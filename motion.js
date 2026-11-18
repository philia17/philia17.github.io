(() => {
  const control = document.querySelector('.portfolio-home .motion-toggle');
  if (!control) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const preferenceKey = 'portfolio-trajectory';
  let enabled = true;
  try { enabled = localStorage.getItem(preferenceKey) !== 'off'; } catch {}

  function applyPreference() {
    const animate = enabled && !reducedMotion.matches;
    control.hidden = reducedMotion.matches;
    control.setAttribute('aria-pressed', String(animate));
    document.documentElement.dataset.portfolioMotion = animate ? 'on' : 'off';
  }

  control.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch {}
    applyPreference();
  });
  reducedMotion.addEventListener('change', applyPreference);

  if (!location.hash && !reducedMotion.matches) document.body.classList.add('hero-arrived');
  applyPreference();
})();
