/* =============================================
   COUNSELING 3D: "Harbor Ride" scroll scene
   Scroll-driven Three.js backdrop: the camera glides forward
   over a wireframe current past soft buoy markers, while glass
   DOM panels (.ride-panel) fade in and out per stop.

   Navigation is true continuous native scroll, matching the
   big-cat-rescue-3d.js model exactly: the page scrolls normally
   (no wheel/touch interception, no forced per-gesture jumps,
   no CSS scroll-snap), and the camera's Z position is driven
   continuously off window.scrollY every frame. The .ride-scene
   nearest the current scroll position is tracked as "active"
   (drives the opacity toggle and the water/mist freeze state)
   purely by rounding scroll progress — no IntersectionObserver.
   Keyboard Up/Down/PageUp/PageDown/Home/End still jump a full
   beat at a time via the browser's own smooth scroll.

   Previously this used `scroll-snap-type: y proximity` (see
   counseling.css) plus an IntersectionObserver to pick the
   active panel. That combination is what caused the mobile
   "boomerang": resize events fired by the collapsing/expanding
   iOS address bar kept re-measuring .ride-track's height mid-
   scroll, and proximity-snap would then yank the scroll position
   toward the nearest snap target. Removing snap entirely (there
   is now exactly one thing driving scroll position: the person
   scrolling) and computing the active panel from scroll math
   instead of a second, async observer removes both the fight
   and the jerk.

   The screenshot carousel is now a flat-DOM filmstrip (real
   <img> tags, horizontal scroll-snap, drag/swipe/arrows/dots,
   tap-to-zoom into the lightbox) instead of a Three.js-rigged
   HUD carousel — normal page content inside .ride-panel, no
   raycasting needed. While that stop is active, the Harbor
   scene freezes (water swell, mist, camera bob all hold still)
   rather than continuing to animate behind it.

   Requires counseling.html to load three.js (r128) before this
   file, and to define:
     <canvas id="ride-canvas"></canvas>
     <div class="ride-track"> containing
       <section class="ride-scene" data-scene="N" [data-device] [data-carousel]>
         <div class="ride-panel">...</div>
       one of which, for the carousel stop, also contains a
       .filmstrip-track + .filmstrip-dots + .filmstrip-arrows
       (see big-cat-rescue.html for the exact markup shape).

   No prefers-reduced-motion branch, by design — matching every
   other ride script on this site.
============================================= */
(function () {
  var canvas = document.getElementById('ride-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  var isMobile = window.matchMedia('(max-width: 760px)').matches;

  /* ---------- palette, pulled straight from counseling.css ---------- */
  var MIST = 0xF0F6FA;
  var HARBOR = 0x0F4C66;
  var CURRENT = 0x2F7A9E;
  var SEAFOAM = 0xA9D2C8;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(MIST);
  scene.fog = new THREE.Fog(MIST, 10, 42);

  var camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(0, 1.6, 12);

  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  /* ---------- water: wireframe plane, gentle vertex swell ---------- */
  var waterSegs = isMobile ? 34 : 60;
  var waterGeo = new THREE.PlaneGeometry(120, 260, 30, waterSegs);
  waterGeo.rotateX(-Math.PI / 2);
  var waterMat = new THREE.MeshBasicMaterial({ color: CURRENT, wireframe: true, transparent: true, opacity: 0.28 });
  var water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = -2.4;
  scene.add(water);
  var waterBase = waterGeo.attributes.position.array.slice();

  /* ---------- drifting mist particles ---------- */
  var mistCount = isMobile ? 120 : 260;
  var mistGeo = new THREE.BufferGeometry();
  var mistPos = new Float32Array(mistCount * 3);
  for (var i = 0; i < mistCount; i++) {
    mistPos[i * 3] = (Math.random() - 0.5) * 40;
    mistPos[i * 3 + 1] = Math.random() * 6 - 1;
    mistPos[i * 3 + 2] = -Math.random() * 220 + 10;
  }
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  var mistMat = new THREE.PointsMaterial({ color: SEAFOAM, size: 0.12, transparent: true, opacity: 0.45 });
  var mistPoints = new THREE.Points(mistGeo, mistMat);
  scene.add(mistPoints);

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

  /* ---------- buoy markers at each scene depth ---------- */
  var buoys = [];
  function rebuildBuoys() {
    buoys.forEach(function (b) { scene.remove(b); });
    buoys = [];
    sceneZ.forEach(function (z, i) {
      var geo = new THREE.SphereGeometry(0.22, 16, 16);
      var mat = new THREE.MeshBasicMaterial({ color: i % 2 ? SEAFOAM : CURRENT, transparent: true, opacity: 0.85 });
      var buoy = new THREE.Mesh(geo, mat);
      buoy.position.set(i % 2 === 0 ? -3.2 : 3.2, -0.6, z);
      scene.add(buoy);
      buoys.push(buoy);
    });
  }
  rebuildBuoys();

  /* ---------- track height: real pixels, from the actual filtered scene count ----------
     Same reasoning as big-cat-rescue-3d.js: 100vh alone drifts from the real
     visible viewport on mobile as the address bar collapses/expands, so the
     height is measured in real pixels here instead of left to CSS. */
  var track = document.querySelector('.ride-track');
  function syncTrackHeight() {
    if (!track) return;
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    track.style.height = (beats.length * vh) + 'px';
  }
  syncTrackHeight();

  /* ---------- continuous native-scroll navigation ----------
     No wheel/touch interception and no forced jumps, no CSS scroll-snap: the
     page scrolls exactly the way the browser wants it to, and the camera Z
     position + active beat + water/mist freeze state are all just a
     continuous function of window.scrollY, recomputed on every scroll tick. */
  var activeIndex = -1;
  var frozen = false;

  function trackScrollHeight() {
    return Math.max(0, track.offsetHeight - window.innerHeight);
  }
  function beatScrollY(index) {
    var th = trackScrollHeight();
    if (beats.length <= 1 || th === 0) return 0;
    return (index / (beats.length - 1)) * th;
  }
  function setActive(idx) {
    if (idx === activeIndex) return;
    if (activeIndex !== -1 && carouselIndices.indexOf(activeIndex) !== -1) {
      // leaving the carousel stop resets its zoom/back state, so it's
      // never left mid-interaction the next time it scrolls into view
      filmstripZoomOut();
    }
    activeIndex = idx;
    beats.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
  }
  function renderAtScrollY(y) {
    var th = trackScrollHeight();
    var progress = th > 0 ? Math.min(1, Math.max(0, y / th)) : 0;
    camera.userData.targetZ = sceneZ[0] - progress * (sceneZ[0] - sceneZ[sceneZ.length - 1]);
    var idx = Math.round(progress * (beats.length - 1));
    setActive(idx);
    frozen = carouselIndices.indexOf(idx) !== -1;
  }

  /* rAF-throttled scroll listener: cheap enough to run every tick, but never
     more than once per frame even if the browser fires scroll faster than that */
  var scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      renderAtScrollY(window.scrollY);
      scrollTicking = false;
    });
  }, { passive: true });

  /* keyboard still jumps a full beat, but via the browser's own smooth scroll
     rather than a custom rAF animation — the scroll listener above takes care
     of updating the camera/active-state as that native scroll plays out */
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

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var nowMobile = window.matchMedia('(max-width: 760px)').matches;
      if (nowMobile !== isMobile) {
        isMobile = nowMobile;
        computeScenes();
        rebuildBuoys();
      }
      syncTrackHeight();
      renderAtScrollY(window.scrollY);
    }, 150);
  });

  renderAtScrollY(window.scrollY);

  /* ---------- render loop ---------- */
  var clock = new THREE.Clock();
  var bobAmpCurrent = 1;
  function animate() {
    requestAnimationFrame(animate);
    var targetBobAmp = frozen ? 0.3 : 1;
    bobAmpCurrent += (targetBobAmp - bobAmpCurrent) * 0.06;

    var t = clock.getElapsedTime();

    camera.position.z += ((camera.userData.targetZ || sceneZ[0]) - camera.position.z) * 0.06;
    camera.position.y = 1.6 + Math.sin(t * 0.55) * 0.12 * bobAmpCurrent;
    camera.rotation.z = Math.sin(t * 0.35) * 0.012 * bobAmpCurrent;

    buoys.forEach(function (b, i) { b.position.y = -0.6 + Math.sin(t * 0.8 + i) * 0.15; });

    mistPoints.rotation.y += 0.0004;
    var mp = mistGeo.attributes.position.array;
    for (var i = 0; i < mistCount; i++) {
      mp[i * 3 + 1] += 0.0025;
      if (mp[i * 3 + 1] > 5) mp[i * 3 + 1] = -1;
    }
    mistGeo.attributes.position.needsUpdate = true;

    var wp = waterGeo.attributes.position.array;
    for (var j = 0; j < wp.length; j += 3) {
      wp[j + 1] = waterBase[j + 1] + Math.sin(t * 0.6 + wp[j] * 0.15 + wp[j + 2] * 0.1) * 0.18;
    }
    waterGeo.attributes.position.needsUpdate = true;
    waterMat.opacity += ((frozen ? 0.1 : 0.28) - waterMat.opacity) * 0.05;
    mistMat.opacity += ((frozen ? 0.15 : 0.45) - mistMat.opacity) * 0.05;

    renderer.render(scene, camera);
  }
  animate();

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
     Same shared pattern as big-cat-rescue-3d.js's initFilmstrip: real <img>
     tags in a horizontally scroll-snapping track, native swipe/drag/arrows/
     dots, tap-to-zoom into the lightbox. Replaces the old Three.js HUD
     carousel (hudGroup/carouselMeshes/raycaster/pointer-swipe rigging)
     entirely — that machinery is removed, not just unused. */
  var filmstripZoomOut = function () {}; // reassigned once the filmstrip below initializes

  function initFilmstrip(prefix, shots) {
    var track = document.getElementById(prefix + 'Track');
    var dotsWrap = document.getElementById(prefix + 'Dots');
    var prevBtn = document.getElementById(prefix + 'Prev');
    var nextBtn = document.getElementById(prefix + 'Next');
    if (!track) return;

    var index = 0;

    function render() {
      track.innerHTML = '';
      if (dotsWrap) dotsWrap.innerHTML = '';
      shots.forEach(function (shot, i) {
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

        if (dotsWrap && shots.length > 1) {
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'dot' + (i === index ? ' is-active' : '');
          dot.setAttribute('aria-label', 'Go to ' + shot.label);
          dot.addEventListener('click', function () { index = i; scrollToIndex(true); });
          dotsWrap.appendChild(dot);
        }
      });
      if (dotsWrap) dotsWrap.style.display = shots.length > 1 ? 'flex' : 'none';
      if (prevBtn) prevBtn.style.display = shots.length > 1 ? 'flex' : 'none';
      if (nextBtn) nextBtn.style.display = shots.length > 1 ? 'flex' : 'none';
    }

    function scrollToIndex(smooth) {
      var cards = track.querySelectorAll('.film-shot');
      cards.forEach(function (c, i) { c.classList.toggle('is-center', i === index); });
      var dots = dotsWrap ? dotsWrap.querySelectorAll('.dot') : [];
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
      var target = cards[index];
      if (target) target.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', inline: 'center', block: 'nearest' });
    }

    function next() { index = Math.min(shots.length - 1, index + 1); scrollToIndex(true); }
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

    filmstripZoomOut = function () { /* no persistent 3D "zoomed" state anymore — kept as a no-op hook */ };

    render();
    scrollToIndex(false);
  }

  initFilmstrip('filmstripScreens', [
    { file: 'images/counseling-homepage.png', label: 'Homepage' },
    { file: 'images/counseling-contact.png', label: 'Contact' },
    { file: 'images/counseling-services.png', label: 'Services' }
  ]);
})();
