(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.pathname === location.pathname) link.classList.add('active');
  });
  const heroVideo = document.querySelector('[data-hero-video]');
  const heroToggle = document.querySelector('[data-hero-toggle]');
  const syncHeroToggle = () => {
    if (!heroVideo || !heroToggle) return;
    const playing = !heroVideo.paused;
    heroToggle.textContent = playing ? 'Ⅱ' : '▶';
    heroToggle.setAttribute('aria-label', playing ? 'Pause hero video' : 'Play hero video');
  };
  heroToggle?.addEventListener('click', async () => {
    if (!heroVideo) return;
    if (heroVideo.paused) {
      try { await heroVideo.play(); } catch { syncHeroToggle(); }
    } else {
      heroVideo.pause();
    }
  });
  heroVideo?.addEventListener('play', syncHeroToggle);
  heroVideo?.addEventListener('pause', syncHeroToggle);
  syncHeroToggle();
  const cctvSlideshow = document.querySelector('[data-cctv-slideshow]');
  if (cctvSlideshow) {
    const photos = [
      { src: '/media/assets/images/cctv/cctv-installation-01.jpg', alt: 'Two dome cameras installed on the exterior of a building', caption: 'Exterior camera coverage' },
      { src: '/media/assets/images/cctv/cctv-installation-02.jpg', alt: 'Dome camera installed at an interior ceiling corner', caption: 'Indoor camera installation' },
      { src: '/media/assets/images/cctv/cctv-installation-03.jpg', alt: 'Monitor displaying a live CCTV camera view', caption: 'Live camera monitoring' },
      { src: '/media/assets/images/cctv/cctv-installation-04.jpg', alt: 'Two dome cameras mounted on an exterior wall', caption: 'Building perimeter coverage' },
      { src: '/media/assets/images/cctv/cctv-installation-05.jpg', alt: 'Wide view of a building with exterior security cameras', caption: 'Wide-angle exterior coverage' },
      { src: '/media/assets/images/cctv/cctv-installation-06.jpg', alt: 'Close view of two mounted dome security cameras', caption: 'Camera hardware detail' }
    ];
    const image = cctvSlideshow.querySelector('[data-slide-image]');
    const caption = cctvSlideshow.querySelector('[data-slide-caption]');
    const counter = cctvSlideshow.querySelector('[data-slide-counter]');
    const counterLabel = cctvSlideshow.querySelector('.cctv-slide-counter');
    const dots = [...cctvSlideshow.querySelectorAll('[data-slide-to]')];
    const toggle = cctvSlideshow.querySelector('[data-slide-toggle]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let timer = null;
    let pausedByUser = reducedMotion.matches;
    let userStarted = false;

    const show = (next) => {
      current = (next + photos.length) % photos.length;
      const photo = photos[current];
      image.src = photo.src;
      image.alt = photo.alt;
      caption.textContent = photo.caption;
      counter.textContent = String(current + 1);
      counterLabel.setAttribute('aria-label', `Photo ${current + 1} of ${photos.length}`);
      dots.forEach((dot, index) => dot.setAttribute('aria-current', String(index === current)));
    };
    const stop = () => { window.clearInterval(timer); timer = null; };
    const syncToggle = () => {
      const canAutoPlay = !reducedMotion.matches || userStarted;
      const isPlaying = !pausedByUser && canAutoPlay;
      toggle.textContent = isPlaying ? 'Pause slideshow' : 'Play slideshow';
      toggle.setAttribute('aria-label', isPlaying ? 'Pause slideshow' : 'Play slideshow');
    };
    const start = () => {
      stop();
      if (pausedByUser || (reducedMotion.matches && !userStarted) || document.hidden) return;
      timer = window.setInterval(() => show(current + 1), 5500);
      syncToggle();
    };
    const navigate = (next) => { show(next); start(); };

    cctvSlideshow.querySelector('[data-slide-prev]').addEventListener('click', () => navigate(current - 1));
    cctvSlideshow.querySelector('[data-slide-next]').addEventListener('click', () => navigate(current + 1));
    dots.forEach(dot => dot.addEventListener('click', () => navigate(Number(dot.dataset.slideTo))));
    toggle.addEventListener('click', () => {
      const isPlaying = !pausedByUser && (!reducedMotion.matches || userStarted);
      pausedByUser = isPlaying;
      if (!pausedByUser) userStarted = true;
      syncToggle();
      if (pausedByUser) stop(); else start();
    });
    document.addEventListener('visibilitychange', start);
    reducedMotion.addEventListener?.('change', () => { syncToggle(); start(); });
    show(0);
    syncToggle();
    start();
  }
  const portfolioHero = document.querySelector('[data-portfolio-hero]');
  if (portfolioHero) {
    const slides = [
      { src: '/media/assets/images/portfolio-hero/portfolio-hero-01.jpg', alt: 'Film editor working at a computer workstation', caption: 'At the edit suite' },
      { src: '/media/assets/images/portfolio-hero/portfolio-hero-02.jpg', alt: 'Live broadcast control room with production monitors', caption: 'Live broadcast control room' },
      { src: '/media/assets/images/portfolio-hero/portfolio-hero-03.jpg', alt: 'Two people seated together at a community meeting', caption: 'Stories from the community' },
      { src: '/media/assets/images/portfolio-hero/portfolio-hero-04.jpg', alt: 'Camera operator filming an event with a professional camera', caption: 'Camera operator on assignment' },
      { src: '/media/assets/images/portfolio-hero/portfolio-hero-05.jpg', alt: 'Production crew coordinating a live broadcast at their workstations', caption: 'Production crew at work' },
      { src: '/media/assets/images/portfolio-hero/portfolio-hero-06.jpg', alt: 'Broadcast team monitoring a production together', caption: 'Keeping the live feed in focus' },
      { src: '/media/assets/images/portfolio-hero/portfolio-hero-07.jpg', alt: 'Camera operator working behind a cinema camera', caption: 'Behind the camera' }
    ];
    const layers = [...portfolioHero.querySelectorAll('[data-portfolio-hero-layer]')];
    const caption = portfolioHero.querySelector('[data-portfolio-hero-caption]');
    const dots = [...portfolioHero.querySelectorAll('[data-portfolio-hero-to]')];
    const toggle = portfolioHero.querySelector('[data-portfolio-hero-toggle]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let activeLayer = 0;
    let timer = null;
    let paused = reducedMotion.matches;

    const stop = () => { window.clearInterval(timer); timer = null; };
    const syncToggle = () => {
      toggle.textContent = paused ? '▶' : 'Ⅱ';
      toggle.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
    };
    const show = (nextIndex) => {
      current = (nextIndex + slides.length) % slides.length;
      const slide = slides[current];
      const incomingIndex = activeLayer === 0 ? 1 : 0;
      const incoming = layers[incomingIndex];
      const outgoing = layers[activeLayer];
      incoming.classList.remove('is-active');
      incoming.src = slide.src;
      incoming.alt = slide.alt;
      requestAnimationFrame(() => {
        outgoing.classList.remove('is-active');
        outgoing.setAttribute('aria-hidden', 'true');
        incoming.classList.add('is-active');
        incoming.setAttribute('aria-hidden', 'false');
        activeLayer = incomingIndex;
      });
      caption.textContent = slide.caption;
      dots.forEach((dot, index) => dot.setAttribute('aria-current', String(index === current)));
    };
    const start = () => {
      stop();
      if (paused || document.hidden) return;
      timer = window.setInterval(() => show(current + 1), 7200);
      syncToggle();
    };
    const navigate = (index) => {
      show(index);
      if (!paused) start();
    };

    portfolioHero.querySelector('[data-portfolio-hero-prev]').addEventListener('click', () => navigate(current - 1));
    portfolioHero.querySelector('[data-portfolio-hero-next]').addEventListener('click', () => navigate(current + 1));
    dots.forEach(dot => dot.addEventListener('click', () => navigate(Number(dot.dataset.portfolioHeroTo))));
    toggle.addEventListener('click', () => {
      paused = !paused;
      syncToggle();
      if (paused) stop(); else start();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    reducedMotion.addEventListener?.('change', event => {
      if (event.matches) { paused = true; stop(); }
      syncToggle();
      if (!paused) start();
    });
    syncToggle();
    start();
  }
  const broadcastSlideshow = document.querySelector('[data-broadcast-slideshow]');
  if (broadcastSlideshow) {
    const photos = [
      { src: '/media/assets/images/broadcast/broadcast-01.jpg', alt: 'Film editor working at a computer workstation', caption: 'At the edit suite' },
      { src: '/media/assets/images/broadcast/broadcast-02.jpg', alt: 'Live broadcast control room with production monitors', caption: 'Live broadcast control room' },
      { src: '/media/assets/images/broadcast/broadcast-03.jpg', alt: 'Production director guiding a live broadcast from the control room', caption: 'Directing the live production' },
      { src: '/media/assets/images/broadcast/broadcast-04.jpg', alt: 'Camera operator filming an event with a professional camera', caption: 'Camera operator on assignment' },
      { src: '/media/assets/images/broadcast/broadcast-05.jpg', alt: 'Camera operator filming an event from behind a professional camera', caption: 'Capturing the moment' },
      { src: '/media/assets/images/broadcast/broadcast-06.jpg', alt: 'Broadcast team monitoring the live feed together', caption: 'Monitoring the live feed' },
      { src: '/media/assets/images/broadcast/broadcast-07.jpg', alt: 'Camera operator working behind a cinema camera', caption: 'Behind the camera' }
    ];
    const layers = [...broadcastSlideshow.querySelectorAll('[data-broadcast-layer]')];
    const caption = broadcastSlideshow.querySelector('[data-broadcast-caption]');
    const counter = broadcastSlideshow.querySelector('[data-broadcast-counter]');
    const dots = [...broadcastSlideshow.querySelectorAll('[data-broadcast-to]')];
    const toggle = broadcastSlideshow.querySelector('[data-broadcast-toggle]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let activeLayer = 0;
    let timer = null;
    let paused = reducedMotion.matches;

    const stop = () => { window.clearInterval(timer); timer = null; };
    const syncToggle = () => {
      toggle.textContent = paused ? '▶' : 'Ⅱ';
      toggle.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
    };
    const show = (nextIndex) => {
      current = (nextIndex + photos.length) % photos.length;
      const photo = photos[current];
      const incomingIndex = activeLayer === 0 ? 1 : 0;
      const incoming = layers[incomingIndex];
      const outgoing = layers[activeLayer];
      incoming.classList.remove('is-active');
      incoming.src = photo.src;
      incoming.alt = photo.alt;
      requestAnimationFrame(() => {
        outgoing.classList.remove('is-active');
        outgoing.setAttribute('aria-hidden', 'true');
        incoming.classList.add('is-active');
        incoming.setAttribute('aria-hidden', 'false');
        activeLayer = incomingIndex;
      });
      caption.textContent = photo.caption;
      counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(photos.length).padStart(2, '0')}`;
      counter.setAttribute('aria-label', `Photo ${current + 1} of ${photos.length}`);
      dots.forEach((dot, index) => dot.setAttribute('aria-current', String(index === current)));
    };
    const start = () => {
      stop();
      if (paused || document.hidden) return;
      timer = window.setInterval(() => show(current + 1), 6400);
      syncToggle();
    };
    const navigate = (index) => { show(index); if (!paused) start(); };

    broadcastSlideshow.querySelector('[data-broadcast-prev]').addEventListener('click', () => navigate(current - 1));
    broadcastSlideshow.querySelector('[data-broadcast-next]').addEventListener('click', () => navigate(current + 1));
    dots.forEach(dot => dot.addEventListener('click', () => navigate(Number(dot.dataset.broadcastTo))));
    toggle.addEventListener('click', () => {
      paused = !paused;
      syncToggle();
      if (paused) stop(); else start();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    reducedMotion.addEventListener?.('change', event => {
      if (event.matches) { paused = true; stop(); }
      syncToggle();
      if (!paused) start();
    });
    syncToggle();
    start();
  }
})();

