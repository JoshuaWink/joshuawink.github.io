// js/filters/check_offline.js — Detect offline status and show a toast.

export class CheckOffline {
  call(payload) {
    const notify = (offline) => {
      if (!offline) return;
      const toast = document.createElement('cup-toast');
      toast.setAttribute('variant', 'warning');
      toast.textContent = 'You are offline. Some features may be limited.';
      document.body.appendChild(toast);
    };

    notify(!navigator.onLine);

    window.addEventListener('offline', () => notify(true));
    window.addEventListener('online', () => {
      const toast = document.createElement('cup-toast');
      toast.setAttribute('variant', 'success');
      toast.textContent = 'Back online.';
      document.body.appendChild(toast);
    });

    return payload.insert('offline_wired', true);
  }
}
