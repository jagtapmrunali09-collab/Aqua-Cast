/**
 * radarFeedService.js
 * Live Weather Radar integration — RainViewer (https://rainviewer.com).
 *
 * RainViewer's public metadata endpoint is free and requires no API key:
 * it returns a list of recent radar-frame timestamps and a tile-URL
 * template that serves real global radar imagery. This is layered
 * OPTIONALLY on top of AQUA-CAST's own simulated per-cell dBZ mosaic
 * (lib/radarProxy.js) — the simulated mosaic is what the flood-depth
 * MATH actually consumes (it needs a value on every one of our
 * synthetic DEM cells, which no public radar API can give us for an
 * imaginary demo neighborhood), while the RainViewer layer is a
 * genuine live "is it actually raining near here right now" overlay
 * for realism.
 *
 * FALLBACK CONTRACT: getLiveRadarFrames() either resolves with a usable
 * frame list, or resolves to `null`. It never throws past this module
 * and never blocks the caller — a null result means "use the local
 * simulation," full stop, with no visible error anywhere in the UI.
 */
import { fetchJsonWithTimeout } from './fetchWithTimeout.js';
import { CONFIG, canUseRainviewer } from './env.js';

const RAINVIEWER_META_URL = 'https://api.rainviewer.com/public/weather-maps.json';

let cachedFrames = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // radar frames refresh every ~10min upstream; 5min cache is plenty

/**
 * @returns {Promise<{host: string, frames: Array<{time:number, path:string}>} | null>}
 */
export async function getLiveRadarFrames() {
  if (!canUseRainviewer()) return null; // Layer 1: not configured/enabled — skip the network entirely

  const now = Date.now();
  if (cachedFrames && now < cacheExpiresAt) return cachedFrames;

  try {
    const data = await fetchJsonWithTimeout(RAINVIEWER_META_URL, { timeoutMs: CONFIG.fetchTimeoutMs });
    const pastFrames = data?.radar?.past;
    if (!Array.isArray(pastFrames) || pastFrames.length === 0 || !data.host) {
      throw new Error('Unexpected RainViewer response shape');
    }
    cachedFrames = { host: data.host, frames: pastFrames };
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedFrames;
  } catch (err) {
    // Layer 2: live source unreachable/malformed — fall back silently.
    console.info('[AQUA-CAST] Live radar feed unavailable, using simulated radar mosaic.', err?.message);
    return null;
  }
}

/** Builds a real Leaflet-compatible tile URL template for the most recent radar frame. */
export function buildRainviewerTileUrl(radarMeta, frameIndex = -1) {
  if (!radarMeta) return null;
  const frame = radarMeta.frames.at(frameIndex);
  if (!frame) return null;
  // size=256, color scheme 2 (Universal Blue), smoothing on, no snow overlay
  return `${radarMeta.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}
