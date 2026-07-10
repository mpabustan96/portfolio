/* =============================================
   INDEX 3D — Portal Warp homepage scene
   Replaces the flat hero/work/contact layout with
   a scroll-driven Three.js tunnel. Each ring frames
   a real project screenshot; falling glyph-styled
   particles fold the old matrix-bg.js effect into
   the 3D scene instead of running as a separate
   2D canvas behind it — matrix-bg.js is no longer
   loaded on this page.

   Requires index.html to load three.js (r128) before
   this file, and to define:
     <canvas id="pw-canvas"></canvas>
     <div id="pw-progress"></div>
     .pw-track > .pw-beat[data-beat] structure

   No prefers-reduced-motion branch, by design — the
   scene always animates, the same "always running"
   call this site already makes for matrix-bg.js.
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
  var LIME = 0x00FF00;

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

  var ringZ = [-2, -20, -38, -56, -74];

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

    var torusGeo = new THREE.TorusGeometry(3.2, 0.045, 16, 64);
    var torusMat = new THREE.MeshBasicMaterial({ color: project.accent, transparent: true, opacity: 0.92 });
    var torus = new THREE.Mesh(torusGeo, torusMat);
    torus.position.z = z;
    scene.add(torus);

    var torus2 = new THREE.Mesh(
      new THREE.TorusGeometry(4.35, 0.015, 12, isMobile ? 40 : 64),
      new THREE.MeshBasicMaterial({ color: project.accent, transparent: true, opacity: 0.22 })
    );
    torus2.position.z = z;
    scene.add(torus2);

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
        plane.position.z = z;
        scene.add(plane);
      });
    }

    var frameGeo = new THREE.EdgesGeometry(planeGeo);
    var frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: project.accent, transparent: true, opacity: 0.5 }));
    frame.position.z = z;
    scene.add(frame);
  }

  ringZ.forEach(function (z, i) { buildPortal(i, z, PROJECTS[i]); });

  /* ---------- Matrix rain, folded into the tunnel ----------
     Same charset and color logic as matrix-bg.js (periwinkle,
     ~10% rare lime), but reskinned as points streaming down the
     tunnel toward the camera instead of a flat 2D backdrop. This
     replaces matrix-bg.js entirely on this page — the falling
     glyphs are now part of the 3D scene, not a separate canvas
     sitting behind it. */
  var GLYPHS = '01アイウエオカキクケコ.:#$%&'.split('');

  function makeGlyphTexture() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 64;
    var ctx = c.getContext('2d');
    ctx.font = '700 44px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], 32, 34);
    return new THREE.CanvasTexture(c);
  }

  var streakCount = isMobile ? 180 : 520;
  var streakGeo = new THREE.BufferGeometry();
  var streakPos = new Float32Array(streakCount * 3);
  var streakCol = new Float32Array(streakCount * 3);
  var periColor = new THREE.Color(PERIWINKLE);
  var limeColor = new THREE.Color(LIME);

  for (var i = 0; i < streakCount; i++) {
    streakPos[i * 3] = (Math.random() - 0.5) * 18;
    streakPos[i * 3 + 1] = (Math.random() - 0.5) * 11;
    streakPos[i * 3 + 2] = -Math.random() * 90;
    var c3 = Math.random() < 0.1 ? limeColor : periColor;
    streakCol[i * 3] = c3.r; streakCol[i * 3 + 1] = c3.g; streakCol[i * 3 + 2] = c3.b;
  }
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  streakGeo.setAttribute('color', new THREE.BufferAttribute(streakCol, 3));

  var streakMat = new THREE.PointsMaterial({
    map: makeGlyphTexture(),
    size: isMobile ? 0.34 : 0.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  var streaks = new THREE.Points(streakGeo, streakMat);
  scene.add(streaks);

  /* ---------- Scroll-driven camera dolly ----------
     Same mechanism on every device: progress -> camera.position.z
     and beat activation. Only render cost (particle count, AA,
     pixel ratio, secondary ring segments) is reduced on mobile
     above — the scroll behavior itself never branches by device. */
  var beats = document.querySelectorAll('.pw-beat');
  var progressBar = document.getElementById('pw-progress');
  var track = document.querySelector('.pw-track');
  var hint = document.getElementById('pw-hint');
  var hasScrolled = false;

  function updateScroll() {
    var scrollTop = window.scrollY;
    var trackHeight = track.offsetHeight - window.innerHeight;
    var progress = Math.min(1, Math.max(0, trackHeight > 0 ? scrollTop / trackHeight : 0));
    progressBar.style.width = (progress * 100) + '%';

    if (!hasScrolled && scrollTop > 40) {
      hasScrolled = true;
      if (hint) hint.classList.add('is-hidden');
    }

    camera.position.z = 12 - progress * 86;
    camera.rotation.z = Math.sin(progress * Math.PI * 3) * 0.045;

    var beatProgress = progress * (beats.length - 1);
    var activeIndex = Math.round(beatProgress);
    beats.forEach(function (b, i) { b.classList.toggle('is-active', i === activeIndex); });
  }
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();

  /* Recycle streak particles as they pass the camera so the rain
     keeps flowing the whole way down the tunnel instead of thinning
     out near the end of the scroll. */
  function recycleStreaks() {
    var pos = streakGeo.attributes.position.array;
    var camZ = camera.position.z;
    for (var j = 0; j < streakCount; j++) {
      if (pos[j * 3 + 2] > camZ + 6) {
        pos[j * 3] = (Math.random() - 0.5) * 18;
        pos[j * 3 + 1] = (Math.random() - 0.5) * 11;
        pos[j * 3 + 2] = camZ - 90 - Math.random() * 10;
      }
    }
    streakGeo.attributes.position.needsUpdate = true;
  }

  function animate() {
    requestAnimationFrame(animate);
    scene.rotation.z += 0.0005;
    recycleStreaks();
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
