(() => {
  const board = document.querySelector('.signal-board');
  const replay = board?.querySelector('.signal-replay');
  if (!board || !replay) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, watcher) => {
        for (const { isIntersecting, target } of entries) {
          if (!isIntersecting || reducedMotion.matches) continue;
          if (target === board) {
            board.classList.add('signal-playing');
          } else {
            target.classList.add('figure-arrived');
          }
          watcher.unobserve(target);
        }
      }, { threshold: 0.2 })
    : null;

  function applyMotionPreference() {
    replay.hidden = reducedMotion.matches;
    if (reducedMotion.matches) {
      observer?.disconnect();
      board.classList.remove('signal-playing');
      return;
    }
    if (!location.hash) document.body.classList.add('hero-arrived');
    observer?.observe(board);
    if (!location.hash) {
      document.querySelectorAll('#work .project-figure').forEach(figure => observer?.observe(figure));
    }
  }

  replay.addEventListener('click', () => {
    if (reducedMotion.matches) return;
    observer?.unobserve(board);
    board.classList.remove('signal-playing');
    // Restart the same finite sequence without replacing the focused button.
    board.getBoundingClientRect();
    board.classList.add('signal-playing');
  });
  reducedMotion.addEventListener('change', applyMotionPreference);
  applyMotionPreference();
})();
