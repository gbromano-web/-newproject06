# TechStack Lab — Phase 1: Business, Content & Monetization Strategy

**Brand:** TechStack Lab · **Domain:** techstacklab.site
**Focus:** Enterprise IT, Cloud Architecture, Cybersecurity, B2B SaaS, DevOps, AI workflow integration.

> Honest framing: no structure or template can *guarantee* AdSense approval. Google reviews the
> site's actual content, originality, navigation and policy compliance. What this plan does is remove
> every avoidable reason for rejection and put the site in the strongest possible position.

---

## 1. Niche positioning

**Why this niche pays:** advertisers in cloud, security and B2B SaaS sell high-ACV contracts, so
they bid aggressively on decision-maker audiences (IT managers, architects, CISOs, platform teams).
Keyword clusters such as cloud cost management, SIEM/XDR, identity & access management,
backup/DR, data platforms, and ITSM routinely carry far higher CPCs than consumer tech.

**Audience:** practitioners and buyers — cloud/platform engineers, security engineers, IT directors,
and SaaS procurement owners at mid-market and enterprise companies.

**Editorial angle (the differentiator):** *"Field-tested guidance for people who run production."*
Every article answers an operational or buying question with something original: an architecture
diagram, a decision matrix, a cost model, a configuration snippet, or a migration plan. This is
what separates TechStack Lab from rewritten vendor press releases — and it is exactly what the
AdSense "low value content" review looks for.

### Content mix (target ratio)
| Type | Share | Purpose |
|---|---|---|
| Deep guides / tutorials (1,800–3,500 words) | 45% | EEAT, evergreen search traffic, high ad viewability |
| Comparisons & buyer's guides ("X vs Y", "Best X for Y") | 25% | Highest commercial intent → highest RPM |
| Analysis & news commentary (with original take) | 20% | Freshness, return visitors, Discover traffic |
| Checklists / templates / calculators | 10% | Links, bookmarks, repeat visits |

---

## 2. Content silo architecture (EEAT-first)

Five silos, each with one **pillar page** and 8–15 **cluster articles** linking up to the pillar
and sideways to siblings. Cross-silo links only where genuinely relevant.

```
techstacklab.site/
├── cloud-architecture/            PILLAR: The Enterprise Cloud Architecture Handbook
│   ├── multi-cloud-cost-egress-identity
│   ├── azure-landing-zones-explained
│   ├── kubernetes-cost-allocation-showback
│   ├── aws-well-architected-review-checklist
│   └── finops-maturity-model
├── cybersecurity/                 PILLAR: Zero Trust for Real Organizations
│   ├── zero-trust-aws-replace-vpn
│   ├── passkeys-enterprise-rollout
│   ├── siem-vs-xdr-buyers-guide
│   ├── cloud-security-posture-management-compared
│   └── incident-response-runbook-template
├── saas-tools/                    PILLAR: The B2B SaaS Buyer's Playbook
│   ├── saas-security-procurement-checklist (SSO, SCIM, audit logs)
│   ├── itsm-platforms-compared
│   ├── saas-management-platforms
│   └── contract-negotiation-for-it-buyers
├── devops/                        PILLAR: Platform Engineering Field Guide
│   ├── platform-engineering-vs-devops
│   ├── terraform-state-at-scale
│   ├── gitops-argo-vs-flux
│   └── dora-metrics-without-the-theater
└── ai-workflows/                  PILLAR: AI in Enterprise Operations
    ├── rag-evaluation-scorecard
    ├── agentic-workflows-itsm
    ├── llm-gateway-architecture
    └── ai-governance-policy-template
```

### EEAT signals to build in from day one
1. **Real, named authors** with bio pages, LinkedIn/GitHub links and relevant experience.
   *(The sample author names in the templates are placeholders — replace them with real
   contributors. Invented credentials are a trust and policy risk.)*
2. **Editorial guidelines page** (included in About) — sourcing, testing methodology,
   corrections policy, AI-assistance disclosure, advertising/editorial separation.
3. **"Last reviewed" dates** and a visible changelog on evergreen guides.
4. **Original artifacts** in every article: diagrams, config snippets, tables, cost models.
5. **Primary sources**: link to vendor docs, RFCs, NIST/CISA publications, official pricing pages.
6. **Clear site identity**: About, Contact with a real reachable address, Privacy, Terms.

### Pre-application checklist
- 25–35 published, original articles (minimum 1,200 words each, most 1,800+), spread across all 5 silos.
- Every nav link resolves to real content — no empty categories, no "coming soon" pages.
- Site live on the root domain with HTTPS for ~2–4 weeks with some organic traffic.
- No copied, spun, or unreviewed AI-generated text. AI assistance is fine if a human expert edits,
  verifies and adds original insight — and you disclose it.
- `ads.txt` present at the root, Privacy Policy linked in the footer of every page.
- Sitemap submitted in Google Search Console; pages indexed.

---

## 3. Monetization layout plan

Principle: **fewer, better-placed, fully-reserved units**. Viewability drives RPM more than unit
count, and a cluttered page hurts both Core Web Vitals and approval.

| Zone | Page | Unit | Reserved height | Why |
|---|---|---|---|---|
| **Header** (below nav / after hero) | Home, Article | Responsive horizontal | 100px mobile / 90px desktop | High viewability without pushing the H1 below the fold |
| **Mid-content #1** | Article (after section 2) | In-article display | 280px | Readers are engaged; consistently top-viewability placement |
| **Mid-content #2** | Article (after section 4, only if >1,800 words) | In-article display | 280px | Second engaged-read placement on long guides |
| **In-feed** | Home grid (after 3rd card) | Display in a card-shaped slot | 250px | Blends into rhythm, clearly labeled |
| **Sidebar sticky** | Home, Article (desktop ≥1024px) | 300×600 / 300×250 | 600px | Stays in view as the reader scrolls — strong time-in-view |
| **Sticky bottom anchor** | Mobile only, after 600px scroll | 320×50 | fixed (no CLS) | Persistent mobile viewability; user-closable |

Rules baked into the code:
- Every slot has an **"Advertisement" label** and a **fixed reserved height** (CLS ≈ 0).
- Ads never sit adjacent to navigation, buttons or download links (accidental-click policy).
- Ads are **lazy-initialized** 200px before entering the viewport.
- **No ad refresh.** The original brief asked for "ad refresh on scroll" — AdSense policy prohibits
  refreshing ads without user-initiated content change, so the code deliberately does not do it.
  If you later want refresh, that requires Google Ad Manager with properly declared refresh.
- Alternative: you can switch on **Auto ads** for anchor/vignette formats only and keep these
  manual units for in-content placements.
