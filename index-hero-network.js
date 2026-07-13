/* =============================================
   INDEX HERO NETWORK — "Aperture Gallery" version
   Particle-network background for the homepage
   hero only (index.html).

   Drifting nodes link to nearby nodes with a
   periwinkle line that fades with distance, and to
   the cursor itself within HUB_LINK_DIST — a mouse
   "hub" effect, not a repel force (this version drops
   the old repel-on-approach behavior to match the
   reference design). The canvas paints its own
   opaque background each frame instead of relying on
   clearRect, also matching the reference.

   Same "always on" precedent as the rest of the site
   (no prefers-reduced-motion branch), but pauses via
   IntersectionObserver when the hero scrolls off
   screen, and via visibilitychange on a hidden tab —
   purely for battery.
============================================= */
(function () {
  var hero = document.getElementById('home-hero');
  var canvas = document.getElementById('home-hero-canvas');
  if (!hero || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var LINK_DIST = 150;
  var HUB_LINK_DIST = 180;
  var N = 55;

  var W, H, dpr, nodes;
  var mouse = { x: null, y: null, active: false };
  var running = true;
  var heroVisible = true;

  function isMobile() { return window.innerWidth <= 640; }

  function nodeCount() {
    // Fewer nodes on small screens — same density feel, less canvas work.
    return isMobile() ? 38 : N;
  }

  function setup() {
    dpr = window.devicePixelRatio || 1;
    W = hero.clientWidth;
    H = hero.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = nodeCount();
    nodes = [];
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28
      });
    }
  }

  hero.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  });
  hero.addEventListener('mouseleave', function () {
    mouse.active = false;
  });

  function drawFrame() {
    ctx.fillStyle = '#0A0C12';
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }

    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i], b = nodes[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          ctx.strokeStyle = 'rgba(122,156,255,' + (0.35 * (1 - dist / LINK_DIST)).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      if (mouse.active) {
        var mdx = nodes[i].x - mouse.x, mdy = nodes[i].y - mouse.y;
        var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < HUB_LINK_DIST) {
          ctx.strokeStyle = 'rgba(168,192,255,' + (0.55 * (1 - mdist / HUB_LINK_DIST)).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    for (var i = 0; i < nodes.length; i++) {
      ctx.fillStyle = 'rgba(168,192,255,0.85)';
      ctx.beginPath();
      ctx.arc(nodes[i].x, nodes[i].y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mouse.active) {
      ctx.fillStyle = 'rgba(122,156,255,0.95)';
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop() {
    if (running) drawFrame();
    requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', function () {
    running = heroVisible && !document.hidden;
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      heroVisible = entry.isIntersecting;
      running = heroVisible && !document.hidden;
    });
  }, { threshold: 0 });
  io.observe(hero);

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setup, 150);
  });

  setup();
  loop();
})();
