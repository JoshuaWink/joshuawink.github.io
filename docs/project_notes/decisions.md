# Architectural Decisions — joshuawink.github.io

## 2026-04-21 ADR-001: www subdomain instead of apex
**Status**: Accepted

**Context**: GoDaddy's free Website Builder product is connected to joshuawink.com,
which locks the apex A records (Can't edit / Can't delete). We cannot point the
apex directly at GitHub Pages IPs (185.199.108-111.153).

**Decision**: Use `www.joshuawink.com` as the canonical domain for GitHub Pages.
Set a 301 forwarding rule in GoDaddy to redirect `joshuawink.com` → `https://www.joshuawink.com`.

**Alternatives Considered**:
- Disconnect GoDaddy Website Builder → unlocks A records → use apex directly.
  Blocked by GoDaddy SPA not cooperating with browser automation; requires manual
  account action.
- Use Cloudflare as DNS proxy → can fake apex CNAME via CNAME flattening.
  Requires moving nameservers away from GoDaddy. Unnecessary complexity.

**Consequences**:
- `www.joshuawink.com` is canonical and fully HTTPS-enforced via Let's Encrypt
- `joshuawink.com` redirects via GoDaddy forwarding (301). Forwarding propagation
  can take up to 48 hours.
- To simplify in future: disconnect Website Builder in GoDaddy account, add the
  4 GitHub Pages A records (185.199.108-111.153), delete the CNAME and update
  CNAME file back to `joshuawink.com`.

## 2026-04-21 ADR-002: No build step, static browser runtime only
**Status**: Accepted

**Context**: This is a minimal personal landing page.

**Decision**: Keep the site static and deploy directly from `main`, but allow
browser-side ES modules and vendored cup-ui assets. No bundler, no server, no CI
pipeline is required for deploys.

**Consequences**: Zero deploy infrastructure overhead. Update by editing static
files and pushing.

## 2026-04-21 ADR-003: Homepage is a live GitHub Pages index
**Status**: Accepted

**Context**: The old homepage was a small placeholder with a few hard-coded
links. The requirement changed: joshuawink.com should act as the front door for
every GitHub Pages project published under `joshuawink.github.io/*`, and those
projects should be searchable.

**Decision**: Build the homepage with local cup-ui assets and a browser-side
pipeline that scans GitHub repos for `has_pages = true`, normalizes project URLs,
and renders both a searchable dropdown and a project grid.

**Alternatives Considered**:
- Hard-code links in `index.html`.
  Rejected because the list drifts immediately.
- Add a server or build step that generates JSON.
  Rejected because this site already fits the GitHub Pages static-hosting model.

**Consequences**:
- The homepage stays current as new Pages-enabled repos appear.
- The GitHub API can fail or rate-limit, so the site ships with a seeded fallback list.
- cup-ui is now a real dependency of the homepage, so the local vendored copy in
  `cup-ui/` must stay in sync when the design system changes.
