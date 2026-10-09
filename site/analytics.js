/* Meat & Social analytics: the same tags as the live Squarespace site.
 *   Google Tag Manager GTM-W8H2LJHR  (contains GA4 G-G4Y61NP6CQ, plus a GA4 "reservation_start" event and a
 *                                     Meta "InitiateCheckout" event on any click to tables.toasttab.com)
 *   Meta Pixel 4033848116867814      (PageView; Squarespace injected this one outside GTM)
 * Google Consent Mode v2: everything is denied until the visitor accepts in the cookie banner (UK GDPR / PECR).
 * Tags only run on the production domain, so test and preview traffic stays out of the reports. To test on a
 * preview, add ?analytics=1 to the URL (GTM's own preview mode, ?gtm_debug=..., also works).
 * Loaded synchronously in <head> so the consent defaults exist before GTM starts. */
(function () {
  'use strict';
  var CFG = {
    gtm: 'GTM-W8H2LJHR',
    pixel: '4033848116867814',
    hosts: ['meatandsocial.co.uk', 'www.meatandsocial.co.uk'],
    privacy: '/privacy/'
  };
  var w = window, d = document, KEY = 'ms_consent';
  var on = CFG.hosts.indexOf(location.hostname) > -1 || /[?&](analytics=1|gtm_debug=)/.test(location.search);
  try { if (/[?&]analytics=1/.test(location.search)) sessionStorage.setItem('ms_analytics', '1'); if (sessionStorage.getItem('ms_analytics') === '1') on = true; } catch (e) {}

  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = w.gtag || gtag;

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 });
  if (saved === 'granted') gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' });

  w.MSAnalytics = { enabled: on, choice: saved, config: CFG, track: function (event, params) {
    var o = { event: event }; for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) o[k] = params[k];
    w.dataLayer.push(o);
  } };
  if (!on) return;

  // Google Tag Manager
  w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var g = d.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtm.js?id=' + CFG.gtm;
  d.head.appendChild(g);

  // Meta Pixel (consent revoked until accepted)
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(w, d, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  w.fbq('consent', saved === 'granted' ? 'grant' : 'revoke');
  w.fbq('init', CFG.pixel);
  w.fbq('track', 'PageView');

  function setConsent(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    w.MSAnalytics.choice = v;
    var g2 = v === 'granted' ? 'granted' : 'denied';
    gtag('consent', 'update', { ad_storage: g2, ad_user_data: g2, ad_personalization: g2, analytics_storage: g2 });
    w.fbq('consent', v === 'granted' ? 'grant' : 'revoke');
    w.dataLayer.push({ event: 'consent_update', consent: v });
  }
  w.MSAnalytics.setConsent = setConsent;

  // Cookie banner (built after the DOM is ready; styles live in styles.css under "consent")
  function banner(force) {
    if (!force && saved) return;
    var old = d.querySelector('.consent'); if (old) old.remove();
    var el = d.createElement('div');
    el.className = 'consent'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Cookie preferences');
    el.innerHTML = '<p><strong>Cookies, like the butchery, done properly.</strong> We use them to see how the site is used and to measure our ads. <a href="' + CFG.privacy + '">Privacy policy</a></p>' +
      '<div class="consent__btns"><button class="consent__no" type="button">Reject</button><button class="consent__yes" type="button">Accept</button></div>';
    d.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-on'); });
    el.addEventListener('click', function (e) {
      var yes = e.target.closest('.consent__yes'), no = e.target.closest('.consent__no');
      if (!yes && !no) return;
      setConsent(yes ? 'granted' : 'denied'); saved = yes ? 'granted' : 'denied';
      el.classList.remove('is-on'); setTimeout(function () { el.remove(); }, 400);
    });
  }
  w.MSAnalytics.openBanner = function () { banner(true); };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { banner(false); }); else banner(false);
})();
