# AQUA-CAST
Urban Flood Nowcasting System — Smart India Hackathon, Problem Statement 26085.

An enterprise-grade, real-time flood nowcasting and pre-flood action platform for a
chronic-waterlogging Indian metro block. The entire hydrology → hydraulics →
routing → citizen-action pipeline runs client-side in the browser against a seeded
mock dataset, so it is fully demonstrable offline with no backend.

## What's new in this release
This upgrade retains the original hydraulic/mathematical core untouched and adds a
full pre-flood citizen & municipal action layer, historical storm resiliency
testing, a live radar proxy, a desilting planner, crowdsourced hazard reporting,
and a light/dark enterprise theme — all wired into a single cohesive dashboard.

---

## 1. Requirements
- Node.js 18+ and npm

## 2. Install
```bash
cd aqua-cast
npm install
```
No `.env` file is required for this step — see the fallback architecture
section below. If you want to try any live data source, copy the template
first:
```bash
cp .env.example .env
```

## 3. Run the dev server
```bash
npm run dev
```
Then open the URL Vite prints (default `http://localhost:5173`). Hot-reloads on save.

## 4. Build for production
```bash
npm run build
```
Outputs a static bundle to `dist/`. Preview it locally with:
```bash
npm run preview
```

## 5. Deploy
`dist/` is a plain static site — drop it on any static host:
- **Vercel / Netlify**: connect the repo, build command `npm run build`, output directory `dist`.
- **GitHub Pages**: push `dist/` to a `gh-pages` branch, or use an action that runs the build command above.
- **Any static file server / S3 + CloudFront**: upload the contents of `dist/` directly.

No backend or environment variables are required.

---

## Bulletproof 2-layer live-API fallback architecture
AQUA-CAST is designed to survive a live demo with zero setup and zero risk
of a broken tile, a blank map, or a red console error — whether that's
because no `.env` was ever created, a key is wrong, or the venue wifi drops
mid-pitch.

**Layer 1 — real, free, no-key-required APIs (attempted only if configured):**
| Source | Provider | What it adds |
|---|---|---|
| Live weather radar imagery | [RainViewer](https://rainviewer.com) (free, no key) | A real global radar tile overlay on the map |
| Live rainfall intensity | [OpenWeatherMap](https://openweathermap.org/api) (free key) | A genuine "Live: X mm/hr" reading in the top bar |
| Real-road GPS reference route | [OSRM](https://project-osrm.org) public demo server (no key) | A dashed "what a normal GPS would say" overlay for comparison |
| Base map tiles | OpenStreetMap / CartoDB Voyager raster tiles (free, no key) | The map backdrop itself |

**Layer 2 — automatic local fallback (always available, zero network):**
Every one of AQUA-CAST's actual flood-risk calculations — the map's colored
nodes, the depth-by-street data, the flood-aware routing, the desilting
priority list, the ward risk bulletin — comes from the app's own built-in
hydrology/hydraulics engine and its simulated radar mosaic
(`src/lib/radarProxy.js`), **never from a live API**. The live sources above
are purely additive realism layers on top of that core, which is why losing
all of them changes nothing about whether the demo works.

**How the fallback actually triggers**, in `src/services/`:
1. **`env.js`** — the single source of truth for what's configured. If a key
   is missing or the master switch (`VITE_USE_LIVE_APIS=false`) is off, the
   relevant service *never even attempts a network call* — no latency cost,
   no failed-request noise.
2. **`fetchWithTimeout.js`** — every live call goes through here, wrapped in
   an `AbortController` with a hard timeout (`VITE_API_TIMEOUT_MS`, default
   4s). A slow or dead API can never hang the UI.
3. **`radarFeedService.js` / `weatherService.js` / `routingService.js`** —
   each one catches every possible failure (network error, timeout, bad
   response shape) internally and resolves to `null` rather than throwing.
   Callers treat `null` as "use the simulation," and nothing propagates as
   an uncaught error. Failures log at `console.info`, never `console.error`.
4. **`MapPanel.jsx`** additionally listens for Leaflet's `tileerror` event
   on the live radar layer — so even if the RainViewer *metadata* call
   succeeds but the *tile images* themselves fail mid-demo (CDN blocked,
   rate-limited), it flips back to the simulated mosaic instantly, in the
   same visual slot, with no broken image ever shown.
5. **`DataSourceBadge.jsx`** — a small, always-visible transparency panel on
   the map showing whether each source is currently Live, Simulated, or Not
   configured. This is a deliberate design choice: a bulletproof fallback is
   worth showing off, not hiding.

**The upshot:** `npm install && npm run dev` with zero `.env` file produces
the exact same fully-functional demo as a fully-configured one — the
`DataSourceBadge` will just read "Simulated" instead of "Live" everywhere,
and the underlying flood math is identical either way.

---

---

## Multilingual AI Voice Navigation Assistant
A hands-free voice layer for exactly the moment a dashboard becomes unsafe
to read: driving or walking through heavy monsoon rain.

- **Zero external cost**: built entirely on the browser's native
  `window.speechSynthesis` (Web Speech API) — no paid TTS service, no API
  key, no network call. Voice quality depends on whichever language voices
  the user's OS/browser ships with; the engine automatically picks the best
  available match for each language and falls back gracefully if a
  specific regional voice isn't installed (see `getBestVoiceForLang` in
  `src/services/voiceService.js`).
- **Languages**: English (`en-IN`), Hindi (`hi-IN`), Marathi (`mr-IN`) — a
  language selector and a pulsing speak/stop toggle live permanently in the
  top bar (`VoiceAssistant.jsx`), and the choice persists across sessions.
- **Two ways to trigger an advisory**:
  1. **Route advisory** — the top-bar toggle speaks the current flood-aware
     route's travel time, distance, and how many intersections were routed
     around due to deep water, in the selected language.
  2. **Tap-to-speak on the map** — tapping any drainage node, shelter, or
     citizen hazard report in `MapPanel.jsx` speaks that specific location's
     **3-hour predicted peak water depth** (not just the current instant),
     scanning forward across the remaining nowcast timeline exactly like the
     ward-level bulletin does.
- **Resilience**: every speech call is wrapped so an unsupported browser,
  a muted device, or a missing voice never breaks the main UI or the
  simulation loop — `isSpeechSupported()` gates the whole feature, and any
  playback error degrades to a small inline message rather than a crash.
  Speech is always cancelled before a new utterance starts, so tapping
  several markers in a row never queues up overlapping audio.

---

## Project layout
```
src/
  lib/          hydrology.js, hydraulics.js, network.js, coupling.js,
                 simulation.js, routing.js — the original computational core
                 stormPresets.js   — historical/design-storm hyetograph generator
                 radarProxy.js     — Marshall-Palmer dBZ <-> mm/hr + live radar mosaic
                 maintenance.js    — desilting priority ranking engine
                 actionCenter.js   — ward risk bulletin + mock alert broadcast
  data/         mockMetroZone.js  — the demo dataset (nodes, pipes, DEM, radar feed)
                 shelters.js       — shelter / high-ground dataset + nearest-node lookup
                 rng.js            — deterministic seeded PRNG
  components/   TopBar, MetricsPanel, MapPanel, ControlPanel, RoutingPanel,
                 MaintenancePanel, ActionCenterModal, HazardReportDrawer,
                 RouteComparisonDrawer, ThemeToggle, ErrorBoundary
```

---

## Feature guide & mathematical basis

### Core engine (unchanged)
- **Hydrology** (`lib/hydrology.js`): Rational Method, `Q = C*I*A / 360`, for
  catchment runoff from a land-use-weighted composite coefficient.
- **Hydraulics** (`lib/hydraulics.js`): Manning's Equation for circular-pipe
  conveyance, `Q = (1/n)*A*R^(2/3)*S^(1/2)`, with silt blockage modeled as an
  equivalent narrowed bore and a bisection solver for partial-flow depth.
- **Network/coupling** (`lib/network.js`, `lib/coupling.js`): a directed
  drainage graph processed in topological order each 15-min timestep, tracking
  standing (unconveyed) volume at every node and converting it to street
  inundation depth (cm) via a local ponding-footprint assumption.
- **Routing** (`lib/routing.js`): Dijkstra over the street grid with a
  depth-dependent edge-weight penalty, comparing a naive Standard Route against
  a Flood-Aware Safe Route per vehicle class (commuter vs. emergency).

### 1. Pre-Flood Citizen & Municipal Action Center
- **Ward risk bulletin** (`lib/actionCenter.js`): the 6x6 node grid is split
  into four quadrant wards. For each ward, the engine scans the *entire
  remaining* 0-3hr nowcast window from the current timestep forward and reports
  current severity, peak severity, and **estimated time-to-critical** — the
  actual planning question a disaster-management officer needs answered.
  Population estimates use an illustrative planning density
  (220 persons/ha) applied to each ward's summed catchment area — not a
  surveyed census figure.
- **Send WhatsApp/SMS Alert Broadcast**: a mock disaster-management gateway
  call (`triggerAlertBroadcast`) that simulates network latency and returns a
  delivery receipt (households reached, wards notified, timestamp), so the
  full broadcast flow is demonstrable end-to-end without a real SMS/WhatsApp
  Business API key.
- **Safe Shelter & High-Ground Guidance** (`data/shelters.js` +
  `lib/routing.js`): three municipal shelter facilities plus the three
  highest-elevation drainage nodes (informal high-ground points) are attached
  to the routable street graph via a last-mile straight-line edge. "Route to
  nearest shelter" ranks every shelter by *flood-safe walking time*
  (pedestrian block threshold: 30cm, caution penalty above 15cm, walk speed
  4.5 km/h) from the selected origin.

### 2. Advanced Interactive Simulation & GIS Tools
- **Historical Storm Presets** (`lib/stormPresets.js`): reparameterizes the
  same gamma-hyetograph generator used for the live feed with peak
  intensity/timing/shape representative of Mumbai's 26 July 2005 deluge,
  Chennai's 2015 cloudburst, and the IMD "extremely heavy rainfall" design
  benchmark. The Mumbai 2005 preset additionally applies a **tidal
  backpressure** effect — extra silt-equivalent blockage on every pipe
  draining into the outfall — modeling how the real event's high astronomical
  tide locked the storm drains shut for hours, independent of pipe condition.
- **Dual-View Route Comparison Drawer** (`RouteComparisonDrawer.jsx`): a
  side-by-side breakdown of the Standard Shortest Path against the
  Flood-Aware Safe Route, listing every intersection crossed with
  color-coded flood severity and the net time delta.

### 3. "Quill & Code" innovations
- **Pre-Monsoon Silt & Asset Maintenance Planner** (`lib/maintenance.js`):
  ranks every pipe by a transparent, explainable **Desilting Priority score**
  = 40% surveyed silt condition + 40% observed surcharge frequency under the
  *current* simulated storm + 20% downstream network impact (BFS descendant
  count toward the outfall). Pipes are tiered Urgent / Priority / Routine so a
  municipality can schedule pre-monsoon cleaning where it actually reduces
  risk, instead of a fixed calendar rotation.
- **Citizen Crowdsourced Hazard Reporting Feed** (`HazardReportDrawer.jsx`):
  a lightweight slide-out form (location, depth estimate, simulated photo
  upload, note) that drops a live pin on the map canvas immediately —
  demonstrating the citizen-reporting workflow end-to-end in the browser
  session.
- **Live Weather Radar Proxy Engine** (`lib/radarProxy.js`): converts between
  reflectivity (dBZ) and rainfall rate via the classic Marshall-Palmer
  relation `Z = 200*R^1.6`, `dBZ = 10*log10(Z)`, and simulates a
  spatially-varying reflectivity mosaic across the zone's DEM cells each
  timestep (dense core, softer fringe) — giving the dashboard a genuine "live
  radar" operational feel, toggleable from the map's layer controls.

### 4. UI & performance
- **Light/Dark theme toggle** in the top navigation bar, persisted to
  `localStorage` and respecting the OS color-scheme preference on first load.
  Implemented via Tailwind's `class`-strategy dark mode — no runtime CSS
  recalculation cost, and Leaflet's map chrome (popups, zoom controls,
  attribution) gets matching dark-theme overrides.
- All new features are pure functions or small, independently memoized
  components; the what-if sliders, storm presets, and theme toggle all update
  through the same `computeSimulation` pipeline so state stays consistent
  across every panel without redundant recomputation.

---

## Swapping in real data
Everything downstream of `generateMockZoneDataset()` only expects the shape
documented at the top of `src/data/mockMetroZone.js` (streetGrid GeoJSON,
demGrid GeoJSON, `{ nodes, edges }` drainage network, radarSeries array).
Replace that one function's output — e.g. with a real Doppler radar API feed
and a surveyed drainage-network export — and the hydrology, hydraulics,
coupling, routing, maintenance, and action-center layers work unchanged.
Similarly, `generateShelters()` in `src/data/shelters.js` can be swapped for a
real municipal shelter registry, and `triggerAlertBroadcast()` in
`src/lib/actionCenter.js` is the single integration point for a real
WhatsApp Business API / SMS gateway (e.g. Twilio, or India's NDMA Common
Alerting Protocol feed).
