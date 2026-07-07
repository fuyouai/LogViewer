/* ═══════════════════════════════════════════
   i18n — Lightweight Internationalization
   ═══════════════════════════════════════════ */

(function() {
  'use strict';

  var messages = {
    en: {
      // App
      'app.title': 'LogViewer',

      // Header
      'header.toggleSidebar': 'Toggle sidebar (Ctrl+B)',
      'header.searchPlaceholder': 'Search message / tag / pid / tid... (Ctrl+F)',
      'header.regexToggle': 'Toggle regex',
      'header.prevMatch': 'Previous match (Shift+Enter)',
      'header.nextMatch': 'Next match (Enter)',
      'header.matches': '{n} matches',
      'header.tooltipFilter': 'Currently: hiding non-matches. Click to show all',
      'header.tooltipShowAll': 'Currently: showing all lines. Click to hide non-matches',
      'header.filter': '🔽 Filter',
      'header.showAll': '👁 Show all',
      'header.export': '📥 Export',
      'header.exportTooltip': 'Export',
      'header.open': '📂 Open',
      'header.encodingTitle': 'Text encoding (change to re-read the file)',
      'header.encodingAuto': 'Auto detect',

      // Tabs
      'tab.untitled': 'Untitled',
      'tab.close': 'Close tab',
      'tab.add': 'Open file in new tab',

      // Sidebar
      'sidebar.levels': 'Log Levels',
      'sidebar.levelAll': 'All',
      'sidebar.levelWEF': 'W+E+F',
      'sidebar.levelEF': 'E+F only',
      'sidebar.tags': 'Tags ({n})',
      'sidebar.filterTags': 'Filter tags...',
      'sidebar.noMatchingTags': 'No matching tags',
      'sidebar.selectAll': 'Select All',
      'sidebar.showAll': 'Show All',
      'sidebar.processes': 'Processes ({n})',
      'sidebar.filterProcesses': 'Filter processes...',
      'sidebar.noMatchingProcesses': 'No matching processes',
      'sidebar.shortcuts': 'Shortcuts',
      'shortcut.search': 'Search',
      'shortcut.toggleSidebar': 'Toggle sidebar',
      'shortcut.clearSearch': 'Clear search',
      'shortcut.nextMatch': 'Next match',
      'shortcut.prevMatch': 'Prev match',

      // Loading
      'loading.parsing': 'Parsing logcat...',
      'loading.detecting': 'Detecting encoding...',
      'loading.openDialog': 'Opening file dialog...',
      'loading.reading': 'Reading {name}...',
      'loading.progress': 'Loading... {pct}% ({mb} MB)',
      'loading.readingFile': 'Reading file...',
      'loading.failed': 'Failed to read file',
      'loading.noPath': 'Cannot re-read: file path unavailable',

      // Drop zone
      'dropzone.text': 'Drag & drop a logcat file here',
      'dropzone.hint': 'Or click the + tab above / Open button',
      'dropzone.open': '📂 Open a file',

      // Raw content
      'raw.warning': '⚠ Could not detect logcat format — Showing raw content',
      'raw.info': 'Could not detect logcat format. Showing raw content (first {max} of {total} lines):',

      // Summary
      'summary.lines': 'lines',
      'summary.filtered': '(filtered from {n})',
      'summary.errors': 'errors',
      'summary.warnings': 'warnings',
      'summary.tags': 'tags',

      // Empty state
      'empty.noMatch': 'No entries match current filters',

      // Language
      'lang.switch': 'Switch to English',
      'lang.current': 'English',

      // Dialogs (main process)
      'dialog.openTitle': 'Open Log File',
      'dialog.logFiles': 'Log Files',
      'dialog.allFiles': 'All Files',
      'dialog.exportTitle': 'Export Filtered Logs',
      'dialog.textFiles': 'Text Files'
    },

    zh: {
      // App
      'app.title': 'LogViewer',

      // Header
      'header.toggleSidebar': '切换侧边栏 (Ctrl+B)',
      'header.searchPlaceholder': '搜索 message / tag / pid / tid... (Ctrl+F)',
      'header.regexToggle': '切换正则表达式',
      'header.prevMatch': '上一个匹配 (Shift+Enter)',
      'header.nextMatch': '下一个匹配 (Enter)',
      'header.matches': '{n} 个匹配',
      'header.tooltipFilter': '当前：隐藏不匹配项。点击显示全部',
      'header.tooltipShowAll': '当前：显示全部行。点击隐藏不匹配项',
      'header.filter': '🔽 过滤',
      'header.showAll': '👁 显示全部',
      'header.export': '📥 导出',
      'header.exportTooltip': '导出',
      'header.open': '📂 打开',
      'header.encodingTitle': '文本编码（切换后会重新读取文件）',
      'header.encodingAuto': '自动识别',

      // Tabs
      'tab.untitled': '未命名',
      'tab.close': '关闭标签页',
      'tab.add': '在新标签页打开文件',

      // Sidebar
      'sidebar.levels': '日志级别',
      'sidebar.levelAll': '全部',
      'sidebar.levelWEF': 'W+E+F',
      'sidebar.levelEF': '仅 E+F',
      'sidebar.tags': '标签 ({n})',
      'sidebar.filterTags': '筛选标签...',
      'sidebar.noMatchingTags': '没有匹配的标签',
      'sidebar.selectAll': '全选',
      'sidebar.showAll': '全部显示',
      'sidebar.processes': '进程 ({n})',
      'sidebar.filterProcesses': '筛选进程...',
      'sidebar.noMatchingProcesses': '没有匹配的进程',
      'sidebar.shortcuts': '快捷键',
      'shortcut.search': '搜索',
      'shortcut.toggleSidebar': '切换侧边栏',
      'shortcut.clearSearch': '清除搜索',
      'shortcut.nextMatch': '下一个匹配',
      'shortcut.prevMatch': '上一个匹配',

      // Loading
      'loading.parsing': '解析日志中...',
      'loading.detecting': '正在识别编码...',
      'loading.openDialog': '正在打开文件对话框...',
      'loading.reading': '正在读取 {name}...',
      'loading.progress': '加载中... {pct}% ({mb} MB)',
      'loading.readingFile': '正在读取文件...',
      'loading.failed': '读取文件失败',
      'loading.noPath': '无法重新读取：文件路径不可用',

      // Drop zone
      'dropzone.text': '将 logcat 文件拖放到这里',
      'dropzone.hint': '或点击上方 + 标签页 / 打开按钮',
      'dropzone.open': '📂 打开文件',

      // Raw content
      'raw.warning': '⚠ 无法识别 logcat 格式 — 显示原始内容',
      'raw.info': '无法识别 logcat 格式。显示原始内容（前 {max} 行，共 {total} 行）：',

      // Summary
      'summary.lines': '行',
      'summary.filtered': '（从 {n} 行中筛选）',
      'summary.errors': '错误',
      'summary.warnings': '警告',
      'summary.tags': '标签',

      // Empty state
      'empty.noMatch': '没有匹配当前筛选条件的日志',

      // Language
      'lang.switch': '切换到中文',
      'lang.current': '中文',

      // Dialogs (main process)
      'dialog.openTitle': '打开日志文件',
      'dialog.logFiles': '日志文件',
      'dialog.allFiles': '所有文件',
      'dialog.exportTitle': '导出筛选后的日志',
      'dialog.textFiles': '文本文件'
    }
  };

  var currentLocale = null;

  function detectLocale() {
    // 1. localStorage 优先
    try {
      var saved = localStorage.getItem('logviewer_locale');
      if (saved && messages[saved]) return saved;
    } catch (e) {}
    // 2. 系统语言
    var lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
  }

  function getLocale() {
    if (!currentLocale) currentLocale = detectLocale();
    return currentLocale;
  }

  function setLocale(locale) {
    if (!messages[locale]) return;
    currentLocale = locale;
    try { localStorage.setItem('logviewer_locale', locale); } catch (e) {}
  }

  function t(key, params) {
    var locale = getLocale();
    var text = (messages[locale] && messages[locale][key]) || messages.en[key] || key;
    if (params) {
      for (var k in params) {
        if (params.hasOwnProperty(k)) {
          text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
        }
      }
    }
    return text;
  }

  // 暴露到全局
  window.__i18n = { t: t, getLocale: getLocale, setLocale: setLocale };
})();
