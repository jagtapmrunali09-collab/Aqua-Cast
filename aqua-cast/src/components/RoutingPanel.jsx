import { Ambulance, Car, ArrowRight, TriangleAlert, Route, Columns2, LifeBuoy } from 'lucide-react';

function RouteCard({ title, summary, accent, icon: Icon, isFloodSafe }) {
  if (!summary) {
    return (
      <div className="rounded border border-hairline-strong dark:border-slate-700 bg-canvas dark:bg-slate-950 p-3 text-xs text-ink-faint dark:text-slate-500">
        <p className="font-medium text-ink dark:text-slate-100">{title}</p>
        <p className="mt-1">No route available — every path is blocked for this vehicle class.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-hairline dark:border-slate-800 bg-canvas dark:bg-slate-950 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        <p className="text-xs font-medium text-ink dark:text-slate-100">{title}</p>
      </div>
      <div className="data-readout flex items-baseline gap-1">
        <span className="text-lg font-semibold" style={{ color: accent }}>
          {summary.timeMinutes.toFixed(0)}
        </span>
        <span className="text-xs text-ink-faint dark:text-slate-500">min</span>
        <span className="ml-2 text-xs text-ink-faint dark:text-slate-500">· {(summary.distanceM / 1000).toFixed(2)} km</span>
      </div>
      {summary.blockedNodes.length > 0 && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-risk-critical">
          <TriangleAlert className="h-3 w-3" />
          crosses {summary.blockedNodes.length} blocked intersection(s)
        </p>
      )}
      {isFloodSafe && summary.floodedNodes.length > 0 && summary.blockedNodes.length === 0 && (
        <p className="mt-1.5 text-[11px] text-risk-caution">
          passes {summary.floodedNodes.length} caution-depth intersection(s)
        </p>
      )}
    </div>
  );
}

export default function RoutingPanel({
  nodeOptions,
  shelterOptions = [],
  fromId,
  toId,
  onFromChange,
  onToChange,
  vehicleClass,
  onVehicleClassChange,
  result,
  onRouteToNearestShelter,
  onOpenComparison,
}) {
  return (
    <aside className="w-[260px] shrink-0 overflow-y-auto border-l border-hairline dark:border-slate-800 bg-panel dark:bg-slate-900 px-4">
      <div className="flex items-center gap-1.5 pt-3">
        <Route className="h-3.5 w-3.5 text-ink-faint dark:text-slate-500" />
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">
          Flood-aware routing
        </p>
      </div>

      <div className="mt-2 flex gap-1.5">
        <button
          onClick={() => onVehicleClassChange('commuter')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded border py-1.5 text-xs font-medium transition-colors ${
            vehicleClass === 'commuter'
              ? 'border-water-500 bg-water-50 dark:bg-water-50 dark:bg-water-500/100/10 text-water-600 dark:text-water-300'
              : 'border-hairline-strong dark:border-slate-700 text-ink-muted dark:text-slate-400'
          }`}
        >
          <Car className="h-3.5 w-3.5" /> Commuter
        </button>
        <button
          onClick={() => onVehicleClassChange('emergency')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded border py-1.5 text-xs font-medium transition-colors ${
            vehicleClass === 'emergency'
              ? 'border-risk-critical bg-red-50 dark:bg-red-950/40 text-risk-critical'
              : 'border-hairline-strong dark:border-slate-700 text-ink-muted dark:text-slate-400'
          }`}
        >
          <Ambulance className="h-3.5 w-3.5" /> Emergency
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <label className="block text-xs text-ink-muted dark:text-slate-400">
          From
          <select
            value={fromId}
            onChange={(e) => onFromChange(e.target.value)}
            className="mt-0.5 w-full rounded border border-hairline-strong dark:border-slate-700 bg-canvas dark:bg-slate-950 px-2 py-1.5 text-xs text-ink dark:text-slate-100"
          >
            {nodeOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id} · {n.type}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-ink-muted dark:text-slate-400">
          To
          <select
            value={toId}
            onChange={(e) => onToChange(e.target.value)}
            className="mt-0.5 w-full rounded border border-hairline-strong dark:border-slate-700 bg-canvas dark:bg-slate-950 px-2 py-1.5 text-xs text-ink dark:text-slate-100"
          >
            <optgroup label="Intersections">
              {nodeOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.id} · {n.type}
                </option>
              ))}
            </optgroup>
            {shelterOptions.length > 0 && (
              <optgroup label="Shelters & high ground">
                {shelterOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>

      {onRouteToNearestShelter && (
        <button
          onClick={onRouteToNearestShelter}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-emerald-600 bg-emerald-50 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
        >
          <LifeBuoy className="h-3.5 w-3.5" /> Route to nearest shelter
        </button>
      )}

      <div className="mt-3 space-y-2">
        {result.error === 'invalid_endpoints' && (
          <p className="rounded border border-hairline-strong dark:border-slate-700 bg-canvas dark:bg-slate-950 p-2 text-[11px] text-ink-faint dark:text-slate-500">
            Pick two different intersections to compute a route.
          </p>
        )}
        {result.error === 'no_path_found' && (
          <p className="rounded border border-risk-critical bg-red-50 dark:bg-red-950/40 p-2 text-[11px] text-risk-critical">
            No route exists between these points for this vehicle class — the network may be fully cut off by flooding.
          </p>
        )}
        <RouteCard title="Standard route" summary={result.standard} accent="#0284c7" icon={ArrowRight} />
        <RouteCard
          title="Flood-safe route"
          summary={result.floodSafe}
          accent="#059669"
          icon={Route}
          isFloodSafe
        />
        {(result.standard || result.floodSafe) && (
          <button
            onClick={onOpenComparison}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-hairline-strong dark:border-slate-700 py-1.5 text-xs font-medium text-ink-muted dark:text-slate-400 hover:border-water-500 hover:text-water-600 dark:text-water-300 dark:hover:border-water-300 dark:hover:text-water-300"
          >
            <Columns2 className="h-3.5 w-3.5" /> Compare side-by-side
          </button>
        )}
      </div>

      {result.timeDeltaMinutes !== null && (
        <div className="mt-3 rounded border border-hairline dark:border-slate-800 bg-canvas dark:bg-slate-950 p-3 text-xs">
          <p className="text-ink-muted dark:text-slate-400">Time difference</p>
          <p className="data-readout mt-0.5 text-base font-semibold text-ink dark:text-slate-100">
            {result.timeDeltaMinutes >= 0 ? '+' : ''}
            {result.timeDeltaMinutes.toFixed(1)} min
          </p>
          <p className="mt-1 text-[11px] text-ink-faint dark:text-slate-500">
            {result.timeDeltaMinutes < 0
              ? 'Flood-safe route is actually faster — the standard route wades through slow standing water.'
              : 'Small detour cost to avoid flooded intersections entirely.'}
          </p>
        </div>
      )}

      {result.avoidedIntersections.length > 0 && (
        <div className="mt-3 pb-4 text-xs">
          <p className="text-ink-muted dark:text-slate-400">Avoided flooded intersections</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {result.avoidedIntersections.map((n) => (
              <li key={n} className="data-readout rounded border border-hairline-strong dark:border-slate-700 px-1.5 py-0.5 text-[11px] text-risk-critical">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.avoidedIntersections.length === 0 && <div className="pb-4" />}
    </aside>
  );
}
