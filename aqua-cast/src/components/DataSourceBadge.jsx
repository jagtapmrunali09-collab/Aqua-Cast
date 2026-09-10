import { Radar, Route, CloudSun, Circle } from 'lucide-react';

const STATUS_DOT = {
  live: 'text-emerald-500',
  simulated: 'text-amber-500',
  disabled: 'text-slate-400 dark:text-slate-600',
  checking: 'text-sky-400 animate-pulse',
};

const STATUS_LABEL = {
  live: 'Live',
  simulated: 'Simulated',
  disabled: 'Not configured',
  checking: 'Checking…',
};

function Row({ icon: Icon, label, status }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="flex items-center gap-1.5 text-ink-muted dark:text-slate-400">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span className={`flex items-center gap-1 font-medium ${STATUS_DOT[status]}`}>
        <Circle className="h-1.5 w-1.5 fill-current" />
        {STATUS_LABEL[status]}
      </span>
    </div>
  );
}

/**
 * Small, always-visible transparency panel: shows whether each live API
 * integration is actually reachable right now, or whether AQUA-CAST has
 * automatically fallen back to its built-in simulation engine for that
 * source. This is a deliberate design choice, not a debug leftover —
 * a bulletproof fallback is a feature worth showing, not hiding.
 */
export default function DataSourceBadge({ radarStatus, weatherStatus, routingStatus }) {
  return (
    <div className="pointer-events-auto rounded border border-hairline dark:border-slate-800 bg-canvas/95 dark:bg-slate-950/95 px-2.5 py-1.5 text-[11px] shadow-panel">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">
        Data sources
      </p>
      <Row icon={Radar} label="Radar" status={radarStatus} />
      <Row icon={CloudSun} label="Weather" status={weatherStatus} />
      <Row icon={Route} label="Routing" status={routingStatus} />
    </div>
  );
}
