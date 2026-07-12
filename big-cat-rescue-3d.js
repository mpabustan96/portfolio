/* =============================================
   BIG CAT RESCUE 3D: "Prowl Ride" scroll scene
   Replaces the flat scrolling layout with a
   scroll-driven Three.js ride: the camera pushes
   forward through open night air toward a warm
   vanishing-point glow, with fireflies drifting at
   varying depths, while glass DOM panels
   (.ride-panel) fade in and out per stop. Same
   is-active toggling pattern as index-3d.js's
   .pw-beat and counseling-3d.js's .ride-scene.

   Point of view is deliberately a fast, low prowl,
   not a leisurely dolly: this is the counseling
   Harbor Ride's structural twin, but built to feel
   like something moving quickly and low to the
   ground at night, closing distance on that glow.
   No leaves, no animal, no prey are rendered — the
   motion and the glow carry the "hunt" feeling on
   their own, deliberately restrained.

   Palette pulled straight from big-cat-rescue.css's
   own brand tokens (--lava, --olive, --mango,
   --rusty, --sand) rather than borrowing counseling's
   harbor blues, matching this page's own identity.

   One stop (marked with [data-carousel] in the HTML)
   hosts the screenshot carousel: all ten project
   screenshots — the old site, lo-fi/hi-fi mockups,
   the three donation-flow screens, the mobile
   homepage, and the three design-system sheets —
   rigged to the camera exactly like counseling's
   carousel, so they're always large, centered, and
   in focus regardless of camera movement.

   Requires big-cat-rescue.html to load three.js
   (r128) before this file, and to define:
     <canvas id="ride-canvas"></canvas>
     <div class="ride-track"> containing
       <section class="ride-scene" data-scene="N">
         <div class="ride-panel">...</div>
       </section>
     one of which also carries [data-carousel] and
     the carousel control markup (see
     big-cat-rescue.html for the exact structure).

   No prefers-reduced-motion branch, by design: same
   "always running" call already made for
   matrix-bg.js, index-3d.js, and counseling-3d.js.
============================================= */
(function () {
  var canvas = document.getElementById('ride-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  var isMobile = window.matchMedia('(max-width: 760px)').matches;

  /* ---------- palette, pulled straight from big-cat-rescue.css ---------- */
  var LAVA = 0x14140C;
  var OLIVE = 0x5C683A;
  var MANGO = 0xE3B633;
  var RUSTY = 0xE33346;
  var SAND = 0xE5D4A9;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(LAVA);
  scene.fog = new THREE.Fog(LAVA, 8, 90);

  var camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(0, 1.4, 12);

  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  /* ---------- vanishing-point glow ----------
     A single additive-blended billboard sprite, always
     re-centered a fixed distance ahead of the camera along
     its forward vector (same "rig to the camera" trick the
     carousel HUD below uses), so it always reads as the
     point the camera is prowling toward, never as a fixed
     object the camera passes. Drawn once onto a canvas
     radial gradient in mango, same "canvas texture" approach
     counseling-3d.js uses for its screenshot frames. */
  function glowTexture() {
    var c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, 'rgba(227,182,51,0.95)');
    g.addColorStop(0.35, 'rgba(227,182,51,0.45)');
    g.addColorStop(1, 'rgba(227,182,51,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    return new THREE.CanvasTexture(c);
  }
  var glowMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 });
  var glowSprite = new THREE.Sprite(glowMat);
  glowSprite.scale.set(30, 30, 1);
  scene.add(glowSprite);
  var glowFwd = new THREE.Vector3();

  /* ---------- fireflies: warm drifting points ----------
     Sizes vary per-particle (bigger ones read as "closer"),
     and THREE.PointsMaterial's default perspective size
     attenuation already makes every firefly grow as the
     camera approaches it and shrink as it falls behind —
     exactly the "grow with depth, no streaks" motion called
     for, with no per-frame trail logic needed. Colors mix
     mango, sand, and a few rusty embers for warmth variety,
     same restraint counseling's mist uses with a single hue. */
  var fireflyCount = isMobile ? 140 : 260;
  var fGeo = new THREE.BufferGeometry();
  var fPos = new Float32Array(fireflyCount * 3);
  var fCol = new Float32Array(fireflyCount * 3);
  var fSize = new Float32Array(fireflyCount);
  var mangoC = new THREE.Color(MANGO), sandC = new THREE.Color(SAND), rustyC = new THREE.Color(RUSTY);
  for (var i = 0; i < fireflyCount; i++) {
    fPos[i * 3] = (Math.random() - 0.5) * 44;
    fPos[i * 3 + 1] = Math.random() * 7 - 1.5;
    fPos[i * 3 + 2] = -Math.random() * 230 + 12;
    var pick = Math.random();
    var col = pick < 0.7 ? mangoC : (pick < 0.9 ? sandC : rustyC);
    fCol[i * 3] = col.r; fCol[i * 3 + 1] = col.g; fCol[i * 3 + 2] = col.b;
    fSize[i] = 0.08 + Math.random() * 0.18;
  }
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  var fMat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  var fireflies = new THREE.Points(fGeo, fMat);
  scene.add(fireflies);
  var fDrift = new Float32Array(fireflyCount);
  for (var d = 0; d < fireflyCount; d++) fDrift[d] = Math.random() * Math.PI * 2;

  /* ---------- scenes: one z position per .ride-scene, evenly spaced ----------
     Several dense stops exist twice in the DOM — once as a
     single data-device="desktop" stop, once split into
     shorter data-device="mobile" stops (see
     big-cat-rescue.css) — so the scene list here is filtered
     to whichever variant applies at the current breakpoint,
     the same 760px breakpoint used everywhere else in this
     file (isMobile above) and in big-cat-rescue.css. */
  var allSceneEls = Array.prototype.slice.call(document.querySelectorAll('.ride-scene'));
  var sceneEls = allSceneEls.filter(function (el) {
    var device = el.getAttribute('data-device');
    if (!device) return true;
    return isMobile ? device === 'mobile' : device === 'desktop';
  });
  var sceneZ = sceneEls.map(function (el, i) { return 8 - i * 16; });
  var carouselIndex = sceneEls.findIndex(function (el) { return el.hasAttribute('data-carousel'); });

  /* ---------- track height: source of truth lives here, not in CSS ----------
     Same reasoning as counseling-3d.js's syncTrackHeight: a
     hand-calculated vh value in CSS drifts out of sync
     whenever a scene is added or removed, and "100vh" itself
     doesn't reliably mean "the visible viewport" on mobile
     browsers with a collapsing address bar. Measured in real
     pixels from the actual scene count instead. */
  var track = document.querySelector('.ride-track');
  function syncTrackHeight() {
    if (!track) return;
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    track.style.height = (sceneEls.length * vh) + 'px';
  }
  syncTrackHeight();
  var trackResizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(trackResizeTimer);
    trackResizeTimer = setTimeout(function () {
      var nowMobile = window.matchMedia('(max-width: 760px)').matches;
      if (nowMobile !== isMobile) {
        isMobile = nowMobile;
        sceneEls = allSceneEls.filter(function (el) {
          var device = el.getAttribute('data-device');
          if (!device) return true;
          return isMobile ? device === 'mobile' : device === 'desktop';
        });
        sceneZ = sceneEls.map(function (el, i) { return 8 - i * 16; });
        carouselIndex = sceneEls.findIndex(function (el) { return el.hasAttribute('data-carousel'); });
        observeScenes();
      }
      syncTrackHeight();
      updateScroll();
    }, 150);
  });

  /* ============================================================
     CAROUSEL: rigged to the camera (a "HUD" group whose
     transform is copied from the camera every frame, then
     pushed forward), so the screens are always large,
     centered, and sharply in focus regardless of where the
     ride camera is or how it's bobbing. All ten project
     screenshots live in one combined carousel stop rather
     than being scattered near their sections.
     ============================================================ */
  var hudGroup = new THREE.Group();
  scene.add(hudGroup);

  var shots = [
    { file: 'images/big-cat-rescue-before.png', label: 'The old site', desc: 'The dated, cluttered layout the redesign replaced.' },
    { file: 'images/big-cat-rescue-lofi.png', label: 'Lo-fi wireframe', desc: 'Grayscale layout locking nav, carousel, search, and mission before any styling.' },
    { file: 'images/big-cat-rescue-hifi.png', label: 'Hi-fi homepage', desc: 'The full styled redesign, hero through footer.' },
    { file: 'images/big-cat-rescue-donation-1.png', label: 'Donate: amount', desc: 'One-time and monthly toggles with preset gift amounts.' },
    { file: 'images/big-cat-rescue-donation-2.png', label: 'Donate: payment', desc: 'Card entry and billing info fields.' },
    { file: 'images/big-cat-rescue-donation-3.png', label: 'Donate: confirm', desc: 'Confirm button next to a Charity Navigator trust badge.' },
    { file: 'images/big-cat-rescue-mobile-homepage.png', label: 'Mobile homepage', desc: 'Hero, mission statement, and Give Now button on mobile.' },
    { file: 'images/design-system-colors.png', label: 'Color system', desc: 'The olive-and-mango brand palette with usage notes.' },
    { file: 'images/design-system-typography.png', label: 'Type system', desc: 'Rubik Mono One and Work Sans across desktop and mobile.' },
    { file: 'images/design-system-logos.png', label: 'Logo lockups', desc: 'Full-color, black, and white marks, plus the 30th-anniversary badge.' }
  ];

  var FRAME_W = 800, FRAME_H = 500;
  function frameTexture(img) {
    var c = document.createElement('canvas');
    c.width = FRAME_W; c.height = FRAME_H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
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
    ctx.fillStyle = '#4A5430';
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    ctx.fillStyle = '#E5D4A9';
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
      new THREE.LineBasicMaterial({ color: MANGO, transparent: true, opacity: 0.4 })
    );
    mesh.add(edges);

    var img = new Image();
    img.onload = function () { mat.map = frameTexture(img); mat.map.needsUpdate = true; };
    img.onerror = function () { console.warn('[Prowl Ride] could not load ' + s.file); };
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

  /* ---------- lightbox: real full-resolution view ---------- */
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

  /* ---------- scroll -> camera dolly + active-scene toggling ---------- */
  var progress = 0;
  var activeScene = -1;

  function updateScroll() {
    var trackHeight = track.offsetHeight - window.innerHeight;
    progress = Math.min(1, Math.max(0, trackHeight > 0 ? window.scrollY / trackHeight : 0));
    camera.userData.targetZ = sceneZ[0] - progress * (sceneZ[0] - sceneZ[sceneZ.length - 1]);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  camera.userData.targetZ = sceneZ[0];

  /* ---------- active-scene detection: IntersectionObserver ---------- */
  var sceneObserver = null;
  function setActiveScene(idx) {
    if (idx === activeScene) return;
    if (idx !== carouselIndex && activeScene === carouselIndex) {
      zoomed = false;
      updateCaption();
    }
    activeScene = idx;
    sceneEls.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
  }
  function observeScenes() {
    if (sceneObserver) sceneObserver.disconnect();
    sceneObserver = new IntersectionObserver(function (entries) {
      var best = null;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (!best || entry.intersectionRatio > best.intersectionRatio) best = entry;
      });
      if (best) {
        var idx = sceneEls.indexOf(best.target);
        if (idx !== -1) setActiveScene(idx);
      }
    }, { threshold: [0.5, 0.6, 0.7, 0.8, 0.9, 1] });
    sceneEls.forEach(function (el) { sceneObserver.observe(el); });
  }
  observeScenes();
  setActiveScene(0);

  /* ---------- swipe (touch only) + tap-to-zoom on the carousel ---------- */
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

  /* ---------- main loop ----------
     Camera catch-up lerp is faster than counseling's 0.06
     (a "quick prowl" push, not a leisurely dolly), and the
     bob/sway amplitude and frequency are both higher too, so
     the ride reads as low, fast, and a little unsteady —
     closing distance on the glow rather than gliding past it. */
  var clock = new THREE.Clock();
  var fwd = new THREE.Vector3();
  function animate() {
    requestAnimationFrame(animate);
    var t = clock.getElapsedTime();
    var inCarousel = activeScene === carouselIndex;
    var bobAmp = inCarousel ? 0.25 : 1;

    camera.position.z += (camera.userData.targetZ - camera.position.z) * 0.11;
    camera.position.y = 1.4 + Math.sin(t * 1.4) * 0.16 * bobAmp;
    camera.position.x = Math.sin(t * 0.9) * 0.22 * bobAmp;
    camera.rotation.z = Math.sin(t * 0.8) * 0.02 * bobAmp;

    fireflies.rotation.y += 0.0003;
    var fp = fGeo.attributes.position.array;
    for (var i = 0; i < fireflyCount; i++) {
      fp[i * 3 + 1] += Math.sin(t * 0.6 + fDrift[i]) * 0.0016 + 0.0009;
      fp[i * 3] += Math.cos(t * 0.4 + fDrift[i]) * 0.0011;
      if (fp[i * 3 + 1] > 5.5) fp[i * 3 + 1] = -1.5;
    }
    fGeo.attributes.position.needsUpdate = true;

    glowFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    glowSprite.position.copy(camera.position).addScaledVector(glowFwd, 60);
    glowMat.opacity = 0.7 + Math.sin(t * 0.9) * 0.12;

    hudGroup.position.copy(camera.position);
    hudGroup.quaternion.copy(camera.quaternion);
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    hudGroup.position.addScaledVector(fwd, 4.4);
    hudGroup.visible = inCarousel;

    carouselMeshes.forEach(function (m) {
      var d = diffFromCenter(m.userData.index);
      var isCenter = d === 0;
      var targetX = zoomed && isCenter ? 0 : d * 2.05;
      var targetZ = zoomed && isCenter ? 1.1 : -Math.abs(d) * 0.5;
      var targetRotY = zoomed && isCenter ? 0 : d * -0.55;
      var targetScale = zoomed && isCenter ? 1.55 : (isCenter ? 1.15 : 0.72);
      var targetOpacity = zoomed && !isCenter ? 0 : (isCenter ? 1 : 0.55);

      m.position.x += (targetX - m.position.x) * 0.12;
      m.position.z += (targetZ - m.position.z) * 0.12;
      m.rotation.y += (targetRotY - m.rotation.y) * 0.12;
      m.scale.x += (targetScale - m.scale.x) * 0.12;
      m.scale.y += (targetScale - m.scale.y) * 0.12;
      m.material.opacity += (targetOpacity - m.material.opacity) * 0.12;
      m.renderOrder = isCenter ? 2 : 1;
    });

    renderer.render(scene, camera);
  }
  animate();
  updateScroll();
})();
