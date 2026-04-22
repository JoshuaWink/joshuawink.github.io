/**
 * site-shell.js — shared header nav + footer links
 * Injected on every page. Marks active link via pathname.
 */
(function () {
  var path = window.location.pathname;
  var onPortfolio = path.indexOf('portfolio') !== -1;

  // ── Header nav ──────────────────────────────────────────
  var headerNav = document.querySelector('.site-header .site-nav');
  if (headerNav) {
    headerNav.innerHTML =
      '<a href="/portfolio.html"' + (onPortfolio ? ' aria-current="page"' : '') + '>Portfolio</a>' +
      '<a href="https://orchestrate.solutions">Orchestrate</a>';
  }

  // ── Footer links ─────────────────────────────────────────
  var footer = document.querySelector('.site-footer');
  if (footer && !footer.querySelector('.site-footer__links')) {
    var nav = document.createElement('nav');
    nav.className = 'site-footer__links';
    nav.setAttribute('aria-label', 'Footer');
    nav.innerHTML =
      '<a href="https://github.com/JoshuaWink">GitHub</a>' +
      '<a href="https://www.linkedin.com/in/joshua-w-0501a587">LinkedIn</a>' +
      '<a href="https://orchestrate.solutions">Orchestrate</a>';
    footer.appendChild(nav);
  }
})();
