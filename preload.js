const { ipcRenderer } = require('electron');

// Override the browser Notification API to forward notifications to Electron's native system
window.addEventListener('DOMContentLoaded', () => {
  const OriginalNotification = window.Notification;

  // Always report that notifications are granted (we handle them natively)
  const NotificationOverride = function (title, options = {}) {
    ipcRenderer.send('show-notification', {
      title,
      body: options.body || '',
      icon: options.icon || null,
    });

    // Return a minimal mock so calling code doesn't break
    this.title = title;
    this.body = options.body || '';
    this.onclick = null;
    this.onclose = null;
    this.onerror = null;
    this.close = () => {};
  };

  NotificationOverride.permission = 'granted';

  NotificationOverride.requestPermission = function () {
    return Promise.resolve('granted');
  };

  Object.defineProperty(window, 'Notification', {
    value: NotificationOverride,
    writable: false,
    configurable: false,
  });

  // Watch the document title for unread-count patterns like "(5) Page Title"
  // and forward the count to the main process so it can update the badge.
  function extractCount(text) {
    const leading = text.match(/^\((\d+)\)/);
    if (leading) return parseInt(leading[1], 10);
    const trailing = text.match(/\((\d+)\)\s*$/);
    if (trailing) return parseInt(trailing[1], 10);
    return 0;
  }

  let lastCount = 0;

  function sendBadgeIfChanged() {
    const count = extractCount(document.title);
    if (count !== lastCount) {
      lastCount = count;
      ipcRenderer.send('set-badge-count', count);
    }
  }

  // Observe <title> changes via MutationObserver on <head>.
  // The observer intentionally runs for the entire window lifetime — disconnecting
  // it would stop badge updates, and the preload context is torn down with the window.
  const titleObserver = new MutationObserver(sendBadgeIfChanged);
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, { childList: true, subtree: true, characterData: true });
  }
  // Also observe <head> in case the <title> element is replaced
  const headEl = document.querySelector('head');
  if (headEl) {
    titleObserver.observe(headEl, { childList: true });
  }

  // Send initial count
  sendBadgeIfChanged();
});
