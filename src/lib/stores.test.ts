import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvent } from './events';
import { createReplayStore } from './replay-store';
import { BOOKMARK_KEY, createBookmarkStore, decodeBookmarks } from './bookmark-store';
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});
describe('replay lifecycle', () => {
  it('publishes stable snapshots and keeps a bounded newest-first window', () => {
    vi.useFakeTimers();
    const store = createReplayStore(20, 20);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const initial = store.getSnapshot();
    expect(store.getSnapshot()).toBe(initial);
    store.start();
    store.start();
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot().events).toHaveLength(20);
    expect(store.getSnapshot().received).toBe(8);
    expect(store.getSnapshot().events[0].sequence).toBe(27);
    expect(initial.events[0].sequence).toBe(19);
    store.pause();
    const paused = store.getSnapshot();
    vi.advanceTimersByTime(3000);
    expect(store.getSnapshot()).toBe(paused);
    store.start();
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot().received).toBe(16);
    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not multiply timers when the last subscriber unmounts and remounts', () => {
    vi.useFakeTimers();
    const store = createReplayStore(10);
    const first = store.subscribe(() => {});
    store.start();
    first();
    expect(vi.getTimerCount()).toBe(0);
    expect(store.getSnapshot().running).toBe(false);
    const second = store.subscribe(() => {});
    store.start();
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot().received).toBe(8);
    second();
  });
});
describe('device-local saved requests', () => {
  it('rejects corrupt storage and reconstructs only validated fixture IDs', () => {
    expect(decodeBookmarks('{bad json')).toEqual([]);
    expect(decodeBookmarks('{"version":2,"sequences":[1]}')).toEqual([]);
    expect(decodeBookmarks('{"version":1,"sequences":[4,4,-2,"5",0.3,null,1000000001]}')).toEqual([
      createEvent(4),
    ]);
  });
  it('persists bookmarks, enforces the cap, and permits removals at capacity', () => {
    const store = createBookmarkStore();
    for (let i = 0; i < 100; i++) expect(store.toggle(createEvent(i))).toBe('saved');
    expect(store.toggle(createEvent(100))).toBe('limit');
    expect(store.getSnapshot().events).toHaveLength(100);
    expect(createBookmarkStore().getSnapshot().events).toEqual(store.getSnapshot().events);
    expect(store.toggle(createEvent(10))).toBe('removed');
    expect(store.toggle(createEvent(100))).toBe('saved');
  });
  it('remains usable when storage access is blocked', () => {
    const store = createBookmarkStore(() => {
      throw new Error('blocked');
    });
    expect(store.toggle(createEvent(2))).toBe('saved');
    expect(store.getSnapshot().events).toEqual([createEvent(2)]);
    expect(store.getSnapshot().persistent).toBe(false);
  });
  it('subscribes to cross-tab changes and cleans up the listener', () => {
    const store = createBookmarkStore();
    const changed = vi.fn();
    const unsubscribe = store.subscribe(changed);
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify({ version: 1, sequences: [9] }));
    window.dispatchEvent(new StorageEvent('storage', { key: BOOKMARK_KEY }));
    expect(store.getSnapshot().events).toEqual([createEvent(9)]);
    expect(changed).toHaveBeenCalledOnce();
    unsubscribe();
    window.dispatchEvent(new StorageEvent('storage', { key: BOOKMARK_KEY }));
    expect(changed).toHaveBeenCalledOnce();
  });
});
