import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bookmark,
  Check,
  Code2,
  Keyboard,
  Link,
  Pause,
  Play,
  Search,
  X,
} from 'lucide-react';
import { SERVICES, duration, time, type RequestEvent } from './lib/events';
import { filterEvents, histogram, summarize, writeFilters, type Filters } from './lib/filters';
import { useExplorer } from './hooks/use-explorer';
import { Timeline } from './components/Timeline';
import { RequestList } from './components/RequestList';
import { Inspector } from './components/Inspector';
import { useWebTools } from './hooks/use-web-tools';

export function App() {
  const { replay, feed, bookmarks, saved, filters, update, reset } = useExplorer();
  const [scope, setScope] = useState<'all' | 'saved'>('all');
  const [selected, setSelected] = useState<RequestEvent | null>(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const deferredFilters = useDeferredValue(filters);
  const source = scope === 'saved' ? saved.events : feed.events;
  const visible = useMemo(() => filterEvents(source, deferredFilters), [source, deferredFilters]);
  const chartEvents = useMemo(
    () => filterEvents(source, { ...deferredFilters, range: null }),
    [source, deferredFilters],
  );
  const stats = useMemo(() => summarize(visible), [visible]);
  const minutes = useMemo(() => histogram(source), [source]);
  const savedIds = useMemo(() => new Set(saved.events.map((e) => e.id)), [saved.events]);
  const inspect = useCallback(
    (event: RequestEvent) => {
      replay.pause();
      setSelected(event);
    },
    [replay],
  );
  const closeInspector = useCallback(() => {
    setSelected(null);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('[role="listbox"]')?.focus({ preventScroll: true }),
    );
  }, []);
  const clear = useCallback(() => {
    reset();
    setScope('all');
  }, [reset]);
  const toggleSaved = useCallback(() => {
    if (!selected) return;
    const result = bookmarks.toggle(selected);
    setNotice(
      result === 'limit'
        ? 'You can save up to 100 requests. Remove one to make room.'
        : result === 'saved'
          ? 'Request saved on this device.'
          : 'Request removed from saved requests.',
    );
  }, [bookmarks, selected]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'SUMMARY'].includes(target.tagName) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key === '/') {
        event.preventDefault();
        search.current?.focus();
      }
      if (event.key === 'Escape') closeInspector();
      if (event.key.toLowerCase() === 'b' && selected) {
        event.preventDefault();
        toggleSaved();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, closeInspector, toggleSaved]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  useWebTools(visible, inspect, update);
  const hasFilters =
    filters.query ||
    filters.service !== 'all' ||
    filters.status !== 'all' ||
    filters.slow ||
    filters.range !== null ||
    filters.sort !== 'newest';
  return (
    <div className={`app-shell ${selected ? 'has-selection' : ''}`}>
      <a href="#search-requests" className="skip-link">
        Skip to request search
      </a>
      <header className="app-header">
        <a className="brand" href="./" aria-label="SignalDesk home">
          <span>
            <Activity size={21} />
          </span>
          signaldesk<span className="brand-period">.</span>
        </a>
        <span className="header-tab">Explorer</span>
        <div className="header-actions">
          <details className="shortcuts">
            <summary>
              <Keyboard size={17} />
              <span>Shortcuts</span>
            </summary>
            <div>
              <strong>Stay on the keyboard</strong>
              <p>
                <kbd>/</kbd> Focus search
              </p>
              <p>
                <kbd>↑</kbd>
                <kbd>↓</kbd> Inspect requests
              </p>
              <p>
                <kbd>Home</kbd>
                <kbd>End</kbd> Jump through the list
              </p>
              <p>
                <kbd>B</kbd> Save selected request
              </p>
              <p>
                <kbd>Esc</kbd> Close inspector
              </p>
            </div>
          </details>
          <a
            className="source-link"
            href="https://github.com/MilanG-Ne/signaldesk"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={17} />
            <span>Source</span>
          </a>
        </div>
      </header>
      <main>
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">YOUR SIGNAL, WITHOUT THE NOISE</div>
            <h1>
              Request explorer<span className="demo-badge">SIMULATED DATA</span>
            </h1>
          </div>
          <div className="replay-controls">
            <span className={`replay-state ${feed.running ? 'running' : ''}`}>
              <i />
              {feed.running ? 'Replaying traffic' : 'Replay paused'}
            </span>
            <button
              className="button primary"
              onClick={() => (feed.running ? replay.pause() : replay.start())}
            >
              {feed.running ? <Pause size={15} /> : <Play size={15} />}{' '}
              {feed.running ? 'Pause replay' : 'Start replay'}
            </button>
          </div>
        </section>
        <section className="summary-strip" aria-label="Matching request statistics">
          <div>
            <span>Requests</span>
            <strong>
              {visible.length.toLocaleString('en-US')}
              <small>in this view</small>
            </strong>
          </div>
          <div>
            <span>Server error rate</span>
            <strong>
              {stats.errorRate}
              <em>%</em>
              <small>{stats.errors} errors</small>
            </strong>
          </div>
          <div>
            <span>95th percentile</span>
            <strong>
              {duration(stats.p95)}
              <small>response time</small>
            </strong>
          </div>
          <p>
            Find the slow path.
            <br />
            <span className="muted">Select a minute. Follow a request.</span>
          </p>
        </section>
        <Timeline
          events={chartEvents}
          domain={source}
          selected={filters.range}
          onSelect={(range) => {
            replay.pause();
            update({ range });
          }}
        />
        <section className="explorer" aria-label="Request explorer">
          <div className="scope-bar">
            <div className="scope-tabs" role="group" aria-label="Request collection">
              <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
                All requests<span>{feed.events.length.toLocaleString('en-US')}</span>
              </button>
              <button
                aria-pressed={scope === 'saved'}
                onClick={() => {
                  replay.pause();
                  setScope('saved');
                }}
              >
                <Bookmark size={14} />
                Saved<span>{saved.events.length}</span>
              </button>
            </div>
            <button
              className="text-button copy-filters"
              onClick={async () => {
                try {
                  const q = writeFilters(filters);
                  await navigator.clipboard.writeText(
                    `${location.origin}${location.pathname}${q ? '?' + q : ''}`,
                  );
                  setCopied(true);
                } catch {
                  setNotice(
                    'Clipboard unavailable. Copy the filters from your address bar instead.',
                  );
                }
              }}
            >
              {copied ? <Check size={15} /> : <Link size={15} />}{' '}
              {copied ? 'Copied' : 'Copy filter link'}
            </button>
          </div>
          <div className="filterbar">
            <label className="search">
              <Search size={18} />
              <input
                id="search-requests"
                ref={search}
                aria-label="Search requests"
                placeholder="Search paths, services or request IDs…"
                maxLength={160}
                value={filters.query}
                onChange={(e) => update({ query: e.target.value })}
              />
              {filters.query ? (
                <button
                  className="clear-search"
                  aria-label="Clear search"
                  onClick={() => {
                    update({ query: '' });
                    search.current?.focus();
                  }}
                >
                  <X size={15} />
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </label>
            <label className="select-filter">
              <span className="sr-only">Service</span>
              <select
                aria-label="Service"
                value={filters.service}
                onChange={(e) => update({ service: e.target.value as Filters['service'] })}
              >
                <option value="all">All services</option>
                {SERVICES.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            <label className="select-filter">
              <span className="sr-only">Status</span>
              <select
                aria-label="Status"
                value={filters.status}
                onChange={(e) => update({ status: e.target.value as Filters['status'] })}
              >
                <option value="all">All statuses</option>
                <option value="success">2xx · Success</option>
                <option value="client">4xx · Client errors</option>
                <option value="server">5xx · Server errors</option>
              </select>
            </label>
            <button
              className="button slow-filter"
              aria-pressed={filters.slow}
              onClick={() => update({ slow: !filters.slow })}
            >
              Slow ≥ 800 ms
            </button>
          </div>
          <div className="view-controls">
            <label>
              Time window{' '}
              <select
                aria-label="Time window"
                value={filters.range ?? 'all'}
                onChange={(e) => {
                  replay.pause();
                  update({ range: e.target.value === 'all' ? null : Number(e.target.value) });
                }}
              >
                <option value="all">Full session</option>
                {filters.range !== null && !minutes.some((b) => b.minute === filters.range) && (
                  <option value={filters.range}>
                    {time(filters.range * 60000).slice(0, 5)} UTC (outside session)
                  </option>
                )}
                {minutes.map((bin) => (
                  <option key={bin.minute} value={bin.minute}>
                    {time(bin.minute * 60000).slice(0, 5)} UTC
                  </option>
                ))}
              </select>
            </label>
            {hasFilters && (
              <button className="text-button reset-button" onClick={reset}>
                <X size={13} />
                Reset filters
              </button>
            )}
            <label className="sort-label">
              Sort{' '}
              <select
                aria-label="Sort requests"
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value as Filters['sort'] })}
              >
                <option value="newest">Newest first</option>
                <option value="slowest">Slowest first</option>
              </select>
            </label>
          </div>
          {!saved.persistent && (
            <div className="storage-notice" role="status">
              Browser storage is unavailable. Saved requests will last for this tab only.
            </div>
          )}
          <div
            className={`explorer-body ${filters !== deferredFilters ? 'updating' : ''}`}
            aria-busy={filters !== deferredFilters}
          >
            <RequestList
              events={visible}
              selectedId={selected?.id}
              savedIds={savedIds}
              onSelect={inspect}
              onInspect={replay.pause}
              resetKey={`${scope}:${writeFilters(deferredFilters)}`}
              onReset={clear}
            />
            <Inspector
              event={selected}
              saved={!!selected && savedIds.has(selected.id)}
              onBookmark={toggleSaved}
              onClose={closeInspector}
            />
          </div>
        </section>
        <footer className="app-footer">
          <span>
            <i className="local-indicator" />
            Fictional traffic. Everything runs in your browser.
          </span>
          <span>
            20,000-request rolling window · {feed.received.toLocaleString('en-US')} replayed
          </span>
        </footer>
        <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite">
          {notice}
        </div>
      </main>
    </div>
  );
}
