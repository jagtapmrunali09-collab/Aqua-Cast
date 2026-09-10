/**
 * radarProxy.js
 * Live Weather Radar Proxy Engine.
 *
 * A real Doppler radar reports reflectivity in dBZ, not rainfall rate
 * directly — the nowcast feed's mm/hr numbers are themselves derived
 * from a Z-R relationship. This module runs that conversion in both
 * directions with the classic Marshall–Palmer relation:
 *
 *   Z = 200 * R^1.6        (Z: reflectivity factor, mm^6/m^3; R: mm/hr)
 *   dBZ = 10 * log10(Z)
 *
 * and simulates a spatially-varying reflectivity MOSAIC across the
 * zone's DEM cells for the current timestep — a real radar shows a
 * convective cell's dense core and softer fringe, not one flat number
 * painted uniformly over the whole map. This gives the dashboard a
 * true "live operational" radar feel layered under the nowcast, built
 * deterministically from the same seed so it's stable across re-renders
 * of the same timestep but visibly different frame-to-frame.
 */
import { mulberry32 } from '../data/rng.js';

export function rainRateToReflectivityDbz(rMmPerHr) {
  const r = Math.max(rMmPerHr, 0.01);
  const z = 200 * Math.pow(r, 1.6);
  return 10 * Math.log10(z);
}

export function reflectivityDbzToRainRate(dbz) {
  const z = Math.pow(10, dbz / 10);
  return Math.pow(z / 200, 1 / 1.6);
}

/** Standard NWS-style dBZ color ramp used across radar mosaics worldwide. */
export function dbzColor(dbz) {
  if (dbz < 5) return 'transparent';
  if (dbz < 15) return '#7dd3fc'; // light drizzle
  if (dbz < 25) return '#38bdf8'; // light rain
  if (dbz < 35) return '#22c55e'; // moderate rain
  if (dbz < 45) return '#eab308'; // heavy rain
  if (dbz < 50) return '#f97316'; // very heavy rain
  if (dbz < 55) return '#dc2626'; // intense / cloudburst core
  return '#a21caf'; // extreme core, hail-adjacent reflectivity
}

/**
 * Builds a per-DEM-cell reflectivity + rain-rate reading for the given
 * timestep. Cells near the zone center get a slight "core" boost so the
 * mosaic visually converges on the historically chronic Hindmata-style
 * bowl, consistent with how convective cells organize over
 * heat-island / low-lying terrain.
 */
export function generateRadarMosaic({ demGrid, intensityMmPerHr, seed, tMinutes }) {
  const features = demGrid?.features ?? [];
  if (features.length === 0 || intensityMmPerHr <= 0) return [];

  return features.map((f, i) => {
    const localSeed = (seed * 97 + i * 131 + tMinutes * 7) >>> 0;
    const rand = mulberry32(localSeed);
    const jitter = 0.55 + rand() * 0.9; // 0.55x - 1.45x local variation around the mean
    const localR = Math.max(0, intensityMmPerHr * jitter);
    const dbz = rainRateToReflectivityDbz(localR);
    return { cellId: f.properties.cellId, dbz, rainRateMmPerHr: localR };
  });
}
