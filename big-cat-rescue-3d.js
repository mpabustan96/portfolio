/* =============================================
   BIG CAT RESCUE 3D: "Golden Hour Trail" scroll scene
   A jeep-dolly ride through a golden-hour savanna:
   gradient sky, a swaying wireframe grass plane,
   drifting dust, and a warm sun glow. No animal
   silhouettes or foreground scenery, by design — the
   real screenshots are the "cat" moment, not the
   background.

   Navigation is true continuous native scroll, the
   same model counseling-3d.js uses: the page scrolls
   normally (no wheel/touch interception, no forced
   per-gesture jumps), and the camera's Z position is
   driven continuously off window.scrollY every frame.
   The .ride-scene nearest the current scroll position
   is tracked as "active" (drives the opacity toggle and
   the freeze state) but nothing snaps the scroll itself.
   Keyboard Up/Down/PageUp/PageDown/Home/End still jump
   a full beat at a time, using the browser's own smooth
   scroll rather than a custom animation loop.

   Three stops carry [data-carousel]: real screenshots
   in a flat-DOM filmstrip (horizontal scroll-snap,
   drag/swipe/arrows/dots — no Three.js rigging or
   raycasting needed, since the carousel is normal page
   content inside .ride-panel, not a camera-rigged HUD).
   While one of those stops is active, the savanna scene
   freezes entirely (grass, dust, and camera bob all
   hold still) rather than continuing to animate behind it.

   Requires big-cat-rescue.html to load three.js (r128)
   before this file, and to define:
     <canvas id="safari-canvas"></canvas>
     <div id="safari-progress"></div>
     <div class="ride-track"> containing
       <section class="ride-scene" data-scene="N" [data-device] [data-carousel]>
         <div class="ride-panel">...</div>
       one of which, for each of the 3 carousel stops,
       also contains a .filmstrip-track + .filmstrip-dots
       + .filmstrip-arrows (see counseling.html precedent
       for the general stop markup shape).

   No prefers-reduced-motion branch, by design — matching
   every other ride script on this site.
============================================= */
(function () {
  var canvas = document.getElementById('safari-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  var isMobile = window.matchMedia('(max-width: 760px)').matches;

  /* ---------- palette, pulled straight from big-cat-rescue.css ---------- */
  var LAVA = 0x3A3A26;
  var OLIVE = 0x5C683A;
  var MANGO = 0xE3B633;
  var SAND = 0xE5D4A9;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));

  var scene = new THREE.Scene();

  function skyTexture() {
    var c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    var ctx = c.getContext('2d');
    var grd = ctx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#E3B633');
    grd.addColorStop(0.5, '#8A5A2A');
    grd.addColorStop(1, '#3A3A26');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 8, 256);
    return new THREE.CanvasTexture(c);
  }
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x8A5A2A, 18, 130);

  var camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(0, 1.5, 12);

  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  /* ---------- ground: wireframe savanna grass, gentle sway ---------- */
  var groundSegs = isMobile ? 30 : 50;
  var groundGeo = new THREE.PlaneGeometry(130, 300, 26, groundSegs);
  groundGeo.rotateX(-Math.PI / 2);
  var groundMat = new THREE.MeshBasicMaterial({ color: OLIVE, wireframe: true, transparent: true, opacity: 0.32 });
  var ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -2.2;
  scene.add(ground);
  var groundBase = groundGeo.attributes.position.array.slice();

  /* ---------- drifting golden dust ---------- */
  var dustCount = isMobile ? 110 : 240;
  var dustGeo = new THREE.BufferGeometry();
  var dustPos = new Float32Array(dustCount * 3);
  for (var i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 44;
    dustPos[i * 3 + 1] = Math.random() * 5 - 1.5;
    dustPos[i * 3 + 2] = -Math.random() * 230 + 10;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dustMat = new THREE.PointsMaterial({ color: SAND, size: 0.1, transparent: true, opacity: 0.4 });
  var dustPoints = new THREE.Points(dustGeo, dustMat);
  scene.add(dustPoints);

  /* ---------- sun glow, rigged loosely to the camera for parallax ---------- */
  function sunTexture() {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    var ctx = c.getContext('2d');
    var grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(252,234,168,0.95)');
    grd.addColorStop(0.4, 'rgba(227,182,51,0.55)');
    grd.addColorStop(1, 'rgba(227,182,51,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  var sunMat = new THREE.SpriteMaterial({ map: sunTexture(), transparent: true, depthWrite: false });
  var sun = new THREE.Sprite(sunMat);
  sun.scale.set(20, 20, 1);
  scene.add(sun);

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
    sceneZ = beats.map(function (el, i) { return 6 - i * 16; });
    carouselIndices = [];
    beats.forEach(function (el, i) { if (el.hasAttribute('data-carousel')) carouselIndices.push(i); });
  }
  computeScenes();

  /* ---------- track height: real pixels, from the actual filtered scene count ---------- */
  var track = document.querySelector('.ride-track');
  function syncTrackHeight() {
    if (!track) return;
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    track.style.height = (beats.length * vh) + 'px';
  }
  syncTrackHeight();

  /* ---------- continuous native-scroll navigation (counseling-3d.js pattern) ----------
     No wheel/touch interception and no forced jumps: the page scrolls exactly the
     way the browser wants it to, and the camera Z position + progress bar + active
     beat + carousel-freeze state are all just a continuous function of window.scrollY,
     recomputed on every scroll tick. */
  var progressBar = document.getElementById('safari-progress');
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
    activeIndex = idx;
    beats.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
  }
  function renderAtScrollY(y) {
    var th = trackScrollHeight();
    var progress = th > 0 ? Math.min(1, Math.max(0, y / th)) : 0;
    if (progressBar) progressBar.style.width = (progress * 100) + '%';
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
    var targetBobAmp = frozen ? 0 : 1;
    bobAmpCurrent += (targetBobAmp - bobAmpCurrent) * 0.06;

    camera.position.z += ((camera.userData.targetZ || sceneZ[0]) - camera.position.z) * 0.07;

    /* Ground and dust are fixed-size meshes (not big enough to span the whole
       track), so instead of scaling them up to match total scroll length —
       which would just run out again the next time a section gets added —
       we re-center both on the camera's Z every frame. The sway/drift math
       below reads each vertex's own local coordinates, so recentering the
       mesh doesn't disturb that animation; it just keeps "the horizon"
       extending endlessly around wherever the camera currently is. */
    ground.position.z = camera.position.z;
    dustPoints.position.z = camera.position.z;

    if (!frozen) {
      var t = clock.getElapsedTime();
      camera.position.y = 1.5 + Math.sin(t * 1.4) * 0.09 * bobAmpCurrent + Math.sin(t * 3.1) * 0.02 * bobAmpCurrent;
      camera.rotation.z = Math.sin(t * 0.9) * 0.015 * bobAmpCurrent;
      camera.rotation.x = Math.sin(t * 1.7) * 0.01 * bobAmpCurrent;

      var gp = groundGeo.attributes.position.array;
      for (var j = 0; j < gp.length; j += 3) {
        gp[j + 1] = groundBase[j + 1] + Math.sin(t * 0.5 + gp[j] * 0.12 + gp[j + 2] * 0.09) * 0.14;
      }
      groundGeo.attributes.position.needsUpdate = true;

      dustPoints.rotation.y += 0.0003;
      var dp = dustGeo.attributes.position.array;
      for (var k = 0; k < dustCount; k++) {
        dp[k * 3 + 1] += 0.0022;
        if (dp[k * 3 + 1] > 4.5) dp[k * 3 + 1] = -1.5;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }

    groundMat.opacity += ((frozen ? 0.32 : 0.32) - groundMat.opacity) * 0.05;
    dustMat.opacity += ((frozen ? 0.18 : 0.4) - dustMat.opacity) * 0.05;

    sun.position.set(camera.position.x - 5, camera.position.y + 6.5, camera.position.z - 55);

    renderer.render(scene, camera);
  }
  animate();

  /* ---------- filmstrip carousel (shared logic, 3 instances) ---------- */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxClose = document.getElementById('lightboxClose');
  var lightboxScrollLockY = 0;

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    lightboxScrollLockY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    if (lightboxClose) lightboxClose.focus();
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
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

    /* Native swipe/trackpad/drag-to-scroll handles the gesture itself (the
       track is a plain horizontal scroller with CSS scroll-snap); this just
       watches where scrolling settles and syncs index/dots/center state,
       the same way a typical image carousel keeps its indicator in sync. */
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

  initFilmstrip('filmstripAudit', [
    { file: 'images/big-cat-rescue-before.png', label: 'Old site' }
  ]);
  initFilmstrip('filmstripLofi', [
    { file: 'images/big-cat-rescue-lofi.png', label: 'Lo-fi wireframe' },
    { file: 'images/big-cat-rescue-hifi.png', label: 'Hi-fi homepage' }
  ]);
  initFilmstrip('filmstripBrand', [
    { file: 'images/big-cat-rescue-donation-1.png', label: 'Donate: amount' },
    { file: 'images/big-cat-rescue-donation-2.png', label: 'Donate: payment' },
    { file: 'images/big-cat-rescue-donation-3.png', label: 'Donate: confirm' },
    { file: 'images/big-cat-rescue-mobile-homepage.png', label: 'Mobile homepage' },
    { file: 'images/design-system-colors.png', label: 'Color system' },
    { file: 'images/design-system-typography.png', label: 'Type system' },
    { file: 'images/design-system-logos.png', label: 'Logo lockups' }
  ]);
})();
