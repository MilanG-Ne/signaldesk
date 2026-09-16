import { useEffect, useLayoutEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { RequestEvent } from '../lib/events';
import type { Filters } from '../lib/filters';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Registry = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => unknown };
function inputObject(input: unknown, keys: string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new Error('Unexpected tool input');
  return input as Record<string, unknown>;
}
export function useWebTools(
  events: readonly RequestEvent[],
  inspect: (event: RequestEvent) => void,
  update: (patch: Partial<Filters>) => void,
) {
  const latest = useRef({ events, inspect, update });
  useLayoutEffect(() => {
    latest.current = { events, inspect, update };
  }, [events, inspect, update]);
  useEffect(() => {
    const registry = (document as Document & { modelContext?: Registry }).modelContext;
    if (!registry?.registerTool) return;
    const controller = new AbortController();
    const tools: Tool[] = [
      {
        name: 'list_visible_requests',
        description: 'Read the first 20 requests in the current filtered view.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: (input) => {
          inputObject(input, []);
          return {
            total: latest.current.events.length,
            requests: latest.current.events.slice(0, 20),
          };
        },
      },
      {
        name: 'inspect_visible_request',
        description: 'Pause replay and open the inspector for a request in the current view.',
        inputSchema: {
          type: 'object',
          properties: { request_id: { type: 'string' } },
          required: ['request_id'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const value = inputObject(input, ['request_id']).request_id;
          if (typeof value !== 'string') throw new Error('request_id is required');
          const event = latest.current.events.find((e) => e.id === value);
          if (!event) throw new Error('Request is not in the current view');
          flushSync(() => latest.current.inspect(event));
          return { request_id: event.id, inspector: 'open', replay: 'paused' };
        },
      },
      {
        name: 'search_requests',
        description: 'Set the visible text filter. Other filters remain in place.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string', maxLength: 160 } },
          required: ['query'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const value = inputObject(input, ['query']).query;
          if (typeof value !== 'string' || value.length > 160)
            throw new Error('query must be at most 160 characters');
          flushSync(() => latest.current.update({ query: value }));
          return { query: value };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(registry.registerTool(tool, { signal: controller.signal })).catch(
          () => {},
        );
      } catch {
        /* A browser extension must not break the explorer. */
      }
    }
    return () => controller.abort();
  }, []);
}
