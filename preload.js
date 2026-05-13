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
});
