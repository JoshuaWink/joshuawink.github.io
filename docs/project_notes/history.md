# Work History — joshuawink.github.io

## 2026-04-21 Initial setup — custom domain on GitHub Pages

**What**: Created repo, enabled GitHub Pages, configured custom domain
`www.joshuawink.com` with HTTPS enforcement.

**Why**: Point joshuawink.com to a personal landing page instead of GoDaddy
parking/Website Builder.

**Steps taken**:
1. Created repo `JoshuaWink/joshuawink.github.io`
2. Created `index.html` (dark landing page with links)
3. Created `CNAME` file containing `www.joshuawink.com`
4. Pushed to `main`, enabled GitHub Pages via repo settings
5. Edited www CNAME in GoDaddy DNS: `joshuawink.com.` → `joshuawink.github.io.`
6. Edited GoDaddy domain forwarding: `joshuawink.com` → `https://www.joshuawink.com` (301)
7. Called `gh api repos/JoshuaWink/joshuawink.github.io/pages -X PUT -F https_enforced=true`
8. Verified: `curl -sI https://www.joshuawink.com` → HTTP/2 200, Server: GitHub.com

**Outcome**: https://www.joshuawink.com is live, TLS cert approved by GitHub/Let's Encrypt.

**Lessons**:
- GoDaddy's Website Builder product locks apex A records. The workaround is
  www-canonical + apex forwarding.
- GitHub Pages Let's Encrypt cert provisions quickly (~minutes) once DNS resolves.
- `gh api` can set `https_enforced` without touching the GitHub UI.

## 2026-04-21 Homepage redesign — cup-ui project index

**What**: Replaced the placeholder landing page with a cup-ui powered homepage
that scans JoshuaWink repos for GitHub Pages, renders a searchable jump box, and
lists every live Pages project as a card.

**Why**: joshuawink.com should be the front door for all live projects under
`joshuawink.github.io/*`, not just a static page with a few manual links.

**Steps taken**:
1. Vendored the minimal `cup-ui` CSS bundle and `cup-ui/docs/cup-pipe.js` into the repo
2. Replaced the old `index.html` with a cup-ui based shell and responsive layout
3. Added `site.css` for the homepage visual system and search dropdown styling
4. Added `site.js` with a browser-side pipeline:
   - seed fallback data
   - live GitHub repo scan
   - URL normalization
   - searchable dropdown rendering
   - project grid rendering
5. Validated locally with `python3 -m http.server` + browser snapshot

**Outcome**: The homepage now discovers 8 live Pages projects and can filter them
instantly from a search box.

**Lessons**:
- GitHub repo metadata (`has_pages`) is enough to build a usable Pages index
  without any server-side code.
- Shipping a seeded fallback list avoids an empty homepage when the GitHub API is
  slow or unavailable.
- Vendoring the design-system assets keeps the Pages repo standalone and deployable.
