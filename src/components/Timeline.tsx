import { memo, useMemo, useState } from 'react';
import { histogram } from '../lib/filters';
import { time, type RequestEvent } from '../lib/events';
export const Timeline = memo(function Timeline({
  events,
  domain,
  selected,
  onSelect,
}: {
  events: readonly RequestEvent[];
  domain: readonly RequestEvent[];
  selected: number | null;
  onSelect: (minute: number | null) => void;
}) {
  const [focus, setFocus] = useState(0);
  const bins = useMemo(() => {
    const matches = new Map(histogram(events).map((bin) => [bin.minute, bin]));
    return histogram(domain).map(
      (bin) => matches.get(bin.minute) ?? { minute: bin.minute, total: 0, errors: 0 },
    );
  }, [events, domain]);
  const maximum = Math.max(1, ...bins.map((bin) => bin.total));
  return (
    <section className="timeline" aria-label="Request volume by minute">
      <div className="section-label">
        <span>
          TRAFFIC OVERVIEW <span className="muted">/ UTC</span>
        </span>
        <span className="legend">
          <i />
          Requests <i className="error-key" />
          Server errors
        </span>
      </div>
      <div className="bars">
        {bins.map((bin, index) => (
          <button
            tabIndex={index === Math.min(focus, bins.length - 1) ? 0 : -1}
            onFocus={() => setFocus(index)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? Math.min(bins.length - 1, index + 1)
                  : event.key === 'ArrowLeft'
                    ? Math.max(0, index - 1)
                    : null;
              if (next !== null) {
                event.preventDefault();
                (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
              }
            }}
            key={bin.minute}
            className={`bar ${selected === bin.minute ? 'chosen' : ''}`}
            aria-pressed={selected === bin.minute}
            aria-label={`${time(bin.minute * 60000).slice(0, 5)} UTC: ${bin.total} requests, ${bin.errors} server errors`}
            title={`${time(bin.minute * 60000).slice(0, 5)} · ${bin.total} requests · ${bin.errors} errors`}
            onClick={() => onSelect(selected === bin.minute ? null : bin.minute)}
          >
            <span
              className="bar-fill"
              style={{ height: bin.total ? `${Math.max(4, (bin.total / maximum) * 100)}%` : 0 }}
            >
              <span style={{ height: `${bin.total ? (bin.errors / bin.total) * 100 : 0}%` }} />
            </span>
          </button>
        ))}
      </div>
      <div className="axis">
        <span>{bins.length ? time(bins[0].minute * 60000).slice(0, 5) : '—'}</span>
        <span>Click a minute to isolate it</span>
        <span>{bins.length ? time((bins.at(-1)!.minute + 1) * 60000).slice(0, 5) : '—'}</span>
      </div>
    </section>
  );
});
