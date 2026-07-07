const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');

const PORT = 38491;
let mainWindow = null;
let server = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = express();

    // __dirname works in both dev and packaged (asar) mode
    srv.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
    srv.use(express.static(path.join(__dirname, 'renderer')));

    server = srv.listen(PORT, '127.0.0.1', () => {
      resolve();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        setTimeout(() => {
          server.close();
          server.listen(PORT, '127.0.0.1');
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'LogViewer',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
}

// ─── IPC Handlers ───

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Log File',
    properties: ['openFile'],
    filters: [
      { name: 'Log Files', extensions: ['log', 'txt', 'logcat', 'out', 'csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);

  return {
    path: filePath,
    name: path.basename(filePath),
    size: stats.size
  };
});

// Normalise a detected/supplied encoding label to one Node understands.
// Returns 'utf-8' as a safe fallback.
function normaliseEncoding(enc) {
  if (!enc || typeof enc !== 'string') return 'utf-8';
  var e = enc.trim().toLowerCase();
  // Common aliases / jschardet outputs
  var map = {
    'ascii': 'utf-8',
    'us-ascii': 'utf-8',
    'utf8': 'utf-8',
    'utf-8': 'utf-8',
    'utf-8-sig': 'utf-8',          // BOM handled separately
    'unicode': 'utf-16le',
    'utf-16': 'utf-16le',
    'utf-16le': 'utf-16le',
    'utf-16be': 'utf-16be',
    'utf-32': 'utf-32le',
    'utf-32le': 'utf-32le',
    'utf-32be': 'utf-32be',
    'gb2312': 'gbk',
    'gb18030': 'gb18030',
    'gbk': 'gbk',
    'big5': 'big5',
    'shift_jis': 'shift_jis',
    'shift-jis': 'shift_jis',
    'sjis': 'shift_jis',
    'euc-jp': 'euc-jp',
    'euc-kr': 'euc-kr',
    'windows-1252': 'windows-1252',
    'iso-8859-1': 'latin1',
    'latin1': 'latin1'
  };
  if (map[e]) return map[e];
  // Pass through if Node claims to support it
  try {
    if (Buffer.isEncoding(e)) return e;
  } catch (_) {}
  return 'utf-8';
}

// Node's fs only supports a small set of encodings directly. For everything
// else (gbk, big5, shift_jis, windows-1252, …) we must decode with iconv-lite.
const NODE_NATIVE_ENCODINGS = new Set([
  'utf-8', 'utf8', 'utf-16le', 'utf16le', 'utf-16be', 'utf16be',
  'latin1', 'binary', 'ascii', 'base64', 'hex'
]);

function decodeBuffer(buf, enc) {
  var text;
  if (NODE_NATIVE_ENCODINGS.has(enc)) {
    text = buf.toString(enc);
  } else if (iconv.encodingExists(enc)) {
    text = iconv.decode(buf, enc);
  } else {
    text = buf.toString('utf-8');
    enc = 'utf-8';
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { text: text, encoding: enc };
}

// Count how much of a decoded string is real CJK / Kana text. Returns a score
// in [0,1] = (cjk+kana chars) / (non-whitespace chars). Used to disambiguate
// encodings that jschardet often confuses (e.g. GBK mis-detected as
// windows-1252, or Japanese mis-detected as Latin).
function cjkScore(text) {
  if (!text) return 0;
  var hit = 0, total = 0;
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if (c === 10 || c === 13 || c === 9 || c === 32) continue; // skip whitespace
    total++;
    // CJK Unified Ideographs + extensions + Compatibility + CJK punct + Fullwidth
    if ((c >= 0x4e00 && c <= 0x9fff) ||
        (c >= 0x3400 && c <= 0x4dbf) ||
        (c >= 0xf900 && c <= 0xfaff) ||
        (c >= 0x3000 && c <= 0x303f) ||
        (c >= 0xff00 && c <= 0xffef) ||
        // Japanese Hiragana / Katakana
        (c >= 0x3040 && c <= 0x30ff) ||
        // Hangul Syllables
        (c >= 0xac00 && c <= 0xd7af)) {
      hit++;
    }
  }
  return total === 0 ? 0 : hit / total;
}

// Re-evaluate jschardet's candidate. jschardet frequently reports a Latin
// encoding (windows-1252 / iso-8859-1) for CJK text. If the Latin candidate
// is weak, probe the common CJK encodings and keep the one that decodes to
// the highest ratio of real CJK/Kana characters.
var CJK_CANDIDATES = ['gb18030', 'gbk', 'big5', 'shift_jis', 'euc-jp', 'euc-kr'];
var WEAK_LATIN = new Set(['windows-1252', 'iso-8859-1', 'iso8859-1', 'latin1', 'cp1252']);

function refineCJK(buf, candidate) {
  var normCandidate = candidate ? normaliseEncoding(candidate) : 'utf-8';
  // If jschardet already said a CJK/Korean/Japanese encoding, trust it.
  if (CJK_CANDIDATES.indexOf(normCandidate) !== -1) return normCandidate;

  // If the candidate is a "weak Latin" encoding (the common mis-detection),
  // or jschardet was unsure, probe the CJK encodings and keep the best.
  var shouldProbeCJK = WEAK_LATIN.has(normCandidate) || normCandidate === 'utf-8';

  if (shouldProbeCJK) {
    var bestEnc = null, bestScore = 0;
    for (var i = 0; i < CJK_CANDIDATES.length; i++) {
      var enc = CJK_CANDIDATES[i];
      if (!iconv.encodingExists(enc)) continue;
      var text;
      try { text = iconv.decode(buf, enc); } catch (_) { continue; }
      // Penalise decodes that produced the Unicode replacement character
      // (indicates invalid byte sequences for this encoding).
      var repl = 0, len = text.length;
      for (var j = 0; j < len; j++) { if (text.charCodeAt(j) === 0xfffd) { repl++; } }
      var score = cjkScore(text) - (len ? (repl / len) * 2 : 0);
      if (score > bestScore) { bestScore = score; bestEnc = enc; }
    }
    // Require a meaningful amount of CJK text before overriding jschardet.
    if (bestEnc && bestScore >= 0.15) return bestEnc;
  }
  return normCandidate;
}

// Unified encoding detection from a raw byte buffer. Handles BOM, then
// jschardet, then a CJK disambiguation pass.
function detectBufferEncoding(buf) {
  try {
    var hasBom = false, bomEncoding = null;
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      hasBom = true; bomEncoding = 'utf-8';
    } else if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      hasBom = true; bomEncoding = 'utf-16le';
    } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
      hasBom = true; bomEncoding = 'utf-16be';
    } else if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xfe && buf[2] === 0x00 && buf[3] === 0x00) {
      hasBom = true; bomEncoding = 'utf-32le';
    } else if (buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0xfe && buf[3] === 0xff) {
      hasBom = true; bomEncoding = 'utf-32be';
    }
    if (bomEncoding) {
      return { encoding: normaliseEncoding(bomEncoding), confidence: 1, hasBom: true, raw: bomEncoding };
    }
    var result = jschardet.detect(buf.toString('binary'));
    var rawEnc = result && result.encoding ? result.encoding : 'utf-8';
    var refined = refineCJK(buf, rawEnc);
    return {
      encoding: refined,
      confidence: result ? result.confidence : 0,
      hasBom: false,
      raw: rawEnc
    };
  } catch (e) {
    return { encoding: 'utf-8', confidence: 0, hasBom: false, error: e.message };
  }
}

// Detect encoding by reading up to 256KB of the file head.
// Handles BOM and falls back to jschardet + CJK disambiguation.
function detectEncoding(filePath) {
  var fd = null;
  try {
    var stats = fs.statSync(filePath);
    var sampleSize = Math.min(stats.size, 256 * 1024);
    if (sampleSize === 0) return { encoding: 'utf-8', confidence: 1, hasBom: false };
    var fd = fs.openSync(filePath, 'r');
    var buf = Buffer.alloc(sampleSize);
    var bytesRead = fs.readSync(fd, buf, 0, sampleSize, 0);
    var sample = buf.slice(0, bytesRead);
    return detectBufferEncoding(sample);
  } catch (e) {
    return { encoding: 'utf-8', confidence: 0, hasBom: false, error: e.message };
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) {} }
  }
}

ipcMain.handle('file:detectEncoding', async (event, filePath) => {
  return detectEncoding(filePath);
});

ipcMain.handle('file:read', async (event, filePath, encoding) => {
  return new Promise((resolve, reject) => {
    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    let loaded = 0;

    // Resolve the encoding to use. When omitted, auto-detect.
    var useEnc = encoding ? normaliseEncoding(encoding) : null;
    if (!useEnc) {
      var det = detectEncoding(filePath);
      useEnc = det.encoding;
    }

    const native = NODE_NATIVE_ENCODINGS.has(useEnc);

    if (native) {
      // Node can decode these directly via a stream with an encoding.
      const chunks = [];
      const stream = fs.createReadStream(filePath, { encoding: useEnc });
      stream.on('data', (chunk) => {
        chunks.push(chunk);
        loaded += Buffer.byteLength(chunk, useEnc);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file:progress', { loaded, total: totalSize });
        }
      });
      stream.on('end', () => {
        var text = chunks.join('');
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        resolve({ text: text, encoding: useEnc });
      });
      stream.on('error', (err) => reject(err.message));
    } else {
      // Non-native encoding: read raw bytes, decode with iconv-lite.
      const chunks = [];
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => {
        chunks.push(chunk);
        loaded += chunk.length;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file:progress', { loaded, total: totalSize });
        }
      });
      stream.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(decodeBuffer(buf, useEnc));
      });
      stream.on('error', (err) => reject(err.message));
    }
  });
});

// Detect encoding from a raw byte buffer (no file path needed).
// Handles BOM, then falls back to jschardet.
function detectEncodingFromBuffer(buf) {
  return detectBufferEncoding(buf);
}

// Read + decode from an in-memory byte buffer (used for drag-drop where the
// File object has no real fs path). Supports encodings Node's fs does not,
// via iconv-lite.
ipcMain.handle('file:readFromBuffer', async (event, payload) => {
  // payload: { buffer, encoding, name }
  const buf = Buffer.isBuffer(payload.buffer)
    ? payload.buffer
    : Buffer.from(payload.buffer); // ArrayBuffer / typed array
  const encoding = payload.encoding;

  var useEnc = encoding && encoding !== 'auto' ? normaliseEncoding(encoding) : null;
  if (!useEnc) {
    var det = detectEncodingFromBuffer(buf);
    useEnc = det.encoding;
  }

  // Decode via decodeBuffer (handles Node-native + iconv-lite encodings).
  var out = decodeBuffer(buf, useEnc);
  return { text: out.text, encoding: out.encoding };
});

ipcMain.handle('file:save', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Filtered Logs',
    defaultPath: defaultName || 'filtered_logcat.txt',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) return false;

  fs.writeFileSync(result.filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('app:getLocale', () => {
  return app.getLocale();
});

// ─── App Lifecycle ───

app.whenReady().then(async () => {
  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});
