// js/filters/wire_theme.js — Toggle dark/light theme via cup-toggle.
// One filter, one job. DOM filter → JS runtime.

export class WireTheme {
  call(payload) {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return payload;

    const apply = (dark) => {
      document.body.dataset.theme = dark ? 'dark' : 'light';

      // Keep browser chrome color synchronized with the active tokenized surface.
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        const surface = getComputedStyle(document.body)
          .getPropertyValue('--cup-color-surface')
          .trim();
        if (surface) meta.content = surface;
      }
    };

    toggle.addEventListener('change', (e) => {
      apply(e.target.checked);
    });

    // Respect system preference on first load
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      toggle.checked = false;
      apply(false);
    } else {
      apply(true);
    }

    return payload.insert('theme_wired', true);
  }
}
