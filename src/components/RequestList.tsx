import { memo, useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, Bookmark, SearchX } from 'lucide-react';
import { duration, time, type RequestEvent } from '../lib/events';
const ROW_HEIGHT = 56;
export const RequestList = memo(function RequestList({
  events,
  selectedId,
  savedIds,
  onSelect,
  onInspect,
  resetKey,
  onReset,
}: {
  events: readonly RequestEvent[];
  selectedId?: string;
  savedIds: ReadonlySet<string>;
  onSelect: (event: RequestEvent) => void;
  onInspect: () => void;
  resetKey: string;
  onReset: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const key = useCallback((index: number) => events[index].id, [events]);
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => viewport.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: key,
  });
  useEffect(() => {
    viewport.current?.scrollTo({ top: 0 });
  }, [resetKey]);
  const rows = virtualizer.getVirtualItems();
  const active = rows.find((row) => events[row.index].id === selectedId);
  const choose = (index: number) => {
    onSelect(events[index]);
    virtualizer.scrollToIndex(index, { align: 'auto' });
  };
  return (
    <div className="request-list">
      <div className="list-header" aria-hidden="true">
        <span>STATUS</span>
        <span>REQUEST</span>
        <span>SERVICE</span>
        <span>DURATION</span>
        <span>TIME · UTC</span>
      </div>
      {events.length ? (
        <div
          ref={viewport}
          className="list-viewport"
          role="listbox"
          aria-label="Requests"
          aria-describedby="list-keyboard-hint"
          tabIndex={0}
          onPointerEnter={onInspect}
          onPointerDown={onInspect}
          onFocus={onInspect}
          aria-activedescendant={active ? `row-${selectedId}` : undefined}
          onScroll={(e) => {
            if (e.currentTarget.scrollTop > ROW_HEIGHT) onInspect();
          }}
          onKeyDown={(e) => {
            const current = events.findIndex((event) => event.id === selectedId);
            const next =
              e.key === 'ArrowDown'
                ? Math.min(events.length - 1, current + 1)
                : e.key === 'ArrowUp'
                  ? Math.max(0, current - 1)
                  : e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? events.length - 1
                      : e.key === 'PageDown'
                        ? Math.min(events.length - 1, Math.max(0, current) + 8)
                        : e.key === 'PageUp'
                          ? Math.max(0, current - 8)
                          : null;
            if (next !== null) {
              e.preventDefault();
              choose(next);
            }
          }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {rows.map((row) => {
              const event = events[row.index];
              return (
                <div
                  id={`row-${event.id}`}
                  key={event.id}
                  role="option"
                  aria-selected={event.id === selectedId}
                  aria-posinset={row.index + 1}
                  aria-setsize={events.length}
                  className={`request-row ${event.id === selectedId ? 'selected-row' : ''}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: ROW_HEIGHT,
                    transform: `translateY(${row.start}px)`,
                  }}
                  onClick={() => {
                    onSelect(event);
                    viewport.current?.focus({ preventScroll: true });
                  }}
                >
                  <span className={`status status-${Math.floor(event.status / 100)}`}>
                    {event.status}
                  </span>
                  <span className="route">
                    <b>{event.method}</b>
                    <span>{event.path}</span>
                    {savedIds.has(event.id) && (
                      <Bookmark size={13} className="row-bookmark" aria-label="Saved" />
                    )}
                  </span>
                  <span className="service-name">{event.service}</span>
                  <span
                    className={event.duration >= 800 ? 'slow-value duration-cell' : 'duration-cell'}
                  >
                    {duration(event.duration)}
                  </span>
                  <span className="muted mono time-cell">{time(event.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <SearchX size={28} />
          <h2>No requests in this view</h2>
          <p>Try a different search or clear the filters.</p>
          <button className="button" onClick={onReset}>
            Show all requests
          </button>
        </div>
      )}
      <div className="list-footer">
        <span>{events.length.toLocaleString('en-US')} matching requests</span>
        <span id="list-keyboard-hint">
          <ArrowDown size={12} /> Arrow keys to inspect · Home / End to jump
        </span>
      </div>
    </div>
  );
});
