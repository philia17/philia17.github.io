(() => {
  const hero = document.querySelector('.portfolio-home .hero');
  const canvas = hero?.querySelector('.signal-art-canvas');
  const control = hero?.querySelector('.signal-art-motion');
  if (!control || !canvas) return;

  const context = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const preferenceKey = 'portfolio-trajectory';
  const width = 720;
  const height = 500;
  const tau = Math.PI * 2;
  const pointCount = 100;

  let playing = true;
  try { playing = localStorage.getItem(preferenceKey) !== 'off'; } catch {}
  let inViewport = !('IntersectionObserver' in window);
  let frame = 0;
  let elapsed = 0;
  let previousFrame;
  let teal;
  let copper;
  let tealWash;
  let copperWash;

  function ribbonPoint(u, strand, phase, warm) {
    const swell = Math.sin(Math.PI * u);
    const tilt = warm ? .19 : -.19;
    const wave = warm ? .132 : .152;
    const turn = warm ? .50 : -.04;
    const center = .50 + tilt * (u - .5) + wave * Math.sin(tau * (u + turn) + phase);
    const twist = Math.cos(tau * (.66 * u + turn) + phase);
    return height * (center + strand * (.043 + .137 * swell) * twist);
  }

  function trace(strand, phase, warm, reverse = false) {
    for (let step = 0; step <= pointCount; step++) {
      const u = reverse ? 1 - step / pointCount : step / pointCount;
      const x = 32 + (width - 64) * u;
      const y = ribbonPoint(u, strand, phase, warm);
      if (step === 0 && !reverse) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
  }

  function drawRibbon(phase, warm, strands, stroke, fill) {
    context.beginPath();
    trace(-1, phase, warm);
    trace(1, phase, warm, true);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    for (let line = 0; line < strands; line++) {
      context.beginPath();
      trace(2 * line / (strands - 1) - 1, phase, warm);
      context.lineWidth = line % 5 === 0 ? 1.4 : .82;
      context.stroke();
    }
  }

  function paint() {
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const phase = .34 * Math.sin(tau * elapsed / 11);
    drawRibbon(phase, true, 13, copper, copperWash);
    drawRibbon(phase, false, 24, teal, tealWash);
  }

  function resize() {
    if (!context) return;
    const density = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * density);
    canvas.height = Math.round(canvas.clientHeight * density);
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    teal = context.createLinearGradient(32, 0, width - 32, 0);
    teal.addColorStop(0, '#4a857900');
    teal.addColorStop(.16, '#4485777d');
    teal.addColorStop(.59, '#295c53b0');
    teal.addColorStop(.83, '#316d65a1');
    teal.addColorStop(1, '#4a857900');
    copper = context.createLinearGradient(32, 0, width - 32, 0);
    copper.addColorStop(0, '#aa6a4200');
    copper.addColorStop(.26, '#a7684459');
    copper.addColorStop(.65, '#a8673b90');
    copper.addColorStop(1, '#aa6a4200');
    tealWash = context.createLinearGradient(32, 0, width - 32, 0);
    tealWash.addColorStop(0, '#387e7000');
    tealWash.addColorStop(.55, '#387e7018');
    tealWash.addColorStop(1, '#387e7000');
    copperWash = context.createLinearGradient(32, 0, width - 32, 0);
    copperWash.addColorStop(0, '#b7753f00');
    copperWash.addColorStop(.55, '#b7753f13');
    copperWash.addColorStop(1, '#b7753f00');
    paint();
  }

  function tick(now) {
    if (previousFrame !== undefined) elapsed += Math.min((now - previousFrame) / 1000, .05);
    previousFrame = now;
    paint();
    frame = requestAnimationFrame(tick);
  }

  function updatePlayback() {
    const running = context && inViewport && !document.hidden && playing && !reducedMotion.matches;
    if (running && !frame) {
      frame = requestAnimationFrame(tick);
    } else if (!running && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrame = undefined;
    }
  }

  function applyPreference() {
    const enabled = playing && !reducedMotion.matches;
    control.hidden = reducedMotion.matches;
    control.setAttribute('aria-pressed', String(enabled));
    document.documentElement.dataset.portfolioMotion = enabled ? 'on' : 'off';
    updatePlayback();
  }

  control.addEventListener('click', () => {
    playing = !playing;
    try { localStorage.setItem(preferenceKey, playing ? 'on' : 'off'); } catch {}
    applyPreference();
  });
  reducedMotion.addEventListener('change', applyPreference);
  document.addEventListener('visibilitychange', updatePlayback);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      updatePlayback();
    });
    observer.observe(canvas);
  }

  if (!location.hash && !reducedMotion.matches) document.body.classList.add('hero-arrived');
  resize();
  applyPreference();
})();
