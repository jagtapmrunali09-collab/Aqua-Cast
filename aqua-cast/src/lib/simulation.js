/**
 * simulation.js
 * Bridges the UI's what-if sliders to the hydrology/hydraulics/coupling
 * engine: takes the base mock dataset plus slider values and produces a
 * fresh nowcast timeline. Kept as a pure function so the dashboard can
 * memoize it against slider state.
 */
import { buildDrainageGraph } from './network.js';
import { runNowcastCoupling } from './coupling.js';

export const SEVERITY_COLOR = {
  normal: '#059669',
  caution: '#d97706',
  critical: '#dc2626',
};

export const SEVERITY_FILL = {
  normal: '#d1fae5',
  caution: '#fef3c7',
  critical: '#fee2e2',
};

export function applyRainfallMultiplier(radarSeries, multiplier) {
  return radarSeries.map((s) => ({
    ...s,
    intensityMmPerHr: +Math.min(120, s.intensityMmPerHr * multiplier).toFixed(1),
  }));
}

/** siltScale: 0..2, where 1.0 reproduces the dataset's baseline clogging. */
export function applySiltScale(edges, siltScale) {
  return edges.map((e) => ({
    ...e,
    siltBlockPct: Math.min(95, Math.round(e.siltBlockPct * siltScale)),
  }));
}

/** Pump stations are only realistic at major junctions and the outfall, not every inlet. */
export function selectPumpNodes(nodes, edges) {
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));
  edges.forEach((e) => inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1));
  return new Set(
    nodes.filter((n) => n.type === 'outfall' || inDegree.get(n.id) >= 2).map((n) => n.id)
  );
}

/**
 * Historical-storm presets (see lib/stormPresets.js) that lock the
 * outfall shut via a tidal/backwater effect apply extra silt-equivalent
 * blockage to every pipe draining directly into the outfall — modeling
 * how a high-tide backpressure lock (as in Mumbai, 26 Jul 2005) chokes
 * off conveyance even in perfectly clean pipes.
 */
function applyTidalBackpressure(edges, outfallNodeId, active) {
  if (!active || !outfallNodeId) return edges;
  return edges.map((e) =>
    e.to === outfallNodeId ? { ...e, siltBlockPct: Math.min(95, e.siltBlockPct + 45) } : e
  );
}

export function computeSimulation({
  dataset,
  rainfallMultiplier = 1,
  siltScale = 1,
  pumpActivationPct = 0,
  timeStepMinutes = 15,
  radarSeriesOverride = null,
  tidalBackpressure = false,
}) {
  // Edge case: dataset missing or malformed (e.g. a real DEM/radar feed
  // that hasn't loaded yet) — fail soft with an empty-but-valid timeline
  // instead of throwing and white-screening the dashboard.
  const hasValidNetwork = dataset?.drainageNetwork?.nodes?.length > 0;
  const baseRadarSeries = radarSeriesOverride ?? dataset?.radarSeries;
  const hasValidRadar = Array.isArray(baseRadarSeries) && baseRadarSeries.length > 0;
  if (!hasValidNetwork || !hasValidRadar) {
    return { radarSeries: [], edges: [], nodes: [], timeline: [], pumpNodeIds: new Set(), graph: null, error: 'invalid_dataset' };
  }

  const radarSeries = applyRainfallMultiplier(baseRadarSeries, rainfallMultiplier);
  let edges = applySiltScale(dataset.drainageNetwork.edges, siltScale);
  edges = applyTidalBackpressure(edges, dataset.outfallNodeId, tidalBackpressure);
  const { nodes } = dataset.drainageNetwork;

  const graph = buildDrainageGraph({ nodes, edges });
  const pumpNodeIds = selectPumpNodes(nodes, edges);
  const pumpBoostCumecs = (pumpActivationPct / 100) * 0.8; // ~0.8 m3/s per equipped station at full activation

  const timeline = runNowcastCoupling({
    graph,
    radarSeries,
    timeStepMinutes,
    pumpBoostCumecs,
    pumpNodeIds,
  });

  return { radarSeries, edges, nodes, timeline, pumpNodeIds, graph };
}

export function summarizeStep(step) {
  const highRisk = step.nodes.filter((n) => n.severity !== 'normal').length;
  const surchargedEdges = step.edges.filter((e) => e.surcharged).length;
  const totalStandingM3 = step.nodes.reduce((sum, n) => sum + n.standingVolumeM3, 0);
  const criticalCount = step.nodes.filter((n) => n.severity === 'critical').length;
  return { highRisk, surchargedEdges, totalStandingM3, criticalCount };
}
