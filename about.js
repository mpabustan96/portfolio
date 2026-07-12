/* =============================================
   ABOUT — Scan & Confirm engine
   1. NAV — same mobile toggle every other page uses.
   2. HUD CORNERS — appended once to every .hud-frame
      so the markup doesn't repeat 4 spans per panel.
   3. BEAT OBSERVER — the magnetic scroll-snap (CSS)
      handles WHERE the page stops; this only decides
      which beat is "active" (fully visible) based on
      real intersection, so the fade is a clean binary
      rather than a lingering partial overlap.
   4. DECRYPT REVEALS — the hero ID scan and the origin
      story both resolve from scrambled glyphs into
      plain text, echoing the site's own page-transition
      "Decrypt Flicker" effect rather than being a one-off.
============================================= */
(function () {

  /* ---------- 1. NAV ---------- */
  var navToggle = document.getElementById('nav-toggle');
  var mobileNav = document.getElementById('nav-links-mobile');

  function updateMobileNavOffset() {
    var headerEl = document.querySelector('.nav');
    if (headerEl) {
      document.documentElement.style.setProperty('--mobile-nav-offset', headerEl.offsetHeight + 'px');
    }
  }
  updateMobileNavOffset();
  window.addEventListener('resize', updateMobileNavOffset);
  window.addEventListener('orientationchange', updateMobileNavOffset);

  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
      updateMobileNavOffset();
      var isOpen = mobileNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Open menu');
      });
    });
  }

  /* ---------- 2. HUD corner brackets ---------- */
  document.querySelectorAll('.hud-frame').forEach(function (el) {
    ['tl', 'tr', 'bl', 'br'].forEach(function (pos) {
      var c = document.createElement('span');
      c.className = 'hud-corner ' + pos;
      el.appendChild(c);
    });
  });

  /* ---------- 3. Beat observer ---------- */
  var beats = Array.prototype.slice.call(document.querySelectorAll('.beat'));
  var progressFill = document.getElementById('progress-fill');
  var hudReadout = document.getElementById('hud-readout');
  var scrollCue = document.getElementById('scroll-cue');
  var grid = document.getElementById('corridor-grid');
  var decrypted = false;

  /* ---------- HUD readout visibility (mobile only) ----------
     On mobile the BEAT counter is only meaningful while a snap
     transition is actually happening; left up permanently it covers
     text in the duo and availability beats. showHud() reveals it on
     every beat change, then — only under the mobile media query —
     fades it back out ~900ms later, timed just past the beat's own
     0.6s snap transition so it reads before it disappears. Desktop
     keeps it on screen the whole time, same as before. */
  var hudMobileQuery = window.matchMedia('(max-width: 760px)');
  var hudHideTimer = null;
  function showHud(html) {
    if (!hudReadout) return;
    if (html !== undefined) hudReadout.innerHTML = html;
    clearTimeout(hudHideTimer);
    hudReadout.classList.add('is-visible');
    if (hudMobileQuery.matches) {
      hudHideTimer = setTimeout(function () {
        hudReadout.classList.remove('is-visible');
      }, 900);
    }
  }
  showHud();
  if (hudMobileQuery.addEventListener) {
    hudMobileQuery.addEventListener('change', function (e) {
      clearTimeout(hudHideTimer);
      if (!e.matches) hudReadout && hudReadout.classList.add('is-visible');
    });
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var beat = entry.target;
      var isActive = entry.intersectionRatio > 0.6;
      beat.classList.toggle('is-active', isActive);

      if (isActive) {
        var index = beats.indexOf(beat);
        showHud('SYS://ABOUT.EXE<br>BEAT: ' + (index + 1) + ' / ' + beats.length);
        if (progressFill) progressFill.style.width = ((index / (beats.length - 1)) * 100) + '%';

        if (beat.id === 'beat-origin' && !decrypted) {
          decrypted = true;
          decryptReveal(originEl, ORIGIN_TEXT, 60);
        }
        if (beat.id !== 'beat-hero' && scrollCue) {
          scrollCue.style.opacity = '0';
          scrollCue.style.pointerEvents = 'none';
        }
      }
    });
  }, { threshold: [0, 0.6, 1] });

  beats.forEach(function (beat) { observer.observe(beat); });

  if (grid) {
    window.addEventListener('scroll', function () {
      grid.style.backgroundPosition = '0 ' + (window.scrollY * 0.5) + 'px, 0 0';
    }, { passive: true });
  }

  /* ---------- 4. Decrypt / scramble reveal ----------
     Resolves over a fixed frame count regardless of text length,
     same idiom as page-transitions.js's Decrypt Flicker. */
  var GLYPHS = '01ABCDEF#$%&*<>/\\'.split('');
  function decryptReveal(el, target, totalFrames) {
    if (!el) return;
    var frame = 0;
    function tick() {
      frame++;
      var revealCount = Math.floor((frame / totalFrames) * target.length);
      var out = '';
      for (var i = 0; i < target.length; i++) {
        if (i < revealCount || target[i] === ' ') out += target[i];
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (frame < totalFrames) requestAnimationFrame(tick);
      else el.textContent = target;
    }
    requestAnimationFrame(tick);
  }

  var scanTag = document.getElementById('scan-tag');
  decryptReveal(scanTag, 'IDENTIFYING…', 24);
  setTimeout(function () { decryptReveal(scanTag, 'MARK PABUSTAN — CONFIRMED', 38); }, 1300);

  var ORIGIN_TEXT = "The pull toward design wasn't boredom with code. It was noticing where my attention actually went. Fixing an API integration or getting a layout to render right felt good, but briefly. The design process, working through why something should look or function a certain way, is where I lost track of time. Looking back, the throughline was already there: security is about how people get fooled or protected, and front-end work is about what experience actually reaches them. I just hadn't named it design yet.";
  var originEl = document.getElementById('origin-text');

})();
