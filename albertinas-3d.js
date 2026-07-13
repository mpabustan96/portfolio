/* =============================================
   ALBERTINA'S ANGELS 3D: "Firefly Ride" scroll scene
   The camera glides forward through a cluster of glowing
   violet/gold fireflies, while warm-glass DOM panels
   (.ride-panel) fade in and out per stop.

   Navigation is true continuous native scroll, matching the
   big-cat-rescue-3d.js model exactly: the page scrolls normally
   (no wheel/touch interception, no forced per-gesture jumps,
   no CSS scroll-snap), and the camera's Z position + the
   wing-vein progress fill are both driven continuously off
   window.scrollY every frame. The .ride-scene nearest the
   current scroll position is tracked as "active" purely by
   rounding scroll progress — no IntersectionObserver.

   Previously this page already avoided the JS-driven scroll-to-
   snap loop (see the old header comment below, kept for context),
   but it still set `scroll-snap-type: y proximity` on <html> (see
   albertinas-angels.css) and used IntersectionObserver to decide
   the active panel. That pairing is what caused the mobile
   "boomerang": resize events fired by the collapsing/expanding
   iOS address bar kept re-measuring .ride-track's height mid-
   scroll (see syncTrackHeight), and proximity-snap would then
   yank the scroll position toward the nearest snap target. With
   snap removed entirely, there is now exactly one thing driving
   scroll position: the person scrolling.

   A second, subtler source of the same boomerang remained even
   after that: the scroll-progress math below used to read
   window.innerHeight live on every scroll tick, and that value
   itself changes continuously on mobile as the address bar
   collapses/expands. viewportH is now cached once and only
   re-measured on a genuine resize (see the width-gated resize
   handler), which removes that feedback loop too.

   The screenshot carousel is now a flat-DOM filmstrip (real
   <img> tags, horizontal scroll-snap, drag/swipe/arrows/dots,
   tap-to-zoom into the lightbox) instead of a Three.js-rigged
   HUD carousel — normal page content inside .ride-panel, no
   raycasting needed.

   Requires albertinas-angels.html to load three.js (r128) before
   this file, and to define:
     <canvas id="fireflies"></canvas>
     <div class="vein-spine" id="veinSpine"></div>
     <div class="ride-track"> containing
       <section class="ride-scene" data-scene="N" [data-device] [data-carousel]>
         <div class="ride-panel">...</div>
       one of which, for the carousel stop, also contains a
       .filmstrip-track + .filmstrip-dots + .filmstrip-arrows
       (see big-cat-rescue.html for the exact markup shape), plus
       the existing #lightbox markup already on the page.

   No prefers-reduced-motion branch, by design: same "always
   running" call already made for matrix-bg.js, the homepage's
   Portal Warp scene, and Harbor Ride.
============================================= */
(function () {
  /* Force every load/reload to start at the top of the page. Mobile
     browsers restore the previous scroll position by default, which,
     combined with this page being one continuous scroll-driven "ride",
     made a reload appear to drop the visitor wherever they'd last
     scrolled to (often a carousel stop). Disabling automatic scroll
     restoration and forcing scrollTo(0,0) up front — on script start,
     on 'load', and on a bfcache restore via 'pageshow' — guarantees a
     fresh visit always starts at the hero. */
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);
  window.addEventListener('load', function () { window.scrollTo(0, 0); });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) window.scrollTo(0, 0);
  });

  var canvas = document.getElementById('fireflies');
  if (!canvas || typeof THREE === 'undefined') return;

  var isMobile = window.matchMedia('(max-width: 760px)').matches;

  /* ---------- palette, pulled straight from albertinas-angels.css ---------- */
  var VIOLET = 0xC9B8F0;   // near-white violet core, matches --violet family
  var GOLD = 0xE6D98A;     // warm gold accent layer, matches the palette's #DBBA00

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(0, 0, 10);

  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  /* ---------- bioluminescent bloom sprite ---------- */
  function glowTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.06, 'rgba(232,222,250,0.95)');
    g.addColorStop(0.16, 'rgba(197,178,235,0.75)');
    g.addColorStop(0.36, 'rgba(156,143,196,0.32)');
    g.addColorStop(0.65, 'rgba(120,100,180,0.10)');
    g.addColorStop(1,    'rgba(98,47,219,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  var glowTex = glowTexture();

  /* ---------- flash curve ---------- */
  function flashCurve(x) {
    if (x < 0.18) return x / 0.18;
    var d = (x - 0.18) / 0.82;
    return Math.max(0, 1 - d) * (1 - d * 0.3);
  }

  function makeFireflyLayer(count, spread, baseColor, sizeBase, restBrightness) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var col = new Float32Array(count * 3);
    var period = new Float32Array(count);
    var offset = new Float32Array(count);
    var drift = new Float32Array(count);
    var driftPhase = new Float32Array(count);
    var c = new THREE.Color(baseColor);
    for (var i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * spread.x;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread.y;
      pos[i * 3 + 2] = -Math.random() * spread.z + 6;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      period[i] = 2.2 + Math.random() * 3.2;
      offset[i] = Math.random() * 10;
      drift[i] = 0.15 + Math.random() * 0.35;
      driftPhase[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({
      map: glowTex, size: sizeBase, transparent: true,
      vertexColors: true, blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true, opacity: 1
    });
    var pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return {
      points: pts, geo: geo, period: period, offset: offset,
      drift: drift, driftPhase: driftPhase, base: c, count: count, rest: restBrightness
    };
  }

  var DEPTH = 190;
  var layerNear = makeFireflyLayer(isMobile ? 170 : 320, { x: 34, y: 20, z: DEPTH }, VIOLET, 0.62, 0.16);
  var layerFar  = makeFireflyLayer(isMobile ? 70 : 140,  { x: 46, y: 27, z: DEPTH }, GOLD,   0.9,  0.10);
  var fireflyLayers = [layerNear, layerFar];

  /* ---------- scenes: one z position per .ride-scene, filtered by device ---------- */
  var allSceneEls = Array.prototype.slice.call(document.querySelectorAll('.ride-scene'));
  var beats = [];
  var sceneZ = [];
  var carouselIndices = [];

  function computeScenes() {
    beats = allSceneEls.filter(function (el) {
      var device = el.getAttribute('data-device');
      if (!device) return true;
      return isMobile ? device === 'mobile' : device === 'desktop';
    });
    sceneZ = beats.map(function (el, i) { return 8 - i * 16; });
    carouselIndices = [];
    beats.forEach(function (el, i) { if (el.hasAttribute('data-carousel')) carouselIndices.push(i); });
  }
  computeScenes();

  /* ---------- track height: real pixels, from the actual filtered scene count ----------
     viewportH is captured once here and only re-measured on a genuine
     resize (see the width-gated resize handler below), rather than
     read live every scroll tick — see the file header comment for why
     that live read was the root cause of the mobile boomerang. */
  var track = document.querySelector('.ride-track');
  var viewportH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  function syncTrackHeight() {
    if (!track) return;
    viewportH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    track.style.height = (beats.length * viewportH) + 'px';
  }
  syncTrackHeight();

  /* ---------- continuous native-scroll navigation ----------
     No wheel/touch interception, no forced jumps, no CSS scroll-snap:
     the page scrolls exactly the way the browser wants it to, and the
     camera Z position + wing-vein progress + active beat are all just
     a continuous function of window.scrollY, recomputed on every
     scroll tick. */
  var veinSpine = document.getElementById('veinSpine');
  var activeIndex = -1;
  var frozen = false;

  function trackScrollHeight() {
    return Math.max(0, track.offsetHeight - viewportH);
  }
  function beatScrollY(index) {
    var th = trackScrollHeight();
    if (beats.length <= 1 || th === 0) return 0;
    return (index / (beats.length - 1)) * th;
  }
  function setActive(idx) {
    if (idx === activeIndex) return;
    if (activeIndex !== -1 && carouselIndices.indexOf(activeIndex) !== -1) {
      zoomed = false;
      updateCaption();
    }
    activeIndex = idx;
    beats.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
  }
  function renderAtScrollY(y) {
    var th = trackScrollHeight();
    var progress = th > 0 ? Math.min(1, Math.max(0, y / th)) : 0;
    if (veinSpine) veinSpine.style.setProperty('--vein-progress', (progress * 100) + '%');
    camera.userData.targetZ = sceneZ[0] - progress * (sceneZ[0] - sceneZ[sceneZ.length - 1]);
    var idx = Math.round(progress * (beats.length - 1));
    setActive(idx);
    frozen = carouselIndices.indexOf(idx) !== -1;
  }

  var scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      renderAtScrollY(window.scrollY);
      scrollTicking = false;
    });
  }, { passive: true });

  window.addEventListener('keydown', function (e) {
    var navKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];
    if (navKeys.indexOf(e.key) === -1) return;
    var active = document.activeElement;
    if (active && active.closest && active.closest('.filmstrip-track, .filmstrip-arrows')) return;
    if (lightboxOpen) return;
    e.preventDefault();
    var target = activeIndex;
    switch (e.key) {
      case 'ArrowDown': case 'PageDown': case ' ': target = activeIndex + 1; break;
      case 'ArrowUp': case 'PageUp': target = activeIndex - 1; break;
      case 'Home': target = 0; break;
      case 'End': target = beats.length - 1; break;
    }
    target = Math.max(0, Math.min(beats.length - 1, target));
    window.scrollTo({ top: beatScrollY(target), left: 0, behavior: 'smooth' });
  });

  /* Width-gated resize: mobile browsers fire 'resize' whenever the
     address bar collapses/expands, which only ever changes
     innerHeight, never innerWidth. Reacting to that with a full
     recompute is exactly what fed the boomerang above, so real work
     here only runs when the width actually changes (device rotation,
     or a real window resize on desktop) — height-only churn from the
     address bar is ignored entirely, and viewportH stays exactly as
     captured until a genuine resize occurs. */
  var lastWidth = window.innerWidth;
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      var nowMobile = window.matchMedia('(max-width: 760px)').matches;
      if (nowMobile !== isMobile) {
        isMobile = nowMobile;
        computeScenes();
      }
      syncTrackHeight();
      renderAtScrollY(window.scrollY);
    }, 150);
  });

  renderAtScrollY(window.scrollY);

  /* ============================================================
     Screenshot metadata used by the filmstrip carousel below —
     kept as plain data (no more Three.js HUD-plane rigging).
     ============================================================ */
  var shots = [
    { file: 'images/albertinas-homepage.png', label: 'Homepage' },
    { file: 'images/albertinas-donate.png', label: 'Donation page' },
    { file: 'images/albertinas-news.png', label: 'EN/ES updates feed' }
  ];
  var zoomed = false; // legacy hook, kept as a harmless no-op target for setActive() above
  function updateCaption() {}

  /* ---------- lightbox: real full-resolution view ----------
     Reuses the #lightbox markup already on the page. */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxClose = document.getElementById('lightboxClose');
  var lightboxOpen = false;
  var lightboxScrollLockY = 0;

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    lightboxOpen = true;
    lightboxScrollLockY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    if (lightboxClose) lightboxClose.focus();
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxOpen = false;
    document.documentElement.style.overflow = '';
    window.scrollTo(0, lightboxScrollLockY);
  }
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeLightbox(); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightbox && lightbox.classList.contains('is-open')) closeLightbox();
  });

  /* ---------- flat-DOM filmstrip carousel ----------
     Same shared pattern as big-cat-rescue-3d.js's initFilmstrip.
     Replaces the old Three.js HUD carousel (hudGroup/carouselMeshes/
     raycaster/pointer-swipe rigging) entirely. */
  function initFilmstrip(prefix, shotList) {
    var track = document.getElementById(prefix + 'Track');
    var dotsWrap = document.getElementById(prefix + 'Dots');
    var prevBtn = document.getElementById(prefix + 'Prev');
    var nextBtn = document.getElementById(prefix + 'Next');
    if (!track) return;

    var index = 0;

    function render() {
      track.innerHTML = '';
      if (dotsWrap) dotsWrap.innerHTML = '';
      shotList.forEach(function (shot, i) {
        var card = document.createElement('div');
        card.className = 'film-shot' + (i === index ? ' is-center' : '');
        var img = document.createElement('img');
        img.src = shot.file;
        img.alt = shot.label;
        img.loading = 'lazy';
        card.appendChild(img);
        var label = document.createElement('span');
        label.className = 'film-label';
        label.textContent = shot.label;
        card.appendChild(label);
        card.addEventListener('click', function () {
          if (i === index) {
            openLightbox(shot.file, shot.label);
          } else {
            index = i;
            scrollToIndex(true);
          }
        });
        track.appendChild(card);

        if (dotsWrap && shotList.length > 1) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'dot' + (i === index ? ' is-active' : '');
          dot.setAttribute('aria-label', 'Go to ' + shot.label);
          dot.addEventListener('click', function () { index = i; scrollToIndex(true); });
          dotsWrap.appendChild(dot);
        }
      });
      if (dotsWrap) dotsWrap.style.display = shotList.length > 1 ? 'flex' : 'none';
      if (prevBtn) prevBtn.style.display = shotList.length > 1 ? 'flex' : 'none';
      if (nextBtn) nextBtn.style.display = shotList.length > 1 ? 'flex' : 'none';
    }

    function scrollToIndex(smooth) {
      var cards = track.querySelectorAll('.film-shot');
      cards.forEach(function (c, i) { c.classList.toggle('is-center', i === index); });
      var dots = dotsWrap ? dotsWrap.querySelectorAll('.dot') : [];
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
      var target = cards[index];
      if (!target) return;
      /* Scroll the filmstrip's own horizontal scroll position directly,
         instead of target.scrollIntoView(). scrollIntoView moves EVERY
         scrollable ancestor into view, including the outer page — this
         runs on load, so it was what silently scrolled the whole page
         down to the carousel stop on every load. track.scrollTo only
         ever touches this one horizontal strip. */
      var left = target.offsetLeft - (track.clientWidth - target.clientWidth) / 2;
      track.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'instant' });
    }

    function next() { index = Math.min(shotList.length - 1, index + 1); scrollToIndex(true); }
    function prev() { index = Math.max(0, index - 1); scrollToIndex(true); }
    if (nextBtn) nextBtn.addEventListener('click', next);
    if (prevBtn) prevBtn.addEventListener('click', prev);

    var scrollSettleTimer = null;
    function syncFromScroll() {
      var cards = Array.prototype.slice.call(track.querySelectorAll('.film-shot'));
      if (!cards.length) return;
      var center = track.scrollLeft + track.clientWidth / 2;
      var best = 0, bestDist = Infinity;
      cards.forEach(function (c, i) {
        var d = Math.abs((c.offsetLeft + c.offsetWidth / 2) - center);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      if (best === index) return;
      index = best;
      cards.forEach(function (c, i) { c.classList.toggle('is-center', i === index); });
      var dots = dotsWrap ? dotsWrap.querySelectorAll('.dot') : [];
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
    }
    track.addEventListener('scroll', function () {
      clearTimeout(scrollSettleTimer);
      scrollSettleTimer = setTimeout(syncFromScroll, 100);
    }, { passive: true });

    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.stopPropagation(); prev(); }
      else if (e.key === 'ArrowRight') { e.stopPropagation(); next(); }
    });

    render();
    scrollToIndex(false);
  }

  initFilmstrip('filmstripScreens', shots);

  /* ---------- main loop ---------- */
  var clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();

    camera.position.z += ((camera.userData.targetZ || sceneZ[0]) - camera.position.z) * 0.055;
    camera.position.x = Math.sin(t * 0.06) * 0.6;
    camera.position.y = Math.sin(t * 0.08) * 0.35;

    fireflyLayers.forEach(function (layer) {
      var p = layer.geo.attributes.position.array;
      var col = layer.geo.attributes.color.array;
      for (var i = 0; i < layer.count; i++) {
        p[i * 3]     += Math.cos(t * layer.drift[i] * 0.6 + layer.driftPhase[i]) * 0.0025;
        p[i * 3 + 1] += Math.sin(t * layer.drift[i] + layer.driftPhase[i]) * 0.0022;

        var cyclePos = ((t + layer.offset[i]) % layer.period[i]) / layer.period[i];
        var brightness = layer.rest + (1 - layer.rest) * flashCurve(cyclePos);
        if (frozen) brightness *= 0.45; // recede a bit while the filmstrip has focus
        col[i * 3]     = layer.base.r * brightness;
        col[i * 3 + 1] = layer.base.g * brightness;
        col[i * 3 + 2] = layer.base.b * brightness;
      }
      layer.geo.attributes.position.needsUpdate = true;
      layer.geo.attributes.color.needsUpdate = true;
    });

    renderer.render(scene, camera);
  }
  animate();
})();
