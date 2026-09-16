import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Check, Copy, Crosshair, X } from 'lucide-react';
import { duration, spansFor, time, type RequestEvent } from '../lib/events';
export function Inspector({
  event,
  saved,
  onBookmark,
  onClose,
}: {
  event: RequestEvent | null;
  saved: boolean;
  onBookmark: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (event && window.matchMedia('(max-width: 1000px)').matches) close.current?.focus();
  }, [event?.id]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  if (!event)
    return (
      <aside className="inspector empty-inspector" aria-label="Request inspector">
        <Crosshair size={30} />
        <h2>Follow a request.</h2>
        <p>Select a row to inspect its timing, response, and trace.</p>
        <span className="inspector-tip">
          Try filtering to server errors,
          <br />
          then sort by slowest first.
        </span>
      </aside>
    );
  const spans = spansFor(event);
  const failed = event.status >= 500;
  return (
    <aside
      className="inspector"
      aria-label="Request inspector"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="inspector-heading">
        <span className="section-label">REQUEST INSPECTOR</span>
        <button ref={close} className="icon-button" aria-label="Close inspector" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <button className="mobile-back" onClick={onClose}>
        <ArrowLeft size={16} />
        Back to requests
      </button>
      <div className="inspect-status">
        <span className={`status status-${Math.floor(event.status / 100)}`}>
          {event.status}{' '}
          {failed ? 'Service unavailable' : event.status === 404 ? 'Not found' : 'OK'}
        </span>
        <span className="mono muted">{time(event.timestamp)} UTC</span>
      </div>
      <h2 className="inspect-route">
        <span>{event.method}</span>
        {event.path}
      </h2>
      <p className="request-id">{event.id}</p>
      <div className="inspect-facts">
        <div>
          <span>Duration</span>
          <strong className={failed ? 'slow-value' : ''}>{duration(event.duration)}</strong>
        </div>
        <div>
          <span>Service</span>
          <strong>{event.service}</strong>
        </div>
        <div>
          <span>Region</span>
          <strong>{event.region}</strong>
        </div>
        <div>
          <span>Response size</span>
          <strong>{(event.bytes / 1024).toFixed(1)} KB</strong>
        </div>
      </div>
      <section className="waterfall">
        <div className="section-label">
          REQUEST TIMING <span>{duration(event.duration)}</span>
        </div>
        <ol>
          {spans.map((span) => (
            <li key={span.name}>
              <div>
                <span>{span.name}</span>
                <span className="mono">{duration(span.duration)}</span>
              </div>
              <div className="span-track">
                <span
                  className={span.failed ? 'failed-span' : ''}
                  style={{
                    marginLeft: `${(span.start / event.duration) * 100}%`,
                    width: `${Math.max(1, (span.duration / event.duration) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="response-section">
        <div className="section-label">
          RESPONSE <span>application/json</span>
        </div>
        <pre tabIndex={0} aria-label="Simulated response body">
          {JSON.stringify(
            failed
              ? {
                  error: 'upstream_unavailable',
                  message: 'The upstream service did not respond in time.',
                  retryable: true,
                }
              : event.status === 404
                ? { error: 'not_found', message: 'The requested resource was not found.' }
                : { ok: true, request_id: event.id },
            null,
            2,
          )}
        </pre>
      </section>
      {failed && (
        <p className="failure-note">
          The application span accounts for most of this request’s duration. This is a simulated
          upstream timeout.
        </p>
      )}
      <div className="inspector-actions">
        <button
          className={`button ${saved ? 'is-saved' : ''}`}
          aria-pressed={saved}
          onClick={onBookmark}
        >
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Saved on this device' : 'Save request'}
        </button>
        <button
          className="icon-button"
          aria-label="Copy request JSON"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
              setCopied(true);
              setCopyError(false);
            } catch {
              setCopyError(true);
            }
          }}
        >
          {copied ? <Check size={17} /> : <Copy size={17} />}
        </button>
      </div>
      {copyError && (
        <p className="inline-message" role="status">
          Clipboard access is unavailable in this browser.
        </p>
      )}
    </aside>
  );
}
