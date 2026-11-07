#!/usr/bin/env python3
"""
Generates the site's raster images with a headless browser (Playwright + Chromium):
  public/assets/logo-600x60.png          publisher logo (structured data)
  public/assets/og-default.png           default social share image, 1200x630
  public/assets/covers/<slug>-<size>.png per-article covers: 1200x675, 1200x900, 1200x1200, 1200x630

Run after adding or retitling an article:  python3 scripts/make_images.py
"""
import asyncio
import html
import json
import pathlib
import re

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
OUT = PUBLIC / "assets"
FONTS = (PUBLIC / "fonts").as_uri()

COLORS = {  # matches .art--* in styles.css
    "cloud": ("#12244a", "#3a6fd8"), "security": ("#3a150b", "#d4562f"), "saas": ("#24164a", "#8a63d6"),
    "devops": ("#06333a", "#17a7b2"), "ai": ("#382008", "#d68a2a"),
}
LABELS = {"cloud": "Cloud architecture", "security": "Cybersecurity", "saas": "SaaS tools", "devops": "DevOps", "ai": "AI workflows"}
SIZES = [(1200, 675), (1200, 900), (1200, 1200), (1200, 630)]

BASE_CSS = f"""
@font-face {{ font-family: Plex; font-weight: 400; src: url("{FONTS}/ibm-plex-sans-latin-400-normal.woff2"); }}
@font-face {{ font-family: Plex; font-weight: 600; src: url("{FONTS}/ibm-plex-sans-latin-600-normal.woff2"); }}
@font-face {{ font-family: Plex; font-weight: 700; src: url("{FONTS}/ibm-plex-sans-latin-700-normal.woff2"); }}
* {{ margin: 0; box-sizing: border-box; }}
body {{ font-family: Plex, sans-serif; }}
"""

MARK = ('<svg viewBox="0 0 32 32" width="{s}" height="{s}"><rect x="2" y="2" width="28" height="28" rx="7" fill="#0f766e"/>'
        '<path d="M9 11h14M9 16h10M9 21h6" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>')


def cover_html(title, section, w, h):
    c1, c2 = COLORS[section]
    pad = 72 if w == h or h >= 900 else 64
    size = 64 if h >= 900 else 54
    return f"""<html><head><style>{BASE_CSS}
body {{ width:{w}px; height:{h}px; color:#fff; padding:{pad}px; display:flex; flex-direction:column; justify-content:space-between;
  background: radial-gradient(70% 110% at 100% 0%, {c2}cc, transparent 62%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 1px, transparent 1px 40px),
    repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, transparent 1px 40px), {c1}; }}
.cat {{ font-size:26px; font-weight:600; opacity:.92; display:flex; align-items:center; gap:12px; }}
.cat:before {{ content:""; width:14px; height:14px; border-radius:3px; background:{c2}; }}
h1 {{ font-size:{size}px; line-height:1.12; font-weight:600; letter-spacing:-.02em; max-width:{w - 2 * pad}px; }}
.brand {{ display:flex; align-items:center; gap:14px; font-size:28px; font-weight:700; letter-spacing:-.02em; }}
.brand span {{ font-weight:400; opacity:.85; }}
</style></head><body>
<div class="cat">{LABELS[section]}</div>
<h1>{html.escape(title)}</h1>
<div class="brand">{MARK.format(s=40)}TechStack <span>Lab</span></div>
</body></html>"""


def og_default_html():
    return f"""<html><head><style>{BASE_CSS}
body {{ width:1200px; height:630px; color:#e8eef5; padding:80px; display:flex; flex-direction:column; justify-content:center; gap:28px;
  background: radial-gradient(70% 110% at 100% 0%, #0f766ecc, transparent 62%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, transparent 1px 40px),
    repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, transparent 1px 40px), #0e1a2b; }}
.brand {{ display:flex; align-items:center; gap:22px; font-size:76px; font-weight:700; letter-spacing:-.03em; color:#fff; }}
.brand span {{ font-weight:400; color:#6fd6c9; }}
p {{ font-size:34px; line-height:1.35; max-width:900px; color:#c3d0de; }}
</style></head><body>
<div class="brand">{MARK.format(s=84)}TechStack <span>Lab</span></div>
<p>Source-checked guides to enterprise cloud, security, DevOps, SaaS and AI workflows.</p>
</body></html>"""


def logo_html():
    return f"""<html><head><style>{BASE_CSS}
body {{ width:600px; height:60px; background:#fff; display:flex; align-items:center; gap:14px; padding:0 8px; }}
.t {{ font-size:34px; font-weight:700; letter-spacing:-.02em; color:#0e1a2b; }}
.t span {{ font-weight:400; color:#0f766e; }}
</style></head><body>{MARK.format(s=44)}<div class="t">TechStack <span>Lab</span></div></body></html>"""


def articles():
    for p in sorted((ROOT / "content" / "articles").glob("*.html")):
        m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->", p.read_text(encoding="utf-8"), re.S)
        yield json.loads(m.group(1))


async def shot(page, markup, path, w, h):
    await page.set_viewport_size({"width": w, "height": h})
    # Load from a file:// URL: pages created with set_content() may not load file:// fonts.
    tmp = OUT / "_render.html"
    tmp.write_text(markup, encoding="utf-8")
    await page.goto(tmp.as_uri())
    await page.evaluate("document.fonts.ready")
    tmp.unlink()
    path.parent.mkdir(parents=True, exist_ok=True)
    await page.screenshot(path=str(path), clip={"x": 0, "y": 0, "width": w, "height": h})


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await shot(page, logo_html(), OUT / "logo-600x60.png", 600, 60)
        await shot(page, og_default_html(), OUT / "og-default.png", 1200, 630)
        n = 2
        for a in articles():
            for w, h in SIZES:
                await shot(page, cover_html(a["title"], a["section"], w, h), OUT / "covers" / f"{a['slug']}-{w}x{h}.png", w, h)
                n += 1
        await browser.close()
    compress()
    print(f"wrote {n} images to {OUT}")


def compress():
    # 128-colour palette with dithering: about 80% smaller, no visible banding on these designs
    from PIL import Image
    for f in OUT.rglob("*.png"):
        Image.open(f).convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT,
                                               dither=Image.Dither.FLOYDSTEINBERG).save(f, optimize=True)


asyncio.run(main())
