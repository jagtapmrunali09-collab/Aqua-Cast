/**
 * stormPresets.js
 * Historical/reference storm hyetographs for resilience-testing the
 * nowcasting engine against major Indian cloudburst-type events.
 *
 * Each preset reshapes the same gamma-hyetograph generator used for the
 * live mock radar feed (see data/mockMetroZone.js's
 * generateDopplerNowcast) with a peak intensity, peak-timing, and shape
 * parameter representative of the referenced event. These are
 * illustrative magnitudes drawn from public IMD / press reporting on
 * peak rainfall intensity for system-resiliency testing — NOT a replay
 * of the literal historical minute-by-minute time series, which is not
 * bundled with this demo.
 */
import { mulberry32, randRange } from '../data/rng.js';

export const STORM_PRESETS = [
  {
    id: 'live',
    name: 'Live nowcast (current zone)',
    shortName: 'Live feed',
    description:
      "The zone's current 0–3hr Doppler nowcast — no preset override applied.",
  },
  {
    id: 'mumbai_2005',
    name: 'Mumbai 26 July 2005 — High Tide Cloudburst',
    shortName: 'Mumbai 2005',
    description:
      '≈944mm fell across the city in 24h with a sustained extreme-intensity core. Critically, the deluge coincided with a high astronomical tide that locked the storm-drain outfalls shut against backwater pressure for hours.',
    peakMmHr: 190,
    peakStep: 5,
    shape: 2.6,
    tidalBackpressure: true,
  },
  {
    id: 'chennai_2015',
    name: 'Chennai Nov–Dec 2015 — Cloudburst',
    shortName: 'Chennai 2015',
    description:
      'Prolonged cloudburst-type convective rainfall over an already-saturated catchment, with a sharp late-arriving intensity peak.',
    peakMmHr: 150,
    peakStep: 7,
    shape: 4.5,
    tidalBackpressure: false,
  },
  {
    id: 'monsoon_100',
    name: 'IMD "Extremely Heavy Rainfall" Design Storm',
    shortName: 'Monsoon 100mm/hr',
    description:
      'Generic design-storm benchmark at the IMD "extremely heavy rainfall" threshold (>100mm in a day, modeled here as a sustained >100mm/hr burst) — the standard stress-test for municipal drainage capacity.',
    peakMmHr: 110,
    peakStep: 4,
    shape: 3.0,
    tidalBackpressure: false,
  },
];

export function getStormPreset(id) {
  return STORM_PRESETS.find((p) => p.id === id) ?? STORM_PRESETS[0];
}

/** Same gamma-hyetograph shape as the live feed, reparameterized per preset. */
export function generateStormSeries(preset, seed) {
  const rand = mulberry32(seed + 7);
  const steps = 12; // 12 x 15min = 180min = 3hr, matching the live feed's resolution
  const series = [];
  for (let i = 1; i <= steps; i++) {
    const t = i;
    const gamma =
      Math.pow(t / preset.peakStep, preset.shape) * Math.exp(-preset.shape * (t / preset.peakStep - 1));
    const jitter = randRange(rand, -6, 6);
    const intensity = Math.max(0, Math.min(160, gamma * preset.peakMmHr + jitter));
    series.push({ tMinutes: i * 15, intensityMmPerHr: +intensity.toFixed(1) });
  }
  return series;
}
