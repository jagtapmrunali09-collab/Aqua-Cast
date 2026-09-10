import { Droplets, TriangleAlert, Play, Pause, MessageSquareWarning, Camera, Satellite } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import VoiceAssistant from './VoiceAssistant.jsx';

function formatClockOffset(tMinutes) {
  const h = Math.floor(tMinutes / 60);
  const m = tMinutes % 60;
  return `+${h}:${String(m).padStart(2, '0')}`;
}

export default function TopBar({
  radarSeries,
  stepIndex,
  onStepChange,
  currentIntensity,
  alertsEnabled,
  onToggleAlerts,
  hasCriticalNow,
  playing,
  onTogglePlay,
  theme,
  onToggleTheme,
  onOpenBulletin,
  onOpenHazardReport,
  liveIntensity = null,
  routeResult = null,
}) {
  const maxIntensity = Math.max(...radarSeries.map((s) => s.intensityMmPerHr));

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b border-hairline dark:border-slate-800 bg-canvas dark:bg-slate-950 px-4">
      <div className="flex items-center gap-2">
        <Droplets className="h-5 w-5 text-water-500" strokeWidth={2} />
        <span className="text-sm font-semibold tracking-tight">AQUA-CAST</span>
      </div>

      <div className="flex flex-1 items-center gap-3">
        <button
          onClick={onTogglePlay}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-hairline-strong dark:border-slate-700 text-ink-muted dark:text-slate-400 hover:border-water-500 hover:text-water-600 dark:hover:text-water-300"
          aria-label={playing ? 'Pause nowcast playback' : 'Play nowcast playback'}
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>

        <span className="data-readout w-14 shrink-0 text-xs text-ink-muted dark:text-slate-400">
          {formatClockOffset(radarSeries[stepIndex].tMinutes)}
        </span>

        <input
          type="range"
          min={0}
          max={radarSeries.length - 1}
          step={1}
          value={stepIndex}
          onChange={(e) => onStepChange(Number(e.target.value))}
          className="h-1 w-full max-w-md flex-1 cursor-pointer accent-water-500"
          aria-label="Nowcast timeline, 0 to 3 hours ahead"
        />

        <div className="data-readout flex items-baseline gap-1 whitespace-nowrap text-xs text-ink-muted dark:text-slate-400">
          <span className="text-sm font-semibold text-water-600 dark:text-water-300">{currentIntensity.toFixed(0)}</span>
          <span>/ {maxIntensity.toFixed(0)} mm/hr</span>
        </div>

        {liveIntensity && (
          <div
            className="flex items-center gap-1 whitespace-nowrap rounded border border-emerald-500/40 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
            title={`Live observed rainfall via OpenWeatherMap as of ${new Date(liveIntensity.observedAt).toLocaleTimeString()}`}
          >
            <Satellite className="h-3 w-3" />
            Live: {liveIntensity.intensityMmPerHr.toFixed(1)} mm/hr
          </div>
        )}
      </div>

      <button
        onClick={onOpenBulletin}
        className="flex items-center gap-1.5 rounded border border-hairline-strong dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-ink-muted dark:text-slate-400 transition-colors hover:border-risk-critical hover:text-risk-critical"
      >
        <MessageSquareWarning className="h-3.5 w-3.5" />
        Bulletin
      </button>

      <button
        onClick={onOpenHazardReport}
        className="flex items-center gap-1.5 rounded border border-hairline-strong dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-ink-muted dark:text-slate-400 transition-colors hover:border-water-500 hover:text-water-600 dark:hover:text-water-300"
      >
        <Camera className="h-3.5 w-3.5" />
        Report
      </button>

      <button
        onClick={onToggleAlerts}
        className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
          alertsEnabled
            ? hasCriticalNow
              ? 'border-risk-critical bg-red-50 dark:bg-red-950/40 text-risk-critical'
              : 'border-water-500 bg-water-50 dark:bg-water-500/10 text-water-600 dark:text-water-300'
            : 'border-hairline-strong dark:border-slate-700 text-ink-faint dark:text-slate-500'
        }`}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        {alertsEnabled ? (hasCriticalNow ? 'Alert active' : 'Alerts on') : 'Alerts off'}
      </button>

      <VoiceAssistant routeResult={routeResult} />

      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}
