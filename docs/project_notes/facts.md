# Project Facts — joshuawink.github.io

## What This Is
Personal landing page served via GitHub Pages at **https://www.joshuawink.com**

## Stack
- **Hosting**: GitHub Pages (free tier)
- **TLS**: Let's Encrypt via GitHub Pages automatic provisioning
- **DNS**: GoDaddy nameservers
- **Repo**: github.com/JoshuaWink/joshuawink.github.io
- **Branch**: `main` (root `/`)
- **Content**: Single `index.html`, no build step, no framework

## Important Files
- `CNAME` — tells GitHub Pages the custom domain (`www.joshuawink.com`)
- `index.html` — the entire site

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
