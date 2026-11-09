/**
 * Moves a menu opened at the pointer back inside the window: up when it would run off the
 * bottom (a right click on the last items of a list), left when it would run off the right.
 */
export function keepInView(el: HTMLElement, _at?: unknown) {
  const margin = 6;
  const place = () => {
    const r = el.getBoundingClientRect();
    if (r.bottom > innerHeight - margin) el.style.top = `${Math.max(margin, innerHeight - margin - r.height)}px`;
    if (r.right > innerWidth - margin) el.style.left = `${Math.max(margin, innerWidth - margin - r.width)}px`;
  };
  place();
  return { update: place };
}
