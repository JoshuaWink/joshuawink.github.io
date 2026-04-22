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

## 2026-04-21 ADR-002: No build step, no framework
**Status**: Accepted

**Context**: This is a minimal personal landing page.

**Decision**: Single `index.html` with inline styles. No npm, no bundler, no CI.
Push to main → GitHub Pages auto-deploys.

**Consequences**: Zero maintenance overhead. Update by editing `index.html` and pushing.
