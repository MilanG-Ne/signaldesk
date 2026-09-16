export const SERVICES = ['gateway', 'checkout', 'identity', 'catalog'] as const;
export type Service = (typeof SERVICES)[number];
export type RequestEvent = Readonly<{
  id: string; sequence: number; timestamp: number; method: 'GET' | 'POST' | 'PUT';
  path: string; service: Service; status: number; duration: number; region: string; bytes: number;
}>;
export const INITIAL_COUNT = 20_000;
export const MAX_EVENTS = 20_000;
export const BASE_TIME = Date.UTC(2026, 8, 16, 12);

function random(seed: number) {
  let x = (seed + 1) | 0;
  return () => { x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
}
const routes: Record<Service, readonly [RequestEvent['method'], string][]> = {
  gateway: [['GET', '/api/v1/health'], ['GET', '/api/v1/config'], ['POST', '/api/v1/events']],
  checkout: [['POST', '/api/v1/checkout'], ['GET', '/api/v1/orders'], ['PUT', '/api/v1/cart']],
  identity: [['POST', '/api/v1/auth/token'], ['GET', '/api/v1/profile'], ['POST', '/api/v1/auth/refresh']],
  catalog: [['GET', '/api/v1/products'], ['GET', '/api/v1/search'], ['GET', '/api/v1/categories']],
};
export function createEvent(sequence: number): RequestEvent {
  const next = random(sequence);
  const service = SERVICES[Math.floor(next() * SERVICES.length)];
  const [method, path] = routes[service][Math.floor(next() * 3)];
  const incident = sequence >= 13_500 && sequence < 15_000 && service === 'checkout';
  const chance = next();
  const status = chance < (incident ? 0.58 : 0.035) ? 503 : chance < (incident ? 0.65 : 0.07) ? 404 : method === 'POST' ? 201 : 200;
  const duration = Math.round(18 + next() * 170 + (status >= 500 ? 600 + next() * 1400 : incident ? 500 : 0));
  return Object.freeze({ id: `req_${sequence.toString(16).padStart(8, '0')}`, sequence, timestamp: BASE_TIME + sequence * 180,
    method, path, service, status, duration, region: ['fra-1', 'iad-1', 'ams-1'][Math.floor(next() * 3)], bytes: Math.round(180 + next() * 9500) });
}
export function createDataset(count = INITIAL_COUNT) {
  return Array.from({ length: count }, (_, i) => createEvent(count - i - 1));
}
export const time = (value: number) => new Date(value).toISOString().slice(11, 19);
export const duration = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
export function spansFor(event: RequestEvent) {
  const names = ['Edge routing', 'Authentication', event.service === 'checkout' ? 'Payment service' : 'Application handler', 'Response'];
  let offset = 0;
  return [0.06, 0.13, 0.76, 0.05].map((fraction, index) => {
    const span = { name: names[index], start: offset, duration: index === 3 ? event.duration - offset : Math.floor(event.duration * fraction), failed: index === 2 && event.status >= 500 };
    offset += span.duration;
    return span;
  });
}
