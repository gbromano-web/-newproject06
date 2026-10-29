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
    client: 'ca-pub-XXXXXXXXXXXXXXXX',          // your AdSense publisher ID
    slots: {                                     // ad unit IDs from AdSense → Ads → By ad unit
      header:      '1111111111',
      midContent1: '2222222222',
      midContent2: '3333333333',
      infeed:      '4444444444',
      sidebar:     '5555555555',
      sticky:      '6666666666'
    },
    lazyRootMargin: '200px 0px',                 // start loading this far before a slot is visible
    idleFallbackMs: 3500,                        // load library after this delay if no interaction
    stickyShowAfterPx: 600,                      // reveal mobile anchor after this much scroll
    stickyMaxWidth: 1023,                        // anchor only on viewports at or below this width
    consentStorageKey: 'tsl-consent-v1',
    consentVersion: 1,
    /* Set to true if you use Google's own certified CMP (AdSense → Privacy & messaging).
       Google requires a certified CMP to serve ads to users in the EEA, UK and Switzerland.
       When true, the custom banner stays hidden and Google's message handles consent. */
    useGoogleCMP: false,
    debug: false
  };

  var log = function () { if (CONFIG.debug && window.console) console.log.apply(console, ['[TSLAds]'].concat([].slice.call(arguments))); };

  /* ---------- 2. Consent Mode v2 defaults (must run before any Google tag) ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);

  /* ---------- 3. Consent state ---------- */
  function readConsent() {
    try {
      var raw = localStorage.getItem(CONFIG.consentStorageKey);
      if (!raw) return null;
      var c = JSON.parse(raw);
      return c && c.v === CONFIG.consentVersion ? c : null;
    } catch (e) { return null; }
  }

  function writeConsent(c) {
    try { localStorage.setItem(CONFIG.consentStorageKey, JSON.stringify(c)); } catch (e) { /* storage blocked — consent holds for this page view */ }
  }

  // Global Privacy Control (GPC) is honored as an opt-out of ad personalization / "sharing" (CCPA/CPRA)
  var GPC = navigator.globalPrivacyControl === true;

  function applyConsent(c) {
    if (GPC) c.personalization = false;
    gtag('consent', 'update', {
      ad_storage: c.ads ? 'granted' : 'denied',
      ad_user_data: c.ads ? 'granted' : 'denied',
      ad_personalization: c.ads && c.personalization ? 'granted' : 'denied',
      analytics_storage: c.analytics ? 'granted' : 'denied'
    });
    gtag('set', 'ads_data_redaction', !c.ads);
    window.adsbygoogle = window.adsbygoogle || [];
    // Non-personalized ads when personalization is not granted
    window.adsbygoogle.requestNonPersonalizedAds = (c.ads && c.personalization) ? 0 : 1;
    log('consent applied', c);
  }

  var consent = readConsent();
  if (consent) applyConsent(consent);

  /* ---------- 4. Library loader (once) ---------- */
  var libState = 'idle'; // idle | loading | ready | failed

  function loadLibrary() {
    if (libState !== 'idle') return;
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
    if (!slotId) { slotEl.classList.add('is-unfilled'); return null; }

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
    var mo = new MutationObserver(function () {
      var status = ins.getAttribute('data-ad-status');
      if (!status) return;
      slotEl.classList.add(status === 'filled' ? 'is-filled' : 'is-unfilled');
      slotEl.dataset.adState = status;
      mo.disconnect();
    });
    mo.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
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
