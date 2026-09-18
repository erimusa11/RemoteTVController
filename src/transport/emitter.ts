import type { TvState } from './types';

/** Tiny listener registry shared by both transport implementations. */
export class StateEmitter {
  private listeners = new Set<(state: Partial<TvState>) => void>();

  subscribe(listener: (state: Partial<TvState>) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(patch: Partial<TvState>) {
    this.listeners.forEach((l) => l(patch));
  }
}
