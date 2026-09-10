import { Wrench, ArrowDown } from 'lucide-react';

const TIER_STYLE = {
  Urgent: 'text-risk-critical bg-red-50 dark:bg-red-950/40',
  Priority: 'text-risk-caution bg-amber-50 dark:bg-amber-950/40',
  Routine: 'text-risk-normal bg-emerald-50 dark:bg-emerald-950/40',
};

export default function MaintenancePanel({ ranked }) {
  const urgentCount = ranked.filter((r) => r.tier === 'Urgent').length;

  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-hairline bg-panel px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 pt-3">
        <Wrench className="h-3.5 w-3.5 text-ink-faint" />
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">
          Desilting priority planner
        </p>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-muted dark:text-slate-400">
        Ranks pipes by surveyed silt condition (40%), observed surcharge frequency under the current storm
        (40%), and downstream network impact (20%) — schedule pre-monsoon cleaning where it actually reduces
        risk.
      </p>

      {urgentCount > 0 && (
        <div className="mt-2 flex items-center gap-1.5 rounded border border-risk-critical bg-red-50 px-2 py-1.5 text-[11px] font-medium text-risk-critical dark:bg-red-950/40">
          <ArrowDown className="h-3 w-3" />
          {urgentCount} pipe(s) flagged Urgent this storm
        </div>
      )}

      <div className="mt-3 space-y-1.5 pb-4">
        {ranked.slice(0, 15).map((r, i) => (
          <div key={r.id} className="rounded border border-hairline bg-canvas p-2 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <span className="data-readout text-[11px] text-ink-faint dark:text-slate-500">#{i + 1}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${TIER_STYLE[r.tier]}`}>
                {r.tier}
              </span>
            </div>
            <p className="data-readout mt-0.5 text-xs font-medium text-ink dark:text-slate-100">
              {r.from} → {r.to}
            </p>
            <dl className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-ink-muted dark:text-slate-400">
              <div>
                <dt>Silt</dt>
                <dd className="data-readout font-medium text-ink dark:text-slate-200">{r.siltBlockPct}%</dd>
              </div>
              <div>
                <dt>Surcharged</dt>
                <dd className="data-readout font-medium text-ink dark:text-slate-200">{r.surchargeFrequencyPct}%</dd>
              </div>
              <div>
                <dt>Downstream</dt>
                <dd className="data-readout font-medium text-ink dark:text-slate-200">{r.downstreamNodeCount}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </aside>
  );
}
