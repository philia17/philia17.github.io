import { inView } from './assets/vendor/motion-in-view.js';

// Each beat has its own trigger, so a tall project never waits to fit on screen.
const sequences = [
  ['.section-heading, .about-heading, #links > div:first-child', '.section-kicker, h2, .section-intro, .text-link, .about-signature, p:not(.section-kicker)'],
  ['#work .project-divider', '.project-number, .project-category, h3'],
  ['#work .project-index', ':scope > span, :scope > div'],
  ['#work .project-figure', ':scope > .image-mat, :scope > figcaption'],
  ['.project-introduction, .project-evidence, .project-study .project-copy, .build-copy', ':scope > :is(h3, h4, p, details)'],
  ['#work .paper-links, #research .paper-links, #links .external-links', ':scope > a'],
  ['#research .research-ledger > article', ':scope > .paper-venue, :scope > div > :is(h3, p, .paper-badges)'],
  ['#about .about-copy, #about .activity-note', ':scope > :is(h3, p, details)'],
];

function enableScrollReveals() {
  const main = document.querySelector('.portfolio-home main');
  if (!main || !('IntersectionObserver' in window)) return;

  const groups = new Map();
  for (const [selector, parts] of sequences) {
    for (const group of main.querySelectorAll(selector)) {
      const items = [...group.querySelectorAll(parts)];
      if (items.length === 0) continue;
      for (const [index, item] of items.entries()) {
        item.style.setProperty('--reveal-delay', String(Math.min(index, 4) * 75) + 'ms');
      }
      groups.set(group, items);
    }
  }

  function setState(group, state) {
    group.dataset.revealGroup = state;
    for (const item of groups.get(group)) item.dataset.scrollReveal = state;
  }

  for (const group of groups.keys()) setState(group, 'waiting');
  const targets = [...groups.keys()];
  inView(targets, group => {
    setState(group, 'shown');
    return () => {};
  }, {
    amount: .12,
    margin: '0px 0px -8% 0px',
  });
  // Reset only after leaving the actual viewport, even when the trigger is lower down.
  inView(targets, group => () => setState(group, 'waiting'));
}

enableScrollReveals();
