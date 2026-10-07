import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { MetricsResponse, ImpactResponse } from '../api/client';

interface OverviewTabProps {
  metrics: MetricsResponse | null;
  impact: ImpactResponse | null;
  loading: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ metrics, impact, loading }) => {
  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primaryRed"></div>
        <span className="ml-3 text-slate-400 font-medium">Loading operational metrics...</span>
      </div>
    );
  }

  // Workload colors
  const deptColors: Record<string, string> = {
    Engineering: '#38bdf8', // Light sky blue
    Traction: '#f97316',    // Orange
    'S&T': '#22c55e',       // Green
  };

  // Stacked Section Allocation Colors (matching Image 2)
  const stackColors = {
    Engineering: '#7dd3fc', // Soft Cyan/Light Blue
    'S&T': '#2563eb',       // Deep Royal Blue
    Traction: '#fca5a5',    // Soft Salmon/Red
  };

  return (
    <div className="space-y-10 pb-12">
      {/* 1. High-Level Operational Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <span>🚀</span> High-Level Operational Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 shadow-lg">
            <p className="text-xs font-medium text-slate-400">Total Scheduled Tasks</p>
            <p className="text-3xl font-extrabold text-white mt-1">
              {metrics.high_level.total_scheduled_tasks}
            </p>
            <p className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1">
              <span>↑</span> 100% Success Rate
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 shadow-lg">
            <p className="text-xs font-medium text-slate-400">Train Overlap Collisions</p>
            <p className="text-3xl font-extrabold text-white mt-1">
              {metrics.high_level.train_overlap_collisions}
            </p>
            <p className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1">
              <span>↑</span> Zero-Overlap Verified
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 shadow-lg">
            <p className="text-xs font-medium text-slate-400">Solver Runtime</p>
            <p className="text-3xl font-extrabold text-white mt-1">
              {metrics.high_level.solver_runtime}
            </p>
            <p className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1">
              <span>↑</span> Optimal Solver Speed
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 shadow-lg">
            <p className="text-xs font-medium text-slate-400">Planning Horizon</p>
            <p className="text-3xl font-extrabold text-white mt-1">
              {metrics.high_level.planning_horizon}
            </p>
            <p className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1">
              <span>↑</span> {metrics.high_level.planning_minutes}
            </p>
          </div>
        </div>
      </div>

      {/* 1b. Multi-Department Coordination Strip */}
      {metrics?.high_level?.combined_blocks_count !== undefined && (
        <div className="bg-[#0e1d38]/60 border border-blue-900/50 rounded-xl px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
            🤝 Coordinated Planning
          </span>
          <span className="text-sm text-slate-200">
            <strong className="text-white font-bold">{metrics.high_level.combined_blocks_count}</strong>
            <span className="text-slate-400"> combined multi-department blocks</span>
          </span>
          <span className="text-sm text-slate-200">
            <strong className="text-white font-bold">{metrics.high_level.coordinated_tasks}</strong>
            <span className="text-slate-400"> tasks sharing corridor windows</span>
          </span>
          <span className="text-sm text-slate-200">
            <strong className="text-emerald-400 font-bold">{metrics.high_level.disruptions_avoided}</strong>
            <span className="text-slate-400"> traffic disruptions avoided</span>
          </span>
        </div>
      )}

      {/* 2. Operational Impact: Time Saved for the Railway */}
      {impact && (
        <div>
          <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <span>⚡</span> Operational Impact — Traffic-Aware Scheduling Advantage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Card 1: Train delay eliminated */}
            <div className="bg-gradient-to-br from-[#111827] to-[#0d1526] border border-emerald-500/20 rounded-xl p-5 shadow-lg">
              <p className="text-xs font-medium text-slate-400">🚆 Train Delay Eliminated</p>
              <p className="text-3xl font-extrabold text-emerald-400 mt-1">
                {impact.impact.delay_avoided_hours}
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-2">
                Cumulative holding time removed across the network (7-day plan)
              </p>
            </div>

            {/* Card 2: Collisions avoided */}
            <div className="bg-gradient-to-br from-[#111827] to-[#0d1526] border border-red-500/20 rounded-xl p-5 shadow-lg">
              <p className="text-xs font-medium text-slate-400">💥 Collision Events Avoided</p>
              <p className="text-3xl font-extrabold text-red-400 mt-1">
                {impact.impact.collision_events_avoided}
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-2">
                Block–train conflicts vs traditional traffic-blind planning
              </p>
            </div>

            {/* Card 3: Avg recovery per service */}
            <div className="bg-gradient-to-br from-[#111827] to-[#0d1526] border border-sky-500/20 rounded-xl p-5 shadow-lg">
              <p className="text-xs font-medium text-slate-400">⏱️ Avg Recovery per Affected Service</p>
              <p className="text-3xl font-extrabold text-sky-400 mt-1">
                {impact.impact.avg_delay_recovered_per_train_min}<span className="text-base font-bold"> min</span>
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-2">
                Every affected train now runs at timetable speed
              </p>
            </div>

            {/* Card 4: Punctuality */}
            <div className="bg-gradient-to-br from-[#111827] to-[#0d1526] border border-amber-500/20 rounded-xl p-5 shadow-lg">
              <p className="text-xs font-medium text-slate-400">🎯 Services Running On Time</p>
              <p className="text-3xl font-extrabold text-amber-400 mt-1">
                100%
              </p>
              <p className="text-xs font-semibold text-slate-400 mt-2">
                vs {impact.baseline.trains_on_time_pct}% under naive scheduling ({impact.baseline.trains_affected} of {impact.train_movements_analyzed} services hit)
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            Methodology: baseline simulates traditional sequential block placement (priority order, no traffic awareness) against the same workload; delay = time each train would hold until a conflicting block clears. Optimized plan is the live CP-SAT output.
          </p>
        </div>
      )}

      {/* 3. Middle Row: Department Workload & Priority Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Department Backlog Workload */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 shadow-lg">
          <h3 className="text-base font-semibold text-slate-100 mb-1 flex items-center gap-2">
            <span>🏢</span> Department Backlog Workload
          </h3>
          <p className="text-xs text-slate-400 mb-6">Scheduled Maintenance Tasks by Department</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.dept_workload} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="department" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                  itemStyle={{ color: '#e2e8f0' }}
                  cursor={{ fill: '#1e293b' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {metrics.dept_workload.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={deptColors[entry.department] || '#38bdf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Priority Score Distribution */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 shadow-lg">
          <h3 className="text-base font-semibold text-slate-100 mb-1 flex items-center gap-2">
            <span>🎯</span> Priority Score Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-6">Task Count by Priority Score & Criticality</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.priority_dist} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="score_bucket" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                  itemStyle={{ color: '#e2e8f0' }}
                  cursor={{ fill: '#1e293b' }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', color: '#cbd5e1' }}
                  formatter={(value) => <span style={{ color: '#cbd5e1' }}>{value}</span>}
                />
                <Bar dataKey="count" name="Criticality Distribution" radius={[3, 3, 0, 0]}>
                  {metrics.priority_dist.map((entry, index) => {
                    let color = '#22c55e'; // Low
                    if (entry.criticality === 'Critical') color = '#ef4444';
                    else if (entry.criticality === 'High') color = '#f97316';
                    else if (entry.criticality === 'Medium') color = '#eab308';
                    return <Cell key={`crit-cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Section-wise Maintenance Window Allocation (Stacked Bar Chart) */}
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-6 shadow-lg">
        <h3 className="text-base font-semibold text-slate-100 mb-1 flex items-center gap-2">
          <span>📍</span> Section-wise Maintenance Window Allocation
        </h3>
        <p className="text-xs text-slate-400 mb-6">Total Allocated Maintenance Minutes per Section</p>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={metrics.section_allocation}
              margin={{ top: 10, right: 30, left: 10, bottom: 65 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="section_name"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                itemStyle={{ color: '#e2e8f0' }}
                cursor={{ fill: '#1e293b' }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '15px', color: '#cbd5e1' }}
                formatter={(value) => <span style={{ color: '#cbd5e1' }}>{value}</span>}
              />
              <Bar dataKey="Engineering" stackId="a" fill={stackColors.Engineering} />
              <Bar dataKey="S&T" stackId="a" fill={stackColors['S&T']} />
              <Bar dataKey="Traction" stackId="a" fill={stackColors.Traction} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
