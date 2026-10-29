/* ==========================================================================
   TechStack Lab — site.js
   Theme toggle · mobile nav · live search · category filter · TOC ·
   reading progress · consent banner UI · contact form
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Search index (replace with a generated JSON file as the site grows) ---------- */
  var ARTICLES = [
    { t: 'The Real Cost of Multi-Cloud in 2026: Egress, Identity Sprawl, and the Ops Tax', c: 'Cloud Architecture', k: 'multi-cloud egress finops cost aws azure gcp', u: '/article-template.html' },
    { t: 'Zero Trust on AWS: Replacing Your VPN with Identity-Aware Access', c: 'Cybersecurity', k: 'zero trust verified access vpn identity cedar device posture', u: '/article-template.html' },
    { t: 'Platform Engineering vs. DevOps: What Internal Developer Platforms Actually Change', c: 'DevOps', k: 'platform engineering idp golden path backstage portal', u: '/article-template.html' },
    { t: 'Kubernetes Cost Allocation: Building a Showback Model Finance Will Trust', c: 'Cloud Architecture', k: 'kubernetes k8s finops showback chargeback cost', u: '/article-template.html' },
    { t: 'Evaluating RAG Pipelines for Internal Knowledge Bases: A Practical Scorecard', c: 'AI Workflows', k: 'rag llm retrieval evaluation groundedness ai', u: '/article-template.html' },
    { t: 'SSO Tax, SCIM, and Audit Logs: The SaaS Procurement Checklist for Security Teams', c: 'SaaS Tools', k: 'saas sso scim audit logs procurement identity', u: '/article-template.html' },
    { t: 'Passkeys in the Enterprise: Rollout Lessons for Workforce Identity', c: 'Cybersecurity', k: 'passkeys fido2 webauthn mfa identity', u: '/article-template.html' },
    { t: 'Terraform State at Scale: Remote Backends, Locking, and Drift Detection', c: 'DevOps', k: 'terraform iac state drift opentofu', u: '/article-template.html' },
    { t: 'Azure Landing Zones Explained: Management Groups, Policy, and Subscription Vending', c: 'Cloud Architecture', k: 'azure landing zone management groups policy governance', u: '/article-template.html' },
    { t: 'Agentic Workflows in ITSM: Where Automation Helps and Where It Needs a Human', c: 'AI Workflows', k: 'agents itsm automation servicenow ai ticket triage', u: '/article-template.html' }
  ];

  var CATS = { cloud: 'Cloud Architecture', security: 'Cybersecurity', saas: 'SaaS Tools', devops: 'DevOps', ai: 'AI Workflows' };

  /* ---------- Theme ---------- */
  function currentTheme() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  var themeBtn = $('#themeToggle');
  if (themeBtn) {
    var syncLabel = function () {
      var t = currentTheme();
      themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      themeBtn.setAttribute('aria-pressed', String(t === 'dark'));
    };
    syncLabel();
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('tsl-theme', next); } catch (e) {}
      syncLabel();
    });
  }

  /* ---------- Mobile nav ---------- */
  var menuBtn = $('#menuToggle'), nav = $('#primaryNav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  /* ---------- Live search ---------- */
  var input = $('#q'), list = $('#searchResults');
  function escapeHtml(s) { return s.replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return ARTICLES.map(function (a) {
      var hay = (a.t + ' ' + a.c + ' ' + a.k).toLowerCase();
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return null;
        score += a.t.toLowerCase().indexOf(terms[i]) !== -1 ? 3 : 1;
      }
      return { a: a, s: score };
    }).filter(Boolean).sort(function (x, y) { return y.s - x.s; }).slice(0, 6).map(function (r) { return r.a; });
  }
  if (input && list) {
    var active = -1;
    var render = function () {
      var q = input.value.trim();
      if (q.length < 2) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
      var res = search(q);
      active = -1;
      list.innerHTML = res.length
        ? res.map(function (a, i) {
            return '<li role="presentation"><a role="option" id="sr-' + i + '" href="' + a.u + '"><span class="sr-cat">' + escapeHtml(a.c) + '</span><span class="sr-title">' + escapeHtml(a.t) + '</span></a></li>';
          }).join('')
        : '<li class="empty" role="presentation">No results for “' + escapeHtml(q) + '”</li>';
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    var t;
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(render, 80); });
    input.addEventListener('focus', render);
    input.addEventListener('keydown', function (e) {
      var opts = $$('a[role="option"]', list);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!opts.length) return;
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
        opts.forEach(function (o, i) { o.setAttribute('aria-selected', String(i === active)); });
        input.setAttribute('aria-activedescendant', opts[active].id);
      } else if (e.key === 'Enter' && active >= 0 && opts[active]) {
        e.preventDefault(); window.location.href = opts[active].href;
      } else if (e.key === 'Escape') {
        list.hidden = true; input.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search')) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ---------- Homepage: category filter & ?q= results ---------- */
  var grid = $('#articleGrid');
  if (grid) {
    var params = new URLSearchParams(window.location.search);
    var cat = params.get('cat');
    var q = params.get('q');
    var note = $('#filterNote');
    var cards = $$('.card', grid);
    var shown = cards.length;

    if (cat && CATS[cat]) {
      shown = 0;
      cards.forEach(function (c) { var m = c.getAttribute('data-cat') === cat; c.hidden = !m; if (m) shown++; });
      if (note) note.textContent = 'Showing: ' + CATS[cat] + ' · ';
      if (note) note.insertAdjacentHTML('beforeend', '<a href="/index.html">Clear</a>');
      $$('[data-cat-link="' + cat + '"]').forEach(function (a) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); });
    } else if (q) {
      var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      shown = 0;
      cards.forEach(function (c) {
        var text = c.textContent.toLowerCase();
        var m = terms.every(function (t) { return text.indexOf(t) !== -1; });
        c.hidden = !m; if (m) shown++;
      });
      if (input) input.value = q;
      if (note) { note.textContent = shown + ' result' + (shown === 1 ? '' : 's') + ' for “' + q + '” · '; note.insertAdjacentHTML('beforeend', '<a href="/index.html">Clear</a>'); }
    }
    var empty = $('#gridEmpty');
    if (empty) empty.hidden = shown !== 0;
  }

  /* ---------- Article: TOC, read time, progress ---------- */
  var body = $('#articleBody');
  if (body) {
    var heads = $$('h2[id]', body).filter(function (h) { return !h.closest('.key-takeaways'); });
    var tocHtml = '<ol>' + heads.map(function (h) { return '<li><a href="#' + h.id + '">' + escapeHtml(h.textContent) + '</a></li>'; }).join('') + '</ol>';
    $$('[data-toc]').forEach(function (n) { n.innerHTML = tocHtml; });

    // Close the mobile TOC after choosing a section
    $$('.toc-mobile a').forEach(function (a) { a.addEventListener('click', function () { a.closest('details').open = false; }); });

    // Highlight the active section
    if ('IntersectionObserver' in window && heads.length) {
      var links = $$('[data-toc] a');
      var setActive = function (id) {
        links.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('href') === '#' + id); });
      };
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.id); });
      }, { rootMargin: '-80px 0px -70% 0px' });
      heads.forEach(function (h) { io.observe(h); });
    }

    // Read time (~230 wpm)
    var rt = $('#readTime');
    if (rt) {
      var words = body.textContent.trim().split(/\s+/).length;
      rt.textContent = Math.max(1, Math.round(words / 230)) + ' min read';
    }

    // Reading progress bar (rAF-throttled for INP)
    var bar = $('#readProgress');
    if (bar) {
      var ticking = false;
      var update = function () {
        var r = body.getBoundingClientRect();
        var total = r.height - window.innerHeight;
        var pct = total > 0 ? Math.min(100, Math.max(0, (-r.top / total) * 100)) : 0;
        bar.style.width = pct + '%';
        ticking = false;
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      update();
    }
  }

  /* ---------- Consent banner ---------- */
  var banner = $('#consentBanner');
  if (banner && window.TSLAds) {
    var prefs = $('#consentPrefs');
    var customizeBtn = $('#consentCustomize');
    var boxes = { analytics: $('#c-analytics'), ads: $('#c-ads'), personalization: $('#c-personalization') };

    var open = function () {
      var c = window.TSLAds.getConsent();
      if (c) { boxes.analytics.checked = c.analytics; boxes.ads.checked = c.ads; boxes.personalization.checked = c.personalization; }
      banner.hidden = false;
    };
    var close = function () { banner.hidden = true; prefs.hidden = true; customizeBtn.textContent = 'Customize'; };

    if (window.TSLAds.needsBanner()) open();

    boxes.personalization.addEventListener('change', function () { if (boxes.personalization.checked) boxes.ads.checked = true; });
    boxes.ads.addEventListener('change', function () { if (!boxes.ads.checked) boxes.personalization.checked = false; });

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (!btn) return;
      var action = btn.getAttribute('data-consent');
      if (action === 'accept') {
        window.TSLAds.setConsent({ ads: true, personalization: true, analytics: true }); close();
      } else if (action === 'reject') {
        window.TSLAds.setConsent({ ads: false, personalization: false, analytics: false }); close();
      } else if (action === 'customize') {
        if (prefs.hidden) { prefs.hidden = false; btn.textContent = 'Save choices'; boxes.analytics.focus(); }
        else {
          window.TSLAds.setConsent({ ads: boxes.ads.checked, personalization: boxes.personalization.checked, analytics: boxes.analytics.checked });
          close();
        }
      }
    });

    $$('[data-open-consent]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (window.TSLAds.config.useGoogleCMP && window.googlefc && window.googlefc.showRevocationMessage) {
          window.googlefc.showRevocationMessage(); return;
        }
        open(); prefs.hidden = false; customizeBtn.textContent = 'Save choices';
      });
    });
  }

  /* ---------- Shared form submission ---------- */
  var EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
  var SUBMIT_TIMEOUT_MS = 10000;

  // AUDIT FIX: POST bodies only (never PII in URLs), hard timeout, honeypot, and one retry-safe path.
  // Works out of the box on Netlify Forms (data-netlify). On other hosts, set the form's
  // action to your Formspree / Basin / serverless endpoint.
  function postForm(formEl) {
    var hp = formEl.querySelector('[data-honeypot]');
    if (hp && hp.value) return Promise.resolve({ ok: true, bot: true }); // silently drop bots
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, SUBMIT_TIMEOUT_MS) : null;
    return fetch(formEl.getAttribute('action') || '/', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(formEl)).toString(),
      signal: ctrl ? ctrl.signal : undefined,
      credentials: 'same-origin'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r;
    }).finally(function () { if (timer) clearTimeout(timer); });
  }

  function showStatus(el, ok, okText) {
    el.className = 'form-status ' + (ok ? 'form-status--ok' : 'form-status--err');
    if (ok) el.textContent = okText;
    else el.innerHTML = 'We couldn’t send this right now. Please email us directly at <a href="mailto:support@techstacklab.com">support@techstacklab.com</a>.';
    el.hidden = false;
  }

  /* ---------- Contact form ---------- */
  var form = $('#contactForm');
  if (form) {
    var f = form.elements; // use .elements — form.name would return the <form>'s own name attribute
    var status = $('#formStatus');
    var topic = new URLSearchParams(window.location.search).get('topic');
    // Only accept a topic that matches an existing <option> (allow-list, no selector injection)
    if (topic && f.topic) {
      var allowed = Array.prototype.map.call(f.topic.options, function (o) { return o.value; });
      if (allowed.indexOf(topic) !== -1) f.topic.value = topic;
    }

    var setErr = function (name, msg) { var el = $('[data-error-for="' + name + '"]', form); if (el) el.textContent = msg || ''; };
    var busy = false;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return; // AUDIT FIX: block double submits
      var ok = true;
      var name = f.name.value.trim(), email = f.email.value.trim(), msg = f.message.value.trim();
      ['name', 'email', 'message', 'consent'].forEach(function (n) { setErr(n, ''); });
      if (!name || name.length > 100) { setErr('name', 'Please enter your name (up to 100 characters).'); ok = false; }
      if (!EMAIL_RE.test(email) || email.length > 254) { setErr('email', 'Please enter a valid email address.'); ok = false; }
      if (msg.length < 20 || msg.length > 5000) { setErr('message', 'Please write between 20 and 5,000 characters.'); ok = false; }
      if (!f.consent.checked) { setErr('consent', 'Please confirm you have read the Privacy Policy.'); ok = false; }
      if (!ok) return;

      busy = true;
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = 'Sending…';
      postForm(form).then(function () {
        showStatus(status, true, 'Thanks — your message has been sent. We reply to most messages within two business days.');
        form.reset();
      }).catch(function (err) {
        if (window.console) console.error('[contact] submit failed:', err && err.name === 'AbortError' ? 'timeout' : err);
        showStatus(status, false);
      }).finally(function () {
        busy = false; btn.disabled = false; btn.textContent = 'Send message';
      });
    });
  }

  /* ---------- Newsletter form ---------- */
  var nl = $('#newsletterForm');
  if (nl) {
    var nlStatus = $('#newsletterStatus');
    var nlBusy = false;
    nl.addEventListener('submit', function (e) {
      e.preventDefault();
      if (nlBusy) return;
      var email = nl.elements.email.value.trim();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        nlStatus.className = 'form-status form-status--err'; nlStatus.textContent = 'Please enter a valid email address.'; nlStatus.hidden = false; return;
      }
      nlBusy = true;
      var btn = nl.querySelector('button[type="submit"]');
      btn.disabled = true;
      postForm(nl).then(function () {
        showStatus(nlStatus, true, 'Thanks — you’re on the list. You can unsubscribe from any issue.');
        nl.reset();
      }).catch(function (err) {
        if (window.console) console.error('[newsletter] submit failed:', err);
        showStatus(nlStatus, false);
      }).finally(function () { nlBusy = false; btn.disabled = false; });
    });
  }

  /* ---------- Footer year ---------- */
  $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
})();
