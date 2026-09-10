/**
 * maintenance.js
 * Pre-Monsoon Silt & Asset Maintenance Planner.
 *
 * Ranks every pipe in the drainage network by a "Desilting Priority"
 * score so a municipality can schedule pre-monsoon cleaning where it
 * actually reduces flood risk, rather than desilting on a fixed
 * calendar rotation regardless of condition. The score blends three
 * factors documented at each weight below:
 *
 *   1. Surveyed silt condition (40%)   — dataset.drainageNetwork's
 *      baseline siltBlockPct, i.e. how clogged the pipe already is.
 *   2. Observed surcharge frequency (40%) — the fraction of timesteps
 *      in the CURRENT simulated storm where this pipe's required
 *      discharge exceeded its Manning's-equation capacity. A pipe that
 *      surcharges through most of the storm is doing real damage now,
 *      not just on paper.
 *   3. Downstream network impact (20%) — how many nodes sit downstream
 *      of this pipe. A clogged trunk line near the outfall backs up
 *      everything upstream of it; a clogged lateral only affects its
 *      immediate inlet.
 *
 * This is a transparent, explainable heuristic — not a black-box
 * model — so a municipal engineer can see exactly why a pipe is
 * ranked where it is and override it with local knowledge.
 */

const WEIGHTS = { siltCondition: 0.4, surchargeFrequency: 0.4, downstreamImpact: 0.2 };

/** BFS descendant count for every node, following pipes downstream toward the outfall. */
function computeDownstreamCounts(edges) {
  const adj = new Map();
  const allNodes = new Set();
  edges.forEach((e) => {
    allNodes.add(e.from);
    allNodes.add(e.to);
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  });

  const counts = {};
  allNodes.forEach((n) => {
    const seen = new Set([n]);
    const queue = [n];
    while (queue.length) {
      const cur = queue.shift();
      (adj.get(cur) || []).forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    counts[n] = seen.size - 1; // exclude the node itself
  });
  return counts;
}

function tierForScore(score) {
  if (score >= 0.62) return 'Urgent';
  if (score >= 0.38) return 'Priority';
  return 'Routine';
}

/**
 * @param dataset  the base mock/real dataset (for baseline pipe survey condition)
 * @param timeline the CURRENT simulation's timeline (for observed surcharge frequency)
 */
export function computeDesiltingPriority({ dataset, timeline }) {
  const baselineEdges = dataset?.drainageNetwork?.edges ?? [];
  if (baselineEdges.length === 0) return [];

  const totalSteps = timeline?.length ?? 0;
  const surchargeCount = new Map();
  (timeline ?? []).forEach((step) => {
    step.edges.forEach((e) => {
      if (!e.surcharged) return;
      const key = `${e.from}|${e.to}`;
      surchargeCount.set(key, (surchargeCount.get(key) ?? 0) + 1);
    });
  });

  const downstreamCounts = computeDownstreamCounts(baselineEdges);
  const maxDownstream = Math.max(...Object.values(downstreamCounts), 1);

  const ranked = baselineEdges.map((e) => {
    const key = `${e.from}|${e.to}`;
    const surchargeFrequency = totalSteps > 0 ? (surchargeCount.get(key) ?? 0) / totalSteps : 0;
    const downstreamImpact = (downstreamCounts[e.to] ?? 1) / maxDownstream;
    const siltCondition = Math.min(e.siltBlockPct, 95) / 95;

    const score =
      WEIGHTS.siltCondition * siltCondition +
      WEIGHTS.surchargeFrequency * surchargeFrequency +
      WEIGHTS.downstreamImpact * downstreamImpact;

    return {
      id: key,
      from: e.from,
      to: e.to,
      diameterM: e.diameterM,
      material: e.material,
      lengthM: e.lengthM,
      siltBlockPct: e.siltBlockPct,
      surchargeFrequencyPct: +(surchargeFrequency * 100).toFixed(0),
      downstreamNodeCount: downstreamCounts[e.to] ?? 0,
      score: +score.toFixed(3),
      tier: tierForScore(score),
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
