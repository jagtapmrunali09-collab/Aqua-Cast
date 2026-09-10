/**
 * actionCenter.js
 * Pre-Flood Citizen & Municipal Action Center.
 *
 * Groups the drainage network's nodes into four illustrative wards
 * (quadrants of the surveyed grid) and, for each, scans the FULL
 * remaining 0–3hr nowcast window from the current timestep forward to
 * answer the question a disaster-management officer actually needs
 * answered before a flood hits: "which wards will go critical, and
 * how soon?" — not just what's flooded right now.
 */

const SEVERITY_RANK = { normal: 0, caution: 1, critical: 2 };

function wardForNode(nodeId) {
  const [, rStr, cStr] = nodeId.split('-');
  const r = Number(rStr);
  const c = Number(cStr);
  const north = r < 3;
  const west = c < 3;
  if (north && west) return { id: 'ward-nw', name: 'North-West Ward' };
  if (north && !west) return { id: 'ward-ne', name: 'North-East Ward' };
  if (!north && west) return { id: 'ward-sw', name: 'South-West Ward' };
  return { id: 'ward-se', name: 'South-East Ward' };
}

// Illustrative planning density for a dense Indian metro block — used only
// to give the mock broadcast a plausible "citizens reached" count, not a
// surveyed census figure.
const PERSONS_PER_HECTARE = 220;
const PERSONS_PER_HOUSEHOLD = 4.4;

export function computeFloodBulletin({ dataset, timeline, stepIndex }) {
  if (!timeline || timeline.length === 0) return { generatedAtMinutes: 0, wards: [] };

  const nodesById = new Map(dataset.drainageNetwork.nodes.map((n) => [n.id, n]));
  const wardMap = new Map(); // wardId -> { id, name, nodeIds: [] }

  dataset.drainageNetwork.nodes.forEach((n) => {
    const ward = wardForNode(n.id);
    if (!wardMap.has(ward.id)) wardMap.set(ward.id, { ...ward, nodeIds: [] });
    wardMap.get(ward.id).nodeIds.push(n.id);
  });

  const forwardWindow = timeline.slice(stepIndex);
  const currentStep = timeline[stepIndex];

  const wards = [...wardMap.values()].map((ward) => {
    const estimatedPopulation = Math.round(
      ward.nodeIds.reduce((sum, id) => sum + (nodesById.get(id)?.catchmentAreaHa ?? 0.6), 0) *
        PERSONS_PER_HECTARE
    );

    let currentSeverity = 'normal';
    let peakSeverity = 'normal';
    let etaToCriticalMinutes = null;
    let criticalNodeCountNow = 0;

    const currentNodeMap = new Map(currentStep.nodes.map((n) => [n.node, n]));
    ward.nodeIds.forEach((id) => {
      const rec = currentNodeMap.get(id);
      if (!rec) return;
      if (SEVERITY_RANK[rec.severity] > SEVERITY_RANK[currentSeverity]) currentSeverity = rec.severity;
      if (rec.severity === 'critical') criticalNodeCountNow += 1;
    });

    outer: for (const step of forwardWindow) {
      const stepNodeMap = new Map(step.nodes.map((n) => [n.node, n]));
      for (const id of ward.nodeIds) {
        const rec = stepNodeMap.get(id);
        if (!rec) continue;
        if (SEVERITY_RANK[rec.severity] > SEVERITY_RANK[peakSeverity]) peakSeverity = rec.severity;
        if (rec.severity === 'critical' && etaToCriticalMinutes === null) {
          etaToCriticalMinutes = step.tMinutes - currentStep.tMinutes;
        }
      }
      if (peakSeverity === 'critical' && etaToCriticalMinutes !== null) break outer;
    }

    return {
      ...ward,
      estimatedPopulation,
      currentSeverity,
      peakSeverity,
      criticalNodeCountNow,
      etaToCriticalMinutes,
    };
  });

  // Most urgent wards first: already-critical, then soonest ETA to critical, then by peak severity.
  wards.sort((a, b) => {
    if (a.currentSeverity === 'critical' && b.currentSeverity !== 'critical') return -1;
    if (b.currentSeverity === 'critical' && a.currentSeverity !== 'critical') return 1;
    const aEta = a.etaToCriticalMinutes ?? Infinity;
    const bEta = b.etaToCriticalMinutes ?? Infinity;
    if (aEta !== bEta) return aEta - bEta;
    return SEVERITY_RANK[b.peakSeverity] - SEVERITY_RANK[a.peakSeverity];
  });

  return { generatedAtMinutes: currentStep.tMinutes, wards };
}

/**
 * Mock disaster-management broadcast trigger. In production this would
 * call a real WhatsApp Business API / SMS gateway (e.g. Twilio, or
 * India's NDMA-integrated Common Alerting Protocol feed); here it
 * simulates the network round-trip and returns a plausible delivery
 * receipt so the UI flow is fully demonstrable end-to-end.
 */
export function triggerAlertBroadcast(wards) {
  const targetWards = wards.filter((w) => w.currentSeverity !== 'normal' || w.etaToCriticalMinutes !== null);
  const totalPopulation = targetWards.reduce((sum, w) => sum + w.estimatedPopulation, 0);
  const recipientHouseholds = Math.round(totalPopulation / PERSONS_PER_HOUSEHOLD);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        sent: true,
        channel: 'WhatsApp Business API + SMS gateway (simulated)',
        wardsNotified: targetWards.map((w) => w.name),
        recipientHouseholds,
        timestamp: new Date().toISOString(),
      });
    }, 900);
  });
}
