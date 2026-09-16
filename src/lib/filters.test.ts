import { describe, expect, it } from 'vitest';
import { createDataset, createEvent, spansFor } from './events';
import { DEFAULT_FILTERS, filterEvents, histogram, readFilters, summarize, writeFilters } from './filters';
describe('request exploration', () => {
  it('generates a stable dataset with a visible checkout incident', () => {
    expect(createEvent(42)).toEqual(createEvent(42));
    const events = createDataset();
    const incident = events.filter(e => e.sequence >= 13500 && e.sequence < 15000 && e.service === 'checkout');
    expect(Number(summarize(incident).errorRate)).toBeGreaterThan(40);
    expect(events).toHaveLength(20000);
    expect(new Set(events.map(e => e.id)).size).toBe(20000);
  });
  it('intersects text, service, status, latency and minute filters', () => {
    const events = createDataset(200);
    const target = events.find(e=>e.status >= 500)!;
    const filtered = filterEvents(events, {...DEFAULT_FILTERS,query:target.id.toUpperCase(),service:target.service,status:'server',range:Math.floor(target.timestamp/60000)});
    expect(filtered).toEqual([target]);
    expect(filterEvents(events, {...DEFAULT_FILTERS,query:'no-such-route'})).toEqual([]);
    expect(filterEvents(events, {...DEFAULT_FILTERS,slow:true}).every(e=>e.duration>=800)).toBe(true);
  });
  it('sorts without mutating the source and uses a stable tie breaker', () => {
    const events = createDataset(100); const before = [...events];
    const result = filterEvents(events, {...DEFAULT_FILTERS,sort:'slowest'});
    expect(result.every((e,i)=>i===0||result[i-1].duration>=e.duration)).toBe(true);
    expect(events).toEqual(before);
  });
  it('round-trips filters and rejects malformed URL values', () => {
    const filters = {...DEFAULT_FILTERS,query:'/api/v1/cart',service:'checkout' as const,status:'server' as const,slow:true,sort:'slowest' as const,range:29826042};
    expect(readFilters(writeFilters(filters))).toEqual(filters);
    expect(readFilters('?service=unknown&status=503&minute=NaN&sort=random')).toEqual(DEFAULT_FILTERS);
    expect(readFilters('?q='+ 'x'.repeat(200)).query).toHaveLength(160);
  });
  it('accounts for every event in the timeline', () => {
    const events = createDataset(); const bins = histogram(events);
    expect(bins).toHaveLength(60);
    expect(bins.reduce((n,b)=>n+b.total,0)).toBe(events.length);
    expect(bins.reduce((n,b)=>n+b.errors,0)).toBe(summarize(events).errors);
  });
  it('handles empty statistics and exact waterfall duration', () => {
    expect(summarize([])).toEqual({errors:0,p95:0,errorRate:'0.0'});
    const event=createEvent(57);const spans=spansFor(event);
    expect(spans.reduce((n,s)=>n+s.duration,0)).toBe(event.duration);
    expect(spans.every((s,i)=>i===0||s.start===spans[i-1].start+spans[i-1].duration)).toBe(true);
  });
});
