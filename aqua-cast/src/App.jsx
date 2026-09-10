import { useEffect, useMemo, useState } from 'react';
import { Droplets, SlidersHorizontal, Route, Wrench } from 'lucide-react';
import { generateMockZoneDataset } from './data/mockMetroZone.js';
import { computeSimulation } from './lib/simulation.js';
import { buildStreetGraph, computeRoutes, attachShelterNodes, rankSheltersByAccess } from './lib/routing.js';
import { generateShelters } from './data/shelters.js';
import { getStormPreset, generateStormSeries } from './lib/stormPresets.js';
import { computeDesiltingPriority } from './lib/maintenance.js';
import { computeFloodBulletin } from './lib/actionCenter.js';
import { getLiveRadarFrames, buildRainviewerTileUrl } from './services/radarFeedService.js';
import { getLiveIntensity } from './services/weatherService.js';
import { getOsrmReferenceRoute } from './services/routingService.js';
import { hasOpenWeatherKey } from './services/env.js';
import TopBar from './components/TopBar.jsx';
import MetricsPanel from './components/MetricsPanel.jsx';
import MapPanel from './components/MapPanel.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import RoutingPanel from './components/RoutingPanel.jsx';
import MaintenancePanel from './components/MaintenancePanel.jsx';
import ActionCenterModal from './components/ActionCenterModal.jsx';
import HazardReportDrawer from './components/HazardReportDrawer.jsx';
import RouteComparisonDrawer from './components/RouteComparisonDrawer.jsx';
import DataSourceBadge from './components/DataSourceBadge.jsx';

const ZONE_SEED = 26085; // SIH problem statement ID, doubles as the dataset's fixed seed
const THEME_STORAGE_KEY = 'aqua-cast-theme';

const DEFAULT_SIM = { rainfallMultiplier: 1, siltScale: 1, pumpActivationPct: 0 };

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const dataset = useMemo(() => generateMockZoneDataset(ZONE_SEED), []);
  const streetGraph = useMemo(() => buildStreetGraph(dataset.streetGrid), [dataset]);
  const shelters = useMemo(() => generateShelters(dataset), [dataset]);
  const routableGraph = useMemo(
    () => attachShelterNodes(streetGraph, shelters, dataset.drainageNetwork.nodes),
    [streetGraph, shelters, dataset]
  );

  // --- Theme -------------------------------------------------------------
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // --- Core what-if simulation state -------------------------------------
  const [simParams, setSimParams] = useState(DEFAULT_SIM);
  const [stepIndex, setStepIndex] = useState(3); // start near the ramp-up, before the peak
  const [playing, setPlaying] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [rightTab, setRightTab] = useState('simulate');
  const [stormPresetId, setStormPresetId] = useState('live');

  const [vehicleClass, setVehicleClass] = useState('commuter');
  const [fromId, setFromId] = useState('N-0-0');
  const [toId, setToId] = useState('N-5-5');

  // --- New feature UI state -----------------------------------------------
  const [showBulletin, setShowBulletin] = useState(false);
  const [showHazardReport, setShowHazardReport] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [citizenReports, setCitizenReports] = useState([]);

  // --- Live API integrations, each with an automatic simulation fallback ---
  const [dataSourceStatus, setDataSourceStatus] = useState({
    radar: 'checking',
    weather: hasOpenWeatherKey() ? 'checking' : 'disabled',
    routing: 'checking',
  });
  const [liveRadarTileUrl, setLiveRadarTileUrl] = useState(null);
  const [liveIntensity, setLiveIntensity] = useState(null);
  const [osrmRoute, setOsrmRoute] = useState(null);

  // Live radar (RainViewer) — checked once on load. A null result means
  // "unreachable/not configured," and the map continues showing the
  // built-in simulated Doppler mosaic with zero visible disruption.
  useEffect(() => {
    let cancelled = false;
    getLiveRadarFrames().then((meta) => {
      if (cancelled) return;
      const tileUrl = buildRainviewerTileUrl(meta);
      setLiveRadarTileUrl(tileUrl);
      setDataSourceStatus((s) => ({ ...s, radar: tileUrl ? 'live' : 'simulated' }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live weather (OpenWeatherMap) — only attempted at all if a key is
  // configured; otherwise this resolves to null instantly and the badge
  // reads "Not configured" rather than "Simulated" (it was never tried).
  useEffect(() => {
    let cancelled = false;
    getLiveIntensity(dataset.meta.centerLat, dataset.meta.centerLng).then((result) => {
      if (cancelled) return;
      setLiveIntensity(result);
      if (hasOpenWeatherKey()) {
        setDataSourceStatus((s) => ({ ...s, weather: result ? 'live' : 'simulated' }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dataset]);

  const activeStormPreset = getStormPreset(stormPresetId);
  const radarSeriesOverride = useMemo(
    () => (stormPresetId === 'live' ? null : generateStormSeries(activeStormPreset, ZONE_SEED)),
    [stormPresetId, activeStormPreset]
  );

  const { timeline } = useMemo(
    () =>
      computeSimulation({
        dataset,
        ...simParams,
        radarSeriesOverride,
        tidalBackpressure: activeStormPreset.tidalBackpressure ?? false,
      }),
    [dataset, simParams, radarSeriesOverride, activeStormPreset]
  );

  useEffect(() => {
    if (!playing || timeline.length === 0) return undefined;
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1 >= timeline.length ? 0 : i + 1));
    }, 1200);
    return () => clearInterval(id);
  }, [playing, timeline.length]);

  // Edge case: dataset/simulation produced no usable timeline. Render a
  // clear message rather than crashing on timeline[stepIndex] below.
  if (timeline.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas dark:bg-slate-950 text-sm text-ink-muted dark:text-slate-400">
        No nowcast data available — the mock dataset or radar feed failed to load.
      </div>
    );
  }

  const step = timeline[Math.min(stepIndex, timeline.length - 1)];
  const hasCriticalNow = step.nodes.some((n) => n.severity === 'critical');

  const depthByNode = useMemo(() => new Map(step.nodes.map((n) => [n.node, n.depthCm])), [step]);
  const routeResult = useMemo(
    () => computeRoutes({ streetGraph: routableGraph, depthByNode, fromId, toId, vehicleClass }),
    [routableGraph, depthByNode, fromId, toId, vehicleClass]
  );

  // OSRM real-road reference route — purely additive/illustrative overlay.
  // The flood-aware routeResult above is ALWAYS computed locally and never
  // depends on this succeeding; OSRM only supplies a "what a normal GPS
  // would have said, ignoring the flood" comparison line when reachable.
  useEffect(() => {
    let cancelled = false;
    const allPoints = [...dataset.drainageNetwork.nodes, ...shelters];
    const fromPoint = allPoints.find((p) => p.id === fromId);
    const toPoint = allPoints.find((p) => p.id === toId);
    if (!fromPoint || !toPoint) return undefined;

    getOsrmReferenceRoute(
      { lat: fromPoint.lat, lng: fromPoint.lng },
      { lat: toPoint.lat, lng: toPoint.lng }
    ).then((coords) => {
      if (cancelled) return;
      setOsrmRoute(coords);
      setDataSourceStatus((s) => ({ ...s, routing: coords ? 'live' : 'simulated' }));
    });
    return () => {
      cancelled = true;
    };
  }, [dataset, shelters, fromId, toId]);

  const bulletin = useMemo(
    () => computeFloodBulletin({ dataset, timeline, stepIndex }),
    [dataset, timeline, stepIndex]
  );
  const maintenanceRanking = useMemo(
    () => computeDesiltingPriority({ dataset, timeline }),
    [dataset, timeline]
  );

  const handleRouteToNearestShelter = () => {
    const ranked = rankSheltersByAccess({ streetGraph: routableGraph, shelters, depthByNode, fromId });
    const best = ranked.find((r) => r.reachable);
    if (best) setToId(best.shelter.id);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-canvas dark:bg-slate-950 text-ink dark:text-slate-100">
      <TopBar
        radarSeries={timeline.map((s) => ({ tMinutes: s.tMinutes, intensityMmPerHr: s.intensityMmPerHr }))}
        stepIndex={stepIndex}
        onStepChange={(i) => {
          setPlaying(false);
          setStepIndex(i);
        }}
        currentIntensity={step.intensityMmPerHr}
        alertsEnabled={alertsEnabled}
        onToggleAlerts={() => setAlertsEnabled((v) => !v)}
        hasCriticalNow={hasCriticalNow}
        playing={playing}
        onTogglePlay={() => setPlaying((v) => !v)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onOpenBulletin={() => setShowBulletin(true)}
        onOpenHazardReport={() => setShowHazardReport(true)}
        liveIntensity={liveIntensity}
        routeResult={routeResult}
      />

      {alertsEnabled && hasCriticalNow && (
        <div className="flex shrink-0 items-center gap-2 bg-risk-critical/10 px-4 py-1.5 text-xs font-medium text-risk-critical">
          <Droplets className="h-3.5 w-3.5" />
          Critical street inundation (&gt;25cm) predicted at{' '}
          {step.nodes.filter((n) => n.severity === 'critical').length} location(s) —{' '}
          {dataset.meta.name}
          {activeStormPreset.id !== 'live' && <span> · replaying {activeStormPreset.shortName}</span>}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <MetricsPanel timeline={timeline} stepIndex={stepIndex} />

        <main className="relative min-w-0 flex-1">
          <MapPanel
            dataset={dataset}
            step={step}
            routeResult={rightTab === 'route' ? routeResult : null}
            theme={theme}
            shelters={shelters}
            citizenReports={citizenReports}
            liveRadarTileUrl={liveRadarTileUrl}
            osrmRoute={rightTab === 'route' ? osrmRoute : null}
            timeline={timeline}
            stepIndex={stepIndex}
          />
          <div className="pointer-events-none absolute left-3 top-3 z-[1000]">
            <DataSourceBadge
              radarStatus={dataSourceStatus.radar}
              weatherStatus={dataSourceStatus.weather}
              routingStatus={dataSourceStatus.routing}
            />
          </div>
        </main>


        <div className="flex shrink-0 flex-col border-l border-hairline dark:border-slate-800 bg-panel dark:bg-slate-900">
          <div className="flex border-b border-hairline dark:border-slate-800">
            <button
              onClick={() => setRightTab('simulate')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium ${
                rightTab === 'simulate' ? 'border-b-2 border-water-500 text-water-600 dark:text-water-300' : 'text-ink-faint dark:text-slate-500'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Simulate
            </button>
            <button
              onClick={() => setRightTab('route')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium ${
                rightTab === 'route' ? 'border-b-2 border-water-500 text-water-600 dark:text-water-300' : 'text-ink-faint dark:text-slate-500'
              }`}
            >
              <Route className="h-3.5 w-3.5" />
              Route
            </button>
            <button
              onClick={() => setRightTab('maintenance')}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium ${
                rightTab === 'maintenance' ? 'border-b-2 border-water-500 text-water-600 dark:text-water-300' : 'text-ink-faint dark:text-slate-500'
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              Maintain
            </button>
          </div>

          {rightTab === 'simulate' && (
            <ControlPanel
              simParams={simParams}
              onChange={setSimParams}
              stormPresetId={stormPresetId}
              onStormPresetChange={setStormPresetId}
            />
          )}
          {rightTab === 'route' && (
            <RoutingPanel
              nodeOptions={dataset.drainageNetwork.nodes}
              shelterOptions={shelters}
              fromId={fromId}
              toId={toId}
              onFromChange={setFromId}
              onToChange={setToId}
              vehicleClass={vehicleClass}
              onVehicleClassChange={setVehicleClass}
              result={routeResult}
              onRouteToNearestShelter={handleRouteToNearestShelter}
              onOpenComparison={() => setShowComparison(true)}
            />
          )}
          {rightTab === 'maintenance' && <MaintenancePanel ranked={maintenanceRanking} />}
        </div>
      </div>

      {showBulletin && <ActionCenterModal bulletin={bulletin} onClose={() => setShowBulletin(false)} />}
      {showHazardReport && (
        <HazardReportDrawer
          nodeOptions={dataset.drainageNetwork.nodes}
          onClose={() => setShowHazardReport(false)}
          onSubmit={(report) => setCitizenReports((reports) => [...reports, report])}
        />
      )}
      {showComparison && <RouteComparisonDrawer result={routeResult} onClose={() => setShowComparison(false)} />}
    </div>
  );
}
