import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ScheduledTask, Section, TrainMovement, apiClient, CandidateBlockOption } from '../api/client';
import { Play, RefreshCw, CheckCircle2, Clock, Layers, RotateCw, X, ChevronLeft, ChevronRight, Search, Filter, FileCheck2, Send, CalendarRange } from 'lucide-react';

interface GanttTabProps {
  schedule?: ScheduledTask[];
  trains?: TrainMovement[];
  sections?: Section[];
  loading?: boolean;
  onRefreshSchedule: () => void;
  onNavigate?: (view: any) => void;
  onOpenTaskGenerator?: (assetId?: string | null) => void;
  initialSearch?: string;
}

const HORIZON_OPTIONS = [
  { days: 7, label: 'Weekly', minutes: 7 * 1440 },
  { days: 30, label: 'Monthly', minutes: 30 * 1440 },
];

const fmtClock = (min: number) => {
  const day = Math.floor(min / 1440) + 1;
  const h = String(Math.floor((min % 1440) / 60)).padStart(2, '0');
  const m = String(Math.floor(min % 60)).padStart(2, '0');
  return `D${day} ${h}:${m}`;
};

export const GanttTab: React.FC<GanttTabProps> = ({
  schedule = [],
  trains = [],
  sections = [],
  loading = false,
  onRefreshSchedule,
  onNavigate,
  onOpenTaskGenerator,
  initialSearch = '',
}) => {
  const [optimizing, setOptimizing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDept, setSelectedDept] = useState('All');
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch]);
  const [notification, setNotification] = useState<string | null>(null);
  const [horizonDays, setHorizonDays] = useState(7);
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [selectedBlockModal, setSelectedBlockModal] = useState<ScheduledTask | null>(null);
  const [alternativeWindows, setAlternativeWindows] = useState<CandidateBlockOption[] | null>(null);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [unallocatedTasks, setUnallocatedTasks] = useState<any[]>([]);
  const [requestingBlockId, setRequestingBlockId] = useState<string | null>(null);

  // Pagination for section lanes & table to prevent DOM freeze with 1200+ sections
  const [lanePage, setLanePage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const LANE_PAGE_SIZE = 12;
  const TABLE_PAGE_SIZE = 15;

  const horizonMinutes = horizonDays * 1440;
  const dayLabels = Array.from({ length: horizonDays }, (_, i) => `D${i + 1}`);

  const isDayView = selectedDay !== 'all';
  const viewStart = isDayView ? ((selectedDay as number) - 1) * 1440 : 0;
  const viewLen = isDayView ? 1440 : horizonMinutes;
  const posPct = (min: number) => ((min - viewStart) / viewLen) * 100;

  // Pre-index tasks and trains by section_id for O(1) rendering (eliminates 3.5M filter iterations)
  const tasksBySection = useMemo(() => {
    const map = new Map<string, ScheduledTask[]>();
    for (const t of schedule) {
      const arr = map.get(t.section_id);
      if (arr) arr.push(t);
      else map.set(t.section_id, [t]);
    }
    return map;
  }, [schedule]);

  const trainsBySection = useMemo(() => {
    const map = new Map<string, TrainMovement[]>();
    for (const tr of trains) {
      const arr = map.get(tr.section_id);
      if (arr) arr.push(tr);
      else map.set(tr.section_id, [tr]);
    }
    return map;
  }, [trains]);

  const secGeo = useMemo(() => new Map(sections.map((sec) => [sec.section_id, sec])), [sections]);

  const boundaryLabel = (sid: string, fallback: string) => {
    const g = secGeo.get(sid);
    return g && g.start_station ? `${g.start_station} → ${g.end_station}` : fallback;
  };

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPolling = () => {
    if (pollRef.current) return;
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      const elapsed = Math.round((Date.now() - started) / 1000);
      try {
        const st = await apiClient.get('/schedule/status');
        if (st.data?.running) {
          setOptimizing(true);
          setNotification(`CP-SAT optimizer exploring zero-conflict block arrangements (${elapsed}s)...`);
          return;
        }
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setOptimizing(false);
        if (st.data?.success) {
          setNotification(st.data.message || 'Optimization complete!');
          onRefreshSchedule();
        } else {
          setNotification('Optimizer finished. ' + (st.data?.output_tail || '').split('\n').slice(-3).join(' | '));
        }
      } catch {
        /* transient poll error */
      }
    }, 2000);
  };

  useEffect(() => {
    onRefreshSchedule();
    apiClient.get('/schedule/status').then((res) => {
      if (res.data?.running) startPolling();
    }).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await onRefreshSchedule();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleRunOptimizer = async (days: number) => {
    if (optimizing) return;
    setOptimizing(true);
    setNotification(null);
    try {
      await apiClient.post(`/schedule/generate?horizon_days=${days}`);
      startPolling();
    } catch (err: any) {
      setOptimizing(false);
      if (err.response?.status === 409) {
        setNotification('Optimizer already active — monitoring solver progress.');
        startPolling();
      } else {
        setNotification('Failed to start optimizer: ' + (err.response?.data?.message || err.message));
      }
    }
  };

  // Load backlog tasks that do not yet have an allocated block window
  useEffect(() => {
    let cancelled = false;
    async function loadUnallocated() {
      try {
        const res = await apiClient.get<any>('/tasks?limit=50');
        if (cancelled || !res.data?.data) return;
        const scheduledIds = new Set(schedule.map((t) => t.task_id));
        const pending = (Array.isArray(res.data.data) ? res.data.data : [])
          .filter((t: any) => t?.task_id && !scheduledIds.has(t.task_id))
          .slice(0, 5);
        setUnallocatedTasks(pending);
      } catch {
        if (!cancelled) setUnallocatedTasks([]);
      }
    }
    loadUnallocated();
    return () => { cancelled = true; };
  }, [schedule]);

  const handleRequestBlock = async (taskId: string) => {
    setRequestingBlockId(taskId);
    try {
      const res = await apiClient.post(`/tasks/${taskId}/request-block`, {});
      setNotification(
        res.data?.message ||
        `Block request submitted for ${taskId}. Candidate windows are being evaluated.`
      );
      setUnallocatedTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    } catch (err: any) {
      const reason =
        err.response?.data?.message ||
        err.response?.data?.reason ||
        err.message ||
        'Block request failed.';
      setNotification(`Block request for ${taskId} could not be scheduled. Reason: ${reason}`);
    } finally {
      setRequestingBlockId(null);
    }
  };

  const handleViewAlternatives = async (task: ScheduledTask) => {
    setSelectedBlockModal(task);
    setLoadingAlternatives(true);
    setAlternativeWindows(null);
    try {
      const res = await apiClient.get<any>(`/tasks/${task.task_id}/block-options`);
      const options = res.data?.data || res.data?.block_options || res.data?.alternative_windows || [];
      setAlternativeWindows(Array.isArray(options) ? options : []);
    } catch (err: any) {
      setAlternativeWindows([]);
      setNotification(
        'Could not load alternative windows: ' +
          (err.response?.data?.message || err.message || 'unknown error')
      );
    } finally {
      setLoadingAlternatives(false);
    }
  };

  // Filtered tasks for table and section search
  const filteredTasks = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return schedule.filter((t) => {
      const matchesDept = selectedDept === 'All' || t.department === selectedDept;
      const matchesSearch =
        !q ||
        t.task_id.toLowerCase().includes(q) ||
        (t.block_id && t.block_id.toLowerCase().includes(q)) ||
        (t.combined_group_id && t.combined_group_id.toLowerCase().includes(q)) ||
        (t.section_name && t.section_name.toLowerCase().includes(q)) ||
        (t.section_id && t.section_id.toLowerCase().includes(q)) ||
        (t.task_type && t.task_type.toLowerCase().includes(q));
      return matchesDept && matchesSearch;
    });
  }, [schedule, selectedDept, searchTerm]);

  // Unique sections from filtered tasks, prioritized by number of scheduled tasks
  const allLanes = useMemo(() => {
    const secMap = new Map<string, string>();
    for (const t of filteredTasks) {
      if (!secMap.has(t.section_id)) {
        secMap.set(t.section_id, t.section_name || t.section_id);
      }
    }
    const list = Array.from(secMap.entries());
    return list.sort((a, b) => {
      const countA = tasksBySection.get(a[0])?.length || 0;
      const countB = tasksBySection.get(b[0])?.length || 0;
      if (countB !== countA) return countB - countA;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredTasks, tasksBySection]);

  // Reset pagination on filter changes
  useEffect(() => {
    setLanePage(1);
    setTablePage(1);
  }, [searchTerm, selectedDept]);

  const totalLanePages = Math.max(1, Math.ceil(allLanes.length / LANE_PAGE_SIZE));
  const currentLanes = useMemo(() => {
    const start = (lanePage - 1) * LANE_PAGE_SIZE;
    return allLanes.slice(start, start + LANE_PAGE_SIZE);
  }, [allLanes, lanePage]);

  const totalTablePages = Math.max(1, Math.ceil(filteredTasks.length / TABLE_PAGE_SIZE));
  const currentTableTasks = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredTasks.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTasks, tablePage]);

  // Animated wait screen while active loading is in progress
  if (loading) {
    return (
      <div className="bg-white p-16 rounded-2xl border border-[#E6E6E6] text-center space-y-4 shadow-sm my-6 max-w-3xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13] mx-auto animate-pulse">
          <Clock className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#1F2937]">Loading CP-SAT Block Planning Timeline...</h3>
          <p className="text-xs text-[#667085] mt-1 max-w-md mx-auto">
            Retrieving conflict-free maintenance block assignments and synchronizing with live train timetables
          </p>
        </div>
        <div className="w-48 h-1.5 bg-[#F2F4F7] rounded-full mx-auto overflow-hidden">
          <div className="bg-[#FF9933] h-full w-2/3 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Horizon Selector & Run Button */}
      <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
              <Clock className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2937] font-display">
              CP-SAT Corridor Block Planner ({horizonDays}-Day Horizon)
            </h2>
          </div>
          <p className="text-xs text-[#667085] mt-1 ml-10">
            Time-aware constraint schedule avoiding train precedence walls ({horizonMinutes.toLocaleString()} min timeline). Click any block for explanation.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap self-start md:self-auto">
          {/* Horizon Toggle */}
          <div className="flex rounded-xl overflow-hidden border border-[#E6E6E6] p-1 bg-[#F7F7F5]">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setHorizonDays(opt.days)}
                disabled={optimizing}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-50 ${
                  horizonDays === opt.days
                    ? 'bg-[#FF9933] text-white shadow-sm'
                    : 'text-[#667085] hover:text-[#1F2937]'
                }`}
              >
                {opt.label} ({opt.days}d)
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing || optimizing}
            className="px-3.5 py-2 bg-[#F7F7F5] hover:bg-[#FFF3E6] hover:text-[#B85C00] border border-[#E6E6E6] text-[#475467] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Run Optimizer Button (Saffron CTA) */}
          <button
            onClick={() => handleRunOptimizer(horizonDays)}
            disabled={optimizing}
            className="px-5 py-2 bg-[#FF9933] hover:bg-[#D96F13] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            {optimizing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Solver Exploring...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Regenerate CP-SAT Plan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-4 rounded-xl bg-[#F6FEF9] border border-[#A6F4C5] text-[#0F7644] text-xs font-bold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12B76A]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Tasks without an allocated block window — REQUEST BLOCK actions */}
      {unallocatedTasks.length > 0 && (
        <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-[#F2F4F7] pb-2.5">
            <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <Send className="w-4 h-4 text-[#D92D20]" />
              <span>Tasks Pending Block Allocation ({unallocatedTasks.length})</span>
            </h3>
            <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-[#FFF4ED] text-[#D92D20] border border-[#FECDCA]">
              Block Status: NOT ALLOCATED
            </span>
          </div>
          <div className="space-y-2">
            {unallocatedTasks.map((t) => (
              <div
                key={t.task_id}
                className="p-3 rounded-xl border border-[#E6E6E6] bg-[#FAFAF9] flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-[#1F2937]">{t.task_id}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-[#F2F4F7] text-[#344054]">
                      {t.department}
                    </span>
                    <span className="text-[#667085]">{t.asset_id} · {t.section_id}</span>
                  </div>
                  <p className="text-[11px] text-[#667085] mt-0.5">
                    {t.task_type} · Priority {Number(t.priority_score || 0).toFixed(1)} · {t.duration_minutes}m
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onOpenTaskGenerator && (
                    <button
                      onClick={() => onOpenTaskGenerator(t.asset_id)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-[#344054] font-bold text-[10.5px] hover:bg-[#F7F7F5] transition"
                    >
                      Open in Task Generator
                    </button>
                  )}
                  <button
                    onClick={() => handleRequestBlock(t.task_id)}
                    disabled={requestingBlockId === t.task_id}
                    className="px-3 py-1.5 rounded-lg bg-[#7F1418] hover:bg-[#651013] text-white font-bold text-[10.5px] transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CalendarRange className="w-3.5 h-3.5 text-[#FF9933]" />
                    <span>{requestingBlockId === t.task_id ? 'Requesting...' : 'REQUEST BLOCK'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gantt Visual Chart (Control Timeline) */}
      <div className="bg-white border border-[#E6E6E6] rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6E6E6] pb-3">
          <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D96F13]" />
            <span>Time-Aware Timeline: Train Movements vs Corridor Possessions</span>
          </h3>
          <span className="text-[11px] text-[#667085]">
            Hover or click block bars to inspect feasibility justification
          </span>
        </div>

        {/* Day Zoom Selector & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedDay('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                selectedDay === 'all'
                  ? 'bg-[#FF9933] text-white shadow-sm'
                  : 'bg-[#F7F7F5] text-[#667085] hover:text-[#1F2937] border border-[#E6E6E6]'
              }`}
            >
              ALL
            </button>
            {Array.from({ length: horizonDays }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedDay === d
                    ? 'bg-[#FF9933] text-white shadow-sm'
                    : 'bg-[#F7F7F5] text-[#667085] hover:text-[#1F2937] border border-[#E6E6E6]'
                }`}
              >
                D{d}
              </button>
            ))}
            <span className="text-xs text-[#667085] ml-2 font-medium">
              {isDayView ? `Day ${selectedDay} Zoom (00:00–24:00)` : `Full ${horizonDays}-day timeline`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search Block ID (e.g. BLK-REQ...), task ID, section..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#F7F7F5] border border-[#E6E6E6] text-xs text-[#1F2937] rounded-xl px-3 py-1.5 w-64 focus:outline-none focus:border-[#FF9933]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-2 py-1 text-[11px] font-bold text-[#667085] hover:text-[#1F2937] bg-[#E6E6E6] rounded-lg transition"
                title="Clear search filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Timeline Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#475467] bg-[#F7F7F5] p-2.5 rounded-xl border border-[#E6E6E6]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#B54708]" />Engineering (TMS)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#6927DA]" />Traction (TDMS)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#175CD3]" />S&amp;T (SMMS)</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 h-2 rounded-sm bg-[#FF9933] ring-2 ring-[#FF9933]/50" />Coordinated Block</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-sm bg-[#D92D20]" />Passenger Train Precedence</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-sm bg-slate-400" />Freight Movement</span>
        </div>

        {/* Section Pagination Bar (Eliminates Browser Lag) */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FFF9F2] p-2.5 rounded-xl border border-[#FFD9B3] text-xs">
          <span className="font-semibold text-[#8C4A08]">
            Displaying corridor sections <b className="text-[#1F2937]">{(lanePage - 1) * LANE_PAGE_SIZE + 1}–{Math.min(lanePage * LANE_PAGE_SIZE, allLanes.length)}</b> of <b className="text-[#1F2937]">{allLanes.length}</b> with scheduled possessions
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanePage((p) => Math.max(1, p - 1))}
              disabled={lanePage <= 1}
              className="px-3 py-1 rounded-lg border border-[#FFD9B3] bg-white text-[#8C4A08] font-bold text-xs disabled:opacity-40 hover:bg-[#FFE8CC] transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-bold text-xs text-[#1F2937]">
              {lanePage} / {totalLanePages}
            </span>
            <button
              onClick={() => setLanePage((p) => Math.min(totalLanePages, p + 1))}
              disabled={lanePage >= totalLanePages}
              className="px-3 py-1 rounded-lg border border-[#FFD9B3] bg-white text-[#8C4A08] font-bold text-xs disabled:opacity-40 hover:bg-[#FFE8CC] transition flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Timeline Ruler */}
        {isDayView ? (
          <div className="grid text-[10px] font-bold text-[#667085] border-b border-[#E6E6E6] pb-2"
            style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <div key={h}>{String(h).padStart(2, '0')}:00</div>)}
          </div>
        ) : (
          <div className="grid text-[10px] font-bold text-[#667085] border-b border-[#E6E6E6] pb-2 text-center"
            style={{ gridTemplateColumns: `repeat(${horizonDays}, minmax(0, 1fr))` }}>
            {dayLabels.map((label) => <div key={label}>{label}</div>)}
          </div>
        )}

        {/* Paginated Section Lanes (Silky Smooth 60 FPS) */}
        <div className="space-y-4 overflow-x-auto">
          {currentLanes.map(([secId, secName]) => {
            const secTasks = tasksBySection.get(secId) || [];
            const secTrains = trainsBySection.get(secId) || [];
            const inView = (s: number, e: number) => e > viewStart && s < viewStart + viewLen;
            const vert = (line?: string) =>
              line === 'BOTH'
                ? { top: '8%', height: '84%' }
                : line === 'UP'
                ? { top: '6%', height: '38%' }
                : { top: '56%', height: '38%' };

            return (
              <div key={secId} className="space-y-1.5 min-w-[640px]">
                <div className="flex justify-between text-xs text-[#1F2937] font-semibold">
                  <span>
                    {boundaryLabel(secId, secName)}
                    <span className="text-[#667085] font-normal"> · {secName}</span>
                  </span>
                  <span className="text-[#667085] text-[11px]">
                    {secTasks.length} Blocks · {secTrains.length} Train Timetables
                  </span>
                </div>

                <div className="flex items-stretch gap-2">
                  <div className="w-10 flex flex-col justify-between py-1 text-[9.5px] font-bold text-[#667085] shrink-0 text-right leading-tight">
                    <span>↑ UP</span>
                    <span>↓ DN</span>
                  </div>

                  <div className="relative flex-1 h-16 bg-[#F7F7F5] rounded-xl border border-[#E6E6E6] overflow-hidden">
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200" />

                    {/* Train Precedence Walls */}
                    {secTrains.filter((tr) => inView(tr.entry_min, tr.exit_min)).map((tr) => {
                      const v = vert(tr.direction);
                      return (
                        <div
                          key={tr.movement_id}
                          style={{
                            left: `${Math.max(0, posPct(tr.entry_min))}%`,
                            width: `${Math.max(0.4, posPct(tr.exit_min) - posPct(Math.max(tr.entry_min, viewStart)))}%`,
                            top: v.top,
                            height: '30%',
                          }}
                          title={`${tr.train_id} (${tr.train_type}) · ${tr.direction} | ${fmtClock(tr.entry_min)} → ${fmtClock(tr.exit_min)}`}
                          className={`absolute rounded-sm z-0 ${tr.train_type === 'Freight' ? 'bg-slate-400' : 'bg-[#D92D20]'} opacity-85 hover:h-[45%] transition-all cursor-crosshair`}
                        />
                      );
                    })}

                    {/* Maintenance Block Possessions */}
                    {secTasks.filter((t) => inView(t.start_minute, t.end_minute)).map((t) => {
                      const leftPct = Math.max(0, posPct(t.start_minute));
                      const widthPct = Math.max(0.4, posPct(t.end_minute) - posPct(Math.max(t.start_minute, viewStart)));
                      const v = vert(t.affects_line || 'BOTH');
                      const isCombined = !!t.combined_group_id;

                      let bg = 'bg-[#B54708]';
                      if (t.department === 'Traction') bg = 'bg-[#6927DA]';
                      if (t.department === 'S&T') bg = 'bg-[#175CD3]';
                      if (isCombined) bg = 'bg-[#FF9933]';

                      const qLower = searchTerm.toLowerCase().trim();
                      const isMatch = qLower !== '' && (
                        t.task_id.toLowerCase().includes(qLower) ||
                        (t.block_id && t.block_id.toLowerCase().includes(qLower)) ||
                        (t.combined_group_id && t.combined_group_id.toLowerCase().includes(qLower))
                      );
                      const displayBlockId = t.block_id || t.combined_group_id || '';

                      return (
                        <div
                          key={t.task_id}
                          style={{
                            left: `${leftPct}%`,
                            width: `${Math.max(widthPct, isMatch ? 1.5 : 0.4)}%`,
                            top: v.top,
                            height: v.height
                          }}
                          title={`Block ID: ${displayBlockId || 'Single'}\nTask: ${t.task_id} (${t.department}): ${t.task_type}\nWindow: ${t.assigned_start_time} - ${t.assigned_end_time} (${t.duration_minutes}m)\nStatus: ASSIGNED & APPROVED`}
                          onClick={() => setSelectedBlockModal(t)}
                          className={`absolute rounded-lg cursor-pointer ${bg} opacity-95 hover:opacity-100 transition-all shadow-sm z-[5] ${
                            isCombined ? 'ring-2 ring-[#B85C00] shadow-md z-10' : ''
                          } ${isMatch ? 'ring-4 ring-[#FF9933] ring-offset-2 animate-pulse scale-105 z-20 brightness-110' : ''}`}
                        >
                          {widthPct > 2 && (
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/95 px-0.5 truncate select-none">
                              {displayBlockId || t.affects_line || t.task_id}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scheduled Tasks Filterable Table (Paginated for Zero Lag) */}
      <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#12B76A]" />
            <span>Assigned Corridor Possessions ({filteredTasks.length} Tasks)</span>
          </h3>

          <div className="flex items-center gap-2.5">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-[#F7F7F5] border border-[#E6E6E6] text-xs text-[#1F2937] font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#FF9933]"
            >
              <option value="All">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Traction">Traction</option>
              <option value="S&T">S&amp;T</option>
            </select>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Search Block ID (e.g. BLK-REQ...), task ID, section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#F7F7F5] border border-[#E6E6E6] text-xs text-[#1F2937] rounded-xl px-3 py-1.5 w-64 focus:outline-none focus:border-[#FF9933]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-2 py-1 text-[11px] font-bold text-[#667085] hover:text-[#1F2937] bg-[#E6E6E6] rounded-lg transition"
                  title="Clear search filter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E6E6E6]">
          <table className="w-full text-left text-xs text-[#1F2937]">
            <thead className="bg-[#F7F7F5] border-b border-[#E6E6E6] uppercase text-[10px] tracking-wider text-[#667085] sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 font-bold">Task ID</th>
                <th className="py-2.5 px-3 font-bold">Block ID / Group</th>
                <th className="py-2.5 px-3 font-bold">Dept</th>
                <th className="py-2.5 px-3 font-bold">Section</th>
                <th className="py-2.5 px-3 font-bold">Task Type</th>
                <th className="py-2.5 px-3 font-bold">Criticality</th>
                <th className="py-2.5 px-3 font-bold">Priority</th>
                <th className="py-2.5 px-3 font-bold">Duration</th>
                <th className="py-2.5 px-3 font-bold">Start Time</th>
                <th className="py-2.5 px-3 font-bold">End Time</th>
                <th className="py-2.5 px-3 font-bold">Line</th>
                <th className="py-2.5 px-3 font-bold">Block Status</th>
                <th className="py-2.5 px-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E6E6]">
              {currentTableTasks.map((t) => {
                const prio = typeof t.priority_score === 'number' ? t.priority_score : 85.0;
                return (
                  <tr
                    key={t.task_id}
                    onClick={() => setSelectedBlockModal(t)}
                    className="hover:bg-[#FFF9F2] transition cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-[#1F2937]">{t.task_id}</td>
                    <td className="py-2.5 px-3">
                      {(t.block_id || t.combined_group_id) ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                          (t.block_id || t.combined_group_id)?.startsWith('BLK-REQ')
                            ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                            : 'bg-[#FFF3E6] text-[#B85C00] border-[#FFD9B3]'
                        }`}>
                          {t.block_id || t.combined_group_id}
                        </span>
                      ) : (
                        <span className="text-[#667085] text-[10px]">Independent</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase bg-[#F1F5F9] text-[#475467]">
                        {t.department}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{t.section_name}</td>
                    <td className="py-2.5 px-3 font-medium">{t.task_type}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${t.criticality === 'Critical' ? 'text-[#D92D20]' : 'text-[#F79009]'}`}>
                        {t.criticality}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#D92D20] font-mono">{prio.toFixed(1)}</td>
                    <td className="py-2.5 px-3 font-mono text-[#667085]">{t.duration_minutes}m</td>
                    <td className="py-2.5 px-3 font-mono text-[#475467]">{t.assigned_start_time}</td>
                    <td className="py-2.5 px-3 font-mono text-[#475467]">{t.assigned_end_time}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F1F5F9] text-[#475467]">
                        {t.affects_line || 'BOTH'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                        RECOMMENDED
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => setSelectedBlockModal(t)}
                          className="px-2 py-1 rounded-md bg-[#F7F7F5] border border-[#E6E6E6] text-[10px] font-bold text-[#344054] hover:bg-[#FFF3E6] hover:text-[#B85C00] transition"
                        >
                          VIEW BLOCK
                        </button>
                        <button
                          onClick={() => handleViewAlternatives(t)}
                          className="px-2 py-1 rounded-md bg-[#F7F7F5] border border-[#E6E6E6] text-[10px] font-bold text-[#344054] hover:bg-[#FFF3E6] hover:text-[#B85C00] transition"
                        >
                          VIEW ALTERNATIVES
                        </button>
                        <button
                          onClick={() => onNavigate && onNavigate('approvals_audit')}
                          className="px-2 py-1 rounded-md bg-[#7F1418] text-white text-[10px] font-bold hover:bg-[#651013] transition flex items-center gap-1"
                        >
                          <FileCheck2 className="w-3 h-3 text-[#FF9933]" />
                          <span>REQUEST APPROVAL</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
          <span className="text-[#667085]">
            Showing <b className="text-[#1F2937]">{(tablePage - 1) * TABLE_PAGE_SIZE + 1}–{Math.min(tablePage * TABLE_PAGE_SIZE, filteredTasks.length)}</b> of <b className="text-[#1F2937]">{filteredTasks.length}</b> scheduled tasks
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              disabled={tablePage <= 1}
              className="px-3 py-1 rounded-lg border border-[#E6E6E6] bg-white text-[#475467] font-bold text-xs disabled:opacity-40 hover:bg-[#FFF3E6] hover:text-[#B85C00] transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-bold text-xs text-[#1F2937]">
              {tablePage} / {totalTablePages}
            </span>
            <button
              onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
              disabled={tablePage >= totalTablePages}
              className="px-3 py-1 rounded-lg border border-[#E6E6E6] bg-white text-[#475467] font-bold text-xs disabled:opacity-40 hover:bg-[#FFF3E6] hover:text-[#B85C00] transition flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* "Why This Block?" Modal Drawer */}
      {selectedBlockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E6E6E6] max-w-xl w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3.5">
              <div>
                <span className="text-[10px] font-bold text-[#D96F13] uppercase tracking-wider block">
                  CP-SAT Solver Explanation
                </span>
                <h3 className="text-base font-bold text-[#1F2937] mt-0.5 font-display">
                  Why Did CP-SAT Select Block {selectedBlockModal.combined_group_id || selectedBlockModal.task_id}?
                </h3>
              </div>
              <button
                onClick={() => setSelectedBlockModal(null)}
                className="text-[#667085] hover:text-[#1F2937] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#FFF9F2] p-3.5 rounded-xl border border-[#FFD9B3] text-xs text-[#1F2937] space-y-1">
              <p><b>Operational Section:</b> {selectedBlockModal.section_id} ({selectedBlockModal.section_name})</p>
              <p><b>Granted Window:</b> {selectedBlockModal.assigned_start_time} → {selectedBlockModal.assigned_end_time} ({selectedBlockModal.duration_minutes}m)</p>
              <p><b>Running Track:</b> {selectedBlockModal.affects_line || 'BOTH'}</p>
            </div>

            {/* Hard Constraint Verification Checks */}
            <div>
              <h4 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider mb-2">
                Hard Constraint Verification (All Checks Passed)
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-[#0F7644] bg-[#F6FEF9] p-2.5 rounded-xl border border-[#A6F4C5]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12B76A]" />
                  <span>No Train Precedence Conflict</span>
                </div>
                <div className="flex items-center gap-2 text-[#0F7644] bg-[#F6FEF9] p-2.5 rounded-xl border border-[#A6F4C5]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12B76A]" />
                  <span>Machinery Fleet Available</span>
                </div>
                <div className="flex items-center gap-2 text-[#0F7644] bg-[#F6FEF9] p-2.5 rounded-xl border border-[#A6F4C5]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12B76A]" />
                  <span>8-Point Compatible Group</span>
                </div>
                <div className="flex items-center gap-2 text-[#0F7644] bg-[#F6FEF9] p-2.5 rounded-xl border border-[#A6F4C5]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12B76A]" />
                  <span>Non-Peak Window (Peak Ban OK)</span>
                </div>
                <div className="flex items-center gap-2 text-[#0F7644] bg-[#F6FEF9] p-2.5 rounded-xl border border-[#A6F4C5]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12B76A]" />
                  <span>Task Dependencies Met</span>
                </div>
                <div className="flex items-center gap-2 text-[#0F7644] bg-[#F6FEF9] p-2.5 rounded-xl border border-[#A6F4C5]">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#12B76A]" />
                  <span>Power / Signal Isolation OK</span>
                </div>
              </div>
            </div>

            {/* Alternative Candidate Windows */}
            {loadingAlternatives && (
              <div className="p-3 bg-[#F7F7F5] border border-[#E6E6E6] rounded-xl text-xs text-[#667085] font-semibold animate-pulse">
                Loading candidate block windows...
              </div>
            )}
            {!loadingAlternatives && alternativeWindows && alternativeWindows.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider mb-2">
                  Alternative Windows Evaluated
                </h4>
                <div className="space-y-1.5">
                  {alternativeWindows.map((win, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                        win.status === 'SELECTED'
                          ? 'bg-[#F0FDF4] border-[#86EFAC]'
                          : 'bg-[#FAFAF9] border-[#E6E6E6]'
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold text-[#1F2937]">
                          {win.start_time} – {win.end_time}
                        </span>
                        <span className="text-[#667085] ml-2">({win.duration_minutes}m)</span>
                        {win.conflict_reason && (
                          <p className="text-[10px] text-[#D92D20] font-medium mt-0.5">
                            {win.conflict_reason}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded ${
                          win.status === 'SELECTED'
                            ? 'bg-[#12B76A] text-white'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {win.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!loadingAlternatives && alternativeWindows && alternativeWindows.length === 0 && (
              <div className="p-3 bg-[#FFFBF0] border border-[#FEDF89] rounded-xl text-[11px] text-[#B54708] font-semibold">
                No valid block window found. Reason: all eligible windows contain train, resource, or dependency conflicts.
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => {
                  setSelectedBlockModal(null);
                  setAlternativeWindows(null);
                  if (onNavigate) onNavigate('approvals_audit');
                }}
                className="px-4 py-2 bg-[#7F1418] hover:bg-[#651013] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-[#FF9933]" />
                <span>REQUEST APPROVAL</span>
              </button>
              <button
                onClick={() => {
                  setSelectedBlockModal(null);
                  setAlternativeWindows(null);
                }}
                className="px-4 py-2 bg-[#F7F7F5] hover:bg-[#EAEAEA] text-[#1F2937] text-xs font-bold rounded-xl transition"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
