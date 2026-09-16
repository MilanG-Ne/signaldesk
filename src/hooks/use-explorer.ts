import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { createBookmarkStore } from '../lib/bookmark-store';
import { createReplayStore } from '../lib/replay-store';
import { DEFAULT_FILTERS, readFilters, writeFilters, type Filters } from '../lib/filters';
export function useExplorer() {
  const [replay] = useState(createReplayStore);
  const [bookmarks] = useState(createBookmarkStore);
  const feed = useSyncExternalStore(replay.subscribe, replay.getSnapshot);
  const saved = useSyncExternalStore(bookmarks.subscribe, bookmarks.getSnapshot);
  const [filters, setFilters] = useState(() => readFilters(window.location.search));
  const update = useCallback(
    (patch: Partial<Filters>) => setFilters((previous) => ({ ...previous, ...patch })),
    [],
  );
  const reset = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  useEffect(() => {
    const query = writeFilters(filters);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
    );
  }, [filters]);
  useEffect(() => {
    const restore = () => setFilters(readFilters(window.location.search));
    const hide = () => {
      if (document.hidden) replay.pause();
    };
    window.addEventListener('popstate', restore);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('popstate', restore);
      document.removeEventListener('visibilitychange', hide);
      replay.dispose();
    };
  }, [replay]);
  return { replay, feed, bookmarks, saved, filters, update, reset };
}
