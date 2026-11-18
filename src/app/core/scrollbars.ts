import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';

/** Reveal the scrolling container during touch, keyboard and programmatic scrolling. */
@Injectable({ providedIn: 'root' })
export class Scrollbars {
  constructor() {
    const document = inject(DOCUMENT);
    const view = document.defaultView;
    const destroy = inject(DestroyRef);
    const zone = inject(NgZone);
    if (!view) return;

    const pending = new Map<Element, number>();
    const onScroll = (event: Event) => {
      const target = event.target === document ? document.scrollingElement : event.target;
      if (!(target instanceof Element)) return;
      const previous = pending.get(target);
      if (previous !== undefined) view.clearTimeout(previous);
      target.classList.add('is-scrolling');
      pending.set(
        target,
        view.setTimeout(() => {
          target.classList.remove('is-scrolling');
          pending.delete(target);
        }, 900),
      );
    };

    // Passive capture also sees non-bubbling scroll events from sidebar and dialog containers.
    // This visual effect doesn't trigger Angular change detection on each scroll frame.
    zone.runOutsideAngular(() =>
      document.addEventListener('scroll', onScroll, { passive: true, capture: true }),
    );
    destroy.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, true);
      for (const [target, timer] of pending) {
        view.clearTimeout(timer);
        target.classList.remove('is-scrolling');
      }
      pending.clear();
    });
  }
}
