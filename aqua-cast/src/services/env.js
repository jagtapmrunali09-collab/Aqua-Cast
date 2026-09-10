/**
 * env.js
 * Single source of truth for which live data sources are actually
 * usable in this deployment. Every service module below checks this
 * BEFORE attempting a network call — if a key is missing or a live
 * source is explicitly disabled, we never even attempt the fetch,
 * which means no failed-request noise and no latency cost during the
 * demo. This is Layer 1 of the fallback design: "don't call an API
 * you know is unconfigured."
 *
 * All variables are read through Vite's import.meta.env, which only
 * exposes vars prefixed VITE_ to client code. Every one of them is
 * OPTIONAL — an .env file is never required for the app to run.
 */

const env = import.meta.env ?? {};

export const CONFIG = {
  // Master switch — flip to 'false' to force the entire app into pure
  // offline-simulation mode regardless of what keys are present. Useful
  // for a venue with flaky wifi: guarantees zero network calls.
  useLiveApis: (env.VITE_USE_LIVE_APIS ?? 'true') !== 'false',

  openWeatherApiKey: env.VITE_OPENWEATHER_API_KEY || '',
  rainviewerEnabled: (env.VITE_RAINVIEWER_ENABLED ?? 'true') !== 'false',
  osrmBaseUrl: env.VITE_OSRM_BASE_URL || 'https://router.project-osrm.org',

  // Network calls get a hard timeout so a slow/dead API can never hang
  // the UI — we'd rather fall back a beat early than freeze a live demo.
  fetchTimeoutMs: Number(env.VITE_API_TIMEOUT_MS) || 4000,
};

export const hasOpenWeatherKey = () => CONFIG.useLiveApis && CONFIG.openWeatherApiKey.length > 0;
export const canUseRainviewer = () => CONFIG.useLiveApis && CONFIG.rainviewerEnabled;
export const canUseOsrm = () => CONFIG.useLiveApis;
