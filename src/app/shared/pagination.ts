import { computed, effect, signal, Signal } from '@angular/core';

/** Reset after filtering; keep only one page of a large result set in the DOM. */
export function paginate<T>(rows: Signal<T[]>, size = 25) {
  const page = signal(1);
  const pages = computed(() => Math.max(1, Math.ceil(rows().length / size)));
  const current = computed(() => Math.min(page(), pages()));
  effect(() => {
    rows();
    page.set(1);
  });
  return {
    page: current,
    pages,
    rows: computed(() => rows().slice((current() - 1) * size, current() * size)),
    start: computed(() => (rows().length ? (current() - 1) * size + 1 : 0)),
    end: computed(() => Math.min(current() * size, rows().length)),
    previous: () => page.set(Math.max(1, current() - 1)),
    next: () => page.set(Math.min(pages(), current() + 1)),
  };
}
