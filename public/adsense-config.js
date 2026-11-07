/* ==========================================================================
   TechStack Lab — adsense-config.js
   - Google Consent Mode v2 defaults (denied until the visitor chooses)
   - Lazy-loads the AdSense library after consent + first interaction/idle
   - Lazy-initializes each ad slot ~200px before it enters the viewport
   - Tracks fill state (filled / unfilled) without changing reserved height → no CLS
   - Mobile sticky bottom anchor with close button

   POLICY NOTE — NO AD REFRESH:
   AdSense does not allow publishers to refresh ads on a timer or on scroll
   without a user-initiated content change. Doing so risks the account.
   This file therefore never re-requests an ad in an existing slot.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Configuration — edit these values ---------- */
  var CONFIG = {
    client: 'ca-pub-6723626743879731',          // your AdSense publisher ID (ca-pub- + 16 digits)
    slots: {                                     // ad unit IDs from AdSense → Ads → By ad unit (10 digits)
      header:      '',                           // empty = slot stays reserved but is never requested
      midContent1: '',
      midContent2: '',
      infeed:      '',
      sidebar:     '',
      sticky:      ''
    },
    consentMaxAgeDays: 365,                      // re-ask for consent after this many days (GDPR good practice)
    lazyRootMargin: '200px 0px',                 // start loading this far before a slot is visible
    idleFallbackMs: 3500,                        // load library after this delay if no interaction
    stickyShowAfterPx: 600,                      // reveal mobile anchor after this much scroll
    stickyMaxWidth: 1023,                        // anchor only on viewports at or below this width
    consentStorageKey: 'tsl-consent-v1',
    consentVersion: 1,
    /* Set to true if you use Google's own certified CMP (AdSense → Privacy & messaging).
       Google requires a certified CMP to serve ads to users in the EEA, UK and Switzerland.
       When true, the custom banner stays hidden and Google's message handles consent. */
    useGoogleCMP: true,                          // ON: "TechStack Lab consent" (EEA/UK/CH) and "TechStack Lab US opt-out" are published
    debug: false
  };

  // Regions where consent is required before ad storage (EEA + UK + Switzerland).
  // Used for region-scoped Consent Mode defaults when Google's CMP is in charge.
  var CONSENT_REGIONS = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU',
    'MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH'];

  var log = function () { if (CONFIG.debug && window.console) console.log.apply(console, ['[TSLAds]'].concat([].slice.call(arguments))); };

  // AUDIT FIX: fail closed on placeholder/invalid IDs. Never request ads with a fake publisher ID
  // (invalid requests, console errors, and a malformed account footprint at review time).
  var CLIENT_OK = /^ca-pub-\d{16}$/.test(CONFIG.client);
  var SLOT_RE = /^\d{10}$/;
  if (!CLIENT_OK && window.console) console.warn('[TSLAds] AdSense disabled: CONFIG.client is not a valid publisher ID.');

  /* ---------- 2. Consent Mode v2 defaults (must run before any Google tag) ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var DENIED = {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  };
  if (CONFIG.useGoogleCMP) {
    // Google's CMP collects consent in the EEA/UK/CH and handles US-state opt-outs.
    // Deny by default only where consent is required; elsewhere ads run normally,
    // and the US opt-out message lets visitors in those states opt out.
    gtag('consent', 'default', Object.assign({ region: CONSENT_REGIONS }, DENIED));
    gtag('consent', 'default', {
      ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted',
      analytics_storage: 'granted', functionality_storage: 'granted', security_storage: 'granted'
    });
  } else {
    // Custom banner mode: deny everywhere until the visitor chooses.
    gtag('consent', 'default', DENIED);
    gtag('set', 'ads_data_redaction', true);
  }

  /* ---------- 3. Consent state ---------- */
  function readConsent() {
    try {
      var raw = localStorage.getItem(CONFIG.consentStorageKey);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || c.v !== CONFIG.consentVersion || typeof c.ts !== 'string') return null;
      // AUDIT FIX: consent expires — stale or unparseable timestamps force a fresh choice
      var age = Date.now() - Date.parse(c.ts);
      if (!(age >= 0) || age > CONFIG.consentMaxAgeDays * 864e5) return null;
      return { v: c.v, ads: c.ads === true, personalization: c.personalization === true, analytics: c.analytics === true, ts: c.ts };
    } catch (e) { return null; }
  }

  function writeConsent(c) {
    try { localStorage.setItem(CONFIG.consentStorageKey, JSON.stringify(c)); } catch (e) { /* storage blocked — consent holds for this page view */ }
  }

  // Global Privacy Control (GPC) is honored as an opt-out of ad personalization / "sharing" (CCPA/CPRA)
  var GPC = navigator.globalPrivacyControl === true;

  function applyConsent(c) {
    // AUDIT FIX: GPC overrides personalization without mutating the stored record
    var personalize = c.ads && c.personalization && !GPC;
    gtag('consent', 'update', {
      ad_storage: c.ads ? 'granted' : 'denied',
      ad_user_data: c.ads ? 'granted' : 'denied',
      ad_personalization: personalize ? 'granted' : 'denied',
      analytics_storage: c.analytics ? 'granted' : 'denied'
    });
    gtag('set', 'ads_data_redaction', !c.ads);
    window.adsbygoogle = window.adsbygoogle || [];
    // Non-personalized ads when personalization is not granted
    window.adsbygoogle.requestNonPersonalizedAds = personalize ? 0 : 1;
    log('consent applied', c, 'GPC:', GPC);
  }

  var consent = null;
  if (CONFIG.useGoogleCMP) {
    // Google's CMP owns consent; a choice saved by the old custom banner is ignored.
    if (GPC) {
      // Honour Global Privacy Control as an opt-out of ad personalisation (as the Privacy Policy states)
      gtag('consent', 'update', { ad_personalization: 'denied' });
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.requestNonPersonalizedAds = 1;
    }
  } else {
    consent = readConsent();
    if (consent) applyConsent(consent);
  }

  /* ---------- 4. Library loader (once) ---------- */
  var libState = 'idle'; // idle | loading | ready | failed

  function loadLibrary() {
    if (libState !== 'idle') return;
    if (!CLIENT_OK) { libState = 'failed'; markAll('is-unfilled'); return; }
    if (!CONFIG.useGoogleCMP && !consent) { log('waiting for consent'); return; }
    libState = 'loading';
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CONFIG.client);
    s.onload = function () { libState = 'ready'; log('library ready'); flushQueue(); };
    s.onerror = function () { libState = 'failed'; markAll('is-unfilled'); log('library blocked or failed'); };
    document.head.appendChild(s);
  }

  // Defer the library until the user interacts or the main thread is idle → protects LCP / INP
  var triggered = false;
  function trigger() {
    if (triggered) return;
    triggered = true;
    ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.removeEventListener(ev, trigger, { passive: true }); });
    loadLibrary();
  }
  ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, trigger, { passive: true, once: true }); });
  window.addEventListener('load', function () {
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1); };
    setTimeout(function () { idle(trigger); }, CONFIG.idleFallbackMs);
  });

  /* ---------- 5. Slot rendering ---------- */
  var pending = [];

  function buildIns(slotEl) {
    var key = slotEl.getAttribute('data-ad-key');
    var slotId = CONFIG.slots[key];
    if (!slotId || !SLOT_RE.test(slotId)) { slotEl.classList.add('is-unfilled'); log('no valid slot id for', key); return null; }

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.setAttribute('data-ad-client', CONFIG.client);
    ins.setAttribute('data-ad-slot', slotId);

    var fmt = slotEl.getAttribute('data-ad-format') || 'auto';
    if (fmt === 'fluid-inarticle') {
      ins.style.textAlign = 'center';
      ins.setAttribute('data-ad-layout', 'in-article');
      ins.setAttribute('data-ad-format', 'fluid');
    } else {
      ins.setAttribute('data-ad-format', fmt);
      // Keep the creative inside the reserved box — prevents responsive units from resizing the slot
      ins.setAttribute('data-full-width-responsive', 'false');
    }
    ins.style.display = 'block';
    ins.style.width = '100%';
    ins.style.height = slotEl.clientHeight + 'px';
    return ins;
  }

  function renderSlot(slotEl) {
    if (slotEl.dataset.adState) return;
    // Skip slots that are display:none at this breakpoint (e.g. desktop-only sidebar on mobile)
    if (slotEl.offsetParent === null && !slotEl.closest('.ad-sticky')) return;
    var ins = buildIns(slotEl);
    if (!ins) return;
    slotEl.dataset.adState = 'requested';
    slotEl.appendChild(ins);
    watchFill(slotEl, ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); log('pushed', slotEl.getAttribute('data-ad-key')); }
    catch (e) { slotEl.classList.add('is-unfilled'); log('push error', e); }
  }

  function queue(slotEl) {
    if (libState === 'ready') renderSlot(slotEl);
    else if (libState === 'failed') slotEl.classList.add('is-unfilled');
    else pending.push(slotEl);
  }

  function flushQueue() {
    var list = pending.slice(); pending.length = 0;
    list.forEach(renderSlot);
  }

  // AdSense sets data-ad-status="filled" | "unfilled" on the <ins>
  function watchFill(slotEl, ins) {
    var settled = false;
    var mo = new MutationObserver(function () {
      var status = ins.getAttribute('data-ad-status');
      if (!status) return;
      settled = true;
      var filled = status === 'filled';
      slotEl.classList.toggle('is-filled', filled);
      slotEl.classList.toggle('is-unfilled', !filled);
      slotEl.dataset.adState = status;
      mo.disconnect();
    });
    mo.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    // AUDIT FIX: watchdog — if no fill status arrives (partial ad blocking, network stall),
    // stop the skeleton animation instead of shimmering forever. The observer stays attached,
    // so a late fill still flips the slot to filled. Reserved height never changes → no CLS.
    setTimeout(function () {
      if (settled) return;
      slotEl.classList.add('is-unfilled');
      slotEl.dataset.adState = 'timeout';
      log('fill timeout', slotEl.getAttribute('data-ad-key'));
    }, 10000);
  }

  function markAll(cls) {
    document.querySelectorAll('.ad-slot').forEach(function (s) { s.classList.add(cls); });
  }

  function observeSlots() {
    var slots = document.querySelectorAll('.ad-slot[data-ad-key]:not(.ad-slot--sticky)');
    if (!('IntersectionObserver' in window)) { slots.forEach(queue); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { io.unobserve(entry.target); queue(entry.target); }
      });
    }, { rootMargin: CONFIG.lazyRootMargin });
    slots.forEach(function (s) { io.observe(s); });
  }

  /* ---------- 6. Mobile sticky anchor ---------- */
  function setupSticky() {
    var wrap = document.getElementById('adSticky');
    if (!wrap) return;
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('tsl-sticky-closed') === '1'; } catch (e) {}
    if (dismissed) return;
    var mq = window.matchMedia('(max-width: ' + CONFIG.stickyMaxWidth + 'px)');
    if (!mq.matches) return;

    wrap.hidden = false;
    document.body.classList.add('has-sticky-ad');
    var shown = false;

    function onScroll() {
      if (shown || window.scrollY < CONFIG.stickyShowAfterPx) return;
      shown = true;
      wrap.classList.add('is-visible');
      queue(wrap.querySelector('.ad-slot'));
      window.removeEventListener('scroll', onScroll);
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    wrap.querySelector('.ad-sticky-close').addEventListener('click', function () {
      wrap.classList.remove('is-visible');
      setTimeout(function () { wrap.hidden = true; document.body.classList.remove('has-sticky-ad'); }, 260);
      try { sessionStorage.setItem('tsl-sticky-closed', '1'); } catch (e) {}
    });
  }

  /* ---------- 7. Public API (used by site.js consent banner) ---------- */
  window.TSLAds = {
    config: CONFIG,
    getConsent: function () { return consent; },
    needsBanner: function () { return !CONFIG.useGoogleCMP && !consent; },
    setConsent: function (choice) {
      var hadConsent = !!consent;
      consent = {
        v: CONFIG.consentVersion,
        ads: !!choice.ads,
        personalization: !!choice.ads && !!choice.personalization,
        analytics: !!choice.analytics,
        ts: new Date().toISOString()
      };
      writeConsent(consent);
      applyConsent(consent);
      if (!hadConsent) {
        // First decision on this page view → allow the library to load
        if (triggered) loadLibrary(); else trigger();
      } else if (libState === 'ready') {
        // Ads already requested under the old choice. A reload applies the new choice to every slot.
        log('consent changed after ads loaded — will apply fully on next page view');
      }
    }
  };

  /* ---------- 8. Boot ---------- */
  function boot() { observeSlots(); setupSticky(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
