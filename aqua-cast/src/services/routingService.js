/**
 * routingService.js
 * OSRM (Open Source Routing Machine) integration — the free public demo
 * server at router.project-osrm.org, no API key required.
 *
 * IMPORTANT ARCHITECTURAL NOTE: OSRM routes over the REAL, physical road
 * network using REAL road geometry. Our core flood-aware routing
 * decision (which street floods, which doesn't, and the resulting
 * safe-vs-standard path) has to run over AQUA-CAST's own synthetic
 * street graph, because that's the only graph our hydraulics model
 * actually attaches live depth data to — OSRM has no concept of "this
 * particular manhole is surcharging right now." So OSRM is layered in
 * as a REFERENCE overlay: "what would a normal GPS have told you,
 * ignoring the flood entirely" — a nice, real-world visual contrast to
 * our flood-aware route, not a replacement for it.
 *
 * FALLBACK CONTRACT: getOsrmReferenceRoute() resolves to a coordinate
 * array, or to `null`. The app's local Dijkstra-based routing
 * (lib/routing.js) is ALWAYS computed regardless of whether this
 * succeeds — it is the guaranteed, non-optional routing path. OSRM is
 * purely additive.
 */
import { fetchJsonWithTimeout } from './fetchWithTimeout.js';
import { CONFIG, canUseOsrm } from './env.js';

/**
 * @param {{lat:number, lng:number}} from
 * @param {{lat:number, lng:number}} to
 * @returns {Promise<Array<[number, number]> | null>} array of [lat, lng] pairs, or null
 */
export async function getOsrmReferenceRoute(from, to) {
  if (!canUseOsrm()) return null; // Layer 1: live APIs disabled — skip the network entirely

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${CONFIG.osrmBaseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    const data = await fetchJsonWithTimeout(url, { timeoutMs: CONFIG.fetchTimeoutMs });
    const geometry = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(geometry) || geometry.length === 0) {
      throw new Error('Unexpected OSRM response shape');
    }
    // OSRM returns [lng, lat] pairs (GeoJSON order) — flip to [lat, lng] for Leaflet.
    return geometry.map(([lng, lat]) => [lat, lng]);
  } catch (err) {
    // Layer 2: public demo server unreachable/rate-limited/offline — fall back silently.
    console.info('[AQUA-CAST] OSRM reference route unavailable, showing flood-aware route only.', err?.message);
    return null;
  }
}
