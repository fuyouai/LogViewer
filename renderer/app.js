/* ═══════════════════════════════════════════════════════
   LogViewer — Electron Renderer (Multi-Tab)
   ═══════════════════════════════════════════════════════ */

const h = React.createElement;
const { useState, useEffect, useRef, useCallback, useMemo, memo } = React;

/* ─── Logcat Parser ─── */
const RE_THREADTIME_YEAR = /^\d{4}-(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.+?)\s*:\s([\s\S]*)$/;
const RE_LONG      = /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)-(\d+)\s+(\S+)\s+\S+\s+([VDIWEF])\s+([\s\S]*)$/;
const RE_LONG_DATE = /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)-(\d+)\s+(\S+)\s+\S+\s+([VDIWEF])\s+([\s\S]*)$/;
const RE_THREADTIME = /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.+?)\s*:\s([\s\S]*)$/;
const RE_BRIEF = /^([VDIWEF])\/(.+?)\(\s*(\d+)\):\s([\s\S]*)$/;
const RE_PROCESS = /^([VDIWEF])\(\s*(\d+)\)\s+(.+?)$/;
const RE_TAG = /^([VDIWEF])\/(.+?):\s([\s\S]*)$/;
const RE_LEVEL_TAG_PID = /^([VDIWEF])\s+(\S+)\s+(\d+)\s*:\s([\s\S]*)$/;
const RE_SINGLE_LEVEL = /^([VDIWEF])\s+([\s\S]+)$/;

function parseLine(line) {
  if (!line || !line.trim()) return null;
  var m;
  m = RE_THREADTIME_YEAR.exec(line);
  if (m) return { date: m[1], time: m[2], pid: m[3], tid: m[4], level: m[5], tag: m[6].trim(), message: m[7] };
  m = RE_LONG_DATE.exec(line);
  if (m) return { date: m[1], time: m[2], pid: m[3], tid: m[4], level: m[6], tag: m[5].trim(), message: m[7] };
  m = RE_LONG.exec(line);
  if (m) return { date: '', time: m[1], pid: m[2], tid: m[3], level: m[5], tag: m[4].trim(), message: m[6] };
  m = RE_THREADTIME.exec(line);
  if (m) return { date: m[1], time: m[2], pid: m[3], tid: m[4], level: m[5], tag: m[6].trim(), message: m[7] };
  m = RE_BRIEF.exec(line);
  if (m) return { date: '', time: '', pid: m[3], tid: '', level: m[1], tag: m[2].trim(), message: m[4] };
  m = RE_PROCESS.exec(line);
  if (m) return { date: '', time: '', pid: m[2], tid: '', level: m[1], tag: '', message: m[3] };
  m = RE_LEVEL_TAG_PID.exec(line);
  if (m) return { date: '', time: '', pid: m[3], tid: '', level: m[1], tag: m[2].trim(), message: m[4] };
  m = RE_TAG.exec(line);
  if (m) return { date: '', time: '', pid: '', tid: '', level: m[1], tag: m[2].trim(), message: m[3] };
  m = RE_SINGLE_LEVEL.exec(line);
  if (m) return { date: '', time: '', pid: '', tid: '', level: m[1], tag: '', message: m[2] };
  return { date: '', time: '', pid: '', tid: '', level: '', tag: '', message: line };
}

function parseLog(text) {
  var lines = text.split('\n');
  var entries = [];
  for (var i = 0; i < lines.length; i++) {
    var e = parseLine(lines[i]);
    if (e) { e.lineNum = i + 1; entries.push(e); }
  }
  return entries;
}

/* ─── Helpers ─── */
var _tabId = 0;
function newTabId() { return ++_tabId; }

function hashCode(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function tagColor(tag) {
  if (!tag) return 'var(--text-muted)';
  return 'hsl(' + (hashCode(tag) % 360) + ', 55%, 68%)';
}

var ROW_H = 20;
var LEVELS = ['V', 'D', 'I', 'W', 'E', 'F'];
var LEVEL_COLORS = { V: 'var(--level-V)', D: 'var(--level-D)', I: 'var(--level-I)', W: 'var(--level-W)', E: 'var(--level-E)', F: 'var(--level-F)' };

function makeTab(fileName) {
  return {
    id: newTabId(),
    fileName: fileName || '',
    entries: [],
    levels: new Set(LEVELS),
    selTags: new Set(),
    tagSearch: '',
    query: '',
    useRegex: false,
    searchMode: 'hide',    // 'hide' = hide non-matches (default), 'highlight' = show all, highlight matches
    activeMatch: -1,       // index into matchIndices, -1 = no selection
    rawText: '',
    charCount: 0
  };
}

/* ═══════════════════════════════════════════
   Virtual List
   ═══════════════════════════════════════════ */
function VirtualList(props) {
  var items = props.items, renderItem = props.renderItem, emptyMsg = props.emptyMsg;
  var scrollToIndex = props.scrollToIndex;
  var ref = useRef(null);
  var _top = useState(0); var top = _top[0], setTop = _top[1];
  var _h = useState(600); var height = _h[0], setHeight = _h[1];

  useEffect(function() {
    var el = ref.current;
    if (!el) return;
    var ro = new ResizeObserver(function(entries) { setHeight(entries[0].contentRect.height); });
    ro.observe(el);
    setHeight(el.clientHeight);
    return function() { ro.disconnect(); };
  }, []);

  useEffect(function() {
    if (ref.current) { ref.current.scrollTop = 0; setTop(0); }
  }, [items.length]);

  // Auto-scroll to a specific row index
  useEffect(function() {
    if (scrollToIndex == null || scrollToIndex < 0 || !ref.current) return;
    var targetTop = scrollToIndex * ROW_H;
    var viewH = ref.current.clientHeight;
    var curTop = ref.current.scrollTop;
    // Only scroll if target is not already visible
    if (targetTop < curTop || targetTop + ROW_H > curTop + viewH) {
      ref.current.scrollTop = targetTop - viewH / 3; // place ~1/3 from top
    }
  }, [scrollToIndex]);

  if (items.length === 0 && emptyMsg) {
    return h('div', { ref: ref, className: 'log-scroll', style: { display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      h('span', { style: { color: 'var(--text-muted)', fontSize: 14 } }, emptyMsg)
    );
  }

  var total = items.length * ROW_H;
  var si = Math.max(0, Math.floor(top / ROW_H) - 5);
  var vc = Math.ceil(height / ROW_H) + 10;
  var ei = Math.min(si + vc, items.length);
  var oy = si * ROW_H;
  var rows = [];
  for (var i = si; i < ei; i++) rows.push(renderItem(items[i], i));

  return h('div', { ref: ref, className: 'log-scroll', onScroll: function(e) { setTop(e.currentTarget.scrollTop); } },
    h('div', { style: { height: total, position: 'relative' } },
      h('div', { style: { position: 'absolute', top: oy, left: 0, right: 0 } }, rows)
    )
  );
}

/* ═══════════════════════════════════════════
   LogLine
   ═══════════════════════════════════════════ */
var LogLine = memo(function LogLine(props) {
  var entry = props.entry, idx = props.idx, searchRe = props.searchRe;
  var isActive = props.isActiveMatch;
  var bg = isActive ? undefined : (idx % 2 === 0 ? 'var(--bg-log-even)' : 'var(--bg-log-odd)');

  function renderMsg() {
    var msg = entry.message;
    if (!searchRe || !msg) return msg;
    try {
      var re = new RegExp(searchRe.source, 'gi');
      var result = [];
      var last = 0;
      var m;
      while ((m = re.exec(msg)) !== null) {
        if (m.index > last) result.push(msg.substring(last, m.index));
        result.push(h('span', { key: last, className: 'search-hl' }, m[0]));
        last = m.index + m[0].length;
        if (m[0].length === 0) { re.lastIndex++; continue; } // avoid infinite loop on zero-length match
      }
      if (last < msg.length) result.push(msg.substring(last));
      if (result.length === 0) return msg;
      return result;
    } catch (e) { return msg; }
  }

  return h('div', { className: 'log-line' + (isActive ? ' active-match' : ''), style: { background: bg } },
    h('span', { className: 'log-timestamp' }, entry.time || entry.date),
    h('span', { className: 'log-pid' }, entry.pid),
    h('span', { className: 'log-tid' }, entry.tid),
    h('span', { className: 'log-level log-level-' + entry.level }, entry.level),
    h('span', { className: 'log-tag', style: { color: tagColor(entry.tag) }, title: entry.tag }, entry.tag),
    h('span', { className: 'log-msg', style: { color: LEVEL_COLORS[entry.level] || 'var(--text-primary)' } }, renderMsg())
  );
});

/* ═══════════════════════════════════════════
   Raw Content Viewer
   ═══════════════════════════════════════════ */
function RawViewer(props) {
  var text = props.text;
  var lines = text.split('\n');
  var maxLines = Math.min(lines.length, 500);

  return h('div', { className: 'log-scroll', style: { padding: '12px' } },
    h('div', { style: { marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 } },
      'Could not detect logcat format. Showing raw content (first ' + maxLines + ' of ' + lines.length + ' lines):'
    ),
    lines.slice(0, maxLines).map(function(line, i) {
      return h('div', { key: i, style: {
        fontFamily: "'SF Mono', Monaco, monospace", fontSize: 12, lineHeight: '20px',
        color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        background: i % 2 === 0 ? 'var(--bg-log-even)' : 'var(--bg-log-odd)', padding: '0 12px'
      }}, line);
    })
  );
}

/* ═══════════════════════════════════════════
   App (Multi-Tab)
   ═══════════════════════════════════════════ */
function App() {
  // ─── Global state ───
  var _tabs = useState([makeTab()]);
  var tabs = _tabs[0], setTabs = _tabs[1];
  var _aid = useState(1);
  var activeId = _aid[0], setActiveId = _aid[1];
  var _l = useState(false); var loading = _l[0], setLoading = _l[1];
  var _p = useState(''); var progress = _p[0], setProgress = _p[1];
  var _sb = useState(true); var sidebar = _sb[0], setSidebar = _sb[1];
  var _dr = useState(false); var dragOver = _dr[0], setDragOver = _dr[1];
  var fileRef = useRef(null);

  // ─── Active tab helpers ───
  function getTab(id) {
    for (var i = 0; i < tabs.length; i++) { if (tabs[i].id === id) return tabs[i]; }
    return tabs[0];
  }

  function updateTab(id, updates) {
    setTabs(function(prev) {
      return prev.map(function(t) {
        if (t.id !== id) return t;
        var next = {};
        for (var k in t) next[k] = t[k];
        for (var k in updates) next[k] = updates[k];
        return next;
      });
    });
  }

  var tab = getTab(activeId);
  var entries = tab.entries;
  var hasData = entries.length > 0;
  var hasRaw = tab.rawText.length > 0;

  // ─── Computed stats ───
  var tagStats = useMemo(function() {
    var s = {};
    entries.forEach(function(e) {
      if (e.tag) {
        if (!s[e.tag]) s[e.tag] = { count: 0, color: tagColor(e.tag) };
        s[e.tag].count++;
      }
    });
    return s;
  }, [entries]);

  var lvStats = useMemo(function() {
    var s = { V: 0, D: 0, I: 0, W: 0, E: 0, F: 0 };
    entries.forEach(function(e) { if (s[e.level] !== undefined) s[e.level]++; });
    return s;
  }, [entries]);

  var visTags = useMemo(function() {
    var all = Object.keys(tagStats).sort(function(a, b) { return tagStats[b].count - tagStats[a].count; });
    var ts = tab.tagSearch || '';
    if (!ts) return all;
    var q = ts.toLowerCase();
    return all.filter(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
  }, [tagStats, tab.tagSearch]);

  var tagSearchVal = tab.tagSearch || '';

  // Store search params as plain values (not RegExp object) to avoid lastIndex issues
  var searchRe = useMemo(function() {
    if (!tab.query) return null;
    try {
      var src = tab.useRegex ? tab.query : tab.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      new RegExp(src); // validate
      return { source: src };
    } catch (e) { return null; }
  }, [tab.query, tab.useRegex]);

  var filtered = useMemo(function() {
    if (!entries.length) return [];
    var mode = tab.searchMode || 'hide';
    var re = searchRe ? new RegExp(searchRe.source, 'gi') : null;
    return entries.filter(function(e) {
      if (!e.level) return true;
      if (!tab.levels.has(e.level)) return false;
      if (tab.selTags.size > 0 && !tab.selTags.has(e.tag)) return false;
      if (re && mode === 'hide') {
        re.lastIndex = 0;
        var inMsg = re.test(e.message);
        re.lastIndex = 0;
        var inTag = re.test(e.tag);
        if (!inMsg && !inTag) return false;
      }
      return true;
    });
  }, [entries, tab.levels, tab.selTags, searchRe, tab.searchMode]);

  // Indices into `filtered` where search matches (for highlight mode navigation)
  var matchIndices = useMemo(function() {
    if (!searchRe || !filtered.length) return [];
    var mode = tab.searchMode || 'hide';
    // In 'hide' mode, every filtered row is a match
    if (mode === 'hide') {
      var all = [];
      for (var i = 0; i < filtered.length; i++) all.push(i);
      return all;
    }
    // In 'highlight' mode, find which rows actually match
    var re = new RegExp(searchRe.source, 'gi');
    var indices = [];
    for (var i = 0; i < filtered.length; i++) {
      re.lastIndex = 0;
      var inMsg = re.test(filtered[i].message);
      re.lastIndex = 0;
      var inTag = re.test(filtered[i].tag);
      if (inMsg || inTag) indices.push(i);
    }
    return indices;
  }, [filtered, searchRe, tab.searchMode]);

  // Reset activeMatch when search/filter changes
  useEffect(function() {
    updateTab(activeId, { activeMatch: -1 });
  }, [tab.query, tab.useRegex, tab.searchMode, tab.levels, tab.selTags]);

  // The index in `filtered` that corresponds to the current activeMatch
  var scrollToFilteredIdx = matchIndices.length > 0 && tab.activeMatch >= 0 && tab.activeMatch < matchIndices.length
    ? matchIndices[tab.activeMatch] : -1;

  function navMatch(dir) {
    if (!matchIndices.length) return;
    var cur = tab.activeMatch;
    var next;
    if (cur < 0) { next = dir > 0 ? 0 : matchIndices.length - 1; }
    else { next = cur + dir; if (next < 0) next = matchIndices.length - 1; if (next >= matchIndices.length) next = 0; }
    updateTab(activeId, { activeMatch: next });
  }

  // ─── File Loading ───
  function loadIntoTab(text, name, targetId) {
    var tid = targetId || activeId;
    setProgress('Parsing logcat...');
    setTimeout(function() {
      var parsed = parseLog(text);
      var hasEntries = parsed.length > 0;
      // Use functional setTabs to ensure we work with the latest state
      setTabs(function(prev) {
        return prev.map(function(t) {
          if (t.id !== tid) return t;
          return {
            id: t.id,
            fileName: name || t.fileName,
            entries: parsed,
            levels: new Set(LEVELS),
            selTags: new Set(),
            tagSearch: '',
            query: '',
            useRegex: false,
            searchMode: 'hide',
            activeMatch: -1,
            rawText: hasEntries ? '' : text,
            charCount: text.length
          };
        });
      });
      setActiveId(tid);
      setLoading(false);
      setProgress('');
    }, 50);
  }

  // ─── Create a new tab and set it active — returns the tab ID ───
  function openNewTab(fileName) {
    var id = newTabId();
    var tab = makeTab(fileName);
    tab.id = id; // ensure the tab uses the same ID
    setTabs(function(prev) { return prev.concat([tab]); });
    setActiveId(id);
    return id;
  }

  function openViaElectron() {
    if (!window.electronAPI) { fileRef.current && fileRef.current.click(); return; }
    setLoading(true);
    setProgress('Opening file dialog...');
    window.electronAPI.openFile().then(function(info) {
      if (!info) { setLoading(false); setProgress(''); return; }
      var id = openNewTab(info.name);
      setProgress('Reading ' + info.name + '...');
      window.electronAPI.onFileProgress(function(p) {
        if (p.total > 0) {
          setProgress('Loading... ' + Math.round((p.loaded / p.total) * 100) + '% (' + (p.loaded / 1024 / 1024).toFixed(1) + ' MB)');
        }
      });
      return window.electronAPI.readFile(info.path).then(function(text) {
        loadIntoTab(text, info.name, id);
      });
    }).catch(function(err) {
      setLoading(false); setProgress('');
    });
  }

  function openViaHTML(file) {
    setLoading(true);
    setProgress('Reading file...');
    var id = openNewTab(file.name);
    setTimeout(function() {
      var reader = new FileReader();
      reader.onprogress = function(e) {
        if (e.lengthComputable) {
          setProgress('Loading... ' + Math.round((e.loaded / e.total) * 100) + '% (' + (e.loaded / 1024 / 1024).toFixed(1) + ' MB)');
        }
      };
      reader.onload = function(e) { loadIntoTab(e.target.result, file.name, id); };
      reader.onerror = function() { setLoading(false); setProgress('Failed to read file'); };
      reader.readAsText(file);
    }, 100);
  }

  function closeTab(id, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (tabs.length <= 1) return; // keep at least one tab
    var idx = -1;
    for (var i = 0; i < tabs.length; i++) { if (tabs[i].id === id) { idx = i; break; } }
    var next = tabs.filter(function(t) { return t.id !== id; });
    setTabs(next);
    if (activeId === id) {
      var newIdx = Math.min(idx, next.length - 1);
      setActiveId(next[newIdx].id);
    }
  }

  // ─── Filter Actions (on active tab) ───
  function toggleLevel(lv) {
    updateTab(activeId, { levels: (function() {
      var next = new Set(tab.levels);
      if (next.has(lv)) next.delete(lv); else next.add(lv);
      return next;
    })() });
  }

  function toggleTag(tag) {
    updateTab(activeId, { selTags: (function() {
      var next = new Set(tab.selTags);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    })() });
  }

  function doExport() {
    var text = filtered.map(function(e) {
      return e.date + ' ' + e.time + ' ' + e.pid + ' ' + e.tid + ' ' + e.level + ' ' + e.tag + ': ' + e.message;
    }).join('\n');
    var name = 'filtered_' + (tab.fileName || 'logcat') + '.txt';
    if (window.electronAPI) { window.electronAPI.saveFile(text, name); }
    else {
      var blob = new Blob([text], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // ─── Keyboard ───
  useEffect(function() {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); document.querySelector('.search-box input')?.focus(); }
      if (e.key === 'Escape') { updateTab(activeId, { query: '' }); document.querySelector('.search-box input')?.blur(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); setSidebar(function(p) { return !p; }); }
      // Enter/Shift+Enter to navigate matches when search input is focused
      if (e.key === 'Enter' && e.target && e.target.closest && e.target.closest('.search-box')) {
        e.preventDefault();
        navMatch(e.shiftKey ? -1 : 1);
      }
    }
    window.addEventListener('keydown', handler);
    return function() { window.removeEventListener('keydown', handler); };
  }, [activeId, matchIndices, tab.activeMatch]);

  // ─── Render ───
  var renderRow = useCallback(function(entry, idx) {
    return h(LogLine, { key: entry.lineNum || idx, entry: entry, idx: idx, searchRe: searchRe, isActiveMatch: idx === scrollToFilteredIdx });
  }, [searchRe, scrollToFilteredIdx]);

  var header = h('div', { className: 'header' },
    h('div', { className: 'header-left' },
      h('button', { className: 'btn', onClick: function() { setSidebar(function(p) { return !p; }); }, title: 'Toggle sidebar (Ctrl+B)', style: { padding: '6px 8px' } }, sidebar ? '◀' : '▶'),
      h('strong', { style: { fontSize: 15, color: 'var(--accent)' } }, 'LogViewer')
    ),
    h('div', { className: 'search-box' },
      h('span', { className: 'search-icon' }, '🔎'),
      h('input', { type: 'text', placeholder: 'Search messages... (Ctrl+F)', value: tab.query || '', onChange: function(e) { updateTab(activeId, { query: e.target.value }); }, disabled: !hasData })
    ),
    h('button', { className: 'regex-toggle' + (tab.useRegex ? ' active' : ''), onClick: function() { updateTab(activeId, { useRegex: !tab.useRegex }); }, title: 'Toggle regex' }, '.* regex'),
    tab.query ? h('div', { className: 'search-nav' },
      h('button', { className: 'search-nav-btn', onClick: function() { navMatch(-1); }, disabled: !matchIndices.length, title: 'Previous match (Shift+Enter)' }, '▲'),
      h('button', { className: 'search-nav-btn', onClick: function() { navMatch(1); }, disabled: !matchIndices.length, title: 'Next match (Enter)' }, '▼')
    ) : null,
    tab.query ? h('span', { className: 'search-match-count' },
      matchIndices.length > 0 && tab.activeMatch >= 0 ? (tab.activeMatch + 1) + '/' + matchIndices.length : matchIndices.length + ' matches'
    ) : null,
    tab.query ? h('button', { className: 'search-mode-btn' + ((tab.searchMode || 'hide') === 'highlight' ? ' active' : ''), onClick: function() { updateTab(activeId, { searchMode: (tab.searchMode || 'hide') === 'hide' ? 'highlight' : 'hide' }); }, title: (tab.searchMode || 'hide') === 'hide' ? 'Currently: hiding non-matches. Click to show all' : 'Currently: showing all lines. Click to hide non-matches' }, (tab.searchMode || 'hide') === 'hide' ? '🔽 Filter' : '👁 Show all') : null,
    h('div', { className: 'header-right' },
      hasData ? h('span', { className: 'stats-badge' }, h('strong', null, filtered.length.toLocaleString()), ' / ' + entries.length.toLocaleString()) : null,
      hasData ? h('button', { className: 'btn', onClick: doExport, title: 'Export' }, '📥 Export') : null,
      h('button', { className: 'btn btn-accent', onClick: openViaElectron }, '📂 Open'),
      h('input', { ref: fileRef, type: 'file', accept: '.log,.txt,.logcat,.out,.csv', style: { display: 'none' }, onChange: function(e) { var f = e.target.files && e.target.files[0]; if (f) openViaHTML(f); e.target.value = ''; } })
    )
  );

  // Tab bar
  var tabBar = h('div', { className: 'tab-bar' },
    tabs.map(function(t) {
      var isActive = t.id === activeId;
      return h('div', {
        key: t.id,
        className: 'tab-item' + (isActive ? ' active' : ''),
        onClick: function() { setActiveId(t.id); }
      },
        h('span', { className: 'tab-name', title: t.fileName || 'Untitled' }, t.fileName || 'Untitled'),
        t.entries.length > 0 ? h('span', { className: 'tab-count' }, t.entries.length.toLocaleString()) : null,
        tabs.length > 1 ? h('button', { className: 'tab-close', onClick: function(e) { closeTab(t.id, e); }, title: 'Close tab' }, '×') : null
      );
    }),
    h('div', { className: 'tab-add', onClick: function() { openViaElectron(); }, title: 'Open file in new tab' }, '+')
  );

  // Sidebar
  var sidebarEl = null;
  if (sidebar) {
    var levelBtns = LEVELS.map(function(lv) {
      return h('button', { key: lv, className: 'level-btn level-' + lv + (tab.levels.has(lv) ? ' active' : ''), onClick: function() { toggleLevel(lv); } },
        lv, h('span', { className: 'count' }, lvStats[lv])
      );
    });

    var tagList = visTags.map(function(tag) {
      return h('label', { key: tag, className: 'tag-item' },
        h('input', { type: 'checkbox', checked: tab.selTags.size === 0 || tab.selTags.has(tag), onChange: function() { toggleTag(tag); } }),
        h('span', { className: 'tag-color-dot', style: { background: tagStats[tag].color } }),
        h('span', { className: 'tag-name', title: tag }, tag),
        h('span', { className: 'tag-count' }, tagStats[tag].count.toLocaleString())
      );
    });

    sidebarEl = h('div', { className: 'sidebar' },
      h('div', { className: 'sidebar-section' },
        h('h3', null, 'Log Levels'),
        h('div', { className: 'level-filters' }, levelBtns),
        h('div', { className: 'tag-actions', style: { marginTop: 8 } },
          h('button', { className: 'tag-action-btn', onClick: function() { updateTab(activeId, { levels: new Set(LEVELS) }); } }, 'All'),
          h('button', { className: 'tag-action-btn', onClick: function() { updateTab(activeId, { levels: new Set(['W','E','F']) }); } }, 'W+E+F'),
          h('button', { className: 'tag-action-btn', onClick: function() { updateTab(activeId, { levels: new Set(['E','F']) }); } }, 'E+F only')
        )
      ),
      hasData ? h('div', { className: 'sidebar-section' },
        h('h3', null, 'Tags (' + Object.keys(tagStats).length + ')'),
        h('input', { className: 'tag-search', type: 'text', placeholder: 'Filter tags...', value: tagSearchVal, onChange: function(e) { updateTab(activeId, { tagSearch: e.target.value }); } }),
        h('div', { className: 'tag-list' },
          tagList.length ? tagList : h('div', { style: { padding: '8px 6px', fontSize: 12, color: 'var(--text-muted)' } }, 'No matching tags')
        ),
        h('div', { className: 'tag-actions' },
          h('button', { className: 'tag-action-btn', onClick: function() { updateTab(activeId, { selTags: new Set(Object.keys(tagStats)) }); } }, 'Select All'),
          h('button', { className: 'tag-action-btn', onClick: function() { updateTab(activeId, { selTags: new Set() }); } }, 'Show All')
        )
      ) : null,
      h('div', { className: 'sidebar-section' },
        h('h3', null, 'Shortcuts'),
        h('div', { style: { fontSize: 12, color: 'var(--text-secondary)', lineHeight: '24px' } },
          h('div', null, h('span', { className: 'kbd' }, 'Ctrl+F'), '  Search'),
          h('div', null, h('span', { className: 'kbd' }, 'Ctrl+B'), '  Toggle sidebar'),
          h('div', null, h('span', { className: 'kbd' }, 'Esc'), '  Clear search'),
          h('div', null, h('span', { className: 'kbd' }, 'Enter'), '  Next match'),
          h('div', null, h('span', { className: 'kbd' }, 'Shift+Enter'), '  Prev match')
        )
      )
    );
  }

  // Main content
  var mainContent;
  if (loading) {
    mainContent = h('div', { className: 'loading-overlay' }, h('div', { className: 'spinner' }), h('div', { className: 'loading-text' }, progress));
  } else if (hasRaw && !hasData) {
    mainContent = [
      h('div', { key: 'raw-info', style: { background: 'var(--bg-header)', borderBottom: '1px solid var(--border)', padding: '10px 16px', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12 } },
        h('span', { style: { color: '#d29922' } }, '⚠ Could not detect logcat format — Showing raw content')
      ),
      h(RawViewer, { key: 'raw', text: tab.rawText })
    ];
  } else if (!hasData) {
    mainContent = h('div', { className: 'drop-zone' + (dragOver ? ' drag-over' : '') },
      h('div', { className: 'drop-zone-icon' }, '📄'),
      h('div', { className: 'drop-zone-text' }, 'Drag & drop a logcat file here'),
      h('div', { className: 'drop-zone-hint' }, 'Or click the + tab above / Open button'),
      h('button', { className: 'btn btn-accent', onClick: openViaElectron }, '📂 Open a file')
    );
  } else {
    var summaryText = filtered.length.toLocaleString() + ' lines';
    if (filtered.length < entries.length) summaryText += ' (filtered from ' + entries.length.toLocaleString() + ')';
    mainContent = [
      h(VirtualList, { key: 'list', items: filtered, renderItem: renderRow, emptyMsg: 'No entries match current filters', scrollToIndex: scrollToFilteredIdx }),
      h('div', { key: 'summary', className: 'log-summary' },
        h('span', null, h('strong', null, summaryText)),
        h('span', { className: 'sep' }, '|'),
        h('span', { style: { color: 'var(--level-E)' } }, lvStats.E + ' errors'),
        h('span', { className: 'sep' }, '|'),
        h('span', { style: { color: 'var(--level-W)' } }, lvStats.W + ' warnings'),
        h('span', { className: 'sep' }, '|'),
        h('span', null, Object.keys(tagStats).length + ' tags')
      )
    ];
  }

  return h('div', { className: 'app' + (!sidebar ? ' sidebar-collapsed' : '') },
    header,
    tabBar,
    sidebarEl,
    h('div', { className: 'log-container', onDragOver: function(e) { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, onDragLeave: function(e) { e.preventDefault(); setDragOver(false); }, onDrop: function(e) { e.preventDefault(); e.stopPropagation(); setDragOver(false); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) openViaHTML(f); } },
      mainContent
    )
  );
}
