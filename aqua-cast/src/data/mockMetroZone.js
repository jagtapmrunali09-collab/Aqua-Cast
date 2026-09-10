/**
 * mockMetroZone.js
 * Generates a realistic mock dataset for a chronic-waterlogging Indian
 * metro block, modeled on the Hindmata junction area in Dadar, Mumbai —
 * a low-lying rail-underpass bowl that floods every monsoon because its
 * street level sits below the surrounding grade and its storm drains
 * discharge against tidal backpressure. Coordinates are an illustrative
 * approximation of the real neighborhood, not a surveyed dataset.
 *
 * Produces:
 *   - streetGrid    GeoJSON FeatureCollection of LineStrings
 *   - demGrid       GeoJSON FeatureCollection of Polygons (elevation cells)
 *   - drainageNetwork  { nodes, edges } — directly consumable by network.js
 *   - radarSeries   0-3hr Doppler nowcast, 15-min steps, mm/hr
 */
import { mulberry32, randRange } from './rng.js';

export const ZONE_META = {
  name: 'Hindmata Junction, Dadar (mock)',
  city: 'Mumbai',
  problemStatementId: 26085,
  centerLat: 19.0176,
  centerLng: 72.8438,
  note: 'Illustrative bounding box modeled on a known chronic-waterlogging rail-underpass area; not surveyed data.',
};

const METERS_PER_DEG_LAT = 111320;

function metersToLatLng(centerLat, centerLng, dNorthM, dEastM) {
  const dLat = dNorthM / METERS_PER_DEG_LAT;
  const dLng = dEastM / (METERS_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180));
  return { lat: centerLat + dLat, lng: centerLng + dLng };
}

const GRID_ROWS = 6;
const GRID_COLS = 6;
const SPACING_M = 90; // ~90m city block, typical dense Indian metro grid

function nodeId(r, c) {
  return `N-${r}-${c}`;
}

/** Bowl-shaped elevation field: lowest at the Hindmata-style underpass center, rising toward the grid edges. */
function elevationAt(r, c, rand) {
  const centerR = (GRID_ROWS - 1) / 2;
  const centerC = (GRID_COLS - 1) / 2;
  const maxDist = Math.hypot(centerR, centerC);
  const dist = Math.hypot(r - centerR, c - centerC) / maxDist; // 0 (center) .. 1 (corner)

  const edgeElevationM = 6.5;
  const bowlDepthM = 4.5;
  const noise = randRange(rand, -0.25, 0.25);
  return +(edgeElevationM - (1 - dist) * bowlDepthM + noise).toFixed(2);
}

function landUseMixForNode(dist, catchmentAreaHa, rand) {
  // dist: 0 (Hindmata-style dense market/underpass core) .. 1 (residential/park periphery)
  const roadFrac = 0.22 + randRange(rand, -0.03, 0.03);
  const roofFrac = 0.35 - 0.15 * dist;
  const informalFrac = Math.max(0.28 - 0.22 * dist, 0.02);
  const parkFrac = 0.05 + 0.18 * dist;
  const openFrac = Math.max(1 - roadFrac - roofFrac - informalFrac - parkFrac, 0.02);

  return {
    asphalt_road: +(roadFrac * catchmentAreaHa).toFixed(3),
    concrete_roof: +(roofFrac * catchmentAreaHa).toFixed(3),
    dense_informal_settlement: +(informalFrac * catchmentAreaHa).toFixed(3),
    park_lawn: +(parkFrac * catchmentAreaHa).toFixed(3),
    open_ground_compacted: +(openFrac * catchmentAreaHa).toFixed(3),
  };
}

/**
 * Builds the drainage directed graph (nodes + edges) using steepest-descent
 * routing: each node drains to its lowest-elevation 4-neighbor, which
 * guarantees an acyclic, dendritic network converging on the grid's global
 * elevation minimum — the outfall, mirroring how the real Hindmata bowl
 * drains toward a single chronically overwhelmed nullah connection.
 */
function buildDrainageNetworkData(rand) {
  const elevations = {};
  const positions = {};
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      elevations[nodeId(r, c)] = elevationAt(r, c, rand);
      positions[nodeId(r, c)] = { r, c };
    }
  }

  // Steepest-descent edge for every node (except the global minimum).
  const rawEdges = [];
  let minElevId = nodeId(0, 0);
  for (const id in elevations) {
    if (elevations[id] < elevations[minElevId]) minElevId = id;
  }

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const id = nodeId(r, c);
      if (id === minElevId) continue; // outfall — no outgoing edge

      const neighbors = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ].filter(([nr, nc]) => nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS);

      let best = null;
      for (const [nr, nc] of neighbors) {
        const nId = nodeId(nr, nc);
        if (elevations[nId] < elevations[id] && (!best || elevations[nId] < elevations[best])) {
          best = nId;
        }
      }
      // Rare flat spot with no downhill neighbor: fall back to the
      // single lowest neighbor regardless, still guaranteeing a DAG
      // since ties are broken by node id ordering (no cycles possible
      // in a steepest-descent-to-strict-minimum construction).
      if (!best) {
        best = neighbors
          .map(([nr, nc]) => nodeId(nr, nc))
          .sort((a, b) => elevations[a] - elevations[b])[0];
      }
      rawEdges.push({ from: id, to: best });
    }
  }

  // Aggregate downstream contributing-node counts (Strahler-style) so
  // trunk pipes near the outfall are sized larger than lateral inlets.
  const downstreamCount = {};
  Object.keys(elevations).forEach((id) => (downstreamCount[id] = 1));
  // Process in descending elevation order so every upstream node has
  // already pushed its count downstream before we read it.
  const byElevationDesc = Object.keys(elevations).sort((a, b) => elevations[b] - elevations[a]);
  const edgeByFrom = new Map(rawEdges.map((e) => [e.from, e.to]));
  for (const id of byElevationDesc) {
    const target = edgeByFrom.get(id);
    if (target) downstreamCount[target] += downstreamCount[id];
  }

  // Chronic hotspot nodes (Hindmata-style clogged laterals) get extra silt.
  const chronicHotspots = new Set();
  Object.keys(elevations).forEach((id) => {
    if (rand() < 0.15) chronicHotspots.add(id);
  });

  const edges = rawEdges.map(({ from, to }) => {
    const { r: r1, c: c1 } = positions[from];
    const { r: r2, c: c2 } = positions[to];
    const lengthM = Math.hypot(r1 - r2, c1 - c2) * SPACING_M || SPACING_M;
    const rise = elevations[from] - elevations[to];
    const slope = Math.max(rise / lengthM, 0.001);

    const downstreamRank = downstreamCount[to];
    const diameterM = Math.min(0.3 + downstreamRank * 0.025, 1.05);

    const isHotspot = chronicHotspots.has(from) || chronicHotspots.has(to);
    const siltBlockPct = isHotspot ? Math.round(randRange(rand, 40, 70)) : Math.round(randRange(rand, 0, 15));

    return {
      from,
      to,
      diameterM: +diameterM.toFixed(2),
      lengthM: Math.round(lengthM),
      slope: +slope.toFixed(4),
      material: rand() < 0.75 ? 'concrete' : 'brick_masonry',
      siltBlockPct,
    };
  });

  const inDegree = {};
  Object.keys(elevations).forEach((id) => (inDegree[id] = 0));
  edges.forEach((e) => (inDegree[e.to] += 1));

  const nodes = Object.keys(elevations).map((id) => {
    const { r, c } = positions[id];
    const centerR = (GRID_ROWS - 1) / 2;
    const centerC = (GRID_COLS - 1) / 2;
    const maxDist = Math.hypot(centerR, centerC);
    const dist = Math.hypot(r - centerR, c - centerC) / maxDist;

    const catchmentAreaHa = +randRange(rand, 0.55, 1.1).toFixed(2);
    const { lat, lng } = metersToLatLng(
      ZONE_META.centerLat,
      ZONE_META.centerLng,
      (centerR - r) * SPACING_M,
      (c - centerC) * SPACING_M
    );

    let type = 'manhole';
    if (id === minElevId) type = 'outfall';
    else if (inDegree[id] === 0) type = 'inlet';

    return {
      id,
      type,
      elevationM: elevations[id],
      catchmentAreaHa,
      landUseAreas: landUseMixForNode(dist, catchmentAreaHa, rand),
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
    };
  });

  return { nodes, edges, minElevId, positions };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildStreetGrid(positions, rand) {
  const features = [];
  const toLatLng = (r, c) =>
    metersToLatLng(
      ZONE_META.centerLat,
      ZONE_META.centerLng,
      ((GRID_ROWS - 1) / 2 - r) * SPACING_M,
      (c - (GRID_COLS - 1) / 2) * SPACING_M
    );
  const centerR = (GRID_ROWS - 1) / 2;
  const centerC = (GRID_COLS - 1) / 2;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS - 1; c++) {
      const a = toLatLng(r, c);
      const b = toLatLng(r, c + 1);
      const nearCenter = Math.hypot(r - centerR, c + 0.5 - centerC) < 1.6;
      features.push({
        type: 'Feature',
        properties: {
          id: `street-row-${r}-${c}`,
          name: nearCenter ? 'Hindmata Underpass Road' : `Cross Street ${r}`,
          lowLying: nearCenter,
          fromNode: nodeId(r, c),
          toNode: nodeId(r, c + 1),
          lengthM: Math.round(haversineMeters(a.lat, a.lng, b.lat, b.lng)),
        },
        geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      });
    }
  }
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS - 1; r++) {
      const a = toLatLng(r, c);
      const b = toLatLng(r + 1, c);
      const nearCenter = Math.hypot(r + 0.5 - centerR, c - centerC) < 1.6;
      features.push({
        type: 'Feature',
        properties: {
          id: `street-col-${r}-${c}`,
          name: nearCenter ? 'Hindmata Market Road' : `Link Road ${c}`,
          lowLying: nearCenter,
          fromNode: nodeId(r, c),
          toNode: nodeId(r + 1, c),
          lengthM: Math.round(haversineMeters(a.lat, a.lng, b.lat, b.lng)),
        },
        geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

function buildDemGrid(nodes) {
  const half = SPACING_M / 2;
  const features = nodes.map((n) => {
    const corners = [
      metersToLatLng(n.lat, n.lng, half, -half),
      metersToLatLng(n.lat, n.lng, half, half),
      metersToLatLng(n.lat, n.lng, -half, half),
      metersToLatLng(n.lat, n.lng, -half, -half),
    ];
    const ring = [...corners, corners[0]].map((p) => [p.lng, p.lat]);
    return {
      type: 'Feature',
      properties: {
        cellId: n.id,
        elevationM: n.elevationM,
        dominantLandUse: Object.entries(n.landUseAreas).sort((a, b) => b[1] - a[1])[0]?.[0],
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
  });
  return { type: 'FeatureCollection', features };
}

/**
 * Doppler Weather Radar mock feed: a 0-3hr nowcast at 15-min resolution
 * shaped as a gamma-like hyetograph (slow build, sharp cloudburst peak,
 * tapering tail) typical of a Mumbai monsoon convective cell, jittered
 * with seeded noise so it isn't a perfectly smooth curve.
 */
export function generateDopplerNowcast(seed = 26085, peakIntensityMmHr = 108) {
  const rand = mulberry32(seed + 1);
  const steps = 12; // 12 x 15min = 180min = 3hr
  const shape = 3.2; // gamma shape: controls how peaked the storm is
  const peakStep = 4.5; // storm peaks ~67 min in

  const series = [];
  for (let i = 1; i <= steps; i++) {
    const t = i; // in 15-min units
    const gamma = Math.pow(t / peakStep, shape) * Math.exp(-shape * (t / peakStep - 1));
    const jitter = randRange(rand, -6, 6);
    const intensity = Math.max(0, Math.min(120, gamma * peakIntensityMmHr + jitter));
    series.push({ tMinutes: i * 15, intensityMmPerHr: +intensity.toFixed(1) });
  }
  return series;
}

export function generateMockZoneDataset(seed = 26085) {
  const rand = mulberry32(seed);
  const { nodes, edges, minElevId } = buildDrainageNetworkData(rand);
  const streetGrid = buildStreetGrid(nodes, rand);
  const demGrid = buildDemGrid(nodes);
  const radarSeries = generateDopplerNowcast(seed);

  return {
    meta: ZONE_META,
    streetGrid,
    demGrid,
    drainageNetwork: { nodes, edges },
    outfallNodeId: minElevId,
    radarSeries,
  };
}
