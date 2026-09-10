/**
 * shelters.js
 * Designated flood-shelter and safe high-ground dataset for the zone.
 *
 * Shelters are modeled as municipal facilities (schools, community
 * halls) sited just outside the flood bowl, at plausible walkable
 * offsets from the zone center. High-ground zones are derived directly
 * from the surveyed DEM: the highest-elevation manholes in the
 * drainage network double as informal safe-gathering points, which is
 * how citizens actually behave in a chronic-waterlogging block —
 * heading for the nearest high ground, not necessarily a signed
 * shelter.
 */
const METERS_PER_DEG_LAT = 111320;

function metersToLatLng(centerLat, centerLng, dNorthM, dEastM) {
  const dLat = dNorthM / METERS_PER_DEG_LAT;
  const dLng = dEastM / (METERS_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180));
  return { lat: centerLat + dLat, lng: centerLng + dLng };
}

const SHELTER_TEMPLATES = [
  { name: 'Municipal Corporation School Shelter', capacity: 450, offsetN: 260, offsetE: -210 },
  { name: 'Community Hall Relief Center', capacity: 220, offsetN: -240, offsetE: 250 },
  { name: 'Fire Station Staging Ground', capacity: 120, offsetN: 300, offsetE: 300 },
];

export function generateShelters(dataset) {
  const { centerLat, centerLng } = dataset.meta;
  const { nodes } = dataset.drainageNetwork;

  const shelters = SHELTER_TEMPLATES.map((t, i) => {
    const { lat, lng } = metersToLatLng(centerLat, centerLng, t.offsetN, t.offsetE);
    return {
      id: `SHELTER-${i + 1}`,
      type: 'shelter',
      name: t.name,
      capacity: t.capacity,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
    };
  });

  // Top-3 highest-elevation drainage nodes double as informal high-ground
  // gathering points — no dedicated facility, but demonstrably safe.
  const highGround = [...nodes]
    .sort((a, b) => b.elevationM - a.elevationM)
    .slice(0, 3)
    .map((n, i) => ({
      id: `HIGHGROUND-${i + 1}`,
      type: 'high_ground',
      name: `High Ground — near ${n.id}`,
      capacity: null,
      elevationM: n.elevationM,
      lat: n.lat,
      lng: n.lng,
      nearestNodeId: n.id,
    }));

  return [...shelters, ...highGround];
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

/** Nearest drainage/street-graph node to a shelter, for attaching it to the routable street graph. */
export function nearestStreetNodeId(shelter, nodes) {
  if (shelter.nearestNodeId) return shelter.nearestNodeId;
  let best = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    const d = haversineMeters(shelter.lat, shelter.lng, n.lat, n.lng);
    if (d < bestDist) {
      bestDist = d;
      best = n.id;
    }
  }
  return best;
}

export { haversineMeters };
