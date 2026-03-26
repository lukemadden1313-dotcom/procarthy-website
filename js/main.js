/* ============================================
   PROCARTHY — Cinematic Interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // --- Preloader & cinematic entrance ---
  const preloader = document.getElementById('preloader');
  const nav = document.getElementById('nav');
  const hero = document.getElementById('hero');

  const launchSequence = () => {
    // 1. Dismiss preloader
    if (preloader) preloader.classList.add('done');

    // 2. Reveal hero (triggers text clip + image zoom)
    setTimeout(() => {
      if (hero) hero.classList.add('loaded');
    }, 300);

    // 3. Reveal nav
    setTimeout(() => {
      if (nav) nav.classList.add('visible');
    }, 800);
  };

  // Wait for hero image to load, or timeout after 2.5s
  const heroImg = document.querySelector('.hero-bg img');
  if (heroImg && !heroImg.complete) {
    heroImg.addEventListener('load', () => setTimeout(launchSequence, 600));
    setTimeout(launchSequence, 2500); // fallback
  } else {
    setTimeout(launchSequence, 1600);
  }

  // For non-home pages (no preloader): show nav + hero immediately
  if (!preloader) {
    if (nav) {
      nav.classList.add('visible');
    }
    if (hero) {
      setTimeout(() => hero.classList.add('loaded'), 100);
    }
  }

  // --- Custom cursor ---
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');

  if (dot && ring && window.matchMedia('(pointer: fine)').matches) {
    let mx = 0, my = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.left = mx - 3 + 'px';
      dot.style.top = my - 3 + 'px';
    });

    const follow = () => {
      rx += (mx - rx) * 0.1;
      ry += (my - ry) * 0.1;
      ring.style.left = rx - 18 + 'px';
      ring.style.top = ry - 18 + 'px';
      requestAnimationFrame(follow);
    };
    follow();

    document.querySelectorAll('a, button, .location-tag, .faq-question, .player-card').forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('hover'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
    });
  }

  // --- Nav scroll ---
  const onScroll = () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 80);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Mobile menu ---
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
      document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // --- Scroll reveals ---
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.06,
    rootMargin: '0px 0px -80px 0px'
  });

  revealEls.forEach(el => revealObserver.observe(el));

  // --- FAQ ---
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.parentElement;
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  // --- Location tags ---
  document.querySelectorAll('.locations-strip').forEach(strip => {
    strip.querySelectorAll('.location-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        strip.querySelectorAll('.location-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
      });
    });
  });

  // --- Player filter ---
  const filterBar = document.getElementById('filterBar');
  const grid = document.getElementById('playersGrid');

  if (filterBar && grid) {
    filterBar.querySelectorAll('.location-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const filter = tag.dataset.filter;
        const cards = grid.querySelectorAll('.player-card');

        cards.forEach((card, i) => {
          const show = filter === 'all' || card.dataset.location === filter;
          if (show) {
            card.style.display = '';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.97)';
            setTimeout(() => {
              card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
              card.style.opacity = '1';
              card.style.transform = 'scale(1)';
            }, i * 60);
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // --- Form focus ---
  document.querySelectorAll('.form-field').forEach(field => {
    field.addEventListener('focus', () => {
      field.style.borderColor = 'var(--accent)';
    });
    field.addEventListener('blur', () => {
      field.style.borderColor = 'rgba(255,255,255,0.08)';
    });
  });

  // --- Stat counter ---
  const statNums = document.querySelectorAll('.stat-block .number');

  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const text = el.textContent.trim();
      const sup = el.querySelector('sup');
      const supText = sup ? sup.textContent : '';
      const mainText = sup ? text.replace(supText, '') : text;
      const match = mainText.match(/^(\d+)/);

      if (match) {
        const target = parseInt(match[1]);
        const suffix = mainText.replace(match[1], '');
        let current = 0;
        const duration = 2000;
        const step = target / (duration / 16);

        const counter = () => {
          current += step;
          if (current >= target) {
            el.innerHTML = target + suffix + (supText ? `<sup>${supText}</sup>` : '');
          } else {
            el.innerHTML = Math.floor(current) + suffix + (supText ? `<sup>${supText}</sup>` : '');
            requestAnimationFrame(counter);
          }
        };
        counter();
      }
      countObserver.unobserve(el);
    });
  }, { threshold: 0.5 });

  statNums.forEach(el => countObserver.observe(el));

  // --- Ethereal Shadow Animation ---
  const etherealHue = document.getElementById('etherealHueRotate');
  if (etherealHue) {
    let hueValue = 0;
    const degreesPerFrame = 0.3;

    const animateHue = () => {
      hueValue = (hueValue + degreesPerFrame) % 360;
      etherealHue.setAttribute('values', String(hueValue));
      requestAnimationFrame(animateHue);
    };
    requestAnimationFrame(animateHue);
  }

  // --- Parallax on hero ---
  const heroBg = document.querySelector('.hero-bg img');
  if (heroBg) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      if (scrolled < window.innerHeight) {
        heroBg.style.transform = `translateY(${scrolled * 0.25}px)`;
      }
    }, { passive: true });
  }

  // --- Interactive Locations Map ---
  const mapPinGroups = document.querySelectorAll('.map-pin-group');
  mapPinGroups.forEach(pin => {
    pin.addEventListener('click', () => {
      const wasActive = pin.classList.contains('active');
      mapPinGroups.forEach(p => p.classList.remove('active'));
      if (!wasActive) pin.classList.add('active');
    });
  });

});
