import { X, ArrowRight, Route, TriangleAlert, CircleCheck } from 'lucide-react';

function RouteColumn({ title, accent, summary, icon: Icon, isFloodSafe }) {
  return (
    <div className="rounded border border-hairline bg-canvas p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        <p className="text-sm font-semibold text-ink dark:text-slate-100">{title}</p>
      </div>

      {!summary ? (
        <p className="text-xs text-ink-faint dark:text-slate-500">No route available for this vehicle class.</p>
      ) : (
        <>
          <div className="data-readout flex items-baseline gap-1">
            <span className="text-2xl font-semibold" style={{ color: accent }}>
              {summary.timeMinutes.toFixed(0)}
            </span>
            <span className="text-xs text-ink-faint dark:text-slate-500">min</span>
            <span className="ml-2 text-xs text-ink-faint dark:text-slate-500">
              · {(summary.distanceM / 1000).toFixed(2)} km
            </span>
          </div>

          <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">
            Nodes crossed
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {summary.nodes.map((n) => {
              const blocked = summary.blockedNodes.includes(n);
              const caution = !blocked && summary.floodedNodes.includes(n);
              return (
                <span
                  key={n}
                  className={`data-readout rounded border px-1.5 py-0.5 text-[10px] ${
                    blocked
                      ? 'border-risk-critical bg-red-50 text-risk-critical dark:bg-red-950/40'
                      : caution
                      ? 'border-risk-caution bg-amber-50 text-risk-caution dark:bg-amber-950/40'
                      : 'border-hairline-strong text-ink-muted dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  {n}
                </span>
              );
            })}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            {summary.blockedNodes.length > 0 ? (
              <span className="flex items-center gap-1 text-risk-critical">
                <TriangleAlert className="h-3 w-3" />
                crosses {summary.blockedNodes.length} high-risk flooded node(s)
              </span>
            ) : isFloodSafe ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <CircleCheck className="h-3 w-3" /> avoids every hard-blocked intersection
              </span>
            ) : (
              <span className="text-ink-faint dark:text-slate-500">no hard-blocked intersections on this path</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function RouteComparisonDrawer({ result, onClose }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-md border border-hairline bg-canvas shadow-panel dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-ink dark:text-slate-100">
            Standard Route vs. Flood-Aware Safe Route
          </p>
          <button onClick={onClose} className="text-ink-faint hover:text-ink dark:hover:text-slate-200" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <RouteColumn title="Standard shortest path" accent="#6366f1" icon={ArrowRight} summary={result.standard} />
          <RouteColumn title="Flood-aware safe route" accent="#059669" icon={Route} summary={result.floodSafe} isFloodSafe />
        </div>

        {result.timeDeltaMinutes !== null && (
          <div className="border-t border-hairline px-4 py-3 text-xs text-ink-muted dark:border-slate-800 dark:text-slate-400">
            {result.timeDeltaMinutes < 0
              ? `The flood-safe route is actually ${Math.abs(result.timeDeltaMinutes).toFixed(1)} min faster — the standard route wades through slow standing water.`
              : `The flood-safe route costs a ${result.timeDeltaMinutes.toFixed(1)} min detour to avoid every flooded intersection entirely.`}
          </div>
        )}
      </div>
    </div>
  );
}
