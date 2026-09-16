import { createDataset, createEvent, INITIAL_COUNT, MAX_EVENTS, type RequestEvent } from './events';
export type ReplaySnapshot = Readonly<{
  events: readonly RequestEvent[];
  running: boolean;
  received: number;
}>;
export function createReplayStore(initialCount = INITIAL_COUNT, limit = MAX_EVENTS) {
  let sequence = initialCount;
  let snapshot: ReplaySnapshot = {
    events: createDataset(initialCount).slice(0, limit),
    running: false,
    received: 0,
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const pause = () => {
    clearInterval(timer);
    timer = undefined;
    if (snapshot.running) {
      snapshot = { ...snapshot, running: false };
      emit();
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) pause();
      };
    },
    start: () => {
      if (timer !== undefined) return;
      snapshot = { ...snapshot, running: true };
      emit();
      timer = setInterval(() => {
        const batch = Array.from({ length: 8 }, () => createEvent(sequence++)).reverse();
        snapshot = {
          events: [...batch, ...snapshot.events].slice(0, limit),
          running: true,
          received: snapshot.received + batch.length,
        };
        emit();
      }, 1000);
    },
    pause,
    dispose: pause,
  };
}
