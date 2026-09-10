/**
 * routing.js
 * Emergency & commuter flood-aware routing over the street node graph.
 *   Edge weight = Distance + Penalty(d)
 *     d <= impassableAboveCm  -> normal weight (free travel)
 *     impassable < d <= blocked  -> heavy caution penalty (only some
 *       vehicle classes may still traverse it, slowly)
 *     d > blockedAboveCm  -> Infinity (edge excluded entirely)
 */
import Graph from 'graphology';
import { nearestStreetNodeId, haversineMeters } from '../data/shelters.js';

export const BASE_SPEED_KMH = 28; // typical dense-urban arterial speed
export const CAUTION_SPEED_KMH = 8; // wading through standing water
export const WALK_SPEED_KMH = 4.5; // pedestrian evacuation pace, standing water excluded

export const VEHICLE_RULES = {
  commuter: {
    label: 'Commuter (light vehicle)',
    impassableAboveCm: 15, // > 15cm is already a hard block for light vehicles
    blockedAboveCm: 15,
  },
  emergency: {
    label: 'Emergency (high-clearance)',
    impassableAboveCm: 15, // 15-30cm: passable but cautious/slow
    blockedAboveCm: 30, // > 30cm: blocked for everyone, no exceptions
  },
};

export function buildStreetGraph(streetGrid) {
  const g = new Graph({ type: 'undirected', multi: false });
  streetGrid.features.forEach((f) => {
    const { fromNode, toNode, lengthM, name, lowLying } = f.properties;
    if (!g.hasNode(fromNode)) g.addNode(fromNode);
    if (!g.hasNode(toNode)) g.addNode(toNode);
    if (!g.hasEdge(fromNode, toNode)) {
      g.addEdge(fromNode, toNode, { lengthM, name, lowLying });
    }
  });
  return g;
}

function edgeWeightForVehicle(lengthM, depthCm, vehicleClass) {
  const rules = VEHICLE_RULES[vehicleClass];
  if (depthCm > rules.blockedAboveCm) return Infinity;
  if (depthCm > rules.impassableAboveCm) return lengthM * 4; // caution penalty
  return lengthM;
}

/** Plain O(V^2) Dijkstra — the street graph is small (dozens of nodes), so no priority queue needed. */
export function dijkstraShortestPath(graph, weightFn, sourceId, targetId) {
  if (!graph.hasNode(sourceId) || !graph.hasNode(targetId)) return null;

  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  graph.forEachNode((n) => dist.set(n, Infinity));
  dist.set(sourceId, 0);

  while (visited.size < graph.order) {
    let u = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null || u === targetId) break;
    visited.add(u);

    graph.forEachEdge(u, (edge, attrs, source, target) => {
      const v = source === u ? target : source;
      if (visited.has(v)) return;
      const w = weightFn(edge, attrs, u, v);
      if (w === Infinity) return;
      const alt = dist.get(u) + w;
      if (alt < dist.get(v)) {
        dist.set(v, alt);
        prev.set(v, { node: u, edge });
      }
    });
  }

  if (!Number.isFinite(dist.get(targetId))) return null;

  const nodes = [targetId];
  const edges = [];
  let cur = targetId;
  while (cur !== sourceId) {
    const p = prev.get(cur);
    if (!p) return null;
    edges.unshift(p.edge);
    nodes.unshift(p.node);
    cur = p.node;
  }
  return { nodes, edges, totalWeight: dist.get(targetId) };
}

/**
 * Extends a copy of the street graph with shelter / high-ground nodes,
 * each connected by a single "last-mile" edge to its nearest real
 * street node (straight-line distance, since shelters sit just off the
 * surveyed street grid). This lets the existing Dijkstra routines route
 * to a shelter exactly like any other destination, with no special-casing.
 */
export function attachShelterNodes(streetGraph, shelters, nodes) {
  const g = streetGraph.copy();
  shelters.forEach((s) => {
    if (g.hasNode(s.id)) return;
    g.addNode(s.id, { isShelter: true, shelterType: s.type });
    const nearestId = nearestStreetNodeId(s, nodes);
    if (!nearestId || !g.hasNode(nearestId)) return;
    const lengthM = Math.round(haversineMeters(s.lat, s.lng, ...(() => {
      const n = nodes.find((x) => x.id === nearestId);
      return [n.lat, n.lng];
    })()));
    g.addEdge(s.id, nearestId, { lengthM: Math.max(lengthM, 10), name: 'last-mile approach', lowLying: false });
  });
  return g;
}

/** Ranks every shelter by flood-safe walking time from a given origin node. */
export function rankSheltersByAccess({ streetGraph, shelters, depthByNode, fromId }) {
  return shelters
    .map((s) => {
      const path = dijkstraShortestPath(
        streetGraph,
        (edge, attrs, u, v) => {
          const depth = Math.max(depthByNode.get(u) || 0, depthByNode.get(v) || 0);
          // Pedestrians are blocked earlier than vehicles — 30cm is already
          // dangerous fast-moving standing water for someone on foot.
          if (depth > 30) return Infinity;
          if (depth > 15) return attrs.lengthM * 3;
          return attrs.lengthM;
        },
        fromId,
        s.id
      );
      if (!path) return { shelter: s, reachable: false, distanceM: null, walkMinutes: null };
      const distanceM = sumEdgeLengths(streetGraph, path.edges);
      const walkMinutes = (distanceM / 1000 / WALK_SPEED_KMH) * 60;
      return { shelter: s, reachable: true, distanceM, walkMinutes, path };
    })
    .sort((a, b) => {
      if (a.reachable !== b.reachable) return a.reachable ? -1 : 1;
      return (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity);
    });
}

function sumEdgeLengths(graph, edges) {
  return edges.reduce((sum, e) => sum + graph.getEdgeAttributes(e).lengthM, 0);
}

/** Real-world travel time for a resolved path, accounting for slow-downs through any caution-depth water it actually crosses. */
function routeTravelTimeMinutes(graph, path, depthByNode) {
  let minutes = 0;
  path.edges.forEach((edgeKey, i) => {
    const { lengthM } = graph.getEdgeAttributes(edgeKey);
    const u = path.nodes[i];
    const v = path.nodes[i + 1];
    const depth = Math.max(depthByNode.get(u) || 0, depthByNode.get(v) || 0);
    const speedKmh = depth > 15 ? CAUTION_SPEED_KMH : BASE_SPEED_KMH;
    minutes += (lengthM / 1000 / speedKmh) * 60;
  });
  return minutes;
}

function floodedNodesOnPath(path, depthByNode, thresholdCm) {
  return path.nodes.filter((n) => (depthByNode.get(n) || 0) > thresholdCm);
}

/**
 * Computes both the naive Standard Route (shortest distance, flooding
 * ignored) and the Flood-Safe Route (distance + depth penalty, hard
 * blocks respected) for the given vehicle class, and compares them.
 */
export function computeRoutes({ streetGraph, depthByNode = new Map(), fromId, toId, vehicleClass = 'commuter' }) {
  const rules = VEHICLE_RULES[vehicleClass] ?? VEHICLE_RULES.commuter;

  // Edge cases: missing selection, unknown node ids, or same origin/destination.
  if (!streetGraph || streetGraph.order === 0) {
    return { vehicleClass, rules, standard: null, floodSafe: null, avoidedIntersections: [], timeDeltaMinutes: null, standardBlocked: false, error: 'no_street_graph' };
  }
  if (!fromId || !toId || !streetGraph.hasNode(fromId) || !streetGraph.hasNode(toId)) {
    return { vehicleClass, rules, standard: null, floodSafe: null, avoidedIntersections: [], timeDeltaMinutes: null, standardBlocked: false, error: 'invalid_endpoints' };
  }
  if (fromId === toId) {
    const same = { nodes: [fromId], edges: [], distanceM: 0, timeMinutes: 0, floodedNodes: [], blockedNodes: [] };
    return { vehicleClass, rules, standard: same, floodSafe: same, avoidedIntersections: [], timeDeltaMinutes: 0, standardBlocked: false, error: null };
  }

  const standard = dijkstraShortestPath(streetGraph, (edge, attrs) => attrs.lengthM, fromId, toId);
  const floodSafe = dijkstraShortestPath(
    streetGraph,
    (edge, attrs, u, v) => {
      const depth = Math.max(depthByNode.get(u) || 0, depthByNode.get(v) || 0);
      return edgeWeightForVehicle(attrs.lengthM, depth, vehicleClass);
    },
    fromId,
    toId
  );

  const buildSummary = (path) => {
    if (!path) return null;
    const distanceM = sumEdgeLengths(streetGraph, path.edges);
    const timeMinutes = routeTravelTimeMinutes(streetGraph, path, depthByNode);
    const floodedNodes = floodedNodesOnPath(path, depthByNode, rules.impassableAboveCm);
    const blockedNodes = floodedNodesOnPath(path, depthByNode, rules.blockedAboveCm);
    return { ...path, distanceM, timeMinutes, floodedNodes, blockedNodes };
  };

  const standardSummary = buildSummary(standard);
  const floodSafeSummary = buildSummary(floodSafe);

  const avoidedIntersections =
    standardSummary && floodSafeSummary
      ? standardSummary.floodedNodes.filter((n) => !floodSafeSummary.nodes.includes(n))
      : standardSummary?.floodedNodes ?? [];

  const timeDeltaMinutes =
    standardSummary && floodSafeSummary ? floodSafeSummary.timeMinutes - standardSummary.timeMinutes : null;

  return {
    vehicleClass,
    rules,
    standard: standardSummary,
    floodSafe: floodSafeSummary,
    avoidedIntersections,
    timeDeltaMinutes,
    standardBlocked: standardSummary ? standardSummary.blockedNodes.length > 0 : false,
    error: !standardSummary && !floodSafeSummary ? 'no_path_found' : null,
  };
}
