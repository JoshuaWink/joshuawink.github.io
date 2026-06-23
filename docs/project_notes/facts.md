# Project Facts — joshuawink.github.io

## What This Is
Personal landing page served via GitHub Pages at **https://www.joshuawink.com**

## Stack
- **Hosting**: GitHub Pages (free tier)
- **TLS**: Let's Encrypt via GitHub Pages automatic provisioning
- **DNS**: GoDaddy nameservers
- **Repo**: github.com/JoshuaWink/joshuawink.github.io
- **Branch**: `main` (root `/`)
- **UI System**: vendored `cup-ui` CSS bundle + browser pipeline runtime
- **Runtime**: browser-side ES modules (`site.js` + `cup-ui/docs/cup-pipe.js`)
- **Data Source**: GitHub REST API (`/users/JoshuaWink/repos`) filtered to repos with `has_pages = true`
- **Content**: static HTML + CSS + JS, no build step, no server

## Important Files
- `CNAME` — tells GitHub Pages the custom domain (`www.joshuawink.com`)
- `index.html` — shell markup for the homepage
- `site.css` — site-specific layout and visual treatment on top of cup-ui
- `site.js` — scans GitHub Pages repos, normalizes URLs, renders dropdown + cards
- `cup-ui/` — local copy of the CSS bundle and `docs/cup-pipe.js` runtime used by the homepage

## Homepage Architecture
1. `index.html` boots immediately with the local cup-ui CSS bundle
2. `site.js` seeds the page with a known Pages list so the homepage is never empty
3. `site.js` then fetches JoshuaWink repos from GitHub and filters to `has_pages = true`
4. URLs are normalized to `https://joshuawink.github.io/<repo>/` unless a repo already provides a matching homepage
5. The page renders:
  - searchable dropdown / jump box
  - live project cards
  - source / scan metadata

This is still fully static hosting. The browser does the scan at runtime.

## DNS Configuration (GoDaddy)

| Type  | Name  | Value                         | TTL    | Editable? |
|-------|-------|-------------------------------|--------|-----------|
| A     | @     | 15.197.225.128                | 1 Hour | ❌ Locked |
| A     | @     | 3.33.251.168                  | 1 Hour | ❌ Locked |
| CNAME | www   | joshuawink.github.io.         | 1 Hour | ✅        |

**Why the A records are locked**: GoDaddy's free Website Builder product is
connected to joshuawink.com. This locks the apex A records. To unlock them,
disconnect the Website Builder product in the GoDaddy account.

## Apex Forwarding (GoDaddy)
`joshuawink.com` → `https://www.joshuawink.com` (Permanent 301)
Set via GoDaddy DNS → Forwarding tab.

## GitHub Pages Settings
- **Custom domain**: www.joshuawink.com
- **HTTPS enforced**: yes
- **TLS cert**: Let's Encrypt, covers `www.joshuawink.com`, expires 2026-07-20
  (auto-renews as long as DNS points to GitHub)

## How HTTPS Works Here
1. `CNAME` file in repo → GitHub Pages reads it and claims the domain
2. GitHub Pages requests a Let's Encrypt cert for the domain automatically
3. Let's Encrypt validates by confirming DNS resolves to GitHub IPs
4. GitHub serves traffic on 443 using the issued cert
5. `https_enforced: true` (set via API) redirects HTTP → HTTPS

No Cloudflare. No CDN. GitHub handles everything.
