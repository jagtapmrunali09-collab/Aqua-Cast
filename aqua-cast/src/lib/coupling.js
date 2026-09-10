/**
 * coupling.js
 * Couples the rainfall nowcast (hydrology.js) with the drainage network's
 * hydraulic capacity (hydraulics.js + network.js) and the local DEM.
 * For every timestep of the 0-3hr forward window it produces:
 *   - discharge entering/leaving each node
 *   - which pipes are surcharged (Q_runoff > Q_pipe)
 *   - backflow/standing volume at overwhelmed nodes
 *   - resulting street inundation depth (cm) over each node's DEM cell
 */
import { catchmentRunoffSeries } from './hydrology.js';
import { pipeFullCapacity, solveFlowDepthForDischarge } from './hydraulics.js';
import { topologicalOrder } from './network.js';

/**
 * Converts standing (surcharge) volume at a node into a street depth by
 * spreading it over the node's local ponding footprint — the low-lying
 * fraction of its catchment where water actually accumulates rather
 * than sheeting away.
 */
function backflowVolumeToDepthCm({ volumeM3, footprintAreaM2 }) {
  if (footprintAreaM2 <= 0) return 0;
  return (volumeM3 / footprintAreaM2) * 100; // m -> cm
}

export function runNowcastCoupling({
  graph,
  radarSeries,
  timeStepMinutes = 15,
  pumpBoostCumecs = 0,
  pumpNodeIds = null,
}) {
  const order = topologicalOrder(graph);
  const dtSeconds = timeStepMinutes * 60;

  // Standing (unconveyed) volume carried forward at each node, m^3.
  const standingVolume = new Map(order.map((n) => [n, 0]));

  const timeline = radarSeries.map(({ tMinutes, intensityMmPerHr }) => {
    const inflow = new Map(order.map((n) => [n, 0])); // m^3/s arriving this step
    const nodeResults = [];
    const edgeResults = [];

    for (const nodeId of order) {
      const attrs = graph.getNodeAttributes(nodeId);

      const [{ runoffCumecs: localRunoff }] = catchmentRunoffSeries({
        landUseAreas: attrs.landUseAreas,
        radarSeries: [{ tMinutes, intensityMmPerHr }],
      });

      const upstreamInflow = inflow.get(nodeId) ?? 0;
      const totalQ = localRunoff + upstreamInflow;

      const outEdges = graph.outEdges(nodeId);
      let nodeSurcharged = false;
      let excessQ = 0;

      if (outEdges.length === 0) {
        // Outfall / dead-end sink — nothing further downstream, all
        // unconveyed discharge ponds locally.
        excessQ = totalQ;
      } else {
        // Split evenly across parallel downstream pipes. (A refinement
        // would weight the split by relative pipe capacity.)
        const share = totalQ / outEdges.length;
        outEdges.forEach((edgeKey) => {
          const target = graph.opposite(nodeId, edgeKey);
          const edgeAttrs = graph.getEdgeAttributes(edgeKey);

          const qFull = pipeFullCapacity({
            diameterM: edgeAttrs.diameterM,
            slope: edgeAttrs.slope,
            material: edgeAttrs.material,
            siltBlockPct: edgeAttrs.siltBlockPct,
          });
          const solved = solveFlowDepthForDischarge({
            diameterM: edgeAttrs.diameterM,
            slope: edgeAttrs.slope,
            material: edgeAttrs.material,
            siltBlockPct: edgeAttrs.siltBlockPct,
            targetQ: share,
          });

          const conveyed = Math.min(share, qFull);
          const edgeExcess = Math.max(share - qFull, 0);
          if (edgeExcess > 0) nodeSurcharged = true;
          excessQ += edgeExcess;

          inflow.set(target, (inflow.get(target) ?? 0) + conveyed);

          edgeResults.push({
            edge: edgeKey,
            from: nodeId,
            to: target,
            qRequired: share,
            qCapacity: qFull,
            fillPct: solved.fillPct,
            surcharged: solved.surcharged,
          });
        });
      }

      // Emergency dewatering pumps (what-if slider) actively evacuate
      // standing/excess water at pump-equipped junctions before it has
      // a chance to accumulate.
      const pumpAssist = pumpNodeIds ? (pumpNodeIds.has(nodeId) ? pumpBoostCumecs : 0) : pumpBoostCumecs;
      excessQ = Math.max(excessQ - pumpAssist, 0);

      // Excess discharge accumulates as standing volume over the
      // timestep, net of a mild recession factor (overland spread,
      // seepage, any pump drawdown already applied upstream).
      const prevVolume = standingVolume.get(nodeId) ?? 0;
      const addedVolume = excessQ * dtSeconds;
      const dissipated = prevVolume * 0.05;
      const newVolume = Math.max(prevVolume - dissipated + addedVolume, 0);
      standingVolume.set(nodeId, newVolume);

      // Local ponding footprint: ~15% of a node's catchment sits low
      // enough to pool (street sag points, low-lying junctions).
      const footprintAreaM2 = (attrs.catchmentAreaHa || 0.5) * 10000 * 0.15;
      const depthCm = backflowVolumeToDepthCm({ volumeM3: newVolume, footprintAreaM2 });

      nodeResults.push({
        node: nodeId,
        localRunoffCumecs: localRunoff,
        upstreamInflowCumecs: upstreamInflow,
        surcharged: nodeSurcharged,
        standingVolumeM3: newVolume,
        depthCm,
        severity: depthCm > 25 ? 'critical' : depthCm > 10 ? 'caution' : 'normal',
      });
    }

    return { tMinutes, intensityMmPerHr, nodes: nodeResults, edges: edgeResults };
  });

  return timeline;
}
