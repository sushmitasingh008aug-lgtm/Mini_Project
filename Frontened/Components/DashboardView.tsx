import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  CalendarRange,
  Clock,
  IndianRupee,
  Bell,
  ArrowRight,
} from 'lucide-react';
import { MetricsResponse, ImpactResponse, ScheduledTask } from '../api/client';
import { ViewType } from './Sidebar';

interface DashboardViewProps {
  metrics: MetricsResponse | null;
  impact: ImpactResponse | null;
  loading: boolean;
  onNavigate: (view: ViewType) => void;
  schedule?: ScheduledTask[];
}

const DEPT_COLORS: Record<string, string> = {
  Engineering: '#2563eb',
  Traction: '#ea580c',
  'S&T': '#16a34a',
};

const ASSET_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#d97706'];

type BlockRow = {
  task_id: string;
  section_name: string;
  assigned_start_time: string;
  assigned_end_time: string;
  duration_minutes: number;
  department: string;
  criticality: string;
};

const FALLBACK_BLOCKS: BlockRow[] = [
  { task_id: 'FB1', section_name: 'NDLS – ALD', assigned_start_time: '24 May, 01:00', assigned_end_time: '05:00', duration_minutes: 240, department: 'Engineering', criticality: 'High' },
  { task_id: 'FB2', section_name: 'ALD – CNB', assigned_start_time: '25 May, 23:00', assigned_end_time: '04:00', duration_minutes: 300, department: 'Traction', criticality: 'High' },
  { task_id: 'FB3', section_name: 'CNB – PRYJ', assigned_start_time: '27 May, 01:30', assigned_end_time: '06:30', duration_minutes: 300, department: 'Engineering', criticality: 'High' },
  { task_id: 'FB4', section_name: 'PRYJ – MGS', assigned_start_time: '28 May, 22:30', assigned_end_time: '03:30', duration_minutes: 300, department: 'Engineering', criticality: 'Critical' },
  { task_id: 'FB5', section_name: 'MGS – BSB', assigned_start_time: '30 May, 01:00', assigned_end_time: '06:00', duration_minutes: 300, department: 'Traction', criticality: 'Low' },
];

const STATIC_TREND = [65, 72, 68, 78, 75, 82, 79];
const TREND_DATES = ['17 May', '18 May', '19 May', '20 May', '21 May', '22 May', '23 May'];

function getStatus(criticality: string): { label: string; cls: string } {
  if (criticality === 'Critical') return { label: 'Under Review', cls: 'bg-amber-50 text-amber-700 border border-amber-200' };
  if (criticality === 'High') return { label: 'Planned', cls: 'bg-green-50 text-green-700 border border-green-200' };
  if (criticality === 'Medium') return { label: 'Planned', cls: 'bg-green-50 text-green-700 border border-green-200' };
  return { label: 'Proposed', cls: 'bg-slate-100 text-slate-600 border border-slate-200' };
}

function deptShort(d: string) {
  if (d === 'Engineering') return 'ENG';
  if (d === 'Traction') return 'TRD';
  return 'S&T';
}

function deptColor(d: string) {
  if (d === 'Engineering') return 'bg-blue-600';
  if (d === 'Traction') return 'bg-orange-500';
  return 'bg-green-600';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  impact,
  loading,
  onNavigate,
  schedule = [],
}) => {
  if (loading || !metrics) {
    return (
      <div className="space-y-4 pb-8">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl h-56 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-4">
          {[5, 4, 3].map((span, i) => (
            <div key={i} className={`bg-white border border-gray-200 rounded-xl h-64 animate-pulse col-span-${span}`} />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hl = metrics.high_level;

  /* ── Dept donut ── */
  const deptData = metrics.dept_workload.map((d) => ({
    name: d.department === 'Traction' ? 'TRD' : d.department,
    fullName: d.department,
    value: d.count,
    color: DEPT_COLORS[d.department] || '#6b7280',
  }));
  const deptTotal = metrics.dept_workload.reduce((s, d) => s + d.count, 0);

  /* ── Priority bar ── */
  const priorityData = ['Critical', 'High', 'Medium', 'Low'].map((crit) => ({
    name: crit,
    value: metrics.priority_dist.filter((p) => p.criticality === crit).reduce((s, p) => s + p.count, 0),
    fill: crit === 'Critical' ? '#dc2626' : crit === 'High' ? '#ea580c' : crit === 'Medium' ? '#d97706' : '#16a34a',
  }));

  /* ── Asset type donut ── */
  const engCount = metrics.dept_workload.find((d) => d.department === 'Engineering')?.count || 0;
  const tracCount = metrics.dept_workload.find((d) => d.department === 'Traction')?.count || 0;
  const sntCount = metrics.dept_workload.find((d) => d.department === 'S&T')?.count || 0;
  const othersCount = Math.max(0, deptTotal - engCount - tracCount - sntCount);
  const assetData = [
    { name: 'Track', value: engCount },
    { name: 'OHE', value: tracCount },
    { name: 'Signals', value: sntCount },
    ...(othersCount > 0 ? [{ name: 'Others', value: othersCount }] : []),
  ].filter((d) => d.value > 0);

  /* ── Utilization trend ── */
  const trendData = TREND_DATES.map((date, i) => {
    const dayStart = i * 1440;
    const dayEnd = (i + 1) * 1440;
    const dayTasks = schedule.filter((t) => t.start_minute >= dayStart && t.start_minute < dayEnd);
    const usedMin = dayTasks.reduce((sum, t) => sum + t.duration_minutes, 0);
    const utilPct =
      schedule.length > 0 ? Math.min(100, Math.round((usedMin / 1080) * 100)) : STATIC_TREND[i];
    return { date, utilization: utilPct };
  });

  /* ── Upcoming blocks ── */
  const displayBlocks: BlockRow[] =
    schedule.length > 0
      ? schedule.slice(0, 5).map((t) => ({
          task_id: t.task_id,
          section_name: t.section_name,
          assigned_start_time: t.assigned_start_time,
          assigned_end_time: t.assigned_end_time,
          duration_minutes: t.duration_minutes,
          department: t.department,
          criticality: t.criticality,
        }))
      : FALLBACK_BLOCKS;

  const miniCards = displayBlocks.slice(0, 3);

  /* ── Bottom stats ── */
  const optimalBlocks = hl.combined_blocks_count ?? 18;
  const maintenanceHrs = impact ? parseInt(impact.impact.delay_avoided_hours) || 32 : 32;

  const recentAlerts = [
    { text: 'Critical defect in ALD–CNB (Track)', time: '10m ago', color: 'bg-red-500' },
    { text: 'Block conflict detected on 27 May', time: '25m ago', color: 'bg-amber-500' },
    { text: 'High maintenance demand in NDLS', time: '1h ago', color: 'bg-amber-400' },
  ];

  const corridorNodes = ['NDLS', 'ALD', 'CNB', 'PRYJ'];
  const card = 'bg-white border border-gray-200 rounded-xl';

  return (
    <div className="space-y-4 pb-8 select-none">

      {/* ━━━ Row 1 ━━━ */}
      <div className="grid grid-cols-3 gap-4">

        {/* Workload Donut */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Workload by Department</h2>
            <button onClick={() => onNavigate('demand')} className="text-[11px] text-blue-600 hover:underline font-medium">Backlog →</button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 relative flex items-center justify-center shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deptData} cx="50%" cy="50%" innerRadius={40} outerRadius={58} paddingAngle={2} dataKey="value" stroke="none">
                    {deptData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base font-bold text-gray-900 leading-none">{deptTotal.toLocaleString()}</span>
                <span className="text-[10px] text-gray-400">Total</span>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              {deptData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-700 font-medium">{d.name}</span>
                  </div>
                  <span className="text-gray-500 font-semibold text-[11px]">
                    {Math.round((d.value / deptTotal) * 100)}% ({d.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority Bar */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Priority Distribution</h2>
            <button onClick={() => onNavigate('demand')} className="text-[11px] text-blue-600 hover:underline font-medium">Details →</button>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#111827' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {priorityData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Corridor Nodes + Mini Block Cards */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Corridor Status</h2>
            <button onClick={() => onNavigate('networkmap')} className="text-[11px] text-blue-600 hover:underline font-medium">Map →</button>
          </div>

          {/* Node rail */}
          <div className="flex items-center justify-between mb-4 px-1">
            {corridorNodes.map((node, i) => (
              <React.Fragment key={node}>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-7 h-7 rounded-full bg-blue-50 border-2 border-blue-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  </div>
                  <span className="text-[10px] font-bold text-gray-700">{node}</span>
                </div>
                {i < corridorNodes.length - 1 && (
                  <div className="flex-1 h-px bg-blue-200 mx-1 mb-3" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Mini block cards */}
          <div className="grid grid-cols-3 gap-2">
            {miniCards.map((block, i) => {
              const hours = Math.round(block.duration_minutes / 60);
              const topColor = deptColor(block.department);
              return (
                <div key={block.task_id} className="rounded-lg overflow-hidden border border-gray-200">
                  <div className={`${topColor} px-2 py-1`}>
                    <span className="text-white text-[10px] font-bold">Block B{i + 1}</span>
                  </div>
                  <div className="px-2 py-1.5 bg-white space-y-0.5">
                    <p className="text-[9px] text-gray-500 leading-tight truncate">{block.assigned_start_time}</p>
                    <p className="text-[10px] font-bold text-gray-800">{hours}h</p>
                    <p className="text-[9px] text-gray-400 truncate">{deptShort(block.department)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ━━━ Row 2 ━━━ */}
      <div className="grid grid-cols-12 gap-4">

        {/* Upcoming Blocks Table */}
        <div className={`${card} p-5 col-span-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Upcoming Blocks</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100">
                  <th className="pb-2 pr-3 font-semibold">Block ID</th>
                  <th className="pb-2 pr-3 font-semibold">Route / Section</th>
                  <th className="pb-2 pr-3 font-semibold">Date &amp; Time</th>
                  <th className="pb-2 pr-3 font-semibold">Dur.</th>
                  <th className="pb-2 pr-3 font-semibold">Depts</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayBlocks.map((block, i) => {
                  const status = getStatus(block.criticality);
                  const hours = Math.round(block.duration_minutes / 60);
                  return (
                    <tr key={block.task_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-3 text-xs font-bold text-blue-600">B{i + 1}</td>
                      <td className="py-2.5 pr-3 text-xs text-gray-800 font-medium">{block.section_name}</td>
                      <td className="py-2.5 pr-3 text-xs text-gray-500">{block.assigned_start_time}</td>
                      <td className="py-2.5 pr-3 text-xs text-gray-500">{hours}h</td>
                      <td className="py-2.5 pr-3 text-xs text-gray-500">{deptShort(block.department)}</td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => onNavigate('weekly_planner')}
            className="mt-3 text-[11px] text-blue-600 hover:underline font-medium flex items-center gap-1"
          >
            View All Blocks <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Block Utilization Trend */}
        <div className={`${card} p-5 col-span-4`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Block Utilization Trend</h2>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -26, bottom: 0 }}>
                <defs>
                  <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11, color: '#111827' }}
                  formatter={(v: any) => [`${v}%`, 'Utilization']}
                />
                <Area
                  type="monotone"
                  dataKey="utilization"
                  stroke="#2563eb"
                  strokeWidth={2}
                  fill="url(#utilGrad)"
                  dot={{ fill: '#2563eb', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Maintenance by Asset Type */}
        <div className={`${card} p-5 col-span-3`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">By Asset Type</h2>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={assetData} cx="50%" cy="50%" innerRadius={34} outerRadius={52} paddingAngle={2} dataKey="value" stroke="none">
                    {assetData.map((_, i) => <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm font-bold text-gray-900 leading-none">{deptTotal.toLocaleString()}</span>
                <span className="text-[9px] text-gray-400">Total</span>
              </div>
            </div>
            <div className="mt-3 w-full space-y-1.5">
              {assetData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ASSET_COLORS[i % ASSET_COLORS.length] }} />
                    <span className="text-[11px] text-gray-500">{d.name}</span>
                  </div>
                  <span className="text-[11px] text-gray-700 font-semibold">
                    {Math.round((d.value / deptTotal) * 100)}% ({d.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ Row 3: Bottom Stats + Alerts ━━━ */}
      <div className="grid grid-cols-4 gap-4">

        {/* Optimal Blocks */}
        <div className={`${card} p-5`}>
          <div className="p-2 rounded-lg bg-blue-50 w-fit mb-3">
            <CalendarRange className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-3xl font-extrabold text-gray-900">{optimalBlocks}</p>
          <p className="text-[11px] font-semibold text-gray-700 mt-1">Optimal Blocks Recommended</p>
          <p className="text-[10px] text-green-600 mt-0.5">+3 vs current plan</p>
        </div>

        {/* Maintenance Time */}
        <div className={`${card} p-5`}>
          <div className="p-2 rounded-lg bg-green-50 w-fit mb-3">
            <Clock className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-3xl font-extrabold text-gray-900">{maintenanceHrs}h</p>
          <p className="text-[11px] font-semibold text-gray-700 mt-1">Maintenance Time Optimized</p>
          <p className="text-[10px] text-green-600 mt-0.5">+12% improvement</p>
        </div>

        {/* Cost Saving */}
        <div className={`${card} p-5`}>
          <div className="p-2 rounded-lg bg-amber-50 w-fit mb-3">
            <IndianRupee className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">₹ 4.2 Cr</p>
          <p className="text-[11px] font-semibold text-gray-700 mt-1">Cost Saving Potential</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Estimated impact</p>
        </div>

        {/* Recent Alerts */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-red-500" />
              <h2 className="text-xs font-semibold text-gray-700">Recent Alerts</h2>
            </div>
            <button onClick={() => onNavigate('alerts')} className="text-[11px] text-blue-600 hover:underline font-medium">
              View All
            </button>
          </div>
          <div className="space-y-2.5">
            {recentAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${a.color} shrink-0 mt-1.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-700 leading-tight truncate">{a.text}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
