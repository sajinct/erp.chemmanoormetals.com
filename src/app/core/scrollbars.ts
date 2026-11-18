import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { OverlayScrollbars } from 'overlayscrollbars';

// Keep the existing Angular/Material elements as their own scroll viewports.
// No wrappers are inserted into tables, sidenavs or dialog content.
const SCROLL_CONTAINERS = [
  '.mat-drawer-content',
  '.mat-drawer-inner-container',
  '.table-wrap',
  '.mat-mdc-dialog-content',
  '.mat-mdc-dialog-surface',
  '.preview',
  '.app-notices',
].join(', ');

@Injectable({ providedIn: 'root' })
export class Scrollbars {
  constructor() {
    const document = inject(DOCUMENT);
    const view = document.defaultView;
    const destroy = inject(DestroyRef);
    const zone = inject(NgZone);
    if (!view) return;

    const instances = new Map<HTMLElement, OverlayScrollbars>();
    const forcedColors = view.matchMedia('(forced-colors: active)');
    let frame = 0;

    const scan = () => {
      frame = 0;
      for (const [element, instance] of instances) {
        if (forcedColors.matches || !element.isConnected) {
          instance.destroy();
          instances.delete(element);
        }
      }
      if (forcedColors.matches) return;
      const targets = [document.body, ...document.querySelectorAll<HTMLElement>(SCROLL_CONTAINERS)];
      for (const element of targets) {
        if (instances.has(element)) continue;
        const body = element === document.body;
        const style = view.getComputedStyle(element);
        const overflow = (value: string) =>
          value === 'auto' || value === 'scroll' ? ('scroll' as const) : ('hidden' as const);
        const instance = OverlayScrollbars(
          {
            target: element,
            ...(body ? {} : { elements: { viewport: element } }),
            cancel: { body: false },
          },
          {
            overflow: {
              x: body ? 'hidden' : overflow(style.overflowX),
              y: body ? 'scroll' : overflow(style.overflowY),
            },
            scrollbars: {
              theme: 'os-theme-erp',
              autoHide: 'scroll',
              autoHideDelay: 900,
              dragScroll: true,
              clickScroll: 'instant',
            },
          },
        );
        instances.set(element, instance);
      }
    };
    const schedule = () => {
      if (!frame) frame = view.requestAnimationFrame(scan);
    };
    let observer: MutationObserver;
    zone.runOutsideAngular(() => {
      observer = new view.MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true });
      forcedColors.addEventListener('change', schedule);
      schedule();
    });
    destroy.onDestroy(() => {
      observer.disconnect();
      forcedColors.removeEventListener('change', schedule);
      if (frame) view.cancelAnimationFrame(frame);
      for (const instance of instances.values()) instance.destroy();
      instances.clear();
    });
  }
}
