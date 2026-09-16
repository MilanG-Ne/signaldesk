import { useDeferredValue, useMemo, useState } from 'react';
import { Activity, Github, Search, SlidersHorizontal } from 'lucide-react';
import { createDataset, duration, time } from './lib/events';
import { DEFAULT_FILTERS, filterEvents, summarize, type Filters } from './lib/filters';
import { Timeline } from './components/Timeline';
export function App() {
  const [events] = useState(createDataset);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const deferred = useDeferredValue(filters);
  const visible = useMemo(() => filterEvents(events, deferred), [events, deferred]);
  const stats = useMemo(() => summarize(visible), [visible]);
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="./"><span><Activity size={21}/></span>signaldesk<span className="brand-period">.</span></a><span className="header-tab">Explorer</span><a className="source-link" href="https://github.com/MilanG-Ne/signaldesk"><Github size={17}/>Source</a></header>
    <main><section className="workspace-heading"><div><div className="eyebrow">YOUR SIGNAL, WITHOUT THE NOISE</div><h1>Request explorer<span className="demo-badge">SIMULATED DATA</span></h1></div><span className="session-label">REPLAY SESSION / 16 SEP 2026</span></section>
    <section className="summary-strip" aria-label="Matching request statistics"><div><span>Requests</span><strong>{visible.length.toLocaleString('en-US')}<small>in this view</small></strong></div><div><span>Server error rate</span><strong>{stats.errorRate}<em>%</em><small>{stats.errors} errors</small></strong></div><div><span>95th percentile</span><strong>{duration(stats.p95)}<small>response time</small></strong></div><p>Find the slow path.<br/><span className="muted">Select a minute. Follow a request.</span></p></section>
    <Timeline events={events} selected={filters.range} onSelect={range=>setFilters({...filters,range})}/>
    <section className="explorer"><div className="filterbar"><label className="search"><Search size={18}/><input aria-label="Search requests" placeholder="Search paths, services or request IDs…" value={filters.query} onChange={e=>setFilters({...filters,query:e.target.value})}/><kbd>/</kbd></label><SlidersHorizontal size={17}/><button className="button secondary" onClick={()=>setFilters({...filters,status:filters.status==='server'?'all':'server'})}>Server errors</button></div>
      <div className="list-header"><span>STATUS</span><span>REQUEST</span><span>SERVICE</span><span>DURATION</span><span>TIME · UTC</span></div>
      <div className="initial-list">{visible.slice(0,60).map(event=><div className="request-row" key={event.id}><span className={`status status-${Math.floor(event.status/100)}`}>{event.status}</span><span className="route"><b>{event.method}</b>{event.path}</span><span className="service-name">{event.service}</span><span className={event.duration>=800?'slow-value':''}>{duration(event.duration)}</span><span className="muted mono">{time(event.timestamp)}</span></div>)}</div>
    </section><footer className="app-footer">20,000 fictional requests. No servers connected.<span>Built for the curious.</span></footer></main>
  </div>;
}
