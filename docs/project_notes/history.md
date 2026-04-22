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
