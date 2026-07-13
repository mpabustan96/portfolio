/* =============================================
   ABOUT — "About the Author" engine
   1. NAV — same mobile toggle every other page uses.
   2. INK-SETTLE REVEAL — the bio paragraph resolves
      into focus as it scrolls into view (opacity +
      blur + slight rise). This is the book-appropriate
      reinterpretation of the old terminal glyph-scramble
      decrypt effect: content still "arrives," but the
      idiom now matches ink settling on a page rather
      than a HUD identification sequence.
   Note: the old scroll-snap "beat" observer and HUD
   corner-bracket injection are gone — this page now
   flows continuously like the rest of the site.
============================================= */
(function () {

  /* ---------- 1. NAV ---------- */
  var navToggle = document.getElementById('nav-toggle');
  var mobileNav = document.getElementById('nav-links-mobile');

  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
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

  /* ---------- 2. Ink-settle reveal ---------- */
  var bioText = document.getElementById('bio-text');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (bioText && !reduceMotion && 'IntersectionObserver' in window) {
    var bioObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          bioText.classList.add('is-in');
          bioObserver.disconnect();
        }
      });
    }, { threshold: 0.4 });
    bioObserver.observe(bioText);
  } else if (bioText) {
    // Reduced motion or no IntersectionObserver support: show immediately.
    bioText.classList.add('is-in');
  }

})();
