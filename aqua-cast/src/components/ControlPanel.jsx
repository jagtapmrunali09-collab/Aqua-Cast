import { CloudRain, ShieldAlert, Zap, RotateCcw, History, Waves } from 'lucide-react';
import { STORM_PRESETS } from '../lib/stormPresets.js';

function SliderControl({ icon: Icon, label, value, displayValue, min, max, step, onChange, accent }) {
  return (
    <div className="border-b border-hairline dark:border-slate-800 py-3 first:pt-0 last:border-b-0">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-ink-muted dark:text-slate-400">
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{label}</span>
        </div>
        <span className="data-readout text-xs font-medium" style={{ color: accent }}>
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-water-500"
      />
    </div>
  );
}

const DEFAULTS = { rainfallMultiplier: 1, siltScale: 1, pumpActivationPct: 0 };

export default function ControlPanel({ simParams, onChange, stormPresetId, onStormPresetChange }) {
  const isDefault =
    simParams.rainfallMultiplier === DEFAULTS.rainfallMultiplier &&
    simParams.siltScale === DEFAULTS.siltScale &&
    simParams.pumpActivationPct === DEFAULTS.pumpActivationPct;

  const activePreset = STORM_PRESETS.find((p) => p.id === stormPresetId);

  return (
    <aside className="w-[260px] shrink-0 overflow-y-auto border-l border-hairline dark:border-slate-800 bg-panel dark:bg-slate-900 px-4">
      <div className="pt-3">
        <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">
          <History className="h-3.5 w-3.5" />
          Historical storm preset
        </label>
        <select
          value={stormPresetId}
          onChange={(e) => onStormPresetChange(e.target.value)}
          className="mt-1.5 w-full rounded border border-hairline-strong dark:border-slate-700 bg-canvas dark:bg-slate-950 px-2 py-1.5 text-xs text-ink dark:text-slate-100"
        >
          {STORM_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.shortName}
            </option>
          ))}
        </select>
        {activePreset && activePreset.id !== 'live' && (
          <div className="mt-1.5 rounded border border-hairline-strong dark:border-slate-700 bg-canvas dark:bg-slate-950 p-2 text-[11px] text-ink-muted dark:text-slate-400">
            <p>{activePreset.description}</p>
            {activePreset.tidalBackpressure && (
              <p className="mt-1 flex items-center gap-1 font-medium text-risk-caution">
                <Waves className="h-3 w-3" /> Tidal backpressure applied — outfall pipes are additionally choked.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-hairline dark:border-slate-800 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">
          What-if simulation
        </p>
        <button
          onClick={() => onChange(DEFAULTS)}
          disabled={isDefault}
          className="flex items-center gap-1 text-xs text-ink-faint dark:text-slate-500 hover:text-water-600 dark:hover:text-water-300 disabled:opacity-0"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="mt-1">
        <SliderControl
          icon={CloudRain}
          label="Rainfall intensity"
          value={simParams.rainfallMultiplier}
          displayValue={`${simParams.rainfallMultiplier.toFixed(1)}×`}
          min={0.5}
          max={2}
          step={0.1}
          accent="#0284c7"
          onChange={(v) => onChange({ ...simParams, rainfallMultiplier: v })}
        />
        <SliderControl
          icon={ShieldAlert}
          label="Clogged drain level"
          value={simParams.siltScale}
          displayValue={`${Math.round(simParams.siltScale * 100)}%`}
          min={0}
          max={2}
          step={0.1}
          accent="#d97706"
          onChange={(v) => onChange({ ...simParams, siltScale: v })}
        />
        <SliderControl
          icon={Zap}
          label="Pump activation"
          value={simParams.pumpActivationPct}
          displayValue={`${simParams.pumpActivationPct}%`}
          min={0}
          max={100}
          step={5}
          accent="#059669"
          onChange={(v) => onChange({ ...simParams, pumpActivationPct: v })}
        />
      </div>

      <div className="mt-2 border-t border-hairline dark:border-slate-800 py-3 text-xs text-ink-muted dark:text-slate-400">
        <p>
          Clogged drain level scales every pipe&apos;s silt blockage relative to its baseline
          survey value — 100% reproduces the surveyed condition, 0% simulates freshly cleared
          drains.
        </p>
        <p className="mt-2">
          Pump activation adds dewatering capacity at the outfall and major junctions only,
          mirroring where the municipality actually stations mobile pumps.
        </p>
      </div>
    </aside>
  );
}
