/* =============================================
   ALBERTINA'S ANGELS 3D: "Firefly Ride" scroll scene
   Replaces the flat scrolling layout with a scroll-driven
   Three.js ride: the camera glides forward through a cluster
   of glowing violet/gold fireflies, while warm-glass DOM
   panels (.ride-panel) fade in and out per stop, matching the
   same is-active pattern index-3d.js and counseling-3d.js use
   for their own beats.

   Distinct from counseling's Harbor Ride on purpose: this is a
   dark, ambient night scene built from this page's own dragonfly/
   wing-vein motif and its violet/gold/wing tokens, matching this
   project's "a family's memory, made legible to strangers" thesis
   instead of borrowing Harbor Ride's identity.

   Deliberately built differently from counseling-3d.js in one
   important way: there is NO JS-driven scroll-to-snap loop here.
   Section snapping is handled entirely by CSS `scroll-snap-type: y
   proximity` (see albertinas-angels.css). A native proximity snap
   and a JS scrollTo loop fighting over the same scroll position is
   what caused the mobile stutter/rubber-banding on the counseling
   page — this page only ever has one thing driving scroll position:
   the person scrolling. Which panel is "active" is likewise handled
   by IntersectionObserver rather than a per-scroll-event
   getBoundingClientRect scan, since it's cheaper and isn't affected
   by the iOS address-bar-resize drift that made counseling's panels
   occasionally go stale scrolling back up.

   Requires albertinas-angels.html to load three.js (r128) before
   this file, and to define:
     <canvas id="fireflies"></canvas>
     <div class="vein-spine" id="veinSpine"></div>
     <div class="ride-track"> containing
       <section class="ride-scene" data-scene="N">
         <div class="ride-panel">...</div>
       </section>
     one of which also carries [data-carousel] and the carousel
     control markup (see albertinas-angels.html for the exact
     structure), plus the existing #lightbox markup already on
     the page.

   No prefers-reduced-motion branch, by design: same "always
   running" call already made for matrix-bg.js, the homepage's
   Portal Warp scene, and counseling's Harbor Ride.
============================================= */
(function () {
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

  /* ---------- bioluminescent bloom sprite ----------
     A tiny hot white-violet core that feathers out through several
     soft gradient stops into a wide, low-opacity halo. This is what
     makes a single point of light in the dark actually read as
     "glowing" rather than "a colored dot" — rendered at a larger
     canvas size so the falloff is smooth, not banded. */
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

  /* ---------- flash curve ----------
     Models how a real firefly actually flashes: a quick rise to peak
     brightness, then a slow decay back to near-dark, resting mostly
     dim between flashes — not a smooth symmetric sine pulse. */
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
      period[i] = 2.2 + Math.random() * 3.2;   // seconds per flash cycle
      offset[i] = Math.random() * 10;           // desync starting point
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

  var DEPTH = 190; // covers the full ride length regardless of scene count
  var layerNear = makeFireflyLayer(isMobile ? 170 : 320, { x: 34, y: 20, z: DEPTH }, VIOLET, 0.62, 0.16);
  var layerFar  = makeFireflyLayer(isMobile ? 70 : 140,  { x: 46, y: 27, z: DEPTH }, GOLD,   0.9,  0.10);
  var fireflyLayers = [layerNear, layerFar];

  /* ---------- scenes: one z position per .ride-scene, evenly spaced ----------
     Six dense stops exist twice in the DOM — once as a single
     data-device="desktop" stop, once split into two shorter
     data-device="mobile" stops (see albertinas-angels.css) — so the
     scene list here is filtered to whichever variant applies at the
     current breakpoint. Shared stops (hero, meta, hook, problem,
     brand identity, carousel) have no data-device attribute and
     always pass through. */
  var allSceneEls = Array.prototype.slice.call(document.querySelectorAll('.ride-scene'));
  function filterScenes() {
    return allSceneEls.filter(function (el) {
      var device = el.getAttribute('data-device');
      if (!device) return true;
      return isMobile ? device === 'mobile' : device === 'desktop';
    });
  }
  var sceneEls = filterScenes();
  var sceneZ = sceneEls.map(function (el, i) { return 8 - i * 16; });
  var carouselIndex = sceneEls.findIndex(function (el) { return el.hasAttribute('data-carousel'); });

  /* ---------- track height: source of truth lives here, not in CSS ----------
     Same reasoning as counseling-3d.js: 100vh alone drifts from the
     real visible viewport on mobile as the address bar collapses and
     expands, so the height is measured in real pixels here instead. */
  var track = document.querySelector('.ride-track');
  function syncTrackHeight() {
    if (!track) return;
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    track.style.height = (sceneEls.length * vh) + 'px';
  }
  syncTrackHeight();

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var nowMobile = window.matchMedia('(max-width: 760px)').matches;
      if (nowMobile !== isMobile) {
        isMobile = nowMobile;
        sceneEls = filterScenes();
        sceneZ = sceneEls.map(function (el, i) { return 8 - i * 16; });
        carouselIndex = sceneEls.findIndex(function (el) { return el.hasAttribute('data-carousel'); });
        observeScenes();
      }
      syncTrackHeight();
    }, 150);
  });

  /* ---------- which panel is active: IntersectionObserver ----------
     Decoupled entirely from the scroll listener that drives the
     camera below, so nothing here ever competes with native scroll
     handling. A panel is "active" once more than half of it is in
     view, which reads naturally with proximity snap since a settled
     scroll position always lands one panel clearly dominant. */
  var activeScene = 0;
  var io = null;
  function observeScenes() {
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-active', entry.isIntersecting && entry.intersectionRatio > 0.5);
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          var idx = sceneEls.indexOf(entry.target);
          if (idx !== -1 && idx !== activeScene) {
            if (activeScene === carouselIndex) { zoomed = false; updateCaption(); }
            activeScene = idx;
          }
        }
      });
    }, { threshold: [0, 0.5, 0.75, 1] });
    sceneEls.forEach(function (el) { io.observe(el); });
  }
  observeScenes();
  if (sceneEls[0]) sceneEls[0].classList.add('is-active');

  /* ---------- wing-vein progress fill ----------
     Reuses the page's existing --vein-progress custom property (see
     .vein-spine in albertinas-angels.css), now driven by the ride's
     own scroll fraction instead of full document height, since the
     ride track is what actually represents "through the story" here. */
  var veinSpine = document.getElementById('veinSpine');

  var progress = 0;
  var targetZ = sceneZ[0];
  function readProgress() {
    var max = track.offsetHeight - window.innerHeight;
    progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    targetZ = sceneZ[0] - progress * (sceneZ[0] - sceneZ[sceneZ.length - 1]);
    if (veinSpine) veinSpine.style.setProperty('--vein-progress', (progress * 100) + '%');
  }
  window.addEventListener('scroll', readProgress, { passive: true });
  readProgress();

  /* ============================================================
     CAROUSEL: rigged to the camera (a "HUD" group whose transform is
     copied from the camera every frame, then pushed forward), so the
     screens stay large, centered, and sharply in focus regardless of
     where the ride camera is. The fireflies blur into a soft backdrop
     behind it instead of competing for attention.
     ============================================================ */
  var hudGroup = new THREE.Group();
  scene.add(hudGroup);

  var shots = [
    { file: 'images/albertinas-homepage.png', label: 'Homepage', desc: 'Our Mission hero with a group photo of community members, and the Donorbox donation widget beside the mission statement.' },
    { file: 'images/albertinas-donate.png', label: 'Donation page', desc: 'Make a Difference donate page — appeal copy on the left, the Donorbox amount selector with preset buttons on the right.' },
    { file: 'images/albertinas-news.png', label: 'EN/ES updates feed', desc: 'Nuevas Noticias — year-by-year program summaries and photo galleries from 2020 through 2023, in English and Spanish.' }
  ];

  var FRAME_W = 800, FRAME_H = 500;
  function frameTexture(img) {
    var c = document.createElement('canvas');
    c.width = FRAME_W; c.height = FRAME_H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#F6EFDF';
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    var scale = Math.max(FRAME_W / img.width, FRAME_H / img.height);
    var dw = img.width * scale, dh = img.height * scale;
    var dx = (FRAME_W - dw) / 2, dy = 0;
    ctx.drawImage(img, dx, dy, dw, dh);
    return new THREE.CanvasTexture(c);
  }
  function loadingTexture() {
    var c = document.createElement('canvas');
    c.width = FRAME_W; c.height = FRAME_H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#2A2438';
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    ctx.fillStyle = '#C9B8F0';
    ctx.font = '500 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Loading...', FRAME_W / 2, FRAME_H / 2);
    return new THREE.CanvasTexture(c);
  }

  var carouselMeshes = shots.map(function (s, i) {
    var geo = new THREE.PlaneGeometry(2.6, 1.625);
    var mat = new THREE.MeshBasicMaterial({ map: loadingTexture(), transparent: true, side: THREE.DoubleSide, opacity: 1 });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { label: s.label, desc: s.desc, index: i };
    hudGroup.add(mesh);

    var edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x9C8FC4, transparent: true, opacity: 0.45 })
    );
    mesh.add(edges);

    // No crossOrigin flag: same-folder, same-origin images — setting
    // crossOrigin on a local/static load is what silently breaks
    // textures under some static servers (the fix already applied on
    // the homepage and counseling).
    var img = new Image();
    img.onload = function () { mat.map = frameTexture(img); mat.map.needsUpdate = true; };
    img.onerror = function () { console.warn('[Firefly Ride] could not load ' + s.file); };
    img.src = s.file;

    return mesh;
  });

  var centerIndex = 0;
  var zoomed = false;

  function wrap(i) { return (i + shots.length) % shots.length; }
  function diffFromCenter(i) {
    var d = i - centerIndex;
    if (d > shots.length / 2) d -= shots.length;
    if (d < -shots.length / 2) d += shots.length;
    return d;
  }
  function goTo(i) { centerIndex = wrap(i); zoomed = false; updateCaption(); updateDots(); }
  function nextShot() { goTo(centerIndex + 1); }
  function prevShot() { goTo(centerIndex - 1); }

  var captionTitle = document.getElementById('captionTitle');
  var captionBody = document.getElementById('captionBody');
  var backBtn = document.getElementById('carouselBack');
  function updateCaption() {
    var s = shots[centerIndex];
    if (captionTitle) captionTitle.textContent = s.label;
    if (captionBody) captionBody.textContent = s.desc;
    if (backBtn) backBtn.classList.toggle('is-visible', zoomed);
  }
  var dotsWrap = document.getElementById('carouselDots');
  if (dotsWrap) {
    shots.forEach(function (s, i) {
      var b = document.createElement('button');
      b.className = 'carousel-dot';
      b.type = 'button';
      b.setAttribute('aria-label', 'Go to ' + s.label);
      b.addEventListener('click', function () { goTo(i); });
      dotsWrap.appendChild(b);
    });
  }
  function updateDots() {
    if (!dotsWrap) return;
    Array.prototype.forEach.call(dotsWrap.children, function (d, i) {
      d.classList.toggle('is-active', i === centerIndex);
    });
  }
  updateCaption();
  updateDots();

  var prevBtn = document.getElementById('carouselPrev');
  var nextBtn = document.getElementById('carouselNext');
  if (prevBtn) prevBtn.addEventListener('click', prevShot);
  if (nextBtn) nextBtn.addEventListener('click', nextShot);
  if (backBtn) backBtn.addEventListener('click', function () { zoomed = false; updateCaption(); });

  /* ---------- lightbox: real full-resolution view ----------
     Reuses the #lightbox markup already on the page (same
     .lightbox/.lightbox-img/.lightbox-close classes/styles already
     defined in albertinas-angels.css) — distinct from the 3D
     "zoomed" state above, which just enlarges the centered screen in
     place within the ride scene. Page scroll is frozen while it's
     open, both because the scroll-driven camera has no business
     moving behind an open overlay, and to stop the proximity snap
     from fighting the frozen background. */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxClose = document.getElementById('lightboxClose');
  var expandBtn = document.getElementById('carouselExpand');
  var lightboxOpen = false;
  var scrollLockY = 0;

  function openLightbox() {
    if (!lightbox || !lightboxImg) return;
    var s = shots[centerIndex];
    lightboxImg.src = s.file;
    lightboxImg.alt = s.label + ' — full-size screenshot';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    lightboxOpen = true;
    scrollLockY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxOpen = false;
    document.documentElement.style.overflow = '';
    window.scrollTo(0, scrollLockY);
    if (expandBtn) expandBtn.focus();
  }

  if (expandBtn) expandBtn.addEventListener('click', openLightbox);
  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  /* ---------- swipe (touch only) + tap-to-zoom on the carousel ----------
     A touch drag that's clearly horizontal cycles the carousel, same
     as the arrow buttons. A mostly-vertical drag is left alone
     entirely, since with touch-action: pan-y the browser has already
     claimed it as a page scroll. Mouse drags don't trigger swipe
     navigation, only a tap does. This part of counseling's approach
     wasn't the buggy part, so it's kept as-is. */
  var SWIPE_MIN_PX = 28;
  var SWIPE_DOMINANCE_RATIO = 1.4;
  var TAP_MAX_DRAG_PX = 6;

  var dragStartX = 0, dragStartY = 0, dragging = false, dragDist = 0, dragIsTouch = false, activePointerId = null;
  canvas.addEventListener('pointerdown', function (e) {
    if (activeScene !== carouselIndex || lightboxOpen) return;
    dragging = true; dragDist = 0;
    dragStartX = e.clientX; dragStartY = e.clientY;
    dragIsTouch = e.pointerType === 'touch';
    activePointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var d = Math.abs(e.clientX - dragStartX) + Math.abs(e.clientY - dragStartY);
    if (d > dragDist) dragDist = d;
  });
  function releasePointer() {
    dragging = false;
    if (activePointerId !== null && canvas.hasPointerCapture && canvas.hasPointerCapture(activePointerId)) {
      canvas.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
  }
  function endDrag(e) {
    if (!dragging) return;
    var dx = e.clientX - dragStartX;
    var dy = e.clientY - dragStartY;
    var wasTouch = dragIsTouch;
    var dist = dragDist;
    releasePointer();
    if (activeScene !== carouselIndex || lightboxOpen) return;
    if (wasTouch && Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * SWIPE_DOMINANCE_RATIO) {
      dx < 0 ? nextShot() : prevShot();
    } else if (dist < TAP_MAX_DRAG_PX) {
      handleCarouselTap(e);
    }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', releasePointer);

  var raycaster = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  function handleCarouselTap(e) {
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(carouselMeshes);
    if (!hits.length) return;
    var hitIndex = hits[0].object.userData.index;
    if (hitIndex === centerIndex) {
      zoomed = !zoomed;
      updateCaption();
    } else {
      goTo(hitIndex);
    }
  }

  /* ---------- keyboard support for the carousel ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lightboxOpen) { closeLightbox(); return; }
    if (activeScene !== carouselIndex || lightboxOpen) return;
    if (e.key === 'ArrowLeft') { prevShot(); }
    else if (e.key === 'ArrowRight') { nextShot(); }
    else if (e.key === 'Enter' || e.key === ' ') {
      zoomed = !zoomed;
      updateCaption();
      e.preventDefault();
    }
  });

  /* ---------- main loop ---------- */
  var clock = new THREE.Clock();
  var fwd = new THREE.Vector3();
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    var inCarousel = activeScene === carouselIndex;

    camera.position.z += (targetZ - camera.position.z) * 0.055;
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
        if (inCarousel) brightness *= 0.45; // recede behind the carousel, don't compete with it
        col[i * 3]     = layer.base.r * brightness;
        col[i * 3 + 1] = layer.base.g * brightness;
        col[i * 3 + 2] = layer.base.b * brightness;
      }
      layer.geo.attributes.position.needsUpdate = true;
      layer.geo.attributes.color.needsUpdate = true;
    });

    hudGroup.position.copy(camera.position);
    hudGroup.quaternion.copy(camera.quaternion);
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    hudGroup.position.addScaledVector(fwd, 4.4);
    hudGroup.visible = inCarousel;

    carouselMeshes.forEach(function (m) {
      var d = diffFromCenter(m.userData.index);
      var isCenter = d === 0;
      var targetX = zoomed && isCenter ? 0 : d * 2.05;
      var targetZm = zoomed && isCenter ? 1.1 : -Math.abs(d) * 0.5;
      var targetRotY = zoomed && isCenter ? 0 : d * -0.55;
      var targetScale = zoomed && isCenter ? 1.55 : (isCenter ? 1.15 : 0.72);
      var targetOpacity = zoomed && !isCenter ? 0 : (isCenter ? 1 : 0.55);

      m.position.x += (targetX - m.position.x) * 0.12;
      m.position.z += (targetZm - m.position.z) * 0.12;
      m.rotation.y += (targetRotY - m.rotation.y) * 0.12;
      m.scale.x += (targetScale - m.scale.x) * 0.12;
      m.scale.y += (targetScale - m.scale.y) * 0.12;
      m.material.opacity += (targetOpacity - m.material.opacity) * 0.12;
      m.renderOrder = isCenter ? 2 : 1;
    });

    renderer.render(scene, camera);
  }
  animate();
})();
