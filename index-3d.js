/* =============================================
   INDEX 3D — Portal Warp homepage scene
   Scroll-driven Three.js tunnel. Each ring frames a
   real project screenshot. The falling-glyph matrix
   effect used to live inside this scene as 3D
   streak points; it's now index-matrix.js, a flat
   2D layer behind this canvas — fully independent of
   scroll, camera, and the rotation below.

   Requires index.html to load three.js (r128) before
   this file, and to define:
     <canvas id="pw-canvas"></canvas>
     <div id="pw-progress"></div>
     .pw-track > .pw-beat[data-beat] structure

   No prefers-reduced-motion branch, by design — the
   scene always animates, the same "always running"
   call this site already makes for matrix-bg.js.

   ROTATION — only the cards and their rings turn.
   Each portal (2 torus rings + card plane + frame
   line) lives in its own THREE.Group, spun locally
   around its own z-axis. Nothing else — not the
   camera, not the glow sprites, not the matrix layer
   behind this canvas — rotates. (Glow/haze sprites
   are Three.js Sprites, which always face the camera
   regardless of object rotation, so keeping them
   outside the group wouldn't change their look even
   if they were inside it — they're kept outside for
   clarity about what's actually spinning.)

   SCROLL SNAP — the tunnel no longer free-scrolls.
   Each wheel notch, swipe, or arrow/page key press
   advances exactly one beat (hero -> case study 1 ->
   case study 2 -> case study 3 -> contact), animated
   with easing. Input is locked out while a transition
   is in flight, so a fast scroll or flick can't skip
   past a case study — the camera dolly and progress
   bar are driven by the same animated position, so
   the "flying through the tunnel" motion from the
   original scroll-driven version is preserved, it's
   just triggered one step at a time instead of by
   raw scrollTop.
============================================= */
(function () {
  var canvas = document.getElementById('pw-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  var isMobile = window.matchMedia('(max-width: 900px)').matches;

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !isMobile });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(isMobile ? 1.5 : 2, window.devicePixelRatio || 1));

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 12);

  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  /* ---------- Palette, pulled from index.css tokens ---------- */
  var PERIWINKLE = 0x7A9CFF;

  /* ---------- Project data: real case studies, real screenshots ----------
     fit: 'cover' for photo screenshots, 'contain' for the Angels logo mark
     (matches how index.html itself treats these two image types). */
  var PROJECTS = [
    null,
    { title: 'Connett Family Counseling', accent: 0x2F7A9E, href: 'counseling.html', img: 'images/counseling-card.jpg', fit: 'cover' },
    { title: "Albertina's Angels", accent: 0x9C8FC4, href: 'albertinas-angels.html', img: 'images/albertinas-angels-card.png', fit: 'contain' },
    { title: 'Bootcamp Projects', accent: 0xF08A3D, href: 'education.html', img: 'images/bootcamp-card.jpg', fit: 'cover' },
    null
  ];

  // Ring z-positions for the 3 case-study portals + hero glow (index 0)
  // and closing haze (index 4). The 3 case-study rings are spaced 21.5
  // units apart — matching the camera's actual per-beat step (86 / 4
  // beats = 21.5) — not the 18-unit spacing this array used to have.
  // That mismatch used to compound every beat (camera outpacing the
  // rings by 3.5 units each time), so by beat 3 (Bootcamp) the camera
  // ended up only ~3.5 units from the ring instead of the ~10.5 units
  // Counseling gets — a hard zoom that had nothing to do with Bootcamp
  // itself. All 3 case-study rings now sit at the same camera distance.
  var ringZ = [-2, -20, -41.5, -63, -74];

  // How fast each portal's card + rings spin, in radians/frame.
  // 0.003 = "Fast" — a full local turn roughly every 35 sec at 60fps.
  var ROTATION_SPEED = 0.003;

  /* ---------- Glow sprite: rim-light only, transparent center ---------- */
  function makeGlowSprite(color, size, intensity) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 256;
    var ctx = c.getContext('2d');
    var grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    var hex = '#' + color.toString(16).padStart(6, '0');
    var a = Math.round((intensity || 0.46) * 255).toString(16).padStart(2, '0');
    grd.addColorStop(0, hex + '00');
    grd.addColorStop(0.6, hex + '00');
    grd.addColorStop(0.78, hex + a);
    grd.addColorStop(1, hex + '00');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(c);
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  /* ---------- Soft open haze for the closing beat — "the doorway" ---------- */
  function makeHazeSprite(color, size) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 256;
    var ctx = c.getContext('2d');
    var grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    var hex = '#' + color.toString(16).padStart(6, '0');
    grd.addColorStop(0, hex + '55');
    grd.addColorStop(0.5, hex + '22');
    grd.addColorStop(1, hex + '00');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
    var tex = new THREE.CanvasTexture(c);
    var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
    var sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  /* ---------- Case-study preview card ----------
     Real screenshot, composited with a dark bottom scrim and an
     accent-tinted edge vignette. This is what keeps the ring/glow
     reading clearly and is why the DOM text plaque placed in front
     of it (see .pw-panel in index.css) never has to fight a bright
     screenshot for contrast — the image is already darkened before
     it becomes a texture. */
  function buildCardTexture(image, accent, fit, callback) {
    var w = 640, h = 400;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');

    ctx.fillStyle = '#0A0C14';
    ctx.fillRect(0, 0, w, h);

    if (image) {
      if (fit === 'contain') {
        var pad = 0.16;
        var maxW = w * (1 - pad * 2), maxH = h * (1 - pad * 2);
        var ratio = Math.min(maxW / image.width, maxH / image.height);
        var iw = image.width * ratio, ih = image.height * ratio;
        ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
      } else {
        var scale = Math.max(w / image.width, h / image.height);
        var dw = image.width * scale, dh = image.height * scale;
        ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
    }

    var scrim = ctx.createLinearGradient(0, h * 0.42, 0, h);
    scrim.addColorStop(0, 'rgba(5,6,10,0)');
    scrim.addColorStop(1, 'rgba(5,6,10,0.74)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, w, h);

    var hexA = '#' + accent.toString(16).padStart(6, '0');
    var vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    vig.addColorStop(0, hexA + '00');
    vig.addColorStop(1, hexA + '26');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    callback(new THREE.CanvasTexture(c));
  }

  // Each portal's rings + card + frame live in their own THREE.Group so
  // they can spin locally. Glow/haze sprites are added straight to the
  // scene, outside any group — see the ROTATION note at the top of file.
  var rotatingGroups = [];

  function buildPortal(i, z, project) {
    if (!project) {
      if (i === ringZ.length - 1) {
        var haze = makeHazeSprite(PERIWINKLE, 13);
        haze.position.z = z;
        scene.add(haze);
      } else {
        var glow = makeGlowSprite(PERIWINKLE, 9, 0.3);
        glow.position.z = z;
        scene.add(glow);
      }
      return;
    }

    var group = new THREE.Group();
    group.position.z = z;
    scene.add(group);
    rotatingGroups.push(group);

    var torusGeo = new THREE.TorusGeometry(3.2, 0.045, 16, 64);
    var torusMat = new THREE.MeshBasicMaterial({ color: project.accent, transparent: true, opacity: 0.92 });
    var torus = new THREE.Mesh(torusGeo, torusMat);
    group.add(torus);

    var torus2 = new THREE.Mesh(
      new THREE.TorusGeometry(4.35, 0.015, 12, isMobile ? 40 : 64),
      new THREE.MeshBasicMaterial({ color: project.accent, transparent: true, opacity: 0.22 })
    );
    group.add(torus2);

    // Glow stays centered on the portal but lives outside the rotating
    // group — see the ROTATION note at the top of this file.
    var glow = makeGlowSprite(project.accent, 10.5, 0.42);
    glow.position.z = z;
    scene.add(glow);

    var planeGeo = new THREE.PlaneGeometry(5.0, 3.125);

    // No crossOrigin flag here on purpose: these images are served from
    // the same folder as index.html. Setting crossOrigin='anonymous' on a
    // same-origin request can make some static servers (or a plain
    // file:// open, which has no origin at all) fail the load silently,
    // which is what produces a blank portal.
    var img = new Image();
    img.onload = function () { addCard(img); };
    img.onerror = function () {
      console.warn('[Portal Warp] could not load ' + project.img + ' — check the path, or serve this page over http:// instead of file://');
      addCard(null);
    };
    img.src = project.img;

    function addCard(loadedImg) {
      buildCardTexture(loadedImg, project.accent, project.fit, function (tex) {
        var planeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
        var plane = new THREE.Mesh(planeGeo, planeMat);
        group.add(plane);
      });
    }

    var frameGeo = new THREE.EdgesGeometry(planeGeo);
    var frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: project.accent, transparent: true, opacity: 0.5 }));
    group.add(frame);
  }

  ringZ.forEach(function (z, i) { buildPortal(i, z, PROJECTS[i]); });

  /* ---------- SCROLL SNAP NAVIGATION ----------
     Replaces free scrolling with one-beat-at-a-time steps. The
     camera dolly formula (progress -> camera.position.z / rotation.z)
     and the progress bar are untouched from the original — they're
     just driven by an animated position instead of raw scrollTop, so
     a step still plays as a smooth flythrough, not a jump cut. */
  var beats = document.querySelectorAll('.pw-beat');
  var progressBar = document.getElementById('pw-progress');
  var track = document.querySelector('.pw-track');

  var isAnimating = false;
  var currentIndex = 0;

  function trackScrollHeight() {
    return Math.max(0, track.offsetHeight - window.innerHeight);
  }

  function beatScrollY(index) {
    var trackHeight = trackScrollHeight();
    if (beats.length <= 1 || trackHeight === 0) return 0;
    return (index / (beats.length - 1)) * trackHeight;
  }

  function renderAtScrollY(y) {
    var trackHeight = trackScrollHeight();
    var progress = trackHeight > 0 ? Math.min(1, Math.max(0, y / trackHeight)) : 0;
    progressBar.style.width = (progress * 100) + '%';

    camera.position.z = 12 - progress * 86;
    camera.rotation.z = Math.sin(progress * Math.PI * 3) * 0.045;

    var activeIndex = Math.round(progress * (beats.length - 1));
    beats.forEach(function (b, i) { b.classList.toggle('is-active', i === activeIndex); });
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function animateScrollTo(targetY, duration) {
    isAnimating = true;
    var startY = window.scrollY;
    var startTime = null;

    function step(ts) {
      if (startTime === null) startTime = ts;
      var elapsed = ts - startTime;
      var t = Math.min(1, elapsed / duration);
      var eased = easeInOutCubic(t);
      var y = startY + (targetY - startY) * eased;

      window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      renderAtScrollY(y);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        isAnimating = false;
      }
    }
    requestAnimationFrame(step);
  }

  function goToBeat(index) {
    index = Math.max(0, Math.min(beats.length - 1, index));
    if (isAnimating) return;
    if (index === currentIndex && Math.abs(window.scrollY - beatScrollY(index)) < 1) return;
    currentIndex = index;
    animateScrollTo(beatScrollY(index), 800);
  }

  // Wheel — one notch/flick = one beat, regardless of scroll speed.
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (isAnimating) return;
    goToBeat(currentIndex + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });

  // Touch — one swipe past a small threshold = one beat.
  var touchStartY = null;
  window.addEventListener('touchstart', function (e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', function (e) {
    if (touchStartY === null || isAnimating) { touchStartY = null; return; }
    var deltaY = touchStartY - e.changedTouches[0].clientY;
    touchStartY = null;
    if (Math.abs(deltaY) < 40) return;
    goToBeat(currentIndex + (deltaY > 0 ? 1 : -1));
  }, { passive: true });

  // Keyboard — arrows/page keys/space step one beat, Home/End jump to ends.
  window.addEventListener('keydown', function (e) {
    var navKeys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '];
    if (navKeys.indexOf(e.key) === -1) return;
    e.preventDefault();
    if (isAnimating) return;
    switch (e.key) {
      case 'ArrowDown': case 'PageDown': case ' ':
        goToBeat(currentIndex + 1); break;
      case 'ArrowUp': case 'PageUp':
        goToBeat(currentIndex - 1); break;
      case 'Home':
        goToBeat(0); break;
      case 'End':
        goToBeat(beats.length - 1); break;
    }
  });

  // In-page links (nav "Work"/"Let's talk", hero "See the work") jump to
  // a specific beat by id — route them through the same animated step
  // instead of an instant native anchor jump, so the tunnel flythrough
  // still plays even for a direct link.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#pw-beat-"]');
    if (!a) return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    var idx = Array.prototype.indexOf.call(beats, target);
    if (idx > -1) goToBeat(idx);
  });

  window.addEventListener('resize', function () {
    // Re-sync the visual position (bar/camera/active beat) to the
    // current index on resize, since trackHeight can change.
    renderAtScrollY(beatScrollY(currentIndex));
  });

  // Initial paint: figure out which beat we're on (e.g. a reload mid-
  // scroll or a deep link) and snap cleanly to it without animating.
  (function initScrollPosition() {
    var trackHeight = trackScrollHeight();
    var progress = trackHeight > 0 ? window.scrollY / trackHeight : 0;
    currentIndex = Math.round(progress * (beats.length - 1));
    var y = beatScrollY(currentIndex);
    window.scrollTo({ top: y, left: 0, behavior: 'auto' });
    renderAtScrollY(y);
  })();

  /* ---------- Render loop ----------
     Only the per-portal groups (cards + rings) rotate. Camera,
     glow/haze sprites, and the matrix layer behind this canvas are
     untouched here. */
  function animate() {
    requestAnimationFrame(animate);
    rotatingGroups.forEach(function (g) { g.rotation.z += ROTATION_SPEED; });
    renderer.render(scene, camera);
  }
  animate();

  /* ---------- Portal click-through ----------
     Clicking anywhere on the canvas while a portal beat is active
     routes through that beat's real <a>, so page-transitions.js's
     own delegated click handler fires the same Decrypt Flicker exit
     whether someone clicks the ring itself or the "Enter case study"
     link inside the plaque. */
  canvas.addEventListener('click', function () {
    var active = document.querySelector('.pw-beat.is-active[data-href]');
    if (!active) return;
    var link = active.querySelector('.pw-portal-link');
    if (link) link.click();
  });
})();
