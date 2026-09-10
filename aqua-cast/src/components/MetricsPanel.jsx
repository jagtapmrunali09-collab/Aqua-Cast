import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { CloudRain, Waves, MapPinned } from 'lucide-react';
import { summarizeStep } from '../lib/simulation.js';

function MetricCard({ icon: Icon, label, value, unit, accent, sparkData, sparkKey }) {
  return (
    <div className="border-b border-hairline dark:border-slate-800 py-3 first:pt-0 last:border-b-0">
      <div className="flex items-center gap-1.5 text-ink-faint dark:text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="data-readout text-2xl font-semibold" style={{ color: accent }}>
          {value}
        </span>
        <span className="text-xs text-ink-faint dark:text-slate-500">{unit}</span>
      </div>
      {sparkData && (
        <div className="mt-1 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`spark-${sparkKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={accent}
                strokeWidth={1.5}
                fill={`url(#spark-${sparkKey})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function MetricsPanel({ timeline, stepIndex }) {
  const step = timeline[stepIndex];
  const summary = summarizeStep(step);

  const rainfallSpark = timeline.map((s) => ({ v: s.intensityMmPerHr }));
  const surchargeSpark = timeline.map((s) => ({ v: summarizeStep(s).totalStandingM3 }));
  const riskSpark = timeline.map((s) => ({ v: summarizeStep(s).highRisk }));

  return (
    <aside className="w-[260px] shrink-0 overflow-y-auto border-r border-hairline dark:border-slate-800 bg-panel dark:bg-slate-900 px-4">
      <p className="pt-3 text-xs font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">
        Nowcast metrics
      </p>
      <div className="mt-1">
        <MetricCard
          icon={CloudRain}
          label="Rainfall intensity"
          value={step.intensityMmPerHr.toFixed(1)}
          unit="mm/hr"
          accent="#0284c7"
          sparkData={rainfallSpark}
          sparkKey="rain"
        />
        <MetricCard
          icon={Waves}
          label="Total drainage surcharge"
          value={summary.totalStandingM3.toFixed(0)}
          unit="m³ standing"
          accent="#dc2626"
          sparkData={surchargeSpark}
          sparkKey="surcharge"
        />
        <MetricCard
          icon={MapPinned}
          label="High-risk intersections"
          value={summary.highRisk}
          unit={`of ${step.nodes.length} nodes`}
          accent="#d97706"
          sparkData={riskSpark}
          sparkKey="risk"
        />
      </div>

      <div className="mt-2 border-t border-hairline dark:border-slate-800 pt-3 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">This step</p>
        <dl className="mt-2 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-ink-muted dark:text-slate-400">Surcharged pipes</dt>
            <dd className="data-readout text-ink dark:text-slate-100">{summary.surchargedEdges} / {step.edges.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted dark:text-slate-400">Critical nodes (&gt;25cm)</dt>
            <dd className="data-readout font-medium text-risk-critical">{summary.criticalCount}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
