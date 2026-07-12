/* =============================================
   COUNSELING 3D: "Harbor Ride" scroll scene
   Replaces the flat scrolling layout with a
   scroll-driven Three.js ride: the camera glides
   forward over a wireframe current, past soft
   buoy markers, while glass DOM panels (.ride-panel)
   fade in and out per stop, matching the same
   is-active toggling pattern index-3d.js uses for
   .pw-beat on the homepage.

   Distinct from the homepage's midnight data-tunnel
   on purpose: this is a bright, low-stimulation
   morning-harbor scene built from counseling.css's
   own water-themed tokens (--harbor, --current,
   --seafoam, --mist), matching the page's
   "trust before information" thesis instead of
   borrowing the homepage's identity.

   One stop (marked with [data-carousel] in the
   HTML) hosts the screenshot carousel: real
   screenshots rigged to the camera so they're
   always large, centered, and in focus, cycled
   with arrow buttons, dots, a touch swipe, or a
   tap on the centered screen to zoom in. The swipe
   only fires on a clearly horizontal touch drag,
   so it never fights the page's own vertical
   scroll, which the canvas's touch-action: pan-y
   already hands to the browser natively.

   Requires counseling.html to load three.js (r128)
   before this file, and to define:
     <canvas id="ride-canvas"></canvas>
     <div class="ride-track"> containing
       <section class="ride-scene" data-scene="N">
         <div class="ride-panel">...</div>
       </section>
     one of which also carries [data-carousel]
     and the carousel control markup (see
     counseling.html for the exact structure).

   No prefers-reduced-motion branch, by design:
   same "always running" call already made for
   matrix-bg.js and the homepage's Portal Warp scene.
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

  /* ---------- scenes: one z position per .ride-scene, evenly spaced ----------
     Five dense stops exist twice in the DOM — once as a single
     data-device="desktop" stop, once split into two shorter
     data-device="mobile" stops (see counseling.css) — so the scene
     list here is filtered to whichever variant applies at the
     current breakpoint. Shared stops (hero, meta, hook, problem,
     carousel) have no data-device attribute and always pass through.
     This mirrors the same 760px breakpoint already used elsewhere in
     this file (isMobile above) and in counseling.css. */
  var allSceneEls = Array.prototype.slice.call(document.querySelectorAll('.ride-scene'));
  var sceneEls = allSceneEls.filter(function (el) {
    var device = el.getAttribute('data-device');
    if (!device) return true;
    return isMobile ? device === 'mobile' : device === 'desktop';
  });
  var sceneZ = sceneEls.map(function (el, i) { return 8 - i * 16; });
  var carouselIndex = sceneEls.findIndex(function (el) { return el.hasAttribute('data-carousel'); });

  /* ---------- track height: source of truth lives here, not in CSS ----------
     Each .ride-scene is a normal-flow 100vh block using position:sticky
     to "stick" for its own 100vh of scroll room, so .ride-track needs
     exactly sceneEls.length * 100vh of real height for the trick to
     work end to end. counseling.css's vh-based height is a fallback for
     before this runs, but it has drifted out of sync with the scene
     count before (a scene got added and only the desktop vh value was
     updated), and even when correct, "100vh" itself doesn't reliably
     mean "the visible viewport" on mobile browsers with a collapsing
     address bar. Setting it here in real measured pixels, straight from
     the actual number of scenes, avoids both problems. When the track
     ends up shorter than the content it holds, the last scenes visually
     overflow past it and overlap whatever comes after (the footer/nav),
     which is what was cutting the Hook scene and everything past it off
     on mobile. */
  var track = document.querySelector('.ride-track');
  function syncTrackHeight() {
    if (!track) return;
    // visualViewport.height reflects the real, currently-visible viewport
    // (already excludes the collapsed/expanded address bar); innerHeight
    // is the fallback for browsers without the API.
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    track.style.height = (sceneEls.length * vh) + 'px';
  }
  syncTrackHeight();
  var trackResizeTimer = null;
  window.addEventListener('resize', function () {
    // Debounced: mobile browsers fire resize repeatedly while the
    // address bar animates in/out during ordinary scrolling, and
    // resizing the track mid-scroll would fight that scroll.
    clearTimeout(trackResizeTimer);
    trackResizeTimer = setTimeout(function () {
      var nowMobile = window.matchMedia('(max-width: 760px)').matches;
      if (nowMobile !== isMobile) {
        // Breakpoint crossed — e.g. rotating the phone into landscape
        // (iPhone 15 Pro Max is ~932px wide there, past the 760px cutoff),
        // or resizing a desktop window. counseling.css's data-device rule
        // just swapped which .ride-scene elements are actually visible,
        // so the sceneEls/sceneZ/carouselIndex this script filtered once
        // at load would otherwise keep pointing at now-hidden elements,
        // and .is-active would never reach the ones actually on screen.
        isMobile = nowMobile;
        sceneEls = allSceneEls.filter(function (el) {
          var device = el.getAttribute('data-device');
          if (!device) return true;
          return isMobile ? device === 'mobile' : device === 'desktop';
        });
        sceneZ = sceneEls.map(function (el, i) { return 8 - i * 16; });
        carouselIndex = sceneEls.findIndex(function (el) { return el.hasAttribute('data-carousel'); });
      }
      syncTrackHeight();
      updateScroll();
    }, 150);
  });

  /* ---------- buoy markers at each scene depth ---------- */
  var buoys = [];
  sceneZ.forEach(function (z, i) {
    var geo = new THREE.SphereGeometry(0.22, 16, 16);
    var mat = new THREE.MeshBasicMaterial({ color: i % 2 ? SEAFOAM : CURRENT, transparent: true, opacity: 0.85 });
    var buoy = new THREE.Mesh(geo, mat);
    buoy.position.set(i % 2 === 0 ? -3.2 : 3.2, -0.6, z);
    scene.add(buoy);
    buoys.push(buoy);
  });

  /* ============================================================
     CAROUSEL: rigged to the camera (a "HUD" group whose
     transform is copied from the camera every frame, then pushed
     forward), so the screens are always large, centered, and
     sharply in focus regardless of where the ride camera is or
     how it's bobbing. The water/mist blur into a soft backdrop
     behind it instead of competing for attention.
     ============================================================ */
  var hudGroup = new THREE.Group();
  scene.add(hudGroup);

  var shots = [
    { file: 'images/counseling-homepage.png', label: 'Homepage', desc: '"A Path to Hope" hero, plus the Contact Us section with hours and address below.' },
    { file: 'images/counseling-contact.png', label: 'Contact', desc: 'Where To Find Us, address, phone, and an embedded map of the San Jose office.' },
    { file: 'images/counseling-services.png', label: 'Services', desc: 'Mental Health Service list, Addiction, Anger Management, Grief, Trauma and PTSD, LGBTQ+, and more.' }
  ];

  // Frame each real screenshot into a fixed-aspect canvas using cover +
  // top anchoring, matching the site's own .shot-frame.has-image
  // { object-fit: cover; object-position: top; } rule, so all three
  // panels read as a consistent set even though the source screenshots
  // are different heights. No darkening/scrim is applied.
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
    ctx.fillStyle = '#E4F1ED';
    ctx.fillRect(0, 0, FRAME_W, FRAME_H);
    ctx.fillStyle = '#6B7B83';
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
      new THREE.LineBasicMaterial({ color: CURRENT, transparent: true, opacity: 0.4 })
    );
    mesh.add(edges);

    // No crossOrigin flag: these are same-folder, same-origin images,
    // and crossOrigin='anonymous' on a local/static load is what
    // silently breaks textures under some static servers or file://
    // (the same fix already applied to the homepage's portal cards).
    var img = new Image();
    img.onload = function () { mat.map = frameTexture(img); mat.map.needsUpdate = true; };
    img.onerror = function () { console.warn('[Harbor Ride] could not load ' + s.file); };
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
     Distinct from the 3D "zoomed" state above, which just enlarges
     the centered screen in place within the Harbor Ride scene. This
     opens an actual DOM overlay with the untouched source image
     (same file the carousel already loaded for its texture, see the
     shots array), a dimmed backdrop, and a close button — reusing
     the .lightbox styles already defined in counseling.css. Page
     scroll is frozen while it's open, both because the scene's
     scroll-driven camera has no business moving behind an open
     overlay, and to stop the mandatory CSS snap from fighting the
     frozen background. */
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
    // Click on the dimmed backdrop closes it; click on the image
    // itself (a child of .lightbox) does not, via the target check.
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  /* ---------- scroll -> camera dolly + active-scene toggling ----------
     Same mechanism as the homepage's pw-beat activation: progress maps
     to camera.position.z, and the nearest scene's DOM panel gets
     .is-active. */
  var progress = 0;
  var activeScene = 0;

  /* ---------- section rail: alternate nav alongside the scroll ride ----------
     Dots stay in sync with the same activeScene index updateScroll already
     computes below; clicking one scrolls the page to that scene's position
     by inverting the same progress -> scrollY math updateScroll uses. This
     never touches camera.userData.targetZ directly — it just moves scrollY,
     so the very next updateScroll() (fired by the scroll event the jump
     itself produces) picks it up through the normal path. */
  var railItems = Array.prototype.slice.call(document.querySelectorAll('.rail-item'));
  function updateRail(idx) {
    // Matched by data-index rather than array position — kept this
    // way (rather than reverting to the old i === idx match) since
    // it's equally correct with a single rail list and one less thing
    // to break if a second nav element gets added again later.
    railItems.forEach(function (li) {
      var isActive = parseInt(li.getAttribute('data-index'), 10) === idx;
      li.classList.toggle('is-active', isActive);
      var btn = li.querySelector('.rail-btn');
      if (btn) btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }
  function goToScene(idx) {
    var el = sceneEls[idx];
    if (!el) return;
    // Real element position (getBoundingClientRect + current scroll),
    // rather than an index/trackHeight ratio — same reasoning as the
    // active-scene detection above, so a snap or rail-click always lands
    // on the actual scene even if the vh used to size .ride-track has
    // drifted from the real viewport.
    var target = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: target, behavior: 'smooth' });
  }
  railItems.forEach(function (li) {
    var btn = li.querySelector('.rail-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      goToScene(parseInt(btn.getAttribute('data-target'), 10));
    });
  });

  function updateScroll() {
    var trackHeight = track.offsetHeight - window.innerHeight;
    progress = Math.min(1, Math.max(0, trackHeight > 0 ? window.scrollY / trackHeight : 0));

    // Which scene is "active" (opacity: 1, the only visible one) used to
    // come from this scrollY/trackHeight ratio alone. iOS Safari/Chrome
    // change window.innerHeight live as the address bar collapses (scrolling
    // down) and reveals (scrolling up) — asymmetrically between the two
    // directions — which let the ratio drift out of sync with what's
    // physically in the viewport, especially scrolling back up. That drift
    // is what made previous sections fail to reappear: the scene actually
    // on screen kept opacity:0 because the ratio math still pointed
    // .is-active somewhere else. Reading each scene's real rendered
    // position sidesteps that drift entirely.
    var viewportCenter = window.innerHeight / 2;
    var idx = 0;
    var bestDist = Infinity;
    sceneEls.forEach(function (el, i) {
      var rect = el.getBoundingClientRect();
      var dist = Math.abs((rect.top + rect.height / 2) - viewportCenter);
      if (dist < bestDist) { bestDist = dist; idx = i; }
    });

    if (idx !== carouselIndex && activeScene === carouselIndex) {
      // leaving the carousel stop resets it, so it's never still
      // zoomed in the next time it's scrolled back into view
      zoomed = false;
      updateCaption();
    }
    activeScene = idx;
    sceneEls.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
    updateRail(idx);

    camera.userData.targetZ = sceneZ[0] - progress * (sceneZ[0] - sceneZ[sceneZ.length - 1]);
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  camera.userData.targetZ = sceneZ[0];

  /* ---------- snap-to-nearest-scene on scroll settle ----------
     Runs at every screen size now, matching the mandatory CSS snap
     in counseling.css. Once scrolling stops for a beat, animate to
     the exact scrollY goToScene(idx) would use for the nearest
     scene — the same position the rail's own click-to-jump already
     lands on — so the page always settles fully centered instead of
     holding mid-scene. */
  var snapTimer = null;
  function scheduleSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(function () { goToScene(activeScene); }, 140);
  }
  window.addEventListener('scroll', scheduleSnap, { passive: true });

  /* ---------- swipe (touch only) + tap-to-zoom on the carousel ----------
     A touch drag that's clearly horizontal (more horizontal movement
     than vertical) cycles the carousel, same as the arrow buttons. A
     drag that's mostly vertical is left alone entirely, since with
     touch-action: pan-y the browser has already claimed it as a page
     scroll and won't hand us further move events for it anyway. Mouse
     drags don't trigger swipe navigation, only a tap does, since a
     mouse doesn't need the gesture the way a touchscreen does. */
  /* Swipe tuning — SWIPE_MIN_PX is the minimum horizontal travel before
     it counts as an intentional swipe rather than a stray touch
     (lowered from an earlier 36px so it registers a bit more readily
     on mobile without going so low it fires on an accidental tap-drag).
     SWIPE_DOMINANCE_RATIO is how much more horizontal than vertical
     movement is required, so a diagonal or vertical scroll drag never
     gets mistaken for a swipe. */
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
    // Track max displacement from the start point directly, rather than
    // accumulating movementX/movementY — iOS WebKit doesn't reliably
    // report movement deltas for touch-originated pointer events, so
    // dragDist stayed near 0 and a real drag/swipe could get misread as
    // a tap once the swipe-threshold check below it failed.
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
  // A pointercancel means the browser (not us) claimed the gesture,
  // almost always because it read the drag as a vertical page scroll.
  // Just release, don't evaluate dx/dy against a position that no
  // longer reflects the user's actual intent.
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

  /* ---------- keyboard support for the carousel ----------
     Left/Right cycle the carousel, Enter/Space toggles zoom on the
     centered screen, active only while the carousel stop is the one
     in view (these keys don't otherwise scroll the page, so this
     never interferes with normal keyboard scrolling elsewhere). */
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
    var bobAmp = inCarousel ? 0.3 : 1;

    camera.position.z += (camera.userData.targetZ - camera.position.z) * 0.06;
    camera.position.y = 1.6 + Math.sin(t * 0.55) * 0.12 * bobAmp;
    camera.rotation.z = Math.sin(t * 0.35) * 0.012 * bobAmp;

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
    waterMat.opacity += ((inCarousel ? 0.1 : 0.28) - waterMat.opacity) * 0.05;
    mistMat.opacity += ((inCarousel ? 0.15 : 0.45) - mistMat.opacity) * 0.05;

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
