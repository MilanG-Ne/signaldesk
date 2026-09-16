import { SERVICES, type RequestEvent, type Service } from './events';
export type Filters = {
  query: string;
  service: Service | 'all';
  status: 'all' | 'success' | 'client' | 'server';
  slow: boolean;
  sort: 'newest' | 'slowest';
  range: number | null;
};
export const DEFAULT_FILTERS: Filters = {
  query: '',
  service: 'all',
  status: 'all',
  slow: false,
  sort: 'newest',
  range: null,
};
export function filterEvents(events: readonly RequestEvent[], filters: Filters) {
  const words = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = events.filter((event) => {
    if (filters.service !== 'all' && event.service !== filters.service) return false;
    if (filters.status === 'success' && event.status >= 400) return false;
    if (filters.status === 'client' && (event.status < 400 || event.status >= 500)) return false;
    if (filters.status === 'server' && event.status < 500) return false;
    if (filters.slow && event.duration < 800) return false;
    if (filters.range !== null && Math.floor(event.timestamp / 60_000) !== filters.range)
      return false;
    const haystack =
      `${event.path} ${event.service} ${event.method} ${event.id} ${event.region} ${event.status}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  if (filters.sort === 'slowest')
    results.sort((a, b) => b.duration - a.duration || b.sequence - a.sequence);
  else results.sort((a, b) => b.sequence - a.sequence);
  return results;
}
export function readFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const service = p.get('service');
  const status = p.get('status');
  const range = p.get('minute');
  return {
    query: (p.get('q') ?? '').slice(0, 160),
    service: SERVICES.includes(service as Service) ? (service as Service) : 'all',
    status: ['success', 'client', 'server'].includes(status ?? '')
      ? (status as Filters['status'])
      : 'all',
    slow: p.get('slow') === '1',
    sort: p.get('sort') === 'slowest' ? 'slowest' : 'newest',
    range: range && /^\d{1,10}$/.test(range) ? Number(range) : null,
  };
}
export function writeFilters(filters: Filters) {
  const p = new URLSearchParams();
  if (filters.query) p.set('q', filters.query);
  if (filters.service !== 'all') p.set('service', filters.service);
  if (filters.status !== 'all') p.set('status', filters.status);
  if (filters.slow) p.set('slow', '1');
  if (filters.sort !== 'newest') p.set('sort', filters.sort);
  if (filters.range !== null) p.set('minute', String(filters.range));
  return p.toString();
}
export function summarize(events: readonly RequestEvent[]) {
  if (!events.length) return { errors: 0, p95: 0, errorRate: '0.0' };
  const errors = events.reduce((sum, event) => sum + Number(event.status >= 500), 0);
  const times = events.map((event) => event.duration).sort((a, b) => a - b);
  return {
    errors,
    p95: times[Math.ceil(times.length * 0.95) - 1],
    errorRate: ((errors / events.length) * 100).toFixed(1),
  };
}
export function histogram(events: readonly RequestEvent[]) {
  const bins = new Map<number, { minute: number; total: number; errors: number }>();
  for (const event of events) {
    const minute = Math.floor(event.timestamp / 60000);
    const bin = bins.get(minute) ?? { minute, total: 0, errors: 0 };
    bin.total++;
    if (event.status >= 500) bin.errors++;
    bins.set(minute, bin);
  }
  return [...bins.values()].sort((a, b) => a.minute - b.minute);
}
