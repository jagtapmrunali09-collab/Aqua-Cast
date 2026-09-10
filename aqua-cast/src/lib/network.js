/**
 * network.js
 * Directed-graph representation of the underground drainage network.
 *   Nodes -> manholes / inlets / outfalls           (V)
 *   Edges -> pipes / canals, directed downstream     (E)
 */
import Graph from 'graphology';

export function buildDrainageGraph({ nodes, edges }) {
  const g = new Graph({ type: 'directed', multi: false });

  nodes.forEach((n) => {
    g.addNode(n.id, {
      elevationM: n.elevationM,
      type: n.type, // 'manhole' | 'inlet' | 'outfall'
      catchmentAreaHa: n.catchmentAreaHa ?? 0,
      landUseAreas: n.landUseAreas ?? {},
      lat: n.lat,
      lng: n.lng,
    });
  });

  edges.forEach((e) => {
    g.addEdge(e.from, e.to, {
      diameterM: e.diameterM,
      lengthM: e.lengthM,
      slope: e.slope,
      material: e.material ?? 'concrete',
      siltBlockPct: e.siltBlockPct ?? 0,
    });
  });

  return g;
}

/**
 * Kahn's-algorithm topological ordering, so flow is always accumulated
 * from upstream inlets down to outfalls in a single pass. Throws if a
 * cycle is detected — a real drainage network must be acyclic, since
 * water only flows downhill.
 */
export function topologicalOrder(graph) {
  const inDegree = new Map();
  graph.forEachNode((node) => inDegree.set(node, graph.inDegree(node)));

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([n]) => n);
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    graph.forEachOutNeighbor(node, (neighbor) => {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    });
  }

  if (order.length !== graph.order) {
    throw new Error('Drainage graph contains a cycle — check pipe directions.');
  }
  return order;
}
