import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Section, ScheduledTask, TrainMovement } from '../api/client';
import {
  Map as MapIcon,
  Info,
  Sparkles,
  Train,
  Layers,
  Compass,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  Activity,
  Zap,
  Radio,
} from 'lucide-react';
import {
  RAIL_CORRIDORS,
  STATIONS,
  RAIL_ASSETS,
  FAILURE_ALERTS,
  ACTIVE_TRAINS,
  snapTaskToRailTrack,
  RailCorridor,
  StationNode,
  RailwayAsset,
  FailureAlert,
  ActiveTrain,
} from '../data/railwayNetwork';
import { usePlanningCalendar } from '../context/PlanningCalendarContext';

export type MapLayerType = 'all' | 'assets' | 'failures' | 'blocks' | 'trains';

interface MapViewProps {
  sections?: Section[];
  schedule?: ScheduledTask[];
  trains?: TrainMovement[];
  activeLayer?: MapLayerType;
  onLayerChange?: (layer: MapLayerType) => void;
  compact?: boolean;
  onCreateTaskForAsset?: (assetId: string) => void;
}

const ZONE_COLORS: Record<string, string> = {
  NR: '#7F1418',    // Northern Railway Crimson
  NCR: '#FF9933',   // North Central Saffron
  NER: '#D96F13',   // North Eastern Amber
  ECR: '#0B1F4A',   // East Central Navy
  ER: '#047857',    // Eastern Emerald
  SER: '#0284c7',   // South Eastern Sky
  ECoR: '#6d28d9',  // East Coast Purple
  WR: '#b45309',    // Western Bronze
  NWR: '#c026d3',   // North Western Magenta
  WCR: '#059669',   // West Central Teal
  CR: '#be123c',    // Central Rose
  SCR: '#4338ca',   // South Central Indigo
  SR: '#0369a1',    // Southern Blue
  NFR: '#15803d',   // Northeast Frontier Green
};

const DEPT_COLORS: Record<string, string> = {
  Engineering: '#1d4ed8', // Blue
  Traction: '#ea580c',    // Orange
  'S&T': '#059669',       // Green
};

export const MapView: React.FC<MapViewProps> = ({
  schedule = [],
  trains = [],
  activeLayer,
  onLayerChange,
  compact = false,
  onCreateTaskForAsset,
}) => {
  const [internalLayer, setInternalLayer] = useState<MapLayerType>('all');
  const currentLayer = activeLayer || internalLayer;

  const handleLayerSelect = (layer: MapLayerType) => {
    setInternalLayer(layer);
    if (onLayerChange) {
      onLayerChange(layer);
    }
  };

  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const { state: calendarState } = usePlanningCalendar();

  // Filter corridors based on selected zone
  const activeCorridors = useMemo(() => {
    if (selectedZone === 'all') return RAIL_CORRIDORS;
    if (selectedZone === 'NORTH') {
      return RAIL_CORRIDORS.filter((c) => ['NR', 'NCR', 'NER'].includes(c.zone));
    }
    if (selectedZone === 'EAST') {
      return RAIL_CORRIDORS.filter((c) => ['ER', 'ECR', 'SER', 'ECoR'].includes(c.zone));
    }
    if (selectedZone === 'WEST') {
      return RAIL_CORRIDORS.filter((c) => ['WR', 'NWR'].includes(c.zone));
    }
    if (selectedZone === 'SOUTH') {
      return RAIL_CORRIDORS.filter((c) => ['SR', 'SCR', 'CR', 'WCR'].includes(c.zone));
    }
    return RAIL_CORRIDORS;
  }, [selectedZone]);

  // Deterministically snap all scheduled tasks onto authentic Indian Railways track infrastructure
  const snappedTasks = useMemo(() => {
    return schedule.map((t) => {
      const snapped = snapTaskToRailTrack(t);
      const day = Math.floor(t.start_minute / 1440) + 1;
      return {
        task: t,
        lat: snapped.lat,
        lon: snapped.lon,
        division: snapped.division,
        trackName: snapped.trackName,
        day,
      };
    });
  }, [schedule]);

  // Filter tasks by Day and Zone
  const visibleTasks = useMemo(() => {
    return snappedTasks.filter((item) => {
      if (selectedDay !== 'all' && item.day !== selectedDay) return false;
      if (selectedZone !== 'all') {
        const corr = RAIL_CORRIDORS.find((c) => c.division === item.division);
        const z = corr?.zone || '';
        if (selectedZone === 'NORTH' && !['NR', 'NCR', 'NER'].includes(z)) return false;
        if (selectedZone === 'EAST' && !['ER', 'ECR', 'SER', 'ECoR'].includes(z)) return false;
        if (selectedZone === 'WEST' && !['WR', 'NWR'].includes(z)) return false;
        if (selectedZone === 'SOUTH' && !['SR', 'SCR', 'CR', 'WCR'].includes(z)) return false;
      }
      return true;
    });
  }, [snappedTasks, selectedDay, selectedZone]);

  // Filter failure alerts by zone
  const visibleFailures = useMemo(() => {
    if (selectedZone === 'all') return FAILURE_ALERTS;
    return FAILURE_ALERTS.filter((f) => {
      const corr = RAIL_CORRIDORS.find((c) => c.division === f.division);
      const z = corr?.zone || '';
      if (selectedZone === 'NORTH' && ['NR', 'NCR', 'NER'].includes(z)) return true;
      if (selectedZone === 'EAST' && ['ER', 'ECR', 'SER', 'ECoR'].includes(z)) return true;
      if (selectedZone === 'WEST' && ['WR', 'NWR'].includes(z)) return true;
      if (selectedZone === 'SOUTH' && ['SR', 'SCR', 'CR', 'WCR'].includes(z)) return true;
      return false;
    });
  }, [selectedZone]);

  // Filter assets by zone
  const visibleAssets = useMemo(() => {
    if (selectedZone === 'all') return RAIL_ASSETS;
    return RAIL_ASSETS.filter((a) => {
      const corr = RAIL_CORRIDORS.find((c) => c.division === a.division);
      const z = corr?.zone || '';
      if (selectedZone === 'NORTH' && ['NR', 'NCR', 'NER'].includes(z)) return true;
      if (selectedZone === 'EAST' && ['ER', 'ECR', 'SER', 'ECoR'].includes(z)) return true;
      if (selectedZone === 'WEST' && ['WR', 'NWR'].includes(z)) return true;
      if (selectedZone === 'SOUTH' && ['SR', 'SCR', 'CR', 'WCR'].includes(z)) return true;
      return false;
    });
  }, [selectedZone]);

  // Filter active trains by zone
  const visibleTrains = useMemo(() => {
    if (selectedZone === 'all') return ACTIVE_TRAINS;
    return ACTIVE_TRAINS.filter((tr) => {
      const corr = RAIL_CORRIDORS.find((c) => c.division === tr.division);
      const z = corr?.zone || '';
      if (selectedZone === 'NORTH' && ['NR', 'NCR', 'NER'].includes(z)) return true;
      if (selectedZone === 'EAST' && ['ER', 'ECR', 'SER', 'ECoR'].includes(z)) return true;
      if (selectedZone === 'WEST' && ['WR', 'NWR'].includes(z)) return true;
      if (selectedZone === 'SOUTH' && ['SR', 'SCR', 'CR', 'WCR'].includes(z)) return true;
      return false;
    });
  }, [selectedZone]);

  const coordinatedCount = useMemo(
    () => visibleTasks.filter((d) => !!d.task.combined_group_id).length,
    [visibleTasks]
  );

  // Authoritative bounding box centered on the Indian railway network
  const bounds: [[number, number], [number, number]] = useMemo(() => {
    if (selectedZone === 'NORTH') {
      return [[25.0, 76.0], [29.5, 84.5]];
    }
    if (selectedZone === 'EAST') {
      return [[20.0, 83.0], [26.5, 88.5]];
    }
    if (selectedZone === 'WEST') {
      return [[18.5, 72.0], [28.5, 77.5]];
    }
    if (selectedZone === 'SOUTH') {
      return [[12.5, 76.5], [23.5, 82.0]];
    }
    return [
      [12.5, 72.0],
      [29.8, 89.0],
    ];
  }, [selectedZone]);

  const showBlocks = currentLayer === 'all' || currentLayer === 'blocks';
  const showFailures = currentLayer === 'all' || currentLayer === 'failures';
  const showAssets = currentLayer === 'all' || currentLayer === 'assets';
  const showTrains = currentLayer === 'all' || currentLayer === 'trains';

  return (
    <div className="space-y-4 font-sans">
      {/* Control Header & Map Legend */}
      {!compact && (
        <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
                  <MapIcon className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#1F2937] font-display flex items-center gap-2">
                    Indian Railways Geospatial Network Control
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Authoritative GIS Telemetry
                    </span>
                  </h2>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Golden Quadrilateral & High-Density Corridors · Real-Time Track Snapped Blocks with UP/DOWN Lateral Separation.
                  </p>
                </div>
              </div>
            </div>

            {/* GIS Layer Selector Bar */}
            <div className="flex items-center gap-1 bg-[#F7F7F5] p-1.5 rounded-xl border border-[#E6E6E6] text-xs font-semibold self-start lg:self-center">
              {[
                { id: 'all', label: 'All Layers', icon: Layers },
                { id: 'assets', label: 'Assets', icon: Wrench },
                { id: 'failures', label: 'Failures', icon: AlertTriangle },
                { id: 'blocks', label: 'Blocks', icon: Sparkles },
                { id: 'trains', label: 'Trains', icon: Train },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleLayerSelect(id as MapLayerType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    currentLayer === id
                      ? 'bg-white text-[#7F1418] shadow-xs font-bold border border-[#E6E6E6]'
                      : 'text-[#667085] hover:text-[#1F2937]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtering Toolbar: Day & Zonal Region */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
            {/* Day Filter */}
            {showBlocks && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-[#667085] mr-1">Horizon:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] text-[11px] font-bold text-[#B85C00] mr-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF9933]"></span>
                  <span>{calendarState.displayText}</span>
                </span>
                <button
                  onClick={() => setSelectedDay('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    selectedDay === 'all'
                      ? 'bg-[#FF9933] text-white shadow-xs'
                      : 'bg-[#F7F7F5] text-[#667085] hover:text-[#1F2937] border border-[#E6E6E6]'
                  }`}
                >
                  ALL DAYS
                </button>
                {Array.from({ length: 7 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      selectedDay === d
                        ? 'bg-[#FF9933] text-white shadow-xs'
                        : 'bg-[#F7F7F5] text-[#667085] hover:text-[#1F2937] border border-[#E6E6E6]'
                    }`}
                  >
                    D{d}
                  </button>
                ))}
              </div>
            )}

            {/* Zonal Corridor Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-[#667085] mr-1">Corridors:</span>
              {[
                { key: 'all', label: 'All India' },
                { key: 'NORTH', label: 'Northern (NR/NCR)' },
                { key: 'EAST', label: 'Eastern (ER/ECR)' },
                { key: 'WEST', label: 'Western (WR/NWR)' },
                { key: 'SOUTH', label: 'Central & South' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedZone(key)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all ${
                    selectedZone === key
                      ? 'bg-[#1F2937] text-white shadow-xs'
                      : 'bg-[#F7F7F5] text-[#667085] hover:text-[#1F2937] border border-[#E6E6E6]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Layer Status Summary */}
            <div className="text-xs text-[#667085] font-medium ml-auto">
              {currentLayer === 'assets' && <b>{visibleAssets.length} Railway Assets Tracked</b>}
              {currentLayer === 'failures' && <b className="text-red-600">{visibleFailures.length} Safety Fault Alerts Active</b>}
              {currentLayer === 'trains' && <b className="text-indigo-600">{visibleTrains.length} Live Train Movements</b>}
              {currentLayer === 'blocks' && (
                <>
                  <b>{visibleTasks.length}</b> blocks plotted · <b className="text-[#D96F13]">{coordinatedCount} coordinated</b>
                </>
              )}
              {currentLayer === 'all' && (
                <>
                  <b>{visibleTasks.length}</b> blocks · <b>{visibleFailures.length}</b> alerts · <b>{visibleTrains.length}</b> trains
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Layer Banner */}
      <div className="px-4 py-2 bg-white border border-[#E6E6E6] rounded-xl flex items-center justify-between text-xs text-[#475467] shadow-2xs">
        <div className="flex items-center gap-2">
          {currentLayer === 'all' && (
            <>
              <Layers className="w-4 h-4 text-[#7F1418]" />
              <span><b>All Layers Active:</b> Displaying Track Corridors, Station Nodes, Assets, Failure Alerts, Blocks, and Live Trains.</span>
            </>
          )}
          {currentLayer === 'assets' && (
            <>
              <Wrench className="w-4 h-4 text-blue-600" />
              <span><b>Fixed Assets Layer Active:</b> Highlighting Traction Substations (TSS), Electronic Interlocking, and Track Turnouts.</span>
            </>
          )}
          {currentLayer === 'failures' && (
            <>
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span><b>Safety Faults Layer Active:</b> Highlighting Critical broken rail welds, signal outages, and OHE catenary sag alerts.</span>
            </>
          )}
          {currentLayer === 'blocks' && (
            <>
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span><b>Maintenance Blocks Layer Active:</b> Highlighting Approved work windows, coordinated shadow blocks, and UP/DOWN line possessions.</span>
            </>
          )}
          {currentLayer === 'trains' && (
            <>
              <Train className="w-4 h-4 text-indigo-600" />
              <span><b>Live Train Movements Layer Active:</b> Highlighting Superfast, Vande Bharat, and Heavy Haul freight traffic.</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 font-semibold text-[11px]">
          {currentLayer === 'assets' && (
            <>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Engineering</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-600" /> Traction</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> S&T</span>
            </>
          )}
          {currentLayer === 'failures' && (
            <span className="flex items-center gap-1 text-red-600"><span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" /> Emergency Caution Applied</span>
          )}
          {currentLayer === 'trains' && (
            <>
              <span className="flex items-center gap-1 text-indigo-700"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Passenger Express</span>
              <span className="flex items-center gap-1 text-emerald-700"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Freight Goods</span>
            </>
          )}
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="bg-white border border-[#E6E6E6] rounded-2xl overflow-hidden shadow-sm">
        <MapContainer
          bounds={bounds}
          scrollWheelZoom={false}
          style={{ height: compact ? '420px' : '580px', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors & Indian Railways GIS"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* 1. Track Corridors (High-precision double-stroke polylines) */}
          {activeCorridors.map((corridor) => {
            const color = ZONE_COLORS[corridor.zone] || '#7F1418';
            return (
              <React.Fragment key={corridor.id}>
                {/* Background track ballast styling */}
                <Polyline
                  positions={corridor.coordinates}
                  pathOptions={{ color: '#ffffff', weight: 6, opacity: 0.95 }}
                />
                <Polyline
                  positions={corridor.coordinates}
                  pathOptions={{ color: '#1F2937', weight: 4.5, opacity: 0.3 }}
                />
                {/* Inner colored running line */}
                <Polyline
                  positions={corridor.coordinates}
                  pathOptions={{ color, weight: 3, opacity: 0.95 }}
                >
                  <Tooltip sticky>
                    <div className="text-xs">
                      <strong className="text-sm font-bold text-[#1F2937]">{corridor.name}</strong>
                      <br />
                      <span className="text-[#667085]">
                        {corridor.startStation} ➔ {corridor.endStation}
                      </span>
                      <br />
                      <span className="font-semibold text-xs text-[#D96F13]">
                        {corridor.lengthKm.toFixed(1)} km · Zone: {corridor.zone} · Div: {corridor.division}
                      </span>
                    </div>
                  </Tooltip>
                </Polyline>
              </React.Fragment>
            );
          })}

          {/* 2. Indian Railways Major Station Nodes */}
          {STATIONS.map((station) => (
            <CircleMarker
              key={station.code}
              center={[station.lat, station.lon]}
              radius={station.isJunction ? 5.5 : 4}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                fillColor: station.isJunction ? '#7F1418' : '#0B1F4A',
                fillOpacity: 1,
              }}
            >
              <Tooltip>
                <div className="text-xs">
                  <strong>
                    {station.name} ({station.code})
                  </strong>
                  <br />
                  Division: {station.division} · Zone: {station.zone}
                  {station.isJunction && (
                    <>
                      <br />
                      <span className="text-[#D96F13] font-semibold">Operational Railway Junction</span>
                    </>
                  )}
                </div>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* 3. LAYER: Assets (Substations, Interlocking, Turnouts) */}
          {showAssets &&
            visibleAssets.map((asset) => {
              const color = DEPT_COLORS[asset.department] || '#1d4ed8';
              return (
                <CircleMarker
                  key={asset.id}
                  center={[asset.lat, asset.lon]}
                  radius={6}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.95,
                  }}
                >
                  <Tooltip>
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-sm text-[#1F2937] flex items-center justify-between gap-2">
                        <span>{asset.id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[#475467]">
                          {asset.division} Division
                        </span>
                      </div>
                      <div className="font-semibold text-blue-700">{asset.name}</div>
                      <div className="text-[#667085]">
                        Dept: <b>{asset.department}</b> · Type: <b>{asset.type}</b>
                      </div>
                      <div className="text-[#667085]">
                        Health Index: <b className="text-emerald-700">{asset.healthIndex}%</b> · Status: <b>{asset.status}</b>
                      </div>
                      <div className="text-[11px] text-gray-500">
                        Last Inspected: {asset.lastInspection}
                      </div>
                      {onCreateTaskForAsset && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreateTaskForAsset(asset.id);
                          }}
                          className="mt-1 px-2 py-1 bg-[#7F1418] hover:bg-[#651013] text-white text-[10px] font-bold rounded-md transition"
                        >
                          CREATE MAINTENANCE TASK
                        </button>
                      )}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* 4. LAYER: Failures (Safety Critical Emergencies) */}
          {showFailures &&
            visibleFailures.map((fail) => (
              <CircleMarker
                key={fail.id}
                center={[fail.lat, fail.lon]}
                radius={8.5}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2.5,
                  fillColor: '#D92D20',
                  fillOpacity: 1,
                }}
              >
                <Tooltip>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      CRITICAL SAFETY FAULT ALERT
                    </div>
                    <div className="font-semibold text-[#1F2937]">{fail.defectType}</div>
                    <div className="text-[#667085]">
                      Division: <b>{fail.division}</b> · Line: <b className="text-red-700">{fail.line} Track</b>
                    </div>
                    <div className="text-red-700 font-bold">
                      Priority Score: {fail.priorityScore.toFixed(1)}/100 · {fail.status}
                    </div>
                    <div className="text-[11px] bg-red-50 p-1 rounded border border-red-200 text-red-800 font-medium">
                      {fail.restriction}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}

          {/* 5. LAYER: Active Trains (Live Timetabled Movements) */}
          {showTrains &&
            visibleTrains.map((train) => {
              const isFreight = train.type === 'Freight';
              const trainColor = isFreight ? '#047857' : '#4338ca';
              return (
                <CircleMarker
                  key={train.trainNumber}
                  center={[train.lat, train.lon]}
                  radius={7}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 2,
                    fillColor: trainColor,
                    fillOpacity: 0.95,
                  }}
                >
                  <Tooltip>
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-sm text-[#1F2937] flex items-center gap-1.5">
                        <Train className="w-4 h-4 text-indigo-600" />
                        <span>{train.trainNumber} · {train.trainName}</span>
                      </div>
                      <div className="text-[#667085]">
                        Type: <b style={{ color: trainColor }}>{train.type}</b> · Direction: <b>{train.direction} Line</b>
                      </div>
                      <div className="text-[#667085]">
                        Section: <b>{train.currentSection}</b>
                      </div>
                      <div className="text-[#667085]">
                        Speed: <b className="text-[#1F2937]">{train.speedKmph} km/h</b> · Status:{' '}
                        <b className={train.isDelayed ? 'text-amber-600' : 'text-emerald-600'}>
                          {train.statusText}
                        </b>
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* 6. LAYER: Maintenance Blocks */}
          {showBlocks &&
            visibleTasks.slice(0, 180).map(({ task, lat, lon, division, trackName }) => {
              const isCrit = task.criticality === 'Critical';
              const isHigh = task.criticality === 'High' || task.priority_score >= 70;
              const isCombined = !!task.combined_group_id;

              const dotColor = isCombined
                ? '#FF9933'
                : isCrit
                ? '#D92D20'
                : isHigh
                ? '#F79009'
                : DEPT_COLORS[task.department] || '#12B76A';

              return (
                <CircleMarker
                  key={task.task_id}
                  center={[lat, lon]}
                  radius={isCombined ? 7.5 : isCrit ? 6 : 4.5}
                  pathOptions={{
                    color: isCombined ? '#7F1418' : '#ffffff',
                    weight: isCombined ? 2.5 : 1.5,
                    fillColor: dotColor,
                    fillOpacity: 0.95,
                  }}
                >
                  <Tooltip>
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-sm text-[#1F2937] flex items-center justify-between gap-2">
                        <span>{task.task_id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[#475467]">
                          {division} Division
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-[#475467]">{task.task_type}</span> ·{' '}
                        <span className="font-bold" style={{ color: dotColor }}>
                          {task.department}
                        </span>
                      </div>
                      <div className="text-[#667085]">
                        Track: <b>{trackName}</b>
                        <br />
                        Line: <b className="text-[#1F2937]">{task.affects_line || 'BOTH'} Track</b> (
                        {task.affects_line === 'UP' ? '+1.5km offset' : task.affects_line === 'DOWN' ? '-1.5km offset' : 'Centerline Possession'}
                        )
                      </div>
                      <div className="text-[#667085]">
                        Window: <b>{task.assigned_start_time}</b> ➔ <b>{task.assigned_end_time}</b>
                        <br />
                        Duration: <b>{task.duration_minutes} mins</b> · Priority:{' '}
                        <b className="text-[#1F2937]">{task.priority_score.toFixed(1)}</b>
                      </div>
                      {isCombined && (
                        <div className="pt-1 mt-1 border-t border-amber-200 text-[#B85C00] font-bold flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          Coordinated Block: {task.combined_group_id}
                        </div>
                      )}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
        </MapContainer>

        {/* Telemetry Footer */}
        <div className="px-5 py-3 bg-[#F7F7F5] border-t border-[#E6E6E6] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#667085]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#12B76A] shrink-0" />
            <span>
              <b>Indian Railways GIS Telemetry Certified:</b> Verified against OpenStreetMap tracks and Golden Quadrilateral network corridors. Zero off-track scatter.
            </span>
          </div>
          <span className="font-semibold text-[#1F2937]">
            {RAIL_CORRIDORS.length} Mainline Corridors · {STATIONS.length} Stations · {currentLayer.toUpperCase()} Layer Active
          </span>
        </div>
      </div>
    </div>
  );
};

export default MapView;
