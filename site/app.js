/* Meat & Social — vanilla JS, renders everything from window.MS (data.js). */
(function () {
  'use strict';
  var MS = window.MS, doc = document;
  if (!MS) return;
  var P = MS.profile, IMG = MS.images, MENU = MS.menu;
  // Site events for GTM (Book links are already tracked by the container's toasttab link-click trigger).
  function track(ev, params) { try { (window.MSAnalytics ? window.MSAnalytics.track(ev, params || {}) : (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: ev }, params || {}))); } catch (e) {} }
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, el) { return (el || doc).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function play(v) { try { var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
  function fmtDur(s) { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function reelBy(code) { return MS.reels.filter(function (r) { return r.code === code; })[0]; }

  function srcset(im) {
    var seen = {}, out = [];
    [640, 1280, 1920, 2560].forEach(function (t, i) {
      if (!im['src' + t]) return;
      var w = im.widths[i]; if (seen[w]) return; seen[w] = 1; out.push(im['src' + t] + ' ' + w + 'w');
    });
    return out.join(', ');
  }
  function imgTag(key, sizes, cls, eager) {
    var im = IMG[key]; if (!im) return '';
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + im.src1280 + '" srcset="' + srcset(im) + '" sizes="' + (sizes || '100vw') +
      '" width="' + im.w + '" height="' + im.h + '" alt="' + esc(im.alt) + '" style="object-position:' + im.focal[0] + '% ' + im.focal[1] + '%"' +
      (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">';
  }

  /* ---------- static fills ---------- */
  $$('[data-book]').forEach(function (a) { a.href = P.book; });
  $$('[data-maps]').forEach(function (a) { a.href = P.maps; });
  $$('[data-ig]').forEach(function (a) { a.href = P.instagram; });
  $$('[data-fb]').forEach(function (a) { a.href = P.facebook; });
  $$('[data-li]').forEach(function (a) { a.href = P.linkedin; });
  $$('[data-mailing]').forEach(function (a) { a.href = P.mailing; });
  $$('[data-tel]').forEach(function (a) { a.href = 'tel:' + String(P.phone).replace(/\s/g, ''); a.textContent = P.phone; });
  $$('[data-email]').forEach(function (a) { a.href = 'mailto:' + P.email; a.textContent = P.email; });
  $$('[data-addr]').forEach(function (p) { p.innerHTML = P.address.map(esc).join('<br>'); });
  $$('[data-hours-short]').forEach(function (p) { p.innerHTML = P.hours.map(function (h) { return esc(h.days) + '<br>' + esc(h.label); }).join('<br><br>'); });
  var heroImg = $('[data-hero-img]');
  if (heroImg && MS.hero_image) heroImg.innerHTML = imgTag(MS.hero_image, '100vw', 'hero__photo', true);
  $$('[data-img]').forEach(function (el) { el.innerHTML = imgTag(el.getAttribute('data-img'), '(max-width: 860px) 100vw, 50vw'); });

  /* ---------- London clock: open now + lunch ---------- */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function londonNow() {
    var parts = {};
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false })
        .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
      var d = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
      return { d: d, h: (+parts.hour % 24) + (+parts.minute) / 60 };
    } catch (e) { var n = new Date(); return { d: n.getDay(), h: n.getHours() + n.getMinutes() / 60 }; }
  }
  function hoursFor(d) { return P.hours.filter(function (h) { return h.d.indexOf(d) > -1; })[0]; }
  function fmtH(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60), ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 || 12;
    return h12 + (mm ? ':' + ('0' + mm).slice(-2) : '') + ap;
  }
  function updateClock() {
    var now = londonNow(), today = hoursFor(now.d), txt, open = false;
    if (today && now.h >= today.open && now.h < today.close) { open = true; txt = 'Open now · until ' + fmtH(today.close); }
    else if (today && now.h < today.open) txt = 'Opens today at ' + fmtH(today.open);
    else { var nx = hoursFor((now.d + 1) % 7); txt = 'Closed · opens tomorrow ' + fmtH(nx.open); }
    $$('[data-status]').forEach(function (s) { s.hidden = false; s.classList.toggle('is-open', open); $('span', s).textContent = txt; });
    // hours table
    var tb = $('[data-hours]');
    if (tb && !tb.dataset.done) {
      tb.dataset.done = 1;
      var order = [1, 2, 3, 4, 5, 6, 0];
      tb.insertAdjacentHTML('beforeend', '<tbody>' + order.map(function (d) {
        return '<tr data-d="' + d + '"><td>' + DAYS[d] + '</td><td>' + esc(hoursFor(d).label) + '</td></tr>';
      }).join('') + '</tbody>');
    }
    $$('[data-hours] tr').forEach(function (tr) { tr.classList.toggle('is-today', +tr.dataset.d === now.d); });
    // lunch
    var L = MENU.lunch, live = $('[data-lunch-live]'), lunchDay = L.days.indexOf(now.d) > -1, html, on = false;
    if (lunchDay && now.h >= L.from && now.h < L.to) {
      on = true;
      var left = Math.round((L.to - now.h) * 60);
      html = '<p class="l1"><span class="status is-open"><i></i></span>Serving now</p><p class="l2">' + (left > 90 ? 'Until 4pm' : left + ' min left') + '</p><p class="l3">Walk in or book ahead.</p>';
    } else {
      var d = now.d, add = 0;
      if (lunchDay && now.h < L.from) add = 0; else { do { d = (d + 1) % 7; add++; } while (L.days.indexOf(d) < 0); }
      html = '<p class="l1">Next lunch</p><p class="l2">' + (add === 0 ? 'Today' : add === 1 ? 'Tomorrow' : DAYS[d]) + ', 12pm</p><p class="l3">Served 12–4pm, Monday to Thursday.</p>';
    }
    if (live) { live.innerHTML = html; live.classList.toggle('is-on', on); }
    // Sunday roast: status line, and which panel leads (Sunday leads Fri-Sun, lunch leads Mon-Thu)
    var S = MENU.sunday, sl = $('[data-sunday-live]');
    if (S && sl) {
      var isSun = now.d === S.day, open = isSun && now.h >= S.from && today && now.h < today.close;
      sl.classList.toggle('is-on', open);
      sl.innerHTML = open ? '<span class="status is-open"><i></i></span>Serving today'
        : isSun && now.h < S.from ? 'Today from 12pm'
        : now.d === 6 ? 'Tomorrow from 12pm' : (isSun ? 'Next Sunday' : 'This Sunday') + ' from 12pm';
      var deals = $('[data-deals]'); if (deals) deals.classList.toggle('is-sunday-first', now.d === 0 || now.d >= 5);
    }
  }
  updateClock(); setInterval(updateClock, 60000);

  /* ---------- video manager: teasers play only while visible ---------- */
  var VM = (function () {
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { var v = e.target; v._vis = e.isIntersecting; sync(v); });
    }, { rootMargin: '150px 0px', threshold: 0.2 }) : null;
    var paused = false;
    function sync(v) {
      if (v._vis && !paused && !reduced && !v._manual) {
        if (!v.src) v.src = v.dataset.src;
        play(v);
      } else if (!v.paused) v.pause();
    }
    return {
      add: function (v) { v.addEventListener('playing', function () { v.classList.add('is-playing'); }); if (io) io.observe(v); else { v._vis = true; sync(v); } },
      suspend: function (on) { paused = on; $$('video[data-src]').forEach(sync); },
      sync: sync
    };
  })();

  function reelTile(r, opts) {
    opts = opts || {};
    return '<button class="rtile' + (opts.cls ? ' ' + opts.cls : '') + '" data-reel="' + r.code + '" role="' + (opts.role || 'button') + '">' +
      '<img src="' + r.poster + '" alt="" loading="' + (opts.eager ? 'eager' : 'lazy') + '" decoding="async">' +
      '<video muted playsinline loop preload="none" data-src="' + r.teaser + '" aria-hidden="true"></video>' +
      '<span class="rtile__dur">' + fmtDur(r.duration) + '</span>' +
      '<span class="rtile__play">Play with sound</span>' +
      '<span class="rtile__meta"><span class="rtile__tag">' + esc(r.tag) + '</span><span class="rtile__title">' + esc(r.title) + '</span></span>' +
      '<span class="sr">, ' + esc(r.blurb) + '</span></button>';
  }
  function wireTiles(root, list) {
    $$('.rtile', root).forEach(function (b) {
      VM.add($('video', b));
      b.addEventListener('click', function () { Player.open(list, b.getAttribute('data-reel'), b); });
    });
  }

  // A row of filter chips: "All" plus one per category (with counts). onPick(cat|'all').
  function chips(el, cats, count, onPick, total) {
    if (!el || !cats || !cats.length) return;
    el.innerHTML = '<button aria-pressed="true" data-c="all">All<span class="n">' + total + '</span></button>' +
      cats.map(function (c) { var n = count(c); return n ? '<button aria-pressed="false" data-c="' + esc(c) + '">' + esc(c) + '<span class="n">' + n + '</span></button>' : ''; }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('button', el).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      onPick(b.getAttribute('data-c'));
    });
  }

  /* ---------- hero ---------- */
  var heroList = MS.hero.map(reelBy).filter(Boolean);
  var heroEl = $('[data-hero-reels]');
  heroEl.innerHTML = heroList.map(function (r, i) { return reelTile(r, { eager: true, cls: i === 0 ? 'is-front' : '' }); }).join('');
  wireTiles(heroEl, MS.reels);
  // phone: the three hero reels take turns full-bleed behind the headline, opening on the butcher's block,
  // then the interior photo (front = -1) before looping. Desktop keeps the photo behind a floating triptych, so front stays on a reel.
  var mqPhone = window.matchMedia('(max-width: 860px)');
  var dots = doc.createElement('div'); dots.className = 'hero__dots'; dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = heroList.map(function (_, i) { return '<i' + (i ? '' : ' class="is-on"') + '></i>'; }).join('') + '<i></i>';
  $('.hero').appendChild(dots);
  var front = 0, heroTimer;
  function setFront(n) {
    var tiles = $$('.rtile', heroEl);
    front = n;
    tiles.forEach(function (t, i) { t.classList.toggle('is-front', i === n); });
    $$('i', dots).forEach(function (d, i) { d.classList.toggle('is-on', n === -1 ? i === heroList.length : i === n); });
    if (n >= 0) { var v = $('video', tiles[n]); try { v.currentTime = 0; } catch (e) {} }
  }
  function heroRotate() {
    clearTimeout(heroTimer);
    if (!mqPhone.matches) { setFront(0); return; }
    if (reduced) { setFront(-1); return; }
    heroTimer = setTimeout(function () {
      setFront(front === -1 ? 0 : front + 1 >= heroList.length ? -1 : front + 1);
      heroRotate();
    }, front === -1 ? 4000 : 6500);
  }
  setFront(0);
  heroRotate();
  mqPhone.addEventListener && mqPhone.addEventListener('change', function () { setFront(0); heroRotate(); });
  // desktop: gentle pointer parallax
  if (!reduced && window.matchMedia('(pointer: fine)').matches) {
    var tx = 0, ty = 0, cx = 0, cy = 0, rafOn = false;
    doc.addEventListener('pointermove', function (e) {
      tx = (e.clientX / innerWidth - .5); ty = (e.clientY / innerHeight - .5);
      if (!rafOn) { rafOn = true; requestAnimationFrame(step); }
    });
    function step() {
      cx += (tx - cx) * .08; cy += (ty - cy) * .08;
      $$('.rtile', heroEl).forEach(function (t, i) {
        var k = [14, 26, 18][i] || 16;
        t.style.setProperty('--px', (-cx * k).toFixed(2) + 'px'); t.style.setProperty('--py', (-cy * k).toFixed(2) + 'px');
      });
      if (Math.abs(tx - cx) > .001 || Math.abs(ty - cy) > .001) requestAnimationFrame(step); else rafOn = false;
    }
  }
  function ready() { doc.documentElement.classList.add('is-ready'); doc.body.classList.add('is-ready'); }
  if (doc.fonts && doc.fonts.ready) { Promise.race([doc.fonts.ready, new Promise(function (r) { setTimeout(r, 800); })]).then(ready); } else ready();

  /* ---------- nav ---------- */
  var nav = $('#nav'), pill = $('[data-pill]'), lastY = 0;
  function onScroll() {
    var y = scrollY;
    nav.classList.toggle('is-solid', y > 40);
    nav.classList.toggle('is-hidden', y > 500 && y > lastY + 4 && !doc.body.classList.contains('is-locked'));
    if (y < lastY - 4) nav.classList.remove('is-hidden');
    lastY = y;
    var visit = $('#visit').getBoundingClientRect();
    var showPill = y > innerHeight * .9 && visit.top > innerHeight * .6;
    pill.classList.toggle('is-on', showPill);
    pill.setAttribute('aria-hidden', showPill ? 'false' : 'true'); pill.tabIndex = showPill ? 0 : -1;
    // parallax on the butcher portrait
    var bi = $('.butchery__img img');
    if (bi && !reduced) { var r = bi.parentNode.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) bi.style.setProperty('--par', (-(r.top / innerHeight) * 40 - 20).toFixed(1) + 'px'); }
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if ('IntersectionObserver' in window) {
    var links = $$('.nav__links a');
    var secIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) links.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id); }); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['sunday', 'menu', 'butchery', 'reviews', 'visit'].forEach(function (id) { secIO.observe(doc.getElementById(id)); });
  }

  /* ---------- tabs ---------- */
  var tabs = $$('[data-tabs] [role=tab]');
  function selectTab(t, focus) {
    tabs.forEach(function (x) {
      var on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1;
      var p = doc.getElementById(x.getAttribute('aria-controls')); p.hidden = !on;
      if (on) { p.classList.remove('is-entering'); void p.offsetWidth; p.classList.add('is-entering'); }
    });
    if (focus) t.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); track('menu_tab', { menu_tab: t.textContent.trim() }); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, j = k === 'ArrowRight' ? i + 1 : k === 'ArrowLeft' ? i - 1 : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : null;
      if (j === null) return; e.preventDefault(); selectTab(tabs[(j + tabs.length) % tabs.length], true);
    });
  });

  /* ---------- food menu ---------- */
  var foodEl = $('[data-food]'), frames = $('.food__frames'), cap = $('[data-food-cap]');
  var photoKeys = [];
  MENU.food.forEach(function (c) { c.items.forEach(function (it) { if (it.photo && photoKeys.indexOf(it.photo) < 0) photoKeys.push(it.photo); }); });
  frames.innerHTML = photoKeys.map(function (k, i) { return imgTag(k, '(max-width: 860px) 1px, 40vw', i === 0 ? 'is-on' : '').replace('<img', '<img data-k="' + k + '"'); }).join('');
  cap.textContent = 'Fillet tartare';
  foodEl.innerHTML = MENU.food.map(function (c) {
    return '<div class="cat rv" data-cat="' + c.id + '"><div class="cat__head"><h3>' + esc(c.name) + '</h3>' + (c.note ? '<p>' + esc(c.note) + '</p>' : '') + '</div>' +
      '<div class="' + (c.id === 'sides' ? 'sides' : 'list') + '">' + c.items.map(function (it) {
        var tags = (it.tags || []).map(function (t) { return '<span class="tag" title="' + (t === 'V' ? 'Vegetarian' : 'Gluten free') + '">' + t + '</span>'; }).join('');
        return '<div class="dish" tabindex="' + (it.photo ? 0 : -1) + '" data-tags="' + (it.tags || []).join(' ') + '"' + (it.photo ? ' data-photo="' + it.photo + '"' : '') + ' data-name="' + esc(it.name) + '">' +
          (it.photo ? imgTag(it.photo, '74px', 'dish__thumb').replace(/ alt="[^"]*"/, ' alt=""') : '') +
          '<div class="dish__row"><span class="dish__name">' + esc(it.name) + tags + (it.photo ? '<span class="dish__cam" aria-hidden="true"></span>' : '') + '</span><span class="dish__lead"></span><span class="dish__price">' + esc(String(it.price).replace(/(\d)/, '£$1')) + '</span></div>' +
          (it.desc ? '<p class="dish__desc">' + esc(it.desc) + '</p>' : '') +
          (it.options ? '<ul class="dish__opts">' + it.options.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
      }).join('') + '</div></div>';
  }).join('');
  $('[data-foot]').textContent = MENU.footnote + ' V = vegetarian, GF = gluten free.';
  if (MENU.sunday && $('[data-sunday]')) {
    var S0 = MENU.sunday;
    var row = function (it) { return '<div class="srow"><div class="srow__top"><span class="srow__name">' + esc(it.name) + '</span><span class="dish__lead"></span><span class="srow__price">£' + esc(it.price) + '</span></div><p class="srow__desc">' + esc(it.desc) + '</p></div>'; };
    $('[data-sunday]').innerHTML =
      '<h3 class="sunday__h">To start</h3>' + row(S0.starter) +
      '<h3 class="sunday__h">Roasts</h3>' + S0.roasts.map(row).join('') + '<p class="sunday__with">' + esc(S0.with) + '</p>' +
      '<h3 class="sunday__h">Dessert</h3>' + row(S0.dessert);
  }
  function showPhoto(k, name) {
    $$('img', frames).forEach(function (im) { im.classList.toggle('is-on', im.getAttribute('data-k') === k); });
    cap.textContent = name;
    $$('.dish', foodEl).forEach(function (d) { d.classList.toggle('is-active', d.getAttribute('data-photo') === k); });
  }
  $$('.dish[data-photo]', foodEl).forEach(function (d) {
    var go = function () { showPhoto(d.getAttribute('data-photo'), d.getAttribute('data-name')); };
    d.addEventListener('mouseenter', go); d.addEventListener('focus', go);
  });
  // auto-cycle the photo until the visitor hovers something
  var cyc = 0, cycTimer = setInterval(function () {
    if (reduced || $('#panel-food').hidden || $('.food__photo').matches(':hover')) return;
    if (foodEl.matches(':hover') || foodEl.contains(doc.activeElement)) return;
    cyc = (cyc + 1) % photoKeys.length;
    var d = $('.dish[data-photo="' + photoKeys[cyc] + '"]', foodEl); showPhoto(photoKeys[cyc], d ? d.getAttribute('data-name') : '');
  }, 3200);
  $$('[data-diet] button').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-diet-v');
      $$('[data-diet] button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      $$('.dish', foodEl).forEach(function (d) { d.classList.toggle('is-dim', v !== 'all' && (' ' + d.getAttribute('data-tags') + ' ').indexOf(' ' + v + ' ') < 0); });
    });
  });

  /* ---------- Social Board builder ---------- */
  var B = MENU.board, boardEl = $('[data-board]');
  var sides = MENU.food.filter(function (c) { return c.id === 'sides'; })[0].items.map(function (i) { return i.name; });
  var pick = { meats: [], sides: [], sauces: [] }, people = B.min_people;
  function chip(kind, name, small) { return '<button class="chip" data-kind="' + kind + '" data-v="' + esc(name) + '" aria-pressed="false">' + (small ? '<small>' + esc(small) + '</small>' : '') + esc(name) + '</button>'; }
  boardEl.innerHTML =
    '<div class="board__steps"><div class="board__intro"><p class="kicker">Social Boards · £' + B.price_pp + ' per person</p><h3>Build your board</h3>' +
    '<p>Choose ' + B.pick.meats + ' meats, ' + B.pick.sides + ' sides and ' + B.pick.sauces + ' sauces. For ' + B.min_people + ' or more, made for sharing.</p></div>' +
    '<div class="step"><div class="step__head"><h4>01 · Meats</h4><span data-count-k="meats"></span></div><div class="chips">' +
    B.meats.map(function (g) { return g.items.map(function (m) { return chip('meats', m, g.group); }).join(''); }).join('') + '</div></div>' +
    '<div class="step"><div class="step__head"><h4>02 · Sides</h4><span data-count-k="sides"></span></div><div class="chips">' + sides.map(function (s) { return chip('sides', s); }).join('') + '</div></div>' +
    '<div class="step"><div class="step__head"><h4>03 · Sauces</h4><span data-count-k="sauces"></span></div><div class="chips">' + B.sauces.map(function (s) { return chip('sauces', s); }).join('') + '</div>' +
    '<p class="foot">' + esc(B.sauces_note) + '.</p></div></div>' +
    '<aside class="tray" aria-live="polite"><div class="tray__img">' + imgTag('board', '(max-width: 860px) 100vw, 40vw') + '<div class="tray__picked" data-picked></div></div>' +
    '<div class="tray__body"><div class="people"><span class="people__lbl">People</span><div class="stepper"><button class="round" data-pp="-1" aria-label="Fewer people">−</button><output data-people>' + people + '</output><button class="round" data-pp="1" aria-label="More people">+</button></div></div>' +
    '<div class="total"><span>£' + B.price_pp + ' × <b data-people2>' + people + '</b></span><strong data-total>£' + B.price_pp * people + '</strong></div>' +
    '<p class="tray__ready" data-ready></p><p class="tray__note">Tell your server your picks on the night. Our 12.5% discretionary service charge is added to the bill.</p>' +
    '<a class="btn btn--book" href="' + P.book + '" target="_blank" rel="noopener">Book a table for <span data-people3>' + people + '</span> <svg class="ic" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a></div></aside>';
  function renderBoard() {
    Object.keys(pick).forEach(function (k) {
      var max = B.pick[k], n = pick[k].length, lab = $('[data-count-k="' + k + '"]', boardEl);
      lab.textContent = n + ' of ' + max; lab.classList.toggle('is-full', n === max);
      $$('.chip[data-kind="' + k + '"]', boardEl).forEach(function (c) {
        var on = pick[k].indexOf(c.getAttribute('data-v')) > -1;
        c.setAttribute('aria-pressed', on); c.disabled = !on && n >= max;
      });
    });
    $('[data-picked]', boardEl).innerHTML = pick.meats.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('') +
      pick.sides.map(function (m) { return '<span class="s">' + esc(m) + '</span>'; }).join('') + pick.sauces.map(function (m) { return '<span class="c">' + esc(m) + '</span>'; }).join('');
    $('[data-people]', boardEl).textContent = people; $('[data-people2]', boardEl).textContent = people; $('[data-people3]', boardEl).textContent = people;
    $('[data-total]', boardEl).textContent = '£' + (B.price_pp * people);
    var left = (B.pick.meats - pick.meats.length) + (B.pick.sides - pick.sides.length) + (B.pick.sauces - pick.sauces.length);
    var rd = $('[data-ready]', boardEl); rd.textContent = left ? left + ' more pick' + (left > 1 ? 's' : '') + ' to complete your board' : 'Your board is ready. Now find a table.'; rd.classList.toggle('is-done', !left);
    if (!left && !renderBoard.sent) { renderBoard.sent = true; track('social_board_built', { people: people, meats: pick.meats.join(', '), sides: pick.sides.join(', '), sauces: pick.sauces.join(', ') }); }
    $('[data-pp="-1"]', boardEl).disabled = people <= B.min_people;
  }
  boardEl.addEventListener('click', function (e) {
    var c = e.target.closest('.chip'), pp = e.target.closest('[data-pp]');
    if (c) {
      var k = c.getAttribute('data-kind'), v = c.getAttribute('data-v'), i = pick[k].indexOf(v);
      if (i > -1) pick[k].splice(i, 1); else if (pick[k].length < B.pick[k]) pick[k].push(v);
      c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
      renderBoard();
    }
    if (pp) { people = Math.max(B.min_people, Math.min(20, people + +pp.getAttribute('data-pp'))); renderBoard(); }
  });
  renderBoard();

  /* ---------- drinks ---------- */
  var drinksEl = $('[data-drinks]'), dCat = 'red', dMode = 'all';
  drinksEl.innerHTML = '<div class="drinks__bar"><div class="filters" role="group" aria-label="Drinks list" data-dcat>' +
    MENU.drinks.map(function (c) { return '<button data-c="' + c.id + '" aria-pressed="' + (c.id === dCat) + '">' + esc(c.name) + '</button>'; }).join('') +
    '</div><div class="seg" role="group" aria-label="Show prices" data-dmode><button data-m="all" aria-pressed="true">All</button><button data-m="glass" aria-pressed="false">By the glass</button></div></div>' +
    '<p class="drinks__lede">Chosen to complement every cut: bold reds for aged steak, crisp whites and rosé for lighter plates, from renowned vineyards and hidden gems.</p><div class="drinks__grid" data-dgrid></div>';
  function renderDrinks() {
    var c = MENU.drinks.filter(function (x) { return x.id === dCat; })[0];
    var wine = c.items.some(function (w) { return w.bottle; });
    $('[data-dgrid]', drinksEl).innerHTML = [0, 1].map(function (col) {
      return '<div class="wcol">' + (wine ? '<div class="wine wine--head"><span></span><span>Glass</span><span>Bottle</span></div>' : '') +
        c.items.filter(function (_, i) { return i % 2 === col; }).map(function (w, i) {
          var na = dMode === 'glass' && !w.glass && !w.price;
          var cells = wine ? '<span class="wine__p">' + (w.glass ? '£' + w.glass : '–') + '</span><span class="wine__p">' + (w.bottle ? '£' + w.bottle : '–') + '</span>'
            : '<span class="wine__p"></span><span class="wine__p">£' + w.price + '</span>';
          return '<div class="wine' + (na ? ' is-na' : '') + '" style="animation-delay:' + (i * 45) + 'ms"><span class="wine__txt"><span class="wine__name">' + esc(w.name) + '</span>' +
            (w.maker ? '<span class="wine__maker">' + esc(w.maker) + '</span>' : '') + '</span>' + cells + '</div>';
        }).join('') + '</div>';
    }).join('');
  }
  drinksEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]'), m = e.target.closest('[data-m]');
    if (b) { dCat = b.getAttribute('data-c'); $$('[data-c]', drinksEl).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); renderDrinks(); }
    if (m) { dMode = m.getAttribute('data-m'); $$('[data-m]', drinksEl).forEach(function (x) { x.setAttribute('aria-pressed', x === m); }); renderDrinks(); }
  });
  renderDrinks();

  /* ---------- reels strip + butchery + guests ---------- */
  var ownReels = MS.reels.filter(function (r) { return r.by === P.handle && r.cat !== 'Guests'; });
  var strip = $('[data-strip]'), stripList = ownReels.slice();
  strip.innerHTML = ownReels.map(function (r) { return reelTile(r, { role: 'listitem' }); }).join('');
  $$('.rtile', strip).forEach(function (b) {
    VM.add($('video', b));
    b.addEventListener('click', function () { Player.open(stripList, b.getAttribute('data-reel'), b); });
  });
  chips($('[data-reel-cats]'), MS.reel_cats, function (c) { return ownReels.filter(function (r) { return r.cat === c; }).length; }, function (c) {
    stripList = ownReels.filter(function (r) { return c === 'all' || r.cat === c; });
    $$('.rtile', strip).forEach(function (b) { var r = reelBy(b.getAttribute('data-reel')); b.classList.toggle('is-out', c !== 'all' && r.cat !== c); });
    strip.scrollTo({ left: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, ownReels.length);
  $('[data-strip-prev]').addEventListener('click', function () { strip.scrollBy({ left: -strip.clientWidth * .8, behavior: 'smooth' }); });
  $('[data-strip-next]').addEventListener('click', function () { strip.scrollBy({ left: strip.clientWidth * .8, behavior: 'smooth' }); });
  // drag to scroll with a mouse
  (function () {
    var down = false, sx = 0, sl = 0, moved = false;
    strip.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = strip.scrollLeft; });
    addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 5) { moved = true; strip.style.scrollSnapType = 'none'; } strip.scrollLeft = sl - dx; });
    addEventListener('pointerup', function () { if (!down) return; down = false; strip.style.scrollSnapType = ''; });
    strip.addEventListener('click', function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  })();

  var bRe = $('[data-butch-reels]');
  var butchList = ['DdJ3kJ3tGEC', 'DaIHAT5NEiV'].map(reelBy).filter(Boolean);
  bRe.innerHTML = butchList.map(function (r) { return reelTile(r); }).join('');
  wireTiles(bRe, butchList);

  var pressEl = $('[data-press]');
  var pressList = MS.press.map(function (p) { return reelBy(p.code); }).filter(Boolean);
  pressEl.innerHTML = MS.press.map(function (p) {
    var r = reelBy(p.code); if (!r) return '';
    return '<article class="gcard rv">' + reelTile(r) + '<blockquote><q>' + esc(p.quote) + '</q><p>' + esc(p.detail) + '</p>' +
      '<cite>' + esc(p.by) + ' · <a href="https://www.instagram.com/' + esc(p.handle) + '/" target="_blank" rel="noopener">@' + esc(p.handle) + '</a></cite></blockquote></article>';
  }).join('');
  wireTiles(pressEl, pressList);

  /* ---------- gallery + lightbox ---------- */
  var gal = $('[data-gallery]');
  gal.innerHTML = MS.gallery.map(function (k, i) {
    return '<button class="ph rv" data-i="' + i + '" aria-label="Open photo: ' + esc(IMG[k].alt) + '">' + imgTag(k, '(max-width: 620px) 50vw, 25vw') + '</button>';
  }).join('');
  var galList = MS.gallery.slice();
  chips($('[data-gal-cats]'), MS.gallery_cats, function (c) { return MS.gallery.filter(function (k) { return IMG[k].cat === c; }).length; }, function (c) {
    galList = MS.gallery.filter(function (k) { return c === 'all' || IMG[k].cat === c; });
    $$('.ph', gal).forEach(function (b) { var k = MS.gallery[+b.getAttribute('data-i')]; b.classList.toggle('is-out', c !== 'all' && IMG[k].cat !== c); });
  }, MS.gallery.length);
  var LB = { el: $('[data-lb]'), i: 0, ret: null };
  function lbShow(i) {
    LB.i = (i + galList.length) % galList.length;
    var im = IMG[galList[LB.i]], img = $('[data-lbimg]');
    img.src = im.src1920 || im.src1280; img.alt = im.alt;
    $('[data-lbcap]').innerHTML = esc(im.alt) + (im.url ? ' <a href="' + im.url + '" target="_blank" rel="noopener">View on Instagram <svg class="ic" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></a>' : '');
  }
  function lbOpen(i, from) { LB.ret = from; lbShow(i); track('gallery_open', { photo: IMG[galList[LB.i]].alt }); LB.el.hidden = false; lock(true); $('[data-lbclose]').focus(); }
  function lbClose() { LB.el.hidden = true; lock(false); if (LB.ret) LB.ret.focus(); }
  gal.addEventListener('click', function (e) { var b = e.target.closest('.ph'); if (b) lbOpen(galList.indexOf(MS.gallery[+b.getAttribute('data-i')]), b); });
  $('[data-lbclose]').addEventListener('click', lbClose);
  $('[data-lbprev]').addEventListener('click', function () { lbShow(LB.i - 1); });
  $('[data-lbnext]').addEventListener('click', function () { lbShow(LB.i + 1); });
  LB.el.addEventListener('click', function (e) { if (e.target === LB.el) lbClose(); });
  swipe(LB.el, function (d) { lbShow(LB.i + d); }, lbClose);

  function lock(on) { doc.body.classList.toggle('is-locked', on); VM.suspend(on); }
  function trap(dlg, e) {
    if (e.key !== 'Tab') return;
    var f = $$('button:not([hidden]), a[href]', dlg).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  function swipe(el, onX, onDown) {
    var x0, y0;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) onX(dx < 0 ? 1 : -1);
      else if (dy > 90 && onDown) onDown();
    });
  }

  /* ---------- reel player ---------- */
  var Player = (function () {
    var el = $('[data-player]'), v = $('[data-pv]'), bars = $('[data-bars]'), list = [], i = 0, ret = null, muted = false, raf;
    function load() {
      var r = list[i];
      v.src = r.src; v.poster = r.poster; v.muted = muted; play(v);
      track('reel_play', { reel_title: r.title, reel_code: r.code, reel_category: r.cat || r.tag });
      $('[data-ptag]').textContent = r.tag + (r.by !== P.handle ? ' · @' + r.by : '');
      $('[data-ptitle]').textContent = r.title; $('[data-pblurb]').textContent = r.blurb; $('[data-plink]').href = r.url;
      $$('i', bars).forEach(function (b, j) { b.classList.toggle('done', j < i); $('b', b).style.width = j < i ? '100%' : '0'; });
    }
    function tick() {
      var b = $$('i b', bars)[i];
      if (b && v.duration) b.style.width = (v.currentTime / v.duration * 100) + '%';
      raf = requestAnimationFrame(tick);
    }
    function go(d) { i += d; if (i < 0) i = 0; if (i >= list.length) { close(); return; } load(); }
    function open(l, code, from) {
      list = l; i = Math.max(0, list.findIndex(function (r) { return r.code === code; })); ret = from;
      bars.innerHTML = list.map(function () { return '<i><b></b></i>'; }).join('');
      el.hidden = false; lock(true); load(); cancelAnimationFrame(raf); tick();
      $('[data-pclose]').focus();
    }
    function close() { v.pause(); v.removeAttribute('src'); v.load(); el.hidden = true; cancelAnimationFrame(raf); lock(false); if (ret) ret.focus(); }
    v.addEventListener('ended', function () { go(1); });
    $('[data-pnext]').addEventListener('click', function () { go(1); }); $('[data-pprev]').addEventListener('click', function () { go(-1); });
    $('[data-pnext2]').addEventListener('click', function () { go(1); }); $('[data-pprev2]').addEventListener('click', function () { go(-1); });
    $('[data-pclose]').addEventListener('click', close);
    $('[data-pmute]').addEventListener('click', function () { muted = !muted; v.muted = muted; this.innerHTML = muted ? '<svg class="ic" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>' : '<svg class="ic" viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>'; this.setAttribute('aria-label', muted ? 'Unmute' : 'Mute'); });
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    swipe(el, go, close);
    doc.addEventListener('keydown', function (e) {
      if (!el.hidden) {
        if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === ' ' && e.target === doc.body) { e.preventDefault(); v.paused ? play(v) : v.pause(); }
        trap(el, e);
      } else if (!LB.el.hidden) {
        if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowRight') lbShow(LB.i + 1); else if (e.key === 'ArrowLeft') lbShow(LB.i - 1);
        trap(LB.el, e);
      }
    });
    return { open: open };
  })();

  /* ---------- Google reviews ----------
     Curated excerpts ship in data.js (MS.reviews), so the section works with no setup and no credentials.
     Optional auto-update: set profile.google.featurableId (a free Featurable widget ID, see README). The page
     then fetches Featurable's public JSON (no key; the widget ID is not a secret), keeps 4-5 stars only,
     puts new reviews first and refreshes the rating and count. Works on any static host. */
  var G = P.google || {}, RV = MS.reviews || { items: [], topics: [] };
  var revs = RV.items.slice(), fi = 0, fTimer;
  $('[data-g-all]').href = G.url; $('[data-g-write]').href = G.write;
  $('[data-elsewhere]').innerHTML = (P.elsewhere || []).map(function (e) { return '<li><strong>' + esc(e.score) + '</strong>' + esc(e.name) + ' (' + e.count + ')</li>'; }).join('');
  function initials(n) { return String(n).replace(/[^\p{L}\s&]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '★'; }
  var AV = ['#e57b5e', '#c9a86a', '#8fb39b', '#9aa3d6', '#d99aa0'];
  // Five SVG stars, rating rounded to the nearest half (4.9 shows five full stars). Glyph stars clipped by width got cropped.
  var STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z';
  function starsInner(n) {
    var r = Math.round(n * 2) / 2, out = '';
    for (var i = 1; i <= 5; i++) {
      var f = r >= i ? 'full' : r >= i - 0.5 ? 'half' : 'none';
      out += '<svg viewBox="0 0 24 24" class="st st--' + f + '" aria-hidden="true">' +
        (f === 'half' ? '<defs><linearGradient id="sh' + i + '"><stop offset="50%" stop-color="#f5b83d"/><stop offset="50%" stop-color="rgba(243,236,225,.2)"/></linearGradient></defs><path d="' + STAR + '" fill="url(#sh' + i + ')"/>' : '<path d="' + STAR + '"/>') + '</svg>';
    }
    return out;
  }
  function starsHtml(n, cls) { return '<span class="stars stars--sm ' + (cls || '') + '" role="img" aria-label="' + n + ' out of 5 stars">' + starsInner(n) + '</span>'; }
  function paintStars() { $$('[data-stars]').forEach(function (el) { el.innerHTML = starsInner(+el.getAttribute('data-stars')); }); }
  function renderScore() {
    $('[data-rating]').textContent = Number(G.rating).toFixed(1);
    $('[data-rcount]').textContent = Number(G.count).toLocaleString('en-GB');
    $('[data-hrating]').textContent = Number(G.rating).toFixed(1);
    $('[data-hcount]').textContent = Number(G.count).toLocaleString('en-GB');
    $$('[data-stars]').forEach(function (el) { el.setAttribute('data-stars', G.rating); }); paintStars();
  }
  function renderWall() {
    var wall = $('[data-wall]');
    wall.innerHTML = revs.map(function (r, i) {
      return '<button class="rcard rv' + (r.live ? ' is-new' : '') + '" aria-expanded="false" data-i="' + i + '" data-topics="' + (r.topics || []).join('|') + '">' +
        '<span class="rcard__top">' + starsHtml(r.stars) + (r.live ? '<span class="badge badge--new">New</span>' : '<span class="g-mark" aria-label="Google"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></span>') + '</span>' +
        (r.quote ? '<p class="rcard__q">“' + esc(r.quote) + '”</p>' : '') +
        '<p class="rcard__t">' + esc(r.text) + '</p>' +
        '<span class="rcard__by"><span class="rcard__av" style="background:' + AV[i % AV.length] + '" aria-hidden="true">' + esc(initials(r.name)) + '</span><span><b>' + esc(r.name) + '</b>' + esc(r.when) + (r.guide ? ' · Local Guide' : '') + '</span></span></button>';
    }).join('');
    $$('.rcard', wall).forEach(function (c) {
      c.addEventListener('click', function () { c.setAttribute('aria-expanded', c.getAttribute('aria-expanded') !== 'true'); });
      if (!reduced && 'IntersectionObserver' in window) rio2.observe(c); else c.classList.add('is-in');
    });
  }
  var rio2 = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); rio2.unobserve(e.target); } }); }, { rootMargin: '0px 0px -5% 0px' }) : null;
  var featured = [];
  function renderFeature() {
    featured = revs.filter(function (r) { return r.quote && (r.live || r.quote.length < 90); }).slice(0, 8);
    $('[data-feature-stage]').innerHTML = featured.map(function (r, i) {
      return '<figure class="fq' + (i === 0 ? ' is-on' : '') + '"><blockquote><q>' + esc(r.quote) + '</q><p>' + esc(r.text) + '</p></blockquote>' +
        '<cite><b>' + esc(r.name) + '</b>' + starsHtml(r.stars) + '<span>' + esc(r.when) + '</span>' + (r.live ? '<span class="badge badge--new">New</span>' : '') + '</cite></figure>';
    }).join('');
    $('[data-fdots]').innerHTML = featured.map(function (r, i) { return '<button aria-label="Review ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '></button>'; }).join('');
    fi = 0; fAuto();
  }
  function fShow(i) {
    fi = (i + featured.length) % featured.length;
    $$('.fq').forEach(function (f, k) { f.classList.toggle('is-on', k === fi); });
    $$('[data-fdots] button').forEach(function (d, k) { if (k === fi) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    fAuto();
  }
  function fAuto() { clearTimeout(fTimer); if (!reduced) fTimer = setTimeout(function () { if (!doc.hidden && !$('.feature').matches(':hover')) fShow(fi + 1); else fAuto(); }, 6500); }
  $('[data-fprev]').addEventListener('click', function () { fShow(fi - 1); });
  $('[data-fnext]').addEventListener('click', function () { fShow(fi + 1); });
  $('[data-fdots]').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) fShow($$('[data-fdots] button').indexOf(b)); });
  swipe($('.feature'), function (d) { fShow(fi + d); });
  function renderTopics() {
    var el = $('[data-topics]'); el.innerHTML = ''; var fresh = el.cloneNode(false); el.parentNode.replaceChild(fresh, el);
    chips(fresh, RV.topics, function (t) { return revs.filter(function (r) { return (r.topics || []).indexOf(t) > -1; }).length; }, function (t) {
      $$('.rcard').forEach(function (c) { c.classList.toggle('is-out', t !== 'all' && c.getAttribute('data-topics').split('|').indexOf(t) < 0); });
      track('review_filter', { topic: t });
    }, revs.length);
  }
  function renderReviews() { renderScore(); renderFeature(); renderWall(); renderTopics(); }
  renderReviews();

  // Hero trust line: short quotes, rotating quietly under the buttons
  var hq = $('[data-hquote]'), hqi = 0;
  function heroQuotes() { return revs.filter(function (r) { return r.quote && r.quote.length <= 48; }); }
  function showHQ() {
    var list = heroQuotes(); if (!list.length) return;
    var r = list[hqi % list.length];
    hq.classList.remove('is-on');
    setTimeout(function () { hq.innerHTML = '“' + esc(r.quote) + '” <span>' + esc(r.name) + '</span>'; hq.classList.add('is-on'); }, reduced ? 0 : 350);
    hqi++;
  }
  showHQ(); if (!reduced) setInterval(function () { if (!doc.hidden) showHQ(); }, 5200);

  function ago(iso) {
    var t = Date.parse(iso); if (!t) return '';
    var d = Math.max(0, (Date.now() - t) / 864e5);
    if (d < 1) return 'today'; if (d < 2) return 'yesterday'; if (d < 7) return Math.floor(d) + ' days ago';
    if (d < 14) return 'a week ago'; if (d < 31) return Math.floor(d / 7) + ' weeks ago';
    if (d < 60) return 'a month ago'; if (d < 365) return Math.floor(d / 30) + ' months ago';
    return Math.floor(d / 365) < 2 ? 'a year ago' : Math.floor(d / 365) + ' years ago';
  }
  function liveReviews() {
    if (!G.featurableId || !window.fetch) return;
    fetch('https://api.featurable.com/v1/widgets/' + encodeURIComponent(G.featurableId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.success) return;
        if (data.averageRating) G.rating = data.averageRating;
        if (data.totalReviewCount) G.count = data.totalReviewCount;
        if (data.profileUrl) G.write = data.profileUrl;
        var known = RV.items.map(function (r) { return r.name.split(' ')[0].toLowerCase(); });
        var fresh = (data.reviews || []).filter(function (r) { return r.starRating >= 4 && r.comment && !(r.reviewer && r.reviewer.isAnonymous); }).map(function (r) {
          var full = (r.reviewer && r.reviewer.displayName) || 'Google user', parts = full.trim().split(/\s+/);
          var text = String(r.comment).replace(/\s*\(Translated by Google\)[\s\S]*$/, '').trim();
          var first = (text.match(/^[^.!?]{12,110}[.!?]/) || [])[0];
          return { name: parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.' : full, stars: r.starRating,
            when: ago(r.createTime), quote: first || '', text: first ? (text.slice(first.length).trim() || '') : text,
            topics: RV.topics.filter(function (t) { return new RegExp(t.split(' ')[0], 'i').test(text); }),
            live: Date.parse(r.createTime) > Date.parse(RV.collected || 0), time: Date.parse(r.createTime) || 0 };
        }).filter(function (r) { return known.indexOf(r.name.split(' ')[0].toLowerCase()) < 0; })
          .sort(function (a, b) { return b.time - a.time; }).slice(0, 12);
        revs = fresh.concat(RV.items);
        $('[data-g-write]').href = G.write;
        renderReviews();
        $('[data-rnote]').textContent = 'Updated automatically from Google. 4 and 5-star reviews only.';
      }).catch(function () {});
  }
  // load Google only when the reviews come near the viewport
  if ('IntersectionObserver' in window) {
    var gio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { gio.disconnect(); liveReviews(); } }, { rootMargin: '600px 0px' });
    gio.observe($('#reviews'));
  } else liveReviews();

  $$('[data-cookie-settings]').forEach(function (b) {
    if (!window.MSAnalytics || !window.MSAnalytics.openBanner) { b.hidden = true; return; }
    b.addEventListener('click', function () { window.MSAnalytics.openBanner(); });
  });

  /* ---------- reveal on scroll ---------- */
  if ('IntersectionObserver' in window && !reduced) {
    var rio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv:not(.rcard), .sec-head, .lunch > *, .sunday__img, .sunday__body, .butchery > *, .visit__card, .score').forEach(function (el, k) { el.classList.add('rv'); el.style.transitionDelay = (k % 4) * 70 + 'ms'; rio.observe(el); });
  } else $$('.rv').forEach(function (el) { el.classList.add('is-in'); });

  // pause the ticker when the tab is hidden; teasers already stop via IntersectionObserver
  doc.addEventListener('visibilitychange', function () { VM.suspend(doc.hidden); });
})();
