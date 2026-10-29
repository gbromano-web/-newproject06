# TechStack Lab — Site Package

Static, dependency-free site: semantic HTML5, one CSS file, two small vanilla-JS files.
Strategy and ad-placement plan: see `STRATEGY.md`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Homepage: featured story, article grid with in-feed ad, sidebar (trending, topic pills, newsletter, sticky ad) |
| `article-template.html` | Single-post template: TechArticle/Person/Breadcrumb JSON-LD, TOC, header/mid-content/sidebar/sticky ad slots, author box, related grid |
| `about.html` | About, team, editorial guidelines, corrections policy, advertising independence |
| `contact.html` | Validated contact form (Netlify Forms-ready) + support@techstacklab.com |
| `privacy.html` | Privacy Policy incl. Google AdSense, DoubleClick cookie, Consent Mode, GDPR & CCPA/CPRA |
| `terms.html` | Terms of Service & Disclaimer |
| `styles.css` | Design system: tokens, light/dark, CLS-safe ad reservations, skeleton loaders |
| `adsense-config.js` | Consent Mode v2, lazy AdSense loader, lazy slot init, fill tracking, mobile anchor, GPC support |
| `site.js` | Theme toggle, mobile nav, live search, category filter, TOC, read progress, consent banner UI, contact form |
| `ads.txt`, `robots.txt`, `sitemap.xml` | Crawl + ad-authorization files |
| `netlify.toml`, `vercel.json` | Hosting config: headers, caching, clean article URL rewrite |

## Before you go live — required edits

1. **Publisher ID** — replace `ca-pub-XXXXXXXXXXXXXXXX` in every HTML `<meta name="google-adsense-account">`, in `adsense-config.js` (`CONFIG.client`), and `pub-XXXXXXXXXXXXXXXX` in `ads.txt`.
2. **Ad unit IDs** — after approval, create six display units in AdSense (Ads → By ad unit) and paste their IDs into `CONFIG.slots`.
3. **Authors** — the bylines (Daniel Okafor, Priya Raman, Marcus Lindqvist, Aisha Benali) are sample names. Replace them with real contributors and real profile links (search for `REPLACE`). Do not publish invented people or credentials.
4. **Legal fields** — add your legal entity, business address (`contact.html`, `privacy.html`) and governing-law jurisdiction (`terms.html`). Have the Privacy Policy and Terms reviewed by a lawyer; they are solid templates, not legal advice.
5. **Images** — add `/assets/logo-600x60.png`, `/assets/og-default.png` and article cover images referenced in meta tags and JSON-LD.
6. **Consent in the EEA/UK/Switzerland** — Google requires a Google-certified CMP to serve ads to these visitors. Easiest path: AdSense → Privacy & messaging → create a GDPR message (and a US states message), then set `useGoogleCMP: true` in `adsense-config.js`. The custom banner then stays hidden and the footer "Cookie settings" link reopens Google's message. Keep `false` only if you use another certified CMP wired to the same API.

## Creating new articles

1. Copy `article-template.html` into the silo folder, e.g. `devops/terraform-state-at-scale/index.html`.
2. Update `<title>`, description, canonical, OG tags, all JSON-LD fields, breadcrumb, headline, byline, dates and body.
3. Each `<h2 id="...">` becomes a TOC entry automatically; read time is computed automatically.
4. Delete the **Mid-Content #2** slot on posts under ~1,800 words.
5. Add the article to the `ARTICLES` array in `site.js` (search index), to `index.html`, and to `sitemap.xml`.
6. All internal links use root paths (`/styles.css`, `/about.html`), so pages work at any folder depth.

> Once you pass ~30 articles, consider moving to a static site generator (Eleventy, Astro or Hugo) using these files as the layout — it removes the manual copy step and generates category pages, sitemap and search index for you.

## Local preview

Root-relative paths need a web server (opening the file directly won't load CSS):

```bash
cd techstacklab
npx serve .          # or: python3 -m http.server 8080
```

## Deploy

### Option A — Netlify (recommended: contact form works with zero setup)
1. Push the folder to a GitHub repo.
2. Netlify → **Add new site → Import an existing project** → pick the repo. Build command: *(none)*. Publish directory: `.`
3. **Domain management → Add domain** → `techstacklab.com`, then point DNS at Netlify (or move nameservers). HTTPS is issued automatically.
4. **Forms** → enable form detection; submissions from `contact.html` appear there. Add an email notification to support@techstacklab.com.

### Option B — Vercel
1. Push to GitHub → Vercel **Add New → Project** → import. Framework preset: **Other**, no build command, output directory `.`
2. **Settings → Domains** → add `techstacklab.com` and follow the DNS instructions.
3. Contact form: create a free Formspree form and set the `action` attribute in `contact.html` to `https://formspree.io/f/YOUR_ID`.

### Option C — WordPress
These files are a design reference, not a WP theme. Practical path: use a lightweight block theme (e.g. GeneratePress or Kadence), paste `styles.css` into **Appearance → Customize → Additional CSS** (or a child theme), recreate About/Contact/Privacy/Terms as Pages with the text provided, use **Site Kit by Google** to connect AdSense, and Rank Math or Yoast for schema and sitemaps. Insert ad units with a block-based ad inserter and keep the same placements and reserved heights.

### After deploy
- Google Search Console → add the domain property → submit `https://techstacklab.com/sitemap.xml`.
- Run PageSpeed Insights on the homepage and an article (mobile). Targets: LCP < 2.5s, CLS < 0.1, INP < 200ms.
- Check `https://techstacklab.com/ads.txt` loads as plain text.

## Apply to Google AdSense

1. **Get the content in place first** — 25–35 original, substantive articles across all five categories; every nav link leads to real content (see the checklist in `STRATEGY.md`).
2. Go to **adsense.google.com → Get started**, sign in, enter `techstacklab.com`, choose your country and accept the terms.
3. **Connect your site** — choose the meta tag method (already in every page's `<head>`, just swap in your real ID) or the AdSense code snippet. Click **Verify**.
4. Make sure `ads.txt` contains your real publisher ID.
5. Set up **Privacy & messaging** (GDPR + US states messages) as described above.
6. Click **Request review**. Reviews commonly take from a few days to several weeks. Don't make large structural changes or remove the verification tag while under review.
7. **If rejected**, read the reason (most often "Low value content" or "Site navigation"), fix it — usually by adding depth and originality to articles — and re-apply after a couple of weeks.
8. **After approval** — create the six ad units, paste the IDs into `adsense-config.js`, deploy, then check reports for viewability and RPM per placement after 2–4 weeks before changing anything.

### Policy guardrails built into this package
- No ad refresh (prohibited for AdSense publishers).
- Every ad is labeled "Advertisement" and kept away from nav and buttons (accidental-click policy).
- Ads are not placed on About, Contact, Privacy or Terms.
- Never click your own ads or ask others to; use AdSense's preview tool to check placements.
