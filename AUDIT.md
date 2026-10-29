# TechStack Lab — Pre-Production Audit

**Date:** 2026-10-29 · **Scope:** all files in this repository (static HTML/CSS/JS site, hosting config, ads.txt, compliance pages)
**Not applicable:** Pillar 4 (no database, migrations or server-side state) and server health checks (static hosting).

## 🚦 Pre-Production Verdict

🔴 **REJECT (Block Deployment)** — for the code as originally submitted.

All code-level blockers are now patched and regression-tested. One blocker remains that only the site owner can close: real publisher IDs, real author identities, business address and governing-law jurisdiction. `scripts/preflight.sh` enforces this and fails the production build until they are supplied.

---

## 🚨 Critical / Blocker Issues

**1. Placeholder AdSense publisher and ad-unit IDs would ship live** — ✅ code fixed, ⏳ owner input needed
- **Pillar:** Deployment Safety / Compliance
- **Location:** `adsense-config.js` (`CONFIG.client`, `CONFIG.slots`), `<meta name="google-adsense-account">` in every page, `ads.txt`
- **Impact:** Every page view fires ad requests with an invalid publisher ID. This causes console errors, wasted bandwidth, a malformed `ads.txt`, and a broken verification tag during AdSense review.
- **Root Cause:** No validation; the loader trusted whatever string was configured.
- **Fix applied:** The loader now fails closed unless the ID matches `^ca-pub-\d{16}$` and each slot ID matches `^\d{10}$`. Slot IDs now default to empty. `scripts/preflight.sh` runs as the Netlify/Vercel build step and blocks production deploys while placeholders exist (`ALLOW_PLACEHOLDERS=1` allows previews only).

**2. Newsletter sign-up leaked email addresses into URLs** — ✅ fixed
- **Pillar:** Security (PII exposure) / Compliance (GDPR, PDPL)
- **Location:** `index.html` newsletter form (`method="get" action="/contact.html"`), `site.js` email pre-fill
- **Impact:** Subscriber emails ended up in `?email=` query strings. From there they would be written to host access logs and browser history, and sent in `Referer` headers to every third party on the next page, including ad and analytics requests.
- **Root Cause:** A GET form was used to carry personal data.
- **Fix applied:** The form now POSTs through Netlify Forms with a honeypot, validation and a status message. The URL pre-fill code is removed.

**3. Year-long `immutable` cache on un-versioned CSS/JS** — ✅ fixed
- **Pillar:** Deployment & Rollback Safety
- **Location:** `netlify.toml`, `vercel.json`
- **Impact:** Returning visitors would keep stale `styles.css`, `site.js` and `adsense-config.js` for up to a year. Bug fixes, consent changes and rollbacks would never reach them, and HTML and JS could fall out of sync and break the page.
- **Root Cause:** The `immutable` cache header was applied to filenames without content hashes.
- **Fix applied:** Changed to `max-age=0, must-revalidate` (ETag revalidation).

**4. Fabricated identities and unfilled legal fields on public pages** — ⏳ owner input needed (deploy now gated)
- **Pillar:** Compliance & Governance
- **Location:** Bylines and bios (`article-template.html`, `index.html`, `about.html`), `REPLACE-WITH-REAL-PROFILE` links, `[Registered business address]` (`contact.html`), `[your jurisdiction]` (`terms.html`)
- **Impact:** Publishing invented experts misrepresents the publication to readers. It conflicts with Google's misrepresentation policies and undermines the E-E-A-T signals the AdSense review depends on. Terms with no governing law are weak legally.
- **Fix:** Replace these with real contributors and real company details. The preflight gate catches the address, jurisdiction and profile placeholders. Author names can't be machine-checked, so confirm them manually.

---

## ⚠️ High / Medium Risk Improvements

- **Missing security headers** — ✅ added
  - HSTS, `X-Frame-Options: SAMEORIGIN` (clickjacking on an ad-funded site) and `Permissions-Policy` are now set.
  - CSP ships as **Report-Only**, scoped to Google ad domains. Watch console violations for 1–2 weeks, then rename it to `Content-Security-Policy` to enforce.

- **Form requests had no timeout, double-submit guard, or length limits** — ✅ fixed
  - Submits now use a 10s `AbortController` timeout and a re-entrancy guard.
  - Limits: name 100, email 254, message 20–5,000 characters, enforced in both HTML and JS.
  - The honeypot is checked client-side, and failures are logged to the console with context.

- **Consent never expired, and stored records were trusted blindly** — ✅ fixed
  - Consent is re-requested after 365 days.
  - Stored JSON is validated field by field; corrupt or tampered values cause a fresh prompt instead of granting consent.

- **Global Privacy Control mutated the consent record** — ✅ fixed. The GPC opt-out is now applied at signal time without overwriting the visitor's stored choice.

- **Ad skeleton could shimmer forever** — ✅ fixed
  - If AdSense never reports fill status (partial ad blocking, network stall), a 10s watchdog marks the slot unfilled.
  - The fill observer stays attached, so a late fill still renders. Reserved height is unchanged, so there is no layout shift.

- **Privacy Policy omitted UAE law** — ✅ added
  - The operator is UAE-based, so a section on Federal Decree-Law 45/2021 (PDPL) rights was added, noting DIFC/ADGM regimes and the 12-month consent re-prompt.
  - Have a lawyer confirm.

- **No 404 page** — ✅ added (`noindex`, links back into every category).

- **EEA/UK/CH ad serving needs a Google-certified CMP** — ⏳ configuration. Enable AdSense → Privacy & messaging and set `useGoogleCMP: true`. The custom banner is not a certified CMP.

- **Referenced images don't exist** — ⏳ owner input. Missing: `/assets/logo-600x60.png`, `/assets/og-default.png` and article cover images referenced in OG tags and JSON-LD. Until added, social previews break and the Article rich result is invalid.

- **Consent proof is client-side only** — recommendation. `localStorage` holds the choice, but there is no server-side consent record. Google's certified CMP stores a TCF string and covers this for EEA traffic.

---

## ⚡ Performance & Observability Optimization (Nice to Have)

- **Real-user monitoring:** add LCP/CLS/INP reporting (the `web-vitals` library sending to your analytics) to measure Core Web Vitals in the field, not just in lab tests.
- **Error reporting:** add a lightweight `window.onerror` / `unhandledrejection` reporter (e.g. Sentry's free tier) so production JS failures are visible.
- **Cache-busting filenames:** fingerprint asset filenames (`styles.3f9a.css`) via a static site generator so long-lived `immutable` caching can be safely restored.
- **Search index:** generate it at build time; the hand-maintained `ARTICLES` array will drift from real content.
- **Stricter CSP:** move the inline theme script to a hashed or external script so the policy can drop `'unsafe-inline'` for scripts.

---

## 🔄 Rollback & Deployment Readiness Verification

- **Backward Compatibility:** Pass. Consent storage key and version are unchanged, so existing records remain valid (they expire after 12 months). URLs and page structure are unchanged.
- **Rollback Safety:** Pass. Netlify/Vercel deploys are atomic with one-click rollback, and the cache fix ensures rollbacks actually reach returning visitors. No data migrations are involved.
- **Environment Variables Needed:** `ALLOW_PLACEHOLDERS` is optional; set it to `1` on preview deploys only, never in production.

## Regression tests run after patching

| Check | Result |
|---|---|
| AdSense library requested while ID is a placeholder | Not requested ✅ |
| CLS on homepage load | 0 ✅ |
| Newsletter submit leaves URL free of email | ✅ |
| Failed submit shows fallback email message | ✅ |
| 400-day-old consent → banner re-shown | ✅ |
| Corrupt consent JSON → banner re-shown, no crash | ✅ |
| Malicious `?topic=` value rejected, valid one accepted | ✅ |
| Contact validation errors shown on empty submit | 4/4 ✅ |
| JSON-LD parses on every page; HTML well-formed; no duplicate IDs | ✅ |
| JavaScript page errors across all pages | 0 ✅ |
| `preflight.sh` exits 1 with placeholders, 0 with `ALLOW_PLACEHOLDERS=1` | ✅ |
