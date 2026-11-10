#!/usr/bin/env python3
"""
TechStack Lab site generator.

Source of truth:
  content/articles/*.html   one file per guide: a JSON metadata block in <!--meta ... --> plus the body HTML
  content/pages/*.html      static pages (about, contact, privacy, terms, 404): metadata block + main HTML
  templates/partials/*.html shared header, footer, head, consent banner, homepage layout

Output (committed, served by GitHub Pages / Netlify / Vercel):
  public/<section>/<slug>/index.html, public/index.html, public/<page>.html,
  public/sitemap.xml, public/feed.xml, and the search index inside public/site.js

Run:  python3 scripts/build.py
"""
import datetime as dt
import html
import json
import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
CONTENT = ROOT / "content"
PARTIALS = ROOT / "templates" / "partials"

SITE = "https://techstacklab.site"
SITE_NAME = "TechStack Lab"
EMAIL = "gbromano.5bdf@gmail.com"
AUTHOR_NAME = "TechStack Lab editorial team"
TZ = "+04:00"

SECTIONS = {
    "cloud":    {"path": "cloud-architecture", "label": "Cloud architecture"},
    "security": {"path": "cybersecurity",      "label": "Cybersecurity"},
    "saas":     {"path": "saas-tools",         "label": "SaaS tools"},
    "devops":   {"path": "devops",             "label": "DevOps"},
    "ai":       {"path": "ai-workflows",       "label": "AI workflows"},
}

WPM = 230
MID2_MIN_WORDS = 1800  # second in-article ad only on long guides (STRATEGY.md)


# ---------------------------------------------------------------- helpers
def esc(s):
    return html.escape(s, quote=True)


def read_meta(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*", raw, re.S)
    if not m:
        sys.exit(f"{path}: missing <!--meta {{...}} --> block")
    try:
        meta = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        sys.exit(f"{path}: bad metadata JSON: {e}")
    return meta, raw[m.end():].strip()


def words_in(fragment):
    text = re.sub(r"<pre.*?</pre>", " ", fragment, flags=re.S)  # code doesn't count as reading
    text = re.sub(r"<[^>]+>", " ", text)
    return len(html.unescape(text).split())


def fmt_date(iso, year=True):
    d = dt.date.fromisoformat(iso)
    return d.strftime("%b %-d, %Y") if year else d.strftime("%b %-d")


def rfc822(iso):
    d = dt.datetime.fromisoformat(iso + "T08:00:00" + TZ)
    return d.strftime("%a, %d %b %Y %H:%M:%S +0400")


def partial(name):
    return (PARTIALS / name).read_text(encoding="utf-8")


def ad_slot(key, kind, fmt, comment):
    return (f'\n            <!-- AdSense Slot: {comment} -->\n'
            f'            <div class="ad-wrap">\n'
            f'              <span class="ad-label">Advertisement</span>\n'
            f'              <div class="ad-slot ad-slot--{kind}" data-ad-key="{key}" data-ad-format="{fmt}"></div>\n'
            f'            </div>\n')


def configured_slots():
    """Ad unit IDs from public/adsense-config.js (CONFIG.slots). Empty string = no unit yet."""
    js = (PUBLIC / "adsense-config.js").read_text(encoding="utf-8")
    block = re.search(r"slots:\s*\{(.*?)\}", js, re.S).group(1)
    return dict(re.findall(r"(\w+):\s*'([^']*)'", block))


SLOTS = configured_slots()


def strip_unconfigured_ads(page):
    """Remove ad boxes whose unit ID is not set yet, so visitors and AdSense reviewers
    never see empty 'Advertisement' placeholders. Add the 10-digit ID in adsense-config.js
    and rebuild to bring a slot back. (Auto ads, if enabled in AdSense, need no slots.)"""
    for key, unit in SLOTS.items():
        if re.fullmatch(r"\d{10}", unit):
            continue
        page = re.sub(
            r'(?:[ \t]*<!-- AdSense Slot:[^\n]*-->\n)?[ \t]*<div class="ad-wrap[^"]*">\s*'
            r'<span class="ad-label">Advertisement</span>\s*'
            rf'<div class="ad-slot[^"]*" data-ad-key="{key}"[^>]*></div>\s*</div>\n?', "", page)
        if key == "sticky":
            page = re.sub(r'(?:[ \t]*<!-- AdSense Slot:[^\n]*-->\n)?[ \t]*<div class="ad-sticky" id="adSticky" hidden>.*?'
                          r'data-ad-key="sticky"[^>]*></div>\s*</div>\n?', "", page, flags=re.S)
    page = re.sub(r'(?:[ \t]*<!-- AdSense Slot:[^\n]*-->\n)?[ \t]*<div class="sidebar-sticky ad-desktop-only">\s*</div>\n?', "", page)
    return page


def write_html(dest, out):
    dest.write_text(strip_unconfigured_ads(out), encoding="utf-8")


def head(title, description, canonical, og_type="website", image=None, extra="", jsonld=None, robots="index, follow, max-image-preview:large"):
    image = image or f"{SITE}/assets/og-default.png"
    ld = ""
    if jsonld:
        ld = '  <script type="application/ld+json">\n' + json.dumps(jsonld, indent=2, ensure_ascii=False) + "\n  </script>\n"
    canon = f'  <link rel="canonical" href="{canonical}">\n' if canonical else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">
{canon}  <meta name="theme-color" content="#0f766e">
  <meta name="robots" content="{robots}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="{SITE_NAME}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{canonical or SITE + '/'}">
  <meta property="og:image" content="{image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
{extra}{partial('head_common.html')}{ld}</head>
<body>
"""


def tail():
    return partial("footer.html") + partial("sticky_consent_scripts.html") + "</body>\n</html>\n"


ORG = {
    "@type": "NewsMediaOrganization",
    "@id": f"{SITE}/#organization",
    "name": SITE_NAME,
    "url": f"{SITE}/",
    "logo": {"@type": "ImageObject", "url": f"{SITE}/assets/icon-512.png", "width": 512, "height": 512},
    "email": EMAIL,
    "publishingPrinciples": f"{SITE}/about.html#editorial",
    "correctionsPolicy": f"{SITE}/about.html#corrections",
    "actionableFeedbackPolicy": f"{SITE}/contact.html",
}


# ---------------------------------------------------------------- articles
def load_articles():
    arts = []
    for p in sorted((CONTENT / "articles").glob("*.html")):
        meta, body = read_meta(p)
        for k in ("slug", "section", "title", "description", "dek", "published", "versions", "sources", "takeaways", "cover_label", "kind", "keywords"):
            if k not in meta:
                sys.exit(f"{p.name}: metadata missing '{k}'")
        if meta["section"] not in SECTIONS:
            sys.exit(f"{p.name}: unknown section {meta['section']}")
        meta["body"] = body
        sec = SECTIONS[meta["section"]]
        meta["path"] = f"/{sec['path']}/{meta['slug']}/"
        meta["url"] = SITE + meta["path"]
        meta["section_label"] = sec["label"]
        meta["versions"] = sorted(meta["versions"], key=lambda v: v["date"])
        meta["modified"] = meta["versions"][-1]["date"]
        meta["version"] = meta["versions"][-1]["v"]
        meta["words"] = words_in(body)
        meta["minutes"] = max(1, round(meta["words"] / WPM))
        meta["h2s"] = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', body)
        if len(meta["h2s"]) < 3:
            sys.exit(f"{p.name}: needs at least 3 <h2 id=...> sections")
        meta["covers"] = {r: f"{SITE}/assets/covers/{meta['slug']}-{r}.png" for r in ("1200x675", "1200x900", "1200x1200", "1200x630")}
        arts.append(meta)
    slugs = [a["slug"] for a in arts]
    if len(slugs) != len(set(slugs)):
        sys.exit("duplicate slugs")
    return sorted(arts, key=lambda a: (a["published"], a["title"]), reverse=True)


def insert_ads(body, words):
    # header slot after the 2nd paragraph; mid #1 before ~40% of sections; mid #2 (long guides) before ~75%
    paras = [m.end() for m in re.finditer(r"</p>", body)]
    h2_starts = [m.start() for m in re.finditer(r"<h2 id=", body)]
    inserts = []
    if len(paras) >= 2 and (not h2_starts or paras[1] <= h2_starts[0] + 10_000):
        inserts.append((paras[1], ad_slot("header", "leaderboard", "horizontal", "Header (in-article after intro · reserved 100px mobile / 90px desktop)")))
    n = len(h2_starts)
    i1 = max(2, math.ceil(n * 0.4))
    if i1 < n:
        inserts.append((h2_starts[i1], ad_slot("midContent1", "inarticle", "fluid-inarticle", "Mid-Content #1 (in-article · reserved 280px)")))
    if words >= MID2_MIN_WORDS:
        i2 = max(i1 + 2, math.ceil(n * 0.75))
        if i2 < n:
            inserts.append((h2_starts[i2], ad_slot("midContent2", "inarticle", "fluid-inarticle", "Mid-Content #2 (long-form only · reserved 280px)")))
    for pos, snippet in sorted(inserts, key=lambda x: x[0], reverse=True):
        body = body[:pos] + snippet + body[pos:]
    return body


def card(a, extra_attrs=True):
    attrs = ""
    if extra_attrs:
        attrs = f' data-cat="{a["section"]}" data-published="{a["published"]}"'
        if a["modified"] != a["published"]:
            attrs += f' data-updated="{a["modified"]}"'
    return f"""            <article class="card"{attrs}>
              <div class="card-art art art--{a['section']}"><div class="card-badges"></div><span class="art-label">{esc(a['cover_label'])}</span></div>
              <div class="card-body">
                <a class="cat cat--{a['section']}" href="/?cat={a['section']}">{a['section_label']}</a>
                <h3 class="card-title"><a href="{a['path']}">{esc(a['title'])}</a></h3>
                <p class="card-dek">{esc(a['description'])}</p>
                <div class="card-meta"><span><time datetime="{a['published']}">{fmt_date(a['published'], year=False)}</time></span><span>{a['minutes']} min read</span></div>
              </div>
            </article>
"""


def related_for(a, arts):
    same = [x for x in arts if x["section"] == a["section"] and x["slug"] != a["slug"]]
    other = [x for x in arts if x["section"] != a["section"]]
    return (same + other)[:4]


def article_page(a, arts):
    toc_ids = a["h2s"]
    body = insert_ads(a["body"], a["words"])
    takeaways = "".join(f"                <li>{t}</li>\n" for t in a["takeaways"])
    sources = "".join(f'              <li><a href="{esc(s["url"])}" rel="noopener" target="_blank">{esc(s["title"])}</a></li>\n' for s in a["sources"])
    history = "".join(
        f'                <li><time datetime="{v["date"]}">{fmt_date(v["date"])}</time><span>{v["note"]}</span></li>\n'
        for v in reversed(a["versions"]))
    is_updated = a["modified"] != a["published"]
    status_badge = (f'<span class="badge badge--updated">Updated {fmt_date(a["modified"], year=False)}</span>' if is_updated
                    else f'<span class="badge badge--new">New</span>')
    related = "".join(card(r, extra_attrs=False) for r in related_for(a, arts))
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "TechArticle",
                "@id": a["url"] + "#article",
                "headline": a["title"],
                "description": a["description"],
                "image": [a["covers"]["1200x675"], a["covers"]["1200x900"], a["covers"]["1200x1200"]],
                "datePublished": f'{a["published"]}T08:00:00{TZ}',
                "dateModified": f'{a["modified"]}T08:00:00{TZ}',
                "author": {"@type": "Organization", "name": AUTHOR_NAME, "url": f"{SITE}/about.html"},
                "publisher": {"@id": f"{SITE}/#organization"},
                "mainEntityOfPage": a["url"],
                "articleSection": a["section_label"],
                "keywords": a["keywords"],
                "wordCount": a["words"],
                "inLanguage": "en",
            },
            ORG,
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE}/"},
                    {"@type": "ListItem", "position": 2, "name": a["section_label"], "item": f"{SITE}/?cat={a['section']}"},
                    {"@type": "ListItem", "position": 3, "name": a.get("short_title", a["title"])},
                ],
            },
        ],
    }
    extra = (f'  <meta property="article:published_time" content="{a["published"]}T08:00:00{TZ}">\n'
             f'  <meta property="article:modified_time" content="{a["modified"]}T08:00:00{TZ}">\n'
             f'  <meta property="article:section" content="{a["section_label"]}">\n'
             '  <link rel="preload" href="/fonts/source-serif-4-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>\n')
    out = head(f'{a["title"]} — {SITE_NAME}', a["description"], a["url"], "article", a["covers"]["1200x630"], extra, ld)
    out += '  <div class="progress" id="readProgress" aria-hidden="true"></div>\n'
    out += partial("header.html")
    out += f"""  <main id="main" class="page">
    <div class="container">
      <div class="layout">
        <article aria-labelledby="article-title">
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li><a href="/">Home</a></li>
              <li><a href="/?cat={a['section']}">{a['section_label']}</a></li>
              <li aria-current="page">{esc(a.get('short_title', a['title']))}</li>
            </ol>
          </nav>

          <header class="article-header">
            <a class="cat cat--{a['section']}" href="/?cat={a['section']}">{a['section_label']} {esc(a['kind'].lower())}</a>
            <h1 class="article-title" id="article-title">{esc(a['title'])}</h1>
            <p class="article-dek">{esc(a['dek'])}</p>
            <div class="article-meta">
              <span class="avatar" aria-hidden="true">TL</span>
              <div class="byline">
                <span>By <strong><a href="/about.html#editorial">{AUTHOR_NAME}</a></strong></span>
                <span>Published <time datetime="{a['published']}">{fmt_date(a['published'])}</time>, <span id="readTime">{a['minutes']} min read</span></span>
              </div>
            </div>
          </header>

          <!-- Living guide: version + review status + changelog (generated from metadata) -->
          <section class="living-guide" aria-label="Guide status">
            <div class="living-guide-head">
              {status_badge}
              <p><strong>Living guide, version {a['version']}.</strong> Sources last checked {fmt_date(a['modified'])}.</p>
            </div>
            <details>
              <summary>What changed in this guide</summary>
              <ol>
{history}              </ol>
            </details>
          </section>

          <details class="toc-mobile">
            <summary>On this page</summary>
            <nav class="toc" aria-label="Table of contents (mobile)" data-toc></nav>
          </details>

          <div class="prose" id="articleBody">
{body}

            <section class="key-takeaways" aria-labelledby="takeaways-heading">
              <h2 id="takeaways-heading">Key takeaways</h2>
              <ul>
{takeaways}              </ul>
            </section>

            <h2 id="sources">Sources and further reading</h2>
            <ul>
{sources}            </ul>

            <p class="updated-note">Spot an error? <a href="/contact.html?topic=correction">Request a correction</a>. Our <a href="/about.html#corrections">corrections policy</a> explains how we handle them.</p>
          </div>

          <aside class="follow-cta" aria-labelledby="follow-heading">
            <div>
              <h2 id="follow-heading">Get notified when this guide changes</h2>
              <p>Vendors change features and pricing often. We log every revision in the guide and in our RSS feed.</p>
            </div>
            <div class="follow-cta-actions">
              <a class="btn" href="/#newsletter">Get updates by email</a>
              <a class="btn btn--ghost" href="/feed.xml">RSS feed</a>
            </div>
          </aside>

          <section class="author-box" aria-labelledby="author-name">
            <span class="avatar avatar--lg" aria-hidden="true">TL</span>
            <div>
              <h2 id="author-name">{AUTHOR_NAME}</h2>
              <p class="role">{SITE_NAME}</p>
              <p>Our guides are researched against vendor documentation, standards and primary sources, which are listed at the end of every guide. Drafts are prepared with AI assistance and checked against those sources before publication. Every revision is logged in the guide's changelog.</p>
              <div class="author-links">
                <a href="/about.html#editorial">Editorial guidelines</a>
                <a href="/contact.html">Contact the team</a>
              </div>
            </div>
          </section>

          <section class="related" aria-labelledby="related-heading">
            <div class="section-head"><h2 id="related-heading">Related guides</h2></div>
            <div class="grid">
{related}            </div>
          </section>
        </article>

        <aside class="sidebar" aria-label="Sidebar">
          <div class="sidebar-sticky">
            <section class="widget ad-desktop-only" aria-labelledby="toc-heading" style="margin-bottom:24px">
              <h2 id="toc-heading">On this page</h2>
              <nav class="toc" aria-label="Table of contents" data-toc></nav>
            </section>

            <!-- AdSense Slot: Sidebar (desktop only · 300x600 · reserved 600px) -->
            <div class="ad-wrap ad-desktop-only">
              <span class="ad-label">Advertisement</span>
              <div class="ad-slot ad-slot--sidebar" data-ad-key="sidebar" data-ad-format="vertical"></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </main>

"""
    out += tail()
    dest = PUBLIC / a["path"].strip("/") / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    write_html(dest, out)
    return dest


# ---------------------------------------------------------------- homepage
def changes(arts):
    rows = []
    for a in arts:
        for i, v in enumerate(a["versions"]):
            rows.append({"date": v["date"], "kind": "new" if i == 0 else "updated", "a": a,
                         "note": a["changelog_summary"] if i == 0 and a.get("changelog_summary") else v["note"]})
    return sorted(rows, key=lambda r: (r["date"], r["kind"] == "updated"), reverse=True)


def homepage(arts):
    tpl = partial("home_main.html")
    featured = next((a for a in arts if a.get("featured")), arts[0])
    rest = [a for a in arts if a is not featured]

    hero = f"""        <div class="hero-body">
          <a class="cat cat--{featured['section']}" href="/?cat={featured['section']}">{featured['section_label']} {esc(featured['kind'].lower())}</a>
          <h1 class="hero-title" id="hero-title">
            <a href="{featured['path']}">{esc(featured['title'])}</a>
          </h1>
          <p class="hero-dek">{esc(featured['dek'])}</p>
          <div class="byline">
            <span>By <strong>{AUTHOR_NAME}</strong></span>
            <span><time datetime="{featured['published']}">{fmt_date(featured['published'])}</time></span>
            <span>{featured['minutes']} min read</span>
          </div>
        </div>
"""
    tpl = re.sub(r'        <div class="hero-body">.*?\n        </div>\n(?=        <div class="hero-art)', lambda m: hero, tpl, count=1, flags=re.S)

    items = []
    for r in changes(arts)[:6]:
        a = r["a"]
        badge = '<span class="badge badge--new">New</span>' if r["kind"] == "new" else '<span class="badge badge--updated">Updated</span>'
        items.append(f"""          <li class="change" data-kind="{r['kind']}" data-date="{r['date']}">
            <time datetime="{r['date']}">{fmt_date(r['date'], year=False)}</time>
            <div class="change-body">
              <div class="change-head">{badge}<a href="{a['path']}">{esc(a['title'])}</a></div>
              <p class="change-note">{r['note']}</p>
            </div>
          </li>
""")
    tpl = re.sub(r'(<ol class="changelog-list">\n).*?(        </ol>)', lambda m: m.group(1) + "".join(items) + m.group(2), tpl, count=1, flags=re.S)

    infeed = """            <!-- AdSense Slot: In-Feed (spans grid · reserved 250px) -->
            <div class="ad-wrap ad-card">
              <span class="ad-label">Advertisement</span>
              <div class="ad-slot ad-slot--infeed" data-ad-key="infeed" data-ad-format="rectangle"></div>
            </div>

"""
    cards = [card(a) for a in rest]
    if len(cards) > 4:
        cards.insert(4, infeed)
    tpl = re.sub(r'(<div class="grid" id="articleGrid">\n).*?(          </div>\n          <p class="empty-state")',
                 lambda m: m.group(1) + "\n".join(cards) + m.group(2), tpl, count=1, flags=re.S)

    picks = [a for a in arts if a.get("start_here")][:5] or arts[:5]
    start = "".join(f'              <li><a href="{a["path"]}">{esc(a["title"])}</a></li>\n' for a in picks)
    tpl = re.sub(r'(<ol class="trending">\n).*?(            </ol>)', lambda m: m.group(1) + start + m.group(2), tpl, count=1, flags=re.S)

    ld = {"@context": "https://schema.org", "@graph": [ORG, {
        "@type": "WebSite", "@id": f"{SITE}/#website", "url": f"{SITE}/", "name": SITE_NAME,
        "publisher": {"@id": f"{SITE}/#organization"}, "inLanguage": "en"}]}
    out = head(f"{SITE_NAME} — Source-checked guides to enterprise cloud, security and SaaS",
               "Source-checked guides on enterprise cloud architecture, cybersecurity, DevOps, B2B SaaS and AI workflows, with a dated changelog for every revision.",
               f"{SITE}/", jsonld=ld)
    out += partial("header.html") + tpl + tail()
    write_html(PUBLIC / "index.html", out)


# ---------------------------------------------------------------- static pages
def static_pages():
    built = []
    for p in sorted((CONTENT / "pages").glob("*.html")):
        meta, main = read_meta(p)
        name = p.name
        canonical = None if name == "404.html" else f"{SITE}/{name}"
        ld = None
        if canonical:
            ld = {"@context": "https://schema.org", "@type": meta.get("type", "WebPage"), "name": meta["name"],
                  "url": canonical, "isPartOf": {"@id": f"{SITE}/#website"}, "publisher": ORG}
        out = head(meta["title"], meta["description"], canonical, jsonld=ld,
                   robots="noindex" if name == "404.html" else "index, follow, max-image-preview:large")
        out += partial("header.html")
        out += f'  <main id="main" class="page">\n    <div class="container">\n{main}\n    </div>\n  </main>\n\n'
        out += tail()
        write_html(PUBLIC / name, out)
        built.append(name)
    return built


# ---------------------------------------------------------------- feeds, sitemap, search
def sitemap(arts, pages):
    today = max(a["modified"] for a in arts)
    urls = [(f"{SITE}/", today)] + [(a["url"], a["modified"]) for a in arts]
    urls += [(f"{SITE}/{p}", today) for p in pages if p != "404.html"]
    body = "".join(f"  <url><loc>{u}</loc><lastmod>{d}</lastmod></url>\n" for u, d in urls)
    (PUBLIC / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "</urlset>\n",
        encoding="utf-8")


def feed(arts):
    rows = changes(arts)[:30]
    items = []
    for r in rows:
        a = r["a"]
        prefix = "New" if r["kind"] == "new" else "Updated"
        v = next(v for v in a["versions"] if v["date"] == r["date"])
        guid = f"techstacklab-{a['slug']}-v{v['v']}"
        items.append(f"""    <item>
      <title>{esc(prefix + ': ' + a['title'])}</title>
      <link>{a['url']}</link>
      <guid isPermaLink="false">{guid}</guid>
      <pubDate>{rfc822(r['date'])}</pubDate>
      <category>{a['section_label']}</category>
      <description>{esc(re.sub('<[^>]+>', '', r['note']))}</description>
    </item>
""")
    last = rfc822(rows[0]["date"])
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{SITE_NAME} — new and updated guides</title>
    <link>{SITE}/</link>
    <atom:link href="{SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Source-checked guides on enterprise cloud, security, DevOps, SaaS and AI workflows, including every revision to existing guides.</description>
    <language>en</language>
    <lastBuildDate>{last}</lastBuildDate>
{''.join(items)}  </channel>
</rss>
"""
    (PUBLIC / "feed.xml").write_text(xml, encoding="utf-8")


def search_index(arts):
    js_path = PUBLIC / "site.js"
    js = js_path.read_text(encoding="utf-8")
    rows = ",\n".join(
        "    " + json.dumps({"t": a["title"], "c": a["section_label"], "k": " ".join(a["keywords"]).lower(), "u": a["path"]}, ensure_ascii=False)
        for a in arts)
    new, n = re.subn(r"var ARTICLES = \[\n.*?\n  \];", lambda m: "var ARTICLES = [\n" + rows + "\n  ];", js, count=1, flags=re.S)
    if n != 1:
        sys.exit("site.js: ARTICLES block not found")
    js_path.write_text(new, encoding="utf-8")


def main():
    arts = load_articles()
    for a in arts:
        article_page(a, arts)
    homepage(arts)
    pages = static_pages()
    sitemap(arts, pages)
    feed(arts)
    search_index(arts)
    print(f"built {len(arts)} articles, {len(pages)} pages")
    for a in arts:
        print(f"  {a['path']:<62} {a['words']:>5} words  v{a['version']}")


if __name__ == "__main__":
    main()
