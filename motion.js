(() => {
  const hero = document.querySelector('.portfolio-home .hero');
  const canvas = hero?.querySelector('.trajectory-canvas');
  const control = hero?.querySelector('.trajectory-motion');
  const context = canvas?.getContext('2d');
  if (!context || !control) return;

  const width = 640;
  const height = 480;
  const cycle = 8.4;
  const signal = '#a0ddd0';
  const amber = '#ffd092';
  const ink = '#10292f';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const preferenceKey = 'portfolio-trajectory';
  const target = panelPoint(.30, .64);
  let playing = true;
  try { playing = localStorage.getItem(preferenceKey) !== 'off'; } catch {}
  let visible = false;
  let frame = 0;
  let seconds = playing ? 0 : 6.4;
  let lastTime = null;

  function clamp(value) { return Math.max(0, Math.min(1, value)); }

  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function panelPoint(u, v) {
    return [457 + 107 * u + 4 * v, 135 - 25 * u + 226 * v];
  }

  function path(points, color, weight = 1) {
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = color;
    context.lineWidth = weight;
    context.stroke();
  }

  function polygon(points, color) {
    context.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fillStyle = color;
    context.fill();
  }

  function dot(x, y, radius, color) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }

  function ring(x, y, radius, color, weight = 1) {
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.strokeStyle = color;
    context.lineWidth = weight;
    context.stroke();
  }

  function glow(x, y, radius, color) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, '#84d1c300');
    dot(x, y, radius, gradient);
  }

  function drawField(time) {
    context.fillStyle = ink;
    context.fillRect(0, 0, width, height);
    const depth = context.createLinearGradient(0, height, width, 40);
    depth.addColorStop(0, '#101f2d');
    depth.addColorStop(.53, '#243d45');
    depth.addColorStop(1, '#1d3641');
    context.fillStyle = depth;
    context.fillRect(0, 0, width, height);
    glow(466, 218, 250, '#5489896b');
    glow(185, 405, 220, '#235d695f');

    for (let i = 0; i <= 21; i++) {
      const x = 25 + 28 * i;
      path([[x, 44], [x, 426]], i % 4 ? '#aac9cc10' : '#afdbd823');
    }
    for (let i = 0; i <= 14; i++) {
      const y = 46 + 27 * i;
      path([[24, y], [615, y]], i % 4 ? '#aac9cc10' : '#afdbd823');
    }
    for (let i = -7; i <= 8; i++) {
      path([[320 + i * 17, 354], [320 + i * 70, 475]], '#96c6d12a');
    }
    for (const offset of [6, 16, 31, 50, 77, 111]) {
      path([[0, 355 + offset], [640, 355 + offset]], '#a5d3d425');
    }
    path([[24, 86], [24, 46], [66, 46]], '#c9e3db61');
    path([[574, 426], [615, 426], [615, 386]], '#c9e3db61');
    // A sparse depth field gives motion an edge-to-edge presence without hiding the diagram.
    for (let i = 0; i < 55; i++) {
      const x = 29 + ((i * 103) % 568);
      const y = 57 + ((i * 67) % 337);
      const strength = .09 + .20 * Math.pow(Math.sin(i + time * .75), 2);
      dot(x, y, i % 7 ? .8 : 1.5, 'rgba(152,221,209,' + strength + ')');
    }
  }

  function drawPanel(time) {
    const corners = [panelPoint(0, 0), panelPoint(1, 0), panelPoint(1, 1), panelPoint(0, 1)];
    const side = corners.map(([x,y]) => [x + 15, y + 8]);
    polygon([corners[1],side[1],side[2],corners[2]], '#10272d');
    polygon([corners[2],side[2],side[3],corners[3]], '#0b222a');
    const glass = context.createLinearGradient(449, 116, 565, 370);
    glass.addColorStop(0, '#7dafa0');
    glass.addColorStop(.50, '#39606a');
    glass.addColorStop(1, '#263c49');
    polygon(corners, glass);
    path([...corners,corners[0]], '#a7d1c8', 1.5);
    const inset = [panelPoint(.07,.04),panelPoint(.93,.04),panelPoint(.93,.96),panelPoint(.07,.96)];
    path([...inset,inset[0]], '#b1dfcf65');

    const display = [panelPoint(.22,.13),panelPoint(.78,.13),panelPoint(.78,.24),panelPoint(.22,.24)];
    polygon(display,'#132b32');
    path([...display,display[0]],'#97c7b9a0');
    const [dx,dy] = panelPoint(.39,.21);
    path([[dx,dy],[dx+13,dy-3],[dx+19,dy-8]], '#76c9b6', 1.8);

    const lock = ease((time - 1.13) / .83) * (1 - ease((time - 7.64) / .75));
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const [x,y] = panelPoint(.30 + col * .42, .44 + row * .20);
        const selected = row === 1 && col === 0;
        dot(x + 2, y + 3, 11, '#142932');
        dot(x, y, 10, '#263d43');
        ring(x, y, 10, '#b3d6cbad');
        ring(x, y, 7, '#8cbab647');
        if (!selected) dot(x, y, 1.8, '#a6c7bf94');
        if (selected && lock > 0) {
          context.save();
          context.globalAlpha = lock;
          glow(x,y,23,'#ffcf8391');
          ring(x,y,9.5,amber,1.5);
          dot(x,y,3.6,amber);
          context.restore();
        }
      }
    }

    if (time < 2.35) {
      const scan = ease(time / 2.35);
      const alpha = Math.sin(Math.PI * clamp(time / 2.35));
      context.save();
      context.globalAlpha = alpha;
      polygon([[80,245],panelPoint(0,.12+scan*.7),panelPoint(1,.28+scan*.7)],'#78decd26');
      path([panelPoint(0,.12+scan*.7),panelPoint(1,.12+scan*.7)],'#c8fff2',2.1);
      glow(82,245,45,'#70dfc786');
      context.restore();
    }
  }

  function trajectory(t, offset = 0) {
    const s = 1 - t;
    return [
      s*s*s*67 + 3*s*s*t*199 + 3*s*t*t*252 + t*t*t*target[0],
      s*s*s*373 + 3*s*s*t*(444+offset) + 3*s*t*t*(96+offset) + t*t*t*target[1]
    ];
  }

  function routeBetween(start, end, offset = 0) {
    return Array.from({length:44}, (_, i) => trajectory(start+(end-start)*i/43, offset));
  }

  function drawTrajectory(time) {
    const arrival = ease((time - 2.32) / 3.62);
    const fade = 1 - ease((time - 7.68) / .63);
    for (const spread of [-63,-28,28,63]) {
      path(routeBetween(0,1,spread), '#a0ddd044', spread===-28 ? 1.2 : .8);
    }
    context.setLineDash([3,5]);
    path(routeBetween(0,1), '#cbe7e56b');
    context.setLineDash([]);
    const [sx,sy] = trajectory(0);
    glow(sx,sy,20,'#8be2d266');
    ring(sx,sy,10,'#95ccbfac');
    dot(sx,sy,3,signal);

    if (arrival > 0) {
      context.save();
      context.globalAlpha = fade;
      const ribbon = context.createLinearGradient(67,373,target[0],target[1]);
      ribbon.addColorStop(0,'#46a6c6');
      ribbon.addColorStop(.50,'#b2f5df');
      ribbon.addColorStop(1,amber);
      const sampled = routeBetween(0,arrival);
      path(sampled,'#79dcd63d',10);
      path(sampled,'#9ceee780',4.9);
      path(sampled,ribbon,2.1);
      for (let i = 1; i < 13; i++) {
        if (i / 13 >= arrival) break;
        const [x,y] = trajectory(i / 13);
        dot(x,y,i % 3 ? 2.1 : 3.1,'#d7f7e9');
      }
      const [x,y] = trajectory(arrival);
      glow(x,y,42,arrival < .98 ? '#a5fffbc5' : '#ffc97db0');
      dot(x,y,4.5,arrival < .98 ? '#e6fff5' : amber);
      context.restore();
    }
    const pulse = clamp((time - 5.94) / 1.48);
    if (pulse > 0 && pulse < 1) {
      const [x,y] = target;
      context.save();
      context.globalAlpha = (1-pulse) * .84;
      ring(x,y,13+41*ease(pulse),amber,1.35);
      ring(x,y,13+27*ease(pulse),'#fff3d5',.8);
      context.restore();
    }
  }

  function paint(time) {
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    drawField(time);
    drawPanel(time);
    drawTrajectory(time);
    const phase = time < 2.32 ? 'sense' : time < 5.94 ? 'compute' : 'act';
    if (hero.dataset.phase !== phase) hero.dataset.phase = phase;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const density = Math.min(devicePixelRatio || 1, 2);
    if (rect.width === 0) return;
    const pixels = Math.round(rect.width*density);
    if (canvas.width !== pixels) {
      canvas.width = pixels;
      canvas.height = Math.round(pixels*height/width);
    }
    paint(reducedMotion.matches ? 6.4 : seconds);
  }

  function tick(now) {
    if (lastTime !== null) seconds = (seconds + Math.min((now - lastTime) / 1000, .1)) % cycle;
    lastTime = now;
    paint(seconds);
    frame = requestAnimationFrame(tick);
  }

  function updatePlayback() {
    const running = visible && !document.hidden && playing && !reducedMotion.matches;
    hero.toggleAttribute('data-motion-live', running);
    if (running) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
    }
  }

  function applyPreference() {
    control.hidden = reducedMotion.matches;
    control.setAttribute('aria-pressed', String(playing));
    if (reducedMotion.matches) paint(6.4);
    updatePlayback();
  }

  control.addEventListener('click', () => {
    playing = !playing;
    try { localStorage.setItem(preferenceKey, playing ? 'on' : 'off'); } catch {}
    applyPreference();
  });
  document.addEventListener('visibilitychange', updatePlayback);
  reducedMotion.addEventListener('change', applyPreference);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    });
    observer.observe(canvas);
    if (!reducedMotion.matches && !location.hash) {
      const reveal = new IntersectionObserver((entries, watcher) => {
        for (const {isIntersecting, target} of entries) {
          if (!isIntersecting) continue;
          target.classList.add('figure-arrived');
          watcher.unobserve(target);
        }
      }, {threshold:.2});
      document.querySelectorAll('#work .project-figure').forEach(figure => reveal.observe(figure));
    }
  } else visible = true;

  if (!location.hash && !reducedMotion.matches) document.body.classList.add('hero-arrived');
  resize();
  applyPreference();
})();
