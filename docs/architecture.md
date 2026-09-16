# Architecture

SignalDesk has one screen and three kinds of state:

- **Replay data:** an external store owns the simulated stream and its timer.
- **Saved IDs:** a separate external store persists a bounded device-local collection.
- **View state:** React owns filters, the selected request, the active collection, and short-lived feedback.

The stores contain no React imports. `useExplorer` binds them to React with `useSyncExternalStore`. Filtering, statistics, histogram bins, and waterfall spans are pure functions. Components receive the data they render and explicit actions.

## One replay, one timer

`createReplayStore` starts paused with 20,000 deterministic requests. Starting twice does not create two timers. Each tick prepends eight new events and trims the oldest events to keep the collection bounded. Snapshots retain their object identity until the data or running state changes, which is required for a stable external-store subscription.

Entering the list with the pointer or keyboard focus, selecting a request, scrolling away from the top, switching to saved requests, or hiding the document pauses the stream. A selected request is an immutable snapshot: it remains inspectable after the rolling window advances. The last subscriber leaving stops the timer. Tests exercise pause/resume and unsubscribe/remount behavior rather than merely checking that an interval was created.

This is a replay clock, not real wall time. The fixed fixture begins on 16 September 2026 at 12:00 UTC. Eight events arrive per real second; their simulated timestamps advance by 180 milliseconds per event. Refreshing restarts the session. Request IDs and content are deterministic for each sequence number.

## Filtering and rendering

The search field updates immediately. `useDeferredValue` lets React defer the filter-dependent render while keeping the previous results visible. `useMemo` caches each derivation by its actual inputs. `RequestList` is memoized, with stable callbacks for inspection and reset, so an urgent keystroke does not need to render every row.

This is cooperative scheduling, not parallel computation: the filter function still runs on the main thread. If the dataset or query language became much larger, profiling could justify moving computation to a worker. Debouncing alone would impose an arbitrary delay; rendering 20,000 DOM rows would solve the wrong problem.

TanStack Virtual maintains a fixed 56-pixel row estimate and an overscan of eight items. Stable request IDs prevent recycling one request's identity for another. The viewport has a bounded height and `overflow-anchor: none`; replay pauses when a reader scrolls down.

The list uses `role=listbox`, `role=option`, selection state, position/set-size attributes, and a mounted active descendant. Arrow, Page, Home, and End keys update the same selected request as clicking. When a selected request leaves the filtered result, its inspector stays open as a snapshot, and the list exposes no invalid active descendant.

## Filter links

URL serialization has a small allowlist: text, service, status, slow requests, sort, and minute. Unknown values revert to defaults; search length is bounded. `replaceState` keeps the address aligned without creating a history entry for each keystroke. A `popstate` listener restores externally navigated filter URLs.

A copied link reproduces filters against the receiver's local fixture. It cannot transfer another browser's saved collection or invent replay events that have not been generated in that session.

The timeline shows the current collection with all filters **except** the selected minute, so adjacent minutes remain available. The time positions come from the unfiltered collection; zero-match minutes remain gaps instead of shifting later bars. Summary statistics and rows include the minute filter.

## Saved requests

The storage schema is `{version: 1, sequences: number[]}`. The reader validates integer bounds, deduplicates, caps the collection at 100, and regenerates event content from the deterministic fixture. It does not trust arbitrary serialized request text. This also keeps saved requests available after their events leave the rolling buffer.

A storage event reloads the cached snapshot in other tabs. Corrupt data becomes an empty collection. If the browser denies storage or the quota is exhausted, the current tab retains an in-memory collection and shows a persistence warning. Cross-tab writes are last-write-wins; this is a local convenience, not collaborative storage.

## Testing boundaries

- Pure tests verify intersecting filters, sorting without mutation, URL validation, histogram totals, and exact span-duration totals.
- Store tests use fake timers and storage events to exercise timer ownership, retention limits, persistence failure, capacity, and cleanup.
- A Testing Library test checks a rendered inspector's save and Escape actions.
- Playwright verifies real virtualization and the last row, URL reload, replay-to-inspection pause, persisted replayed events, timeline keyboard controls, and the mobile workflow.

The measured DOM bound is enforced in browser tests. There is no blanket performance score or full WCAG certification claim.

## Limits

- The fixture is synthetic. Timing spans and response bodies illustrate an investigation; they do not represent a real distributed trace.
- No backend, uploads, network ingestion, accounts, or collaborative state.
- Requests and saves are bounded at 20,000 and 100 respectively. Replay resets on reload, while saved IDs persist when storage is available.
- Runtime generation intentionally uses a simple array copy per batch. A ring buffer or worker would add complexity without evidence that this workload needs it.
- Unit tests use jsdom; the release browser suite covers Chromium, not every browser/assistive technology combination.
- Optional WebMCP tools are feature-detected on `document.modelContext`. They read the visible results, change the text filter, or open the existing inspector. The test browser did not expose this API, so native discovery/invocation remains unverified; no shim is shipped or required.

## References

- [React: useDeferredValue](https://react.dev/reference/react/useDeferredValue)
- [React: useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [TanStack Virtual: React adapter](https://tanstack.com/virtual/latest/docs/framework/react/react-virtual)
- [TanStack Virtual: Virtualizer API](https://tanstack.com/virtual/latest/docs/api/virtualizer)
