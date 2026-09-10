/**
 * weatherService.js
 * OpenWeatherMap integration — used, if a key is configured, to overlay
 * a genuine "live observed rainfall intensity" reading on top of
 * AQUA-CAST's own nowcast model. Without a key, this module is a no-op:
 * getLiveIntensity() resolves to `null` immediately, and every caller
 * treats `null` as "use the simulated intensity from the local
 * hyetograph generator," which is fully self-sufficient on its own.
 *
 * OpenWeatherMap's Current Weather API reports rain volume in mm over
 * the last 1h under `rain['1h']`, which we surface directly as mm/hr.
 */
import { fetchJsonWithTimeout } from './fetchWithTimeout.js';
import { CONFIG, hasOpenWeatherKey } from './env.js';

const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * @returns {Promise<{ intensityMmPerHr: number, observedAt: string, source: 'openweathermap' } | null>}
 */
export async function getLiveIntensity(lat, lng) {
  if (!hasOpenWeatherKey()) return null; // Layer 1: no key configured — never attempt the call

  const url = `${OWM_BASE_URL}?lat=${lat}&lon=${lng}&appid=${CONFIG.openWeatherApiKey}&units=metric`;

  try {
    const data = await fetchJsonWithTimeout(url, { timeoutMs: CONFIG.fetchTimeoutMs });
    const mmLastHour = data?.rain?.['1h'] ?? 0;
    return {
      intensityMmPerHr: mmLastHour,
      observedAt: new Date().toISOString(),
      source: 'openweathermap',
    };
  } catch (err) {
    // Layer 2: key present but request failed (bad key, quota, network) — fall back silently.
    console.info('[AQUA-CAST] Live weather feed unavailable, using simulated nowcast intensity.', err?.message);
    return null;
  }
}
