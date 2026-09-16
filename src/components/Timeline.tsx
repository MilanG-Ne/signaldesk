import { memo, useMemo } from 'react';
import { histogram } from '../lib/filters';
import { time, type RequestEvent } from '../lib/events';
export const Timeline = memo(function Timeline({ events, selected, onSelect }: { events: readonly RequestEvent[]; selected: number | null; onSelect: (minute: number | null) => void }) {
  const bins = useMemo(() => histogram(events), [events]);
  const maximum = Math.max(1, ...bins.map(bin => bin.total));
  return <section className="timeline" aria-label="Request volume by minute">
    <div className="section-label"><span>TRAFFIC OVERVIEW <span className="muted">/ UTC</span></span><span className="legend"><i />Requests <i className="error-key" />Server errors</span></div>
    <div className="bars">{bins.map(bin => <button key={bin.minute} className={`bar ${selected === bin.minute ? 'chosen' : ''}`} aria-pressed={selected === bin.minute} aria-label={`${time(bin.minute * 60000).slice(0,5)} UTC: ${bin.total} requests, ${bin.errors} server errors`} title={`${time(bin.minute * 60000).slice(0,5)} · ${bin.total} requests · ${bin.errors} errors`} onClick={() => onSelect(selected === bin.minute ? null : bin.minute)}>
      <span className="bar-fill" style={{ height: `${Math.max(4, bin.total / maximum * 100)}%` }}><span style={{ height: `${bin.errors / bin.total * 100}%` }} /></span>
    </button>)}</div>
    <div className="axis"><span>{bins.length ? time(bins[0].minute * 60000).slice(0,5) : '—'}</span><span>Click a minute to isolate it</span><span>{bins.length ? time((bins.at(-1)!.minute + 1) * 60000).slice(0,5) : '—'}</span></div>
  </section>;
});
