import { createEvent, type RequestEvent } from './events';
export const BOOKMARK_KEY = 'signaldesk.saved.v1';
export const MAX_BOOKMARKS = 100;
type Snapshot = Readonly<{ events: readonly RequestEvent[]; persistent: boolean }>;
export function decodeBookmarks(raw: string | null): RequestEvent[] {
  try {
    const data: unknown = JSON.parse(raw ?? 'null');
    if (
      !data ||
      typeof data !== 'object' ||
      !('version' in data) ||
      data.version !== 1 ||
      !('sequences' in data) ||
      !Array.isArray(data.sequences)
    )
      return [];
    // Store only deterministic IDs. Never trust arbitrary event content from storage.
    return [
      ...new Set(
        data.sequences.filter(
          (n): n is number => Number.isInteger(n) && n >= 0 && n <= 1_000_000_000,
        ),
      ),
    ]
      .slice(0, MAX_BOOKMARKS)
      .map(createEvent);
  } catch {
    return [];
  }
}
export function createBookmarkStore(getStorage: () => Storage = () => window.localStorage) {
  const listeners = new Set<() => void>();
  const read = (): Snapshot => {
    try {
      return { events: decodeBookmarks(getStorage().getItem(BOOKMARK_KEY)), persistent: true };
    } catch {
      return { events: [], persistent: false };
    }
  };
  let snapshot = read();
  const emit = () => listeners.forEach((listener) => listener());
  const onStorage = (event: StorageEvent) => {
    if (event.key === BOOKMARK_KEY || event.key === null) {
      snapshot = read();
      emit();
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      if (!listeners.size) window.addEventListener('storage', onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) window.removeEventListener('storage', onStorage);
      };
    },
    toggle: (event: RequestEvent): 'saved' | 'removed' | 'limit' => {
      const exists = snapshot.events.some((saved) => saved.id === event.id);
      if (!exists && snapshot.events.length >= MAX_BOOKMARKS) return 'limit';
      const events = exists
        ? snapshot.events.filter((saved) => saved.id !== event.id)
        : [event, ...snapshot.events];
      let persistent = true;
      try {
        getStorage().setItem(
          BOOKMARK_KEY,
          JSON.stringify({ version: 1, sequences: events.map((e) => e.sequence) }),
        );
      } catch {
        persistent = false;
      }
      snapshot = { events, persistent };
      emit();
      return exists ? 'removed' : 'saved';
    },
  };
}
