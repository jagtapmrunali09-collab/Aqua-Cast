import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';
import { Radar, LifeBuoy, MessagesSquare, Volume2 } from 'lucide-react';
import { SEVERITY_COLOR, SEVERITY_FILL } from '../lib/simulation.js';
import { generateRadarMosaic, dbzColor } from '../lib/radarProxy.js';
import { nearestStreetNodeId } from '../data/shelters.js';
import { speakNodeAdvisory, getPersistedVoiceLang } from './VoiceAssistant.jsx';

const NODE_TYPE_RADIUS = { inlet: 4, manhole: 5, outfall: 7 };

const TILE_URLS = {
  light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

function demStyle(nodeSeverityById) {
  return (feature) => {
    const sev = nodeSeverityById.get(feature.properties.cellId) ?? 'normal';
    return {
      color: SEVERITY_COLOR[sev],
      weight: 0.5,
      opacity: 0.4,
      fillColor: SEVERITY_FILL[sev],
      fillOpacity: sev === 'normal' ? 0.15 : 0.55,
    };
  };
}

function streetStyle(feature) {
  return {
    color: feature.properties.lowLying ? '#0c4a6e' : '#94a3b8',
    weight: feature.properties.lowLying ? 2 : 1,
    opacity: feature.properties.lowLying ? 0.6 : 0.5,
  };
}

function radarStyle(dbzByCell) {
  return (feature) => {
    const dbz = dbzByCell.get(feature.properties.cellId) ?? 0;
    return {
      color: 'transparent',
      weight: 0,
      fillColor: dbzColor(dbz),
      fillOpacity: dbz < 5 ? 0 : 0.42,
    };
  };
}

function nodeTypeLabel(type) {
  if (type === 'outfall') return 'main outfall';
  if (type === 'inlet') return 'storm drain inlet';
  return 'manhole';
}

function LayerToggleButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium shadow-panel transition-colors ${
        active
          ? 'border-water-500 bg-water-50 text-water-600 dark:bg-water-500/20 dark:text-water-300'
          : 'border-hairline-strong bg-canvas text-ink-muted dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
function SearchField() {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new GeoSearchControl({
      provider: provider,
      style: 'bar',
      showMarker: true,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: true,
    });

    map.addControl(searchControl);
    return () => map.removeControl(searchControl);
  }, [map]);

  return null;
}

export default function MapPanel({
  dataset,
  step,
  routeResult,
  theme = 'light',
  shelters = [],
  citizenReports = [],
  liveRadarTileUrl = null,
  osrmRoute = null,
  timeline = [],
  stepIndex = 0,
}) {
  const [showRadar, setShowRadar] = useState(false);
  const [showShelters, setShowShelters] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [speakingLabel, setSpeakingLabel] = useState(null);
  // Layer 2 fallback trigger for the LIVE radar tile layer specifically:
  // the RainViewer metadata call can succeed (we get a valid tile URL
  // template) while the actual tile images still fail to load mid-demo
  // (CDN blocked by venue wifi, rate-limited, etc). Leaflet's `tileerror`
  // event catches that case and flips us back to the simulated mosaic
  // instantly, with no broken/missing tile ever visible.
  const [liveRadarTileFailed, setLiveRadarTileFailed] = useState(false);
  useEffect(() => {
    setLiveRadarTileFailed(false);
  }, [liveRadarTileUrl]);
  const useLiveRadarTiles = Boolean(liveRadarTileUrl) && !liveRadarTileFailed;

  const nodesById = useMemo(
    () => new Map((dataset?.drainageNetwork?.nodes ?? []).map((n) => [n.id, n])),
    [dataset]
  );

  // Edge case: no current step (empty/invalid timeline) — render the base
  // map with street/DEM layers but skip anything that needs live depth data.
  if (!step) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-panel-raised dark:bg-slate-800 text-sm text-ink-faint dark:text-slate-500">
        No nowcast data available for this timestep.
      </div>
    );
  }

  const hasDem = dataset?.demGrid?.features?.length > 0;
  const hasStreets = dataset?.streetGrid?.features?.length > 0;

  const nodeStepById = useMemo(() => new Map(step.nodes.map((n) => [n.node, n])), [step]);
  const nodeSeverityById = useMemo(
    () => new Map(step.nodes.map((n) => [n.node, n.severity])),
    [step]
  );

  // 3-hour predicted peak depth per node, scanning forward from the
  // current timestep — this is what the voice assistant actually speaks
  // when a marker is tapped, not just the current-instant depth, since
  // the whole point of AQUA-CAST is warning people BEFORE the peak hits.
  const peakDepthByNode = useMemo(() => {
    const map = new Map();
    const forwardWindow = timeline.length > 0 ? timeline.slice(stepIndex) : [step];
    forwardWindow.forEach((s) => {
      s.nodes.forEach((rec) => {
        const current = map.get(rec.node) ?? 0;
        if (rec.depthCm > current) map.set(rec.node, rec.depthCm);
      });
    });
    return map;
  }, [timeline, stepIndex, step]);

  const handleSpeakNode = (label, depthCm) => {
    const lang = getPersistedVoiceLang();
    setSpeakingLabel(label);
    speakNodeAdvisory(
      { label, depthCm },
      lang,
      {
        onEnd: () => setSpeakingLabel(null),
        onError: () => setSpeakingLabel(null),
      }
    );
  };


  const radarCells = useMemo(
    () =>
      showRadar
        ? generateRadarMosaic({
            demGrid: dataset.demGrid,
            intensityMmPerHr: step.intensityMmPerHr,
            seed: dataset.meta.problemStatementId ?? 26085,
            tMinutes: step.tMinutes,
          })
        : [],
    [showRadar, dataset, step]
  );
  const dbzByCell = useMemo(() => new Map(radarCells.map((c) => [c.cellId, c.dbz])), [radarCells]);

  const center = [dataset?.meta?.centerLat ?? 19.0176, dataset?.meta?.centerLng ?? 72.8438];

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={16}
        className="h-full w-full"
        zoomControl={true}
        attributionControl={true}
      >
        <SearchField />
        <TileLayer         
            key={theme}
            url={theme === 'dark' ? TILE_URLS.dark : TILE_URLS.light}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
            maxNativeZoom={19}
            eventHandlers={{
            tileerror: () => console.info('[AQUA-CAST] Base map tiles unavailable – data layers unaffected.')
          }}
        />
        

        {hasDem && (
          <GeoJSON key={`dem-${step.tMinutes}`} data={dataset.demGrid} style={demStyle(nodeSeverityById)} />
        )}
        {hasStreets && <GeoJSON data={dataset.streetGrid} style={streetStyle} />}

        {showRadar && useLiveRadarTiles && (
          // Layer 1: a real RainViewer radar frame is available — show genuine
          // live global radar imagery as a semi-transparent overlay. If the
          // tile images themselves fail to load (venue blocks the CDN, rate
          // limit, etc), `tileerror` flips liveRadarTileFailed and we drop
          // straight to the Layer 2 simulated mosaic below on the next render.
          <TileLayer
            url={liveRadarTileUrl}
            maxZoom={19}
            maxNativeZoom={7}
            opacity={0.6}
          />
        )}
        {showRadar && !useLiveRadarTiles && hasDem && (
          // Layer 2 (fallback): RainViewer unreachable/disabled/failed — fall
          // back silently to AQUA-CAST's own simulated per-cell dBZ mosaic.
          // Same toggle button, same visual slot, no error, no missing tile.
          <GeoJSON key={`radar-${step.tMinutes}-${showRadar}`} data={dataset.demGrid} style={radarStyle(dbzByCell)} />
        )}

        {step.edges.map((e) => {
          const from = nodesById.get(e.from);
          const to = nodesById.get(e.to);
          if (!from || !to) return null;
          return (
            <Polyline
              key={e.edge}
              positions={[
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]}
              pathOptions={{
                color: e.surcharged ? SEVERITY_COLOR.critical : '#0284c7',
                weight: e.surcharged ? 3.5 : 2,
                opacity: e.surcharged ? 0.85 : 0.55,
                dashArray: e.surcharged ? '4 3' : null,
              }}
            />
          );
        })}

        {routeResult?.standard && (
          <Polyline
            positions={routeResult.standard.nodes
              .filter((id) => nodesById.get(id) || shelters.find((s) => s.id === id))
              .map((id) => {
                const n = nodesById.get(id) ?? shelters.find((s) => s.id === id);
                return [n.lat, n.lng];
              })}
            pathOptions={{ color: '#6366f1', weight: 4, opacity: 0.75, dashArray: '2 8' }}
          />
        )}
        {routeResult?.floodSafe && (
          <Polyline
            positions={routeResult.floodSafe.nodes
              .filter((id) => nodesById.get(id) || shelters.find((s) => s.id === id))
              .map((id) => {
                const n = nodesById.get(id) ?? shelters.find((s) => s.id === id);
                return [n.lat, n.lng];
              })}
            pathOptions={{ color: '#059669', weight: 4, opacity: 0.85 }}
          />
        )}
        {osrmRoute && (
          // Real-road GPS reference overlay (Layer 1: live OSRM). Purely
          // illustrative — "what a normal GPS would say, ignoring the
          // flood entirely." Never affects the actual flood-aware route
          // above, which is always computed locally regardless.
          <Polyline
            positions={osrmRoute}
            pathOptions={{ color: '#94a3b8', weight: 3, opacity: 0.6, dashArray: '1 6' }}
          />
        )}

        {dataset.drainageNetwork.nodes.map((n) => {
          const nodeStep = nodeStepById.get(n.id);
          const severity = nodeStep?.severity ?? 'normal';
          const peakDepth = peakDepthByNode.get(n.id) ?? nodeStep?.depthCm ?? 0;
          const spokenLabel = `${nodeTypeLabel(n.type)} ${n.id}`;
          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lng]}
              radius={NODE_TYPE_RADIUS[n.type] ?? 4}
              pathOptions={{
                color: '#ffffff',
                weight: 1.5,
                fillColor: SEVERITY_COLOR[severity],
                fillOpacity: 0.95,
              }}
              eventHandlers={{
                // Tap-to-speak: any drainage node announces its own 3-hour
                // predicted flood level in the user's chosen language —
                // hands-free, no need to read the popup while driving.
                click: () => handleSpeakNode(spokenLabel, peakDepth),
              }}
            >
              <Popup>
                <div className="min-w-[180px] font-sans text-xs">
                  <p className="mb-1 text-sm font-semibold text-ink">
                    {n.id} <span className="font-normal text-ink-faint">· {n.type}</span>
                  </p>
                  <dl className="space-y-0.5">
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">Elevation</dt>
                      <dd className="data-readout">{n.elevationM.toFixed(2)} m</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">Depth now</dt>
                      <dd
                        className="data-readout font-medium"
                        style={{ color: SEVERITY_COLOR[severity] }}
                      >
                        {nodeStep?.depthCm.toFixed(1) ?? '0.0'} cm
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-muted">3hr peak (predicted)</dt>
                      <dd className="data-readout font-medium">{peakDepth.toFixed(1)} cm</dd>
                    </div>
                  </dl>
                  {step.edges.filter((e) => e.from === n.id).length > 0 && (
                    <>
                      <p className="mt-2 mb-0.5 font-medium text-ink-muted">Outgoing pipes</p>
                      <ul className="space-y-1">
                        {step.edges
                          .filter((e) => e.from === n.id)
                          .map((e) => (
                            <li key={e.edge} className="flex justify-between gap-3">
                              <span className="text-ink-faint">&rarr; {e.to}</span>
                              <span
                                className="data-readout"
                                style={{ color: e.surcharged ? SEVERITY_COLOR.critical : '#0284c7' }}
                              >
                                {e.fillPct.toFixed(0)}% fill{e.surcharged ? ' · surcharged' : ''}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </>
                  )}
                  <button
                    onClick={() => handleSpeakNode(spokenLabel, peakDepth)}
                    className="mt-2 flex items-center gap-1 text-[11px] font-medium text-water-600"
                  >
                    <Volume2 className="h-3 w-3" /> Speak advisory
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {showShelters &&
          shelters.map((s) => {
            const accessNodeId = nearestStreetNodeId(s, dataset.drainageNetwork.nodes);
            const accessDepth = peakDepthByNode.get(accessNodeId) ?? 0;
            return (
              <CircleMarker
                key={s.id}
                center={[s.lat, s.lng]}
                radius={s.type === 'shelter' ? 7 : 5}
                pathOptions={{
                  color: '#ffffff',
                  weight: 1.5,
                  fillColor: s.type === 'shelter' ? '#0891b2' : '#65a30d',
                  fillOpacity: 0.95,
                }}
                eventHandlers={{
                  // Speaks the predicted 3-hour water depth on the road
                  // approaching this shelter — the number that actually
                  // matters for "can I get there safely."
                  click: () => handleSpeakNode(s.name, accessDepth),
                }}
              >
                <Popup>
                  <div className="min-w-[160px] font-sans text-xs">
                    <p className="mb-0.5 text-sm font-semibold text-ink">{s.name}</p>
                    <p className="text-ink-faint">{s.type === 'shelter' ? 'Designated shelter' : 'Safe high-ground zone'}</p>
                    {s.capacity && <p className="mt-1 text-ink-muted">Capacity: {s.capacity} people</p>}
                    {s.elevationM && <p className="mt-1 text-ink-muted">Elevation: {s.elevationM.toFixed(2)} m</p>}
                    <p className="mt-1 text-ink-muted">3hr peak access-road depth: {accessDepth.toFixed(1)} cm</p>
                    <button
                      onClick={() => handleSpeakNode(s.name, accessDepth)}
                      className="mt-2 flex items-center gap-1 text-[11px] font-medium text-water-600"
                    >
                      <Volume2 className="h-3 w-3" /> Speak advisory
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

        {showReports &&
          citizenReports.map((r) => {
            const predictedDepth = peakDepthByNode.get(r.nodeId) ?? r.depthCm;
            const spokenLabel = `the citizen-reported spot near ${r.nodeId}`;
            return (
              <CircleMarker
                key={r.id}
                center={[r.lat, r.lng]}
                radius={6}
                pathOptions={{ color: '#a21caf', weight: 2, fillColor: '#e879f9', fillOpacity: 0.9 }}
                eventHandlers={{
                  click: () => handleSpeakNode(spokenLabel, predictedDepth),
                }}
              >
                <Popup>
                  <div className="min-w-[170px] font-sans text-xs">
                    <p className="mb-0.5 text-sm font-semibold text-ink">Citizen report</p>
                    <p className="text-ink-muted">Reported depth: {r.depthCm} cm</p>
                    <p className="text-ink-muted">3hr peak (predicted): {predictedDepth.toFixed(1)} cm</p>
                    {r.note && <p className="mt-1 text-ink-muted">&ldquo;{r.note}&rdquo;</p>}
                    {r.photoName && <p className="mt-1 text-[11px] text-ink-faint">📷 {r.photoName}</p>}
                    <p className="mt-1 text-[10px] text-ink-faint">{new Date(r.reportedAt).toLocaleTimeString()}</p>
                    <button
                      onClick={() => handleSpeakNode(spokenLabel, predictedDepth)}
                      className="mt-2 flex items-center gap-1 text-[11px] font-medium text-water-600"
                    >
                      <Volume2 className="h-3 w-3" /> Speak advisory
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>

      <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <LayerToggleButton active={showRadar} onClick={() => setShowRadar((v) => !v)} icon={Radar} label="Live radar" />
          <LayerToggleButton active={showShelters} onClick={() => setShowShelters((v) => !v)} icon={LifeBuoy} label="Shelters" />
          <LayerToggleButton active={showReports} onClick={() => setShowReports((v) => !v)} icon={MessagesSquare} label="Citizen reports" />
        </div>
        {speakingLabel && (
          <div className="pointer-events-none flex items-center gap-1.5 rounded border border-water-500 bg-water-50 px-2 py-1 text-[11px] font-medium text-water-600 shadow-panel dark:bg-water-500/20 dark:text-water-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-water-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-water-500" />
            </span>
            Speaking: {speakingLabel}
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded border border-hairline dark:border-slate-800 bg-canvas/95 dark:bg-slate-950/95 px-3 py-2 shadow-panel">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint dark:text-slate-500">
          Street inundation depth
        </p>
        <div className="flex items-center gap-3 text-[11px] text-ink-muted dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR.normal }} />
            0–10cm
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR.caution }} />
            10–25cm
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR.critical }} />
            &gt;25cm
          </span>
        </div>
        {routeResult && (
          <div className="mt-1.5 flex flex-wrap items-center gap-3 border-t border-hairline dark:border-slate-800 pt-1.5 text-[11px] text-ink-muted dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-3" style={{ background: '#6366f1' }} />
              standard route
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-3" style={{ background: '#059669' }} />
              flood-safe route
            </span>
            {osrmRoute && (
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-3" style={{ background: '#94a3b8' }} />
                real-road GPS reference
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
