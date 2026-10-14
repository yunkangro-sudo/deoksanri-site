/* Deoksan-ri landing - interactions (vanilla JS, no libraries) */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var header = document.getElementById('header');

  /* 1. Header: transparent -> white after scroll ------------------------ */
  var toTop = document.getElementById('toTop');
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
    if (!toTop) return;
    var show = window.scrollY > 480;
    toTop.classList.toggle('is-on', show);
    toTop.setAttribute('aria-hidden', show ? 'false' : 'true');
    toTop.tabIndex = show ? 0 : -1;
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* 2. Drawer menu ------------------------------------------------------- */
  var drawer = document.getElementById('drawer');
  var burger = document.getElementById('burger');
  var closeBtn = document.getElementById('drawerClose');
  var backdrop = document.getElementById('drawerBackdrop');

  function openDrawer() {
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-locked');
    window.setTimeout(function () { closeBtn.focus(); }, 60);
  }
  function closeDrawer(returnFocus) {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-locked');
    if (returnFocus) burger.focus();
  }
  burger.addEventListener('click', function () {
    if (drawer.classList.contains('is-open')) { closeDrawer(true); } else { openDrawer(); }
  });
  closeBtn.addEventListener('click', function () { closeDrawer(true); });
  backdrop.addEventListener('click', function () { closeDrawer(true); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer(true);
  });
  drawer.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function () { closeDrawer(false); });
  });
  // If the window is widened to desktop while the drawer is open, close it.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) {
    if (m.matches) closeDrawer(false);
  });

  /* 3. Scroll reveal (with stagger) ------------------------------------- */
  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    var step = parseFloat(group.getAttribute('data-stagger')) || 0.1;
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.classList.add('reveal');
      child.style.setProperty('--d', (i * step).toFixed(2) + 's');
    });
  });

  var targets = document.querySelectorAll('.reveal, .zoom');

  function animateCount(el) {
    var end = parseFloat(el.getAttribute('data-count'));
    if (isNaN(end) || reduceMotion) return;
    var duration = 1100;
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(end * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    el.textContent = '0';
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        entry.target.querySelectorAll('[data-count]').forEach(animateCount);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('is-in'); });
  }

  /* 4. Highlight current menu group ------------------------------------- */
  var navLinks = document.querySelectorAll('.nav__link[data-nav]');
  var navSections = document.querySelectorAll('section[data-nav]');
  var navTicking = false;

  function updateNav() {
    navTicking = false;
    var probe = window.innerHeight * 0.4; // reading line (40% from top)
    var current = null;
    navSections.forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) current = s.getAttribute('data-nav');
    });
    navLinks.forEach(function (link) {
      if (current && link.getAttribute('data-nav') === current) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }
  function requestNavUpdate() {
    if (!navTicking) { navTicking = true; requestAnimationFrame(updateNav); }
  }
  if (navSections.length) {
    updateNav();
    window.addEventListener('scroll', requestNavUpdate, { passive: true });
    window.addEventListener('resize', requestNavUpdate);
  }

  /* 5. Media list: filter + feature/list rendering ---------------------- */
  var mediaApp = document.getElementById('mediaApp');
  if (mediaApp) {
    var items = JSON.parse(document.getElementById('mediaData').textContent);
    var txt = mediaApp.dataset;
    var featureEl = document.getElementById('mediaFeature');
    var listEl = document.getElementById('mediaList');
    var toggleEl = document.getElementById('mediaToggle');
    var chips = mediaApp.querySelectorAll('#mediaFilters .chip');
    var filter = 'all';
    var expanded = false;
    var VISIBLE_ROWS = 3;

    var matches = function (i) {
      if (filter === 'all') return true;
      if (filter === 'news' || filter === 'youtube') return i.type === filter;
      return i.cat === filter;
    };
    var make = function (tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    };
    var linkLabel = function (i) { return i.type === 'youtube' ? txt.txtVideo : txt.txtNews; };
    var ytId = function (url) {
      var m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
      return m ? m[1] : '';
    };
    /* plays inside the page; created only after a click, so autoplay follows the user's action */
    var mountPlayer = function (item) {
      var stage = make('div', 'yt-frame');
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + ytId(item.url) + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      frame.title = item.title;
      frame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      stage.appendChild(frame);
      return stage;
    };

    /* external links: new tab + security attributes */
    var external = function (a, url, label) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (label) a.setAttribute('aria-label', label + ' (\uC0C8 \uCC3D)');
      return a;
    };

    /* One slide = one article. Image, title and "read original" all use the SAME item.url,
       so links can never get mixed up between articles. */
    var buildSlide = function (i, n, total) {
      var art = make('article', 'm-slide');
      art.setAttribute('role', 'group');
      art.setAttribute('aria-roledescription', 'slide');
      art.setAttribute('aria-label', (n + 1) + ' / ' + total);
      var thumb = i.type === 'youtube' ? make('button', 'thumb thumb--video') : external(make('a', 'thumb'), i.url, i.title);
      if (i.type === 'youtube') {
        thumb.type = 'button';
        thumb.addEventListener('click', function () { openVideo(i); });
      }
      var label = make('span', 'thumb__label', i.source + ' \u00B7 ' + i.kind);
      if (i.image) {
        /* real image is loaded later (data-src); if it fails, the default placeholder area is shown */
        var img = make('img');
        img.alt = '';
        img.decoding = 'async';
        if (i.pos) img.style.objectPosition = i.pos;
        img.setAttribute('data-src', i.image);
        /* "reference image" tag only on article illustrations; a video thumbnail is the video's own frame */
        var credit = i.type === 'youtube' ? null : make('span', 'thumb__credit', '\uCC38\uACE0 \uC774\uBBF8\uC9C0');
        img.addEventListener('error', function () {
          if (img.parentNode) img.parentNode.removeChild(img);
          if (credit && credit.parentNode) credit.parentNode.removeChild(credit);
          label.hidden = false;
        });
        thumb.appendChild(img);
        if (credit) thumb.appendChild(credit);
        label.hidden = true;
      }
      thumb.appendChild(label);
      art.appendChild(thumb);
      art.appendChild(make('p', 'm-meta', i.source + ' \u00B7 ' + i.kind));
      var h = make('h3', 'm-title');
      if (i.type === 'youtube') {
        var titleBtn = make('button', 'm-title__btn', i.title);
        titleBtn.type = 'button';
        titleBtn.addEventListener('click', function () { openVideo(i); });
        h.appendChild(titleBtn);
      } else {
        h.appendChild(external(make('a', '', i.title), i.url));
      }
      art.appendChild(h);
      art.appendChild(make('p', '', i.summary));
      var meta = make('p', 'small');
      meta.style.marginTop = '10px';
      meta.appendChild(document.createTextNode(i.date + ' \u00B7 '));
      if (i.type === 'youtube') {
        var watch = make('button', 'm-title__btn', linkLabel(i));
        watch.type = 'button';
        watch.addEventListener('click', function () { openVideo(i); });
        meta.appendChild(watch);
      } else {
        meta.appendChild(external(make('a', '', linkLabel(i)), i.url));
      }
      art.appendChild(meta);
      return art;
    };

    /* Image slider: 5s auto fade, prev/next, dots, play/pause, swipe, keyboard.
       Pauses on hover / focus / touch / hidden tab / off-screen. No autoplay with reduced motion. */
    var SLIDE_MS = 5000;
    var buildSlider = function (list, onChange) {
      var total = list.length;
      var many = total > 1;
      var wrap = make('div', 'm-slider');
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-roledescription', 'carousel');
      wrap.setAttribute('aria-label', '\uC8FC\uC694 \uB274\uC2A4');
      var track = make('div', 'm-slides');
      var slides = list.map(function (item, n) {
        var s = buildSlide(item, n, total);
        track.appendChild(s);
        return s;
      });
      wrap.appendChild(track);

      var cur = 0, timer = null;
      var userPaused = reduceMotion; /* reduced motion: starts stopped, user may press play */
      var hover = false, focusIn = false, touching = false, onScreen = true, alive = true;
      var dots = [], playBtn = null, observer = null;

      var loadImg = function (n) {
        var im = slides[(n + total) % total].querySelector('img[data-src]');
        if (im) { im.src = im.getAttribute('data-src'); im.removeAttribute('data-src'); }
      };
      var canRun = function () {
        return many && alive && !userPaused && !hover && !focusIn && !touching && onScreen && !document.hidden;
      };
      var schedule = function () {
        clearTimeout(timer);
        timer = null;
        track.setAttribute('aria-live', canRun() ? 'off' : 'polite');
        if (canRun()) timer = setTimeout(function () { go(cur + 1); schedule(); }, SLIDE_MS);
      };
      var go = function (n) {
        cur = (n + total) % total;
        slides.forEach(function (s, k) {
          var on = k === cur;
          s.classList.toggle('is-active', on);
          s.setAttribute('aria-hidden', on ? 'false' : 'true');
        });
        dots.forEach(function (d, k) {
          if (k === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });
        loadImg(cur);
        if (many) loadImg(cur + 1); /* preload only the next one */
        if (onChange) onChange(list[cur]);
      };
      var manual = function (n) { go(n); schedule(); };

      if (many) {
        var ctrl = make('div', 'm-ctrl');
        var prev = make('button', 'm-btn m-btn--prev');
        prev.type = 'button';
        prev.setAttribute('aria-label', '\uC774\uC804 \uAE30\uC0AC');
        prev.addEventListener('click', function () { manual(cur - 1); });
        var next = make('button', 'm-btn m-btn--next');
        next.type = 'button';
        next.setAttribute('aria-label', '\uB2E4\uC74C \uAE30\uC0AC');
        next.addEventListener('click', function () { manual(cur + 1); });
        var bar = make('div', 'm-bar');
        var dotWrap = make('div', 'm-dots');
        list.forEach(function (item, n) {
          var d = make('button', 'm-dot');
          d.type = 'button';
          d.setAttribute('aria-label', (n + 1) + '\uBC88\uC9F8 \uAE30\uC0AC \uBCF4\uAE30');
          d.addEventListener('click', function () { manual(n); });
          dotWrap.appendChild(d);
          dots.push(d);
        });
        playBtn = make('button', 'm-btn m-btn--play');
        playBtn.type = 'button';
        var syncPlay = function () {
          playBtn.classList.toggle('is-paused', userPaused);
          playBtn.setAttribute('aria-label', userPaused ? '\uC790\uB3D9 \uC804\uD658 \uC2DC\uC791' : '\uC790\uB3D9 \uC804\uD658 \uC77C\uC2DC\uC815\uC9C0');
        };
        playBtn.addEventListener('click', function () { userPaused = !userPaused; syncPlay(); schedule(); });
        syncPlay();
        bar.appendChild(dotWrap);
        bar.appendChild(playBtn);
        ctrl.appendChild(prev);
        ctrl.appendChild(next);
        ctrl.appendChild(bar);
        wrap.appendChild(ctrl);

        /* pause while the user is interacting */
        wrap.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hover = true; schedule(); } });
        wrap.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = false; schedule(); } });
        wrap.addEventListener('focusin', function () { focusIn = true; schedule(); });
        wrap.addEventListener('focusout', function (e) {
          if (!wrap.contains(e.relatedTarget)) { focusIn = false; schedule(); }
        });
        wrap.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowLeft') { e.preventDefault(); manual(cur - 1); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); manual(cur + 1); }
        });
        /* touch swipe */
        var sx = 0, sy = 0;
        wrap.addEventListener('touchstart', function (e) {
          sx = e.touches[0].clientX; sy = e.touches[0].clientY; touching = true; schedule();
        }, { passive: true });
        wrap.addEventListener('touchend', function (e) {
          touching = false;
          var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) manual(dx < 0 ? cur + 1 : cur - 1);
          else schedule();
        }, { passive: true });
        wrap.addEventListener('touchcancel', function () { touching = false; schedule(); }, { passive: true });

        document.addEventListener('visibilitychange', schedule);
        if ('IntersectionObserver' in window) {
          observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { onScreen = en.isIntersecting; schedule(); });
          }, { threshold: 0.25 });
          observer.observe(wrap);
        }
      }

      go(0);
      return {
        el: wrap,
        start: schedule,
        destroy: function () {
          alive = false;
          clearTimeout(timer);
          document.removeEventListener('visibilitychange', schedule);
          if (observer) observer.disconnect();
        }
      };
    };
    var buildRow = function (i) {
      if (i.type === 'youtube') {
        var b = make('button', 'm-row');
        b.type = 'button';
        b.addEventListener('click', function () { openVideo(i); });
        b.appendChild(make('span', 'm-row__kind', i.source + ' \u00B7 ' + i.kind + ' \u00B7 ' + i.date));
        b.appendChild(make('span', 'm-row__title', i.title));
        b.appendChild(make('span', 'm-row__sum', i.summary));
        return b;
      }
      var a = external(make('a', 'm-row'), i.url);
      a.appendChild(make('span', 'm-row__kind', i.source + ' \u00B7 ' + i.kind + ' \u00B7 ' + i.date));
      a.appendChild(make('span', 'm-row__title', i.title));
      a.appendChild(make('span', 'm-row__sum', i.summary));
      return a;
    };

    var slider = null;
    var rowEls = [];

    /* "show all" button only touches the right-hand list, so the slideshow keeps running */
    var syncList = function () {
      rowEls.forEach(function (row, idx) { row.hidden = idx >= VISIBLE_ROWS && !expanded; });
      toggleEl.hidden = rowEls.length <= VISIBLE_ROWS;
      toggleEl.textContent = expanded ? txt.txtLess : txt.txtMore;
      toggleEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    /* youtube category: one player on the page, started by the click (no new tab) */
    var renderPlayer = function (list, current) {
      var item = (current && list.indexOf(current) !== -1) ? current : list[0];
      var box = make('div', 'm-player');
      box.appendChild(mountPlayer(item));
      box.appendChild(make('p', 'm-meta', item.source + ' \u00B7 ' + item.kind));
      box.appendChild(make('h3', 'm-title', item.title));
      box.appendChild(make('p', '', item.summary));
      var meta = make('p', 'small');
      meta.style.marginTop = '10px';
      meta.textContent = item.date;
      box.appendChild(meta);
      featureEl.appendChild(box);
      rowEls.forEach(function (row) { row.classList.toggle('is-current', row._item === item); });
    };

    var renderMedia = function (playItem) {
      var shown = items.filter(matches);
      if (slider) { slider.destroy(); slider = null; }
      featureEl.textContent = '';
      listEl.textContent = '';
      rowEls = [];
      if (!shown.length) {
        featureEl.appendChild(make('p', 'small', txt.txtEmpty));
        toggleEl.hidden = true;
        return;
      }
      shown.forEach(function (i) {
        var row = buildRow(i);
        row._item = i;
        rowEls.push(row);
        listEl.appendChild(row);
      });
      if (filter === 'youtube') {
        renderPlayer(shown, playItem);
        syncList();
        return;
      }
      /* slides = articles that have an image; with none, show the first article with the placeholder */
      var withImg = shown.filter(function (i) { return i.image; });
      slider = buildSlider(withImg.length ? withImg : [shown[0]], function (cur) {
        rowEls.forEach(function (row) { row.classList.toggle('is-current', row._item === cur); });
      });
      featureEl.appendChild(slider.el);
      syncList();
      slider.start();
    };

    var openVideo = function (item) {
      filter = 'youtube';
      expanded = false;
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-filter') === 'youtube' ? 'true' : 'false');
      });
      renderMedia(item);
    };

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        filter = chip.getAttribute('data-filter');
        renderMedia();
      });
    });
    toggleEl.addEventListener('click', function () { expanded = !expanded; syncList(); });
    renderMedia();
  }

  /* 6. Region map: play-in animation + tab focus ------------------------- */
  var regionMap = document.getElementById('regionMap');
  if (regionMap) {
    var tabBtns = document.querySelectorAll('#regionTabs .chip');
    var panels = document.querySelectorAll('#regionPanels [data-panel]');
    if ('IntersectionObserver' in window) {
      var mapIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { regionMap.classList.add('play'); mapIo.disconnect(); }
        });
      }, { threshold: 0.3 });
      mapIo.observe(regionMap);
    } else {
      regionMap.classList.add('play');
    }
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var focus = btn.getAttribute('data-focus');
        tabBtns.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        regionMap.setAttribute('data-focus', focus);
        panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== focus; });
      });
    });
  }

  /* 6a. Hero title rotation (copy A <-> copy B) ------------------------- */
  var heroTitle = document.getElementById('heroTitle');
  if (heroTitle && !reduceMotion) {
    var slides = heroTitle.querySelectorAll('.h1-slide');
    var current = 0;
    var timer = null;
    var INTERVAL = 4800;

    var showSlide = function (next) {
      if (next === current) return;
      var prev = slides[current];
      var cur = slides[next];
      prev.classList.remove('is-active');
      prev.classList.add('is-out');
      prev.setAttribute('aria-hidden', 'true');
      cur.classList.remove('is-out');
      cur.classList.add('is-active');
      cur.removeAttribute('aria-hidden');
      setTimeout(function () { prev.classList.remove('is-out'); }, 800);
      current = next;
    };
    var start = function () {
      if (timer || document.hidden) return;
      timer = setInterval(function () { showSlide((current + 1) % slides.length); }, INTERVAL);
    };
    var stop = function () { clearInterval(timer); timer = null; };

    if (slides.length > 1) {
      var heroCopy = heroTitle.closest('.hero__copy') || heroTitle;
      /* Never rotate while the visitor is reading or focusing inside the hero copy */
      heroCopy.addEventListener('mouseenter', stop);
      heroCopy.addEventListener('mouseleave', start);
      heroCopy.addEventListener('focusin', stop);
      heroCopy.addEventListener('focusout', start);
      document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); } else { start(); } });
      /* Only run while the hero is on screen */
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) { start(); } else { stop(); } });
        }, { threshold: 0.3 }).observe(document.getElementById('hero'));
      } else {
        start();
      }
    }
  }

  /* 6b. 06 package keyword sequence ------------------------------------- */
  var pkg = document.getElementById('pkgStory');
  if (pkg) {
    var pkgWords = (pkg.getAttribute('data-words') || '').split(',');
    var pkgWordEl = document.getElementById('pkgWord');
    var pkgTicks = document.querySelectorAll('#pkgTicks li');
    var pkgTimers = [];
    var pkgRunning = false;

    var pkgClear = function () { pkgTimers.forEach(clearTimeout); pkgTimers = []; };
    var pkgShow = function (i) {
      pkgWordEl.textContent = pkgWords[i];
      pkgWordEl.classList.remove('is-swap');
      void pkgWordEl.offsetWidth;
      pkgWordEl.classList.add('is-swap');
      pkgTicks.forEach(function (t, n) { t.classList.toggle('is-on', n <= i); });
    };
    var pkgIndex = 0;
    var PKG_STEP = 1000; /* ms per keyword, loops forever while on screen */
    var pkgReset = function () {
      pkgClear(); pkgRunning = false; pkgIndex = 0;
      pkgWordEl.classList.remove('is-swap');
      pkgWordEl.textContent = pkgWords[0];
      pkgTicks.forEach(function (t) { t.classList.remove('is-on'); });
    };
    var pkgTick = function () {
      pkgShow(pkgIndex);
      pkgIndex = (pkgIndex + 1) % pkgWords.length;
      /* hold the last keyword a little longer before restarting */
      var wait = (pkgIndex === 0) ? PKG_STEP + 500 : PKG_STEP;
      pkgTimers.push(setTimeout(pkgTick, wait));
    };
    var pkgPlay = function () {
      if (pkgRunning) return;
      pkgRunning = true;
      pkgTick();
    };

    /* keeps rotating while visible; pauses off-screen; reduced-motion users get the swap without slide */
    if ('IntersectionObserver' in window) {
      pkgReset();
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { pkgPlay(); }
          else { pkgClear(); pkgRunning = false; }
        });
      }, { threshold: 0.2 }).observe(pkg);
    }
  }

  /* 5b. Field video (cinematic section): poster -> in-page player on click.
     The YouTube iframe is created only after the click, so nothing third-party loads before that. */
  (function () {
    var stage = document.getElementById('cineStage');
    var btn = document.getElementById('cinePlay');
    var frame = document.getElementById('cineFrame');
    if (!stage || !btn || !frame) return;
    btn.addEventListener('click', function () {
      var id = stage.getAttribute('data-yt');
      if (!id || stage.classList.contains('is-playing')) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.title = '용인 반도체 클러스터 공사현장 영상';
      f.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      f.setAttribute('allowfullscreen', '');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.appendChild(f);
      stage.classList.add('is-playing');
    });
  })();

  /* 6b. Deoksan-ri photo galleries: two independent fade sliders ---------
     Photos come from the #galleryData JSON (one array per slider). */
  (function () {
    var dataEl = document.getElementById('galleryData');
    var roots = document.querySelectorAll('[data-gallery]');
    if (!dataEl || !roots.length) return;
    var data;
    try { data = JSON.parse(dataEl.textContent); } catch (err) { return; }
    var GAL_MS = 5000;

    var el = function (tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text) n.textContent = text;
      return n;
    };
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };

    roots.forEach(function (root) {
      var list = data[root.getAttribute('data-gallery')] || [];
      var mount = root.querySelector('.gal__mount');
      if (!list.length || !mount) return;
      var total = list.length, many = total > 1;
      var label = root.getAttribute('data-label') || '';

      mount.setAttribute('role', 'group');
      mount.setAttribute('aria-roledescription', 'carousel');
      mount.setAttribute('aria-label', label);

      var stage = el('div', 'gal__stage');
      var slides = list.map(function (p, n) {
        var s = el('figure', 'gal__slide');
        s.setAttribute('role', 'group');
        s.setAttribute('aria-roledescription', 'slide');
        s.setAttribute('aria-label', (n + 1) + ' / ' + total);
        var im = document.createElement('img');
        im.alt = p.alt || p.cap || '';
        im.width = 1200; im.height = 900;
        im.decoding = 'async';
        im.sizes = '(min-width: 1280px) 600px, (min-width: 900px) 48vw, 100vw';
        im.setAttribute('data-src', p.img + '-1200.webp');
        im.setAttribute('data-srcset', p.img + '-640.webp 640w, ' + p.img + '-1200.webp 1200w');
        im.addEventListener('error', function () { s.classList.add('is-broken'); });
        s.appendChild(im);
        s.appendChild(el('span', 'gal__ph', '사진 준비 중'));
        stage.appendChild(s);
        return s;
      });
      mount.appendChild(stage);

      var cap = el('p', 'gal__cap');
      var count = el('span', 'gal__count');
      var cur = 0, timer = null;
      var hover = false, focusIn = false, touching = false, onScreen = true, observer = null;

      var loadImg = function (n) {
        var im = slides[(n + total) % total].querySelector('img[data-src]');
        if (!im) return;
        im.srcset = im.getAttribute('data-srcset');
        im.src = im.getAttribute('data-src');
        im.removeAttribute('data-src');
        im.removeAttribute('data-srcset');
      };
      var canRun = function () {
        return many && !reduceMotion && !hover && !focusIn && !touching && onScreen && !document.hidden;
      };
      var schedule = function () {
        clearTimeout(timer);
        timer = null;
        cap.setAttribute('aria-live', canRun() ? 'off' : 'polite');
        if (canRun()) timer = setTimeout(function () { go(cur + 1); schedule(); }, GAL_MS);
      };
      var go = function (n) {
        cur = (n + total) % total;
        slides.forEach(function (s, k) {
          var on = k === cur;
          s.classList.toggle('is-active', on);
          s.setAttribute('aria-hidden', on ? 'false' : 'true');
        });
        loadImg(cur);
        if (many) { loadImg(cur + 1); loadImg(cur - 1); }
        cap.textContent = list[cur].cap || '';
        count.textContent = pad(cur + 1) + ' / ' + pad(total);
      };
      /* any manual move restarts this slider's 5s timer */
      var manual = function (n) { go(n); schedule(); };

      if (many) {
        var prev = el('button', 'gal__btn gal__btn--prev');
        prev.type = 'button';
        prev.setAttribute('aria-label', '이전 사진');
        prev.addEventListener('click', function () { manual(cur - 1); });
        var next = el('button', 'gal__btn gal__btn--next');
        next.type = 'button';
        next.setAttribute('aria-label', '다음 사진');
        next.addEventListener('click', function () { manual(cur + 1); });
        stage.appendChild(prev);
        stage.appendChild(next);
        stage.appendChild(count);

        mount.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hover = true; schedule(); } });
        mount.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hover = false; schedule(); } });
        mount.addEventListener('focusin', function () { focusIn = true; schedule(); });
        mount.addEventListener('focusout', function (e) {
          if (!mount.contains(e.relatedTarget)) { focusIn = false; schedule(); }
        });
        mount.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowLeft') { e.preventDefault(); manual(cur - 1); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); manual(cur + 1); }
        });

        /* touch swipe (horizontal only, so vertical page scroll still works) */
        var sx = 0, sy = 0;
        stage.addEventListener('touchstart', function (e) {
          sx = e.touches[0].clientX; sy = e.touches[0].clientY; touching = true; schedule();
        }, { passive: true });
        stage.addEventListener('touchend', function (e) {
          touching = false;
          var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) manual(dx < 0 ? cur + 1 : cur - 1);
          else schedule();
        }, { passive: true });
        stage.addEventListener('touchcancel', function () { touching = false; schedule(); }, { passive: true });

        document.addEventListener('visibilitychange', schedule);
        if ('IntersectionObserver' in window) {
          observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { onScreen = en.isIntersecting; schedule(); });
          }, { threshold: 0.25 });
          observer.observe(mount);
        }
      }

      mount.appendChild(cap);
      go(0);
      schedule();
    });
  })();

  /* 7. Apply form -> Google Apps Script web app (data-endpoint) --------- */
  var form = document.getElementById('applyForm');
  if (form) {
    var statusEl = document.getElementById('formStatus');
    var submitBtn = form.querySelector('button[type="submit"]');
    var sending = false;

    var setStatus = function (msg, kind) {
      statusEl.textContent = msg;
      statusEl.setAttribute('data-kind', kind || '');
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      var endpoint = (form.getAttribute('data-endpoint') || '').trim();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      /* Not connected yet: keep the page honest instead of faking success */
      if (!endpoint) {
        setStatus('(시안) 아직 전송 서비스가 연결되지 않았습니다.', 'info');
        return;
      }

      var tel = form.elements.tel.value.replace(/[^0-9]/g, '');
      if (tel.length < 9 || tel.length > 11) {
        setStatus('연락처를 다시 확인해 주세요.', 'error');
        form.elements.tel.focus();
        return;
      }

      var body = new URLSearchParams();
      body.set('name', form.elements.name.value.trim());
      body.set('tel', form.elements.tel.value.trim());
      body.set('email', form.elements.email.value.trim());
      body.set('consent', form.elements.consent.checked ? 'yes' : '');
      body.set('website', form.elements.website ? form.elements.website.value : '');
      body.set('page', location.href.slice(0, 300));

      sending = true;
      submitBtn.disabled = true;
      setStatus('접수 중입니다...', 'info');

      fetch(endpoint, { method: 'POST', body: body })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.ok) {
            form.reset();
            setStatus('신청이 접수되었습니다. 확인 후 연락드리겠습니다.', 'ok');
          } else {
            throw new Error('rejected');
          }
        })
        .catch(function () {
          setStatus('전송에 실패했습니다. 잠시 후 다시 시도하시거나 010-5784-2505로 문의해 주세요.', 'error');
        })
        .then(function () { sending = false; submitBtn.disabled = false; });
    });
  }
})();
