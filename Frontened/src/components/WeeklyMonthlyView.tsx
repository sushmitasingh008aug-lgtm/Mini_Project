import React, { useState } from 'react';
import { CalendarDays, CalendarRange, Filter, ChevronRight, Layers, Combine } from 'lucide-react';
import { ScheduledTask, Section } from '../api/client';

interface WeeklyMonthlyProps {
  schedule?: ScheduledTask[];
  sections?: Section[];
  loading?: boolean;
  onHorizonChange?: (days: number) => void;
}

export const WeeklyMonthlyView: React.FC<WeeklyMonthlyProps> = ({
  schedule = [],
  sections = [],
  loading = false,
  onHorizonChange,
}) => {
  const [horizonMode, setHorizonMode] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  const days = ['Day 1 (Sun)', 'Day 2 (Mon)', 'Day 3 (Tue)', 'Day 4 (Wed)', 'Day 5 (Thu)', 'Day 6 (Fri)', 'Day 7 (Sat)'];
  const weeks = ['Week 1 (Aug 23-29)', 'Week 2 (Aug 30-Sep 5)', 'Week 3 (Sep 6-12)', 'Week 4 (Sep 13-19)'];

  if (loading || !schedule || schedule.length === 0) {
    return (
      <div className="bg-white p-16 rounded-2xl border border-[#E6E6E6] text-center space-y-4 shadow-sm my-6 max-w-3xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13] mx-auto animate-pulse">
          <CalendarDays className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#1F2937]">Loading Weekly &amp; Monthly Corridor Plan...</h3>
          <p className="text-xs text-[#667085] mt-1 max-w-md mx-auto">
            Aggregating multi-horizon scheduled maintenance tasks across divisional sections
          </p>
        </div>
        <div className="w-48 h-1.5 bg-[#F2F4F7] rounded-full mx-auto overflow-hidden">
          <div className="bg-[#FF9933] h-full w-2/3 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  const filteredSchedule = schedule.filter(t => {
    if (deptFilter !== 'ALL' && t.department !== deptFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Segmented Controls (Section 23) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E6E6E6] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
              <CalendarDays className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2937] font-display">
              Weekly &amp; Monthly Corridor Plan
            </h2>
          </div>
          <p className="text-xs text-[#667085] mt-1 ml-10">
            Multi-horizon planning view with cross-department consolidation across operational sections
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex bg-[#F7F7F5] p-1 rounded-xl border border-[#E6E6E6] text-xs font-semibold">
            <button
              onClick={() => {
                setHorizonMode('WEEKLY');
                onHorizonChange?.(7);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                horizonMode === 'WEEKLY'
                  ? 'bg-[#FF9933] text-white shadow-sm font-bold'
                  : 'text-[#667085] hover:text-[#1F2937]'
              }`}
            >
              Weekly Calendar (7 Days)
            </button>
            <button
              onClick={() => {
                setHorizonMode('MONTHLY');
                onHorizonChange?.(30);
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                horizonMode === 'MONTHLY'
                  ? 'bg-[#FF9933] text-white shadow-sm font-bold'
                  : 'text-[#667085] hover:text-[#1F2937]'
              }`}
            >
              Monthly Heatmap (30 Days)
            </button>
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="text-xs border border-[#E6E6E6] rounded-xl px-3 py-1.5 bg-[#F7F7F5] font-semibold text-[#1F2937] focus:outline-none focus:border-[#FF9933]"
          >
            <option value="ALL">All Departments</option>
            <option value="Engineering">Engineering (TMS)</option>
            <option value="Traction">Traction (TDMS)</option>
            <option value="S&T">Signalling (SMMS)</option>
          </select>
        </div>
      </div>

      {/* WEEKLY VIEW: 7-day Day-by-Day Responsive Grid */}
      {horizonMode === 'WEEKLY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {days.map((dayName, dayIndex) => {
              const dayStartMin = dayIndex * 1440;
              const dayEndMin = (dayIndex + 1) * 1440;
              const dayTasks = filteredSchedule.filter(
                t => t.start_minute >= dayStartMin && t.start_minute < dayEndMin
              );

              return (
                <div key={dayName} className="bg-white rounded-2xl border border-[#E6E6E6] shadow-sm flex flex-col min-h-[480px] overflow-hidden">
                  <div className="bg-[#F7F7F5] p-3 border-b border-[#E6E6E6] text-center">
                    <span className="font-bold text-xs text-[#1F2937] block">{dayName}</span>
                    <span className="text-[10px] text-[#B85C00] font-semibold bg-[#FFF3E6] px-2 py-0.5 rounded-full border border-[#FFD9B3] inline-block mt-1">
                      {dayTasks.length} Blocks Granted
                    </span>
                  </div>

                  <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[460px]">
                    {dayTasks.slice(0, 8).map((t) => {
                      const isCombined = t.combined_group_id && t.combined_group_id.length > 0;
                      return (
                        <div
                          key={t.task_id}
                          className={`p-2.5 rounded-xl border text-left text-[11px] transition-all ${
                            isCombined
                              ? 'bg-[#FFF9F2] border-[#FFD9B3] shadow-xs'
                              : 'bg-white border-[#E6E6E6] hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-[#1F2937] text-[10.5px] truncate">{t.task_id}</span>
                            <span className="font-mono text-[9.5px] text-[#667085]">
                              {t.assigned_start_time.slice(11)}
                            </span>
                          </div>

                          <p className="text-[10.5px] text-[#475467] truncate font-medium">{t.task_type}</p>

                          <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-gray-100 text-[9.5px]">
                            <span className="text-[#667085] truncate">{t.section_id}</span>
                            {isCombined && (
                              <span className="font-bold text-[#B85C00] bg-[#FFF3E6] px-1 py-0.2 rounded">
                                {t.combined_group_id}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MONTHLY VIEW: 4-Week Section Exposure Heatmap */}
      {horizonMode === 'MONTHLY' && (
        <div className="bg-white rounded-2xl border border-[#E6E6E6] shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
            <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
              30-Day Section Maintenance Workload Exposure Heatmap
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-[#667085]">
              <span>Density:</span>
              <span className="px-2 py-0.5 rounded bg-[#F6FEF9] text-[#0F7644] font-semibold">Light</span>
              <span className="px-2 py-0.5 rounded bg-[#FEF0C7] text-[#B54708] font-semibold">Moderate</span>
              <span className="px-2 py-0.5 rounded bg-[#FEE4E2] text-[#D92D20] font-semibold">Heavy (Possession Wall)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-[#F7F7F5] border-b border-[#E6E6E6] uppercase text-[10px] tracking-wider text-[#667085]">
                <tr>
                  <th className="py-3 px-4 font-bold">Operational Section</th>
                  {weeks.map(w => (
                    <th key={w} className="py-3 px-4 font-bold text-center">{w}</th>
                  ))}
                  <th className="py-3 px-4 font-bold text-center">Total Planned Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E6]">
                {sections.slice(0, 10).map((sec, idx) => {
                  const secTasks = filteredSchedule.filter(t => t.section_id === sec.section_id);
                  const totalHrs = Math.round(secTasks.reduce((acc, t) => acc + t.duration_minutes, 0) / 60);

                  return (
                    <tr key={sec.section_id} className="hover:bg-[#FFF9F2] transition">
                      <td className="py-3 px-4 font-bold text-[#1F2937]">
                        {sec.section_id}
                        <span className="block text-[10px] text-[#667085] font-normal">{sec.name}</span>
                      </td>

                      {[0, 1, 2, 3].map(wIdx => {
                        const weekTasks = secTasks.filter(t => {
                          const smin = Number(t.start_minute || 0);
                          return smin >= wIdx * 10080 && smin < (wIdx + 1) * 10080;
                        });
                        const count = weekTasks.length;
                        const weekMins = weekTasks.reduce((acc, t) => acc + (t.duration_minutes || 0), 0);
                        const weekHrs = Math.round(weekMins / 60);
                        const isHeavy = count > 5;
                        const isMod = count > 0;

                        return (
                          <td key={wIdx} className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-3 py-1.5 rounded-xl font-mono font-bold text-xs ${
                                isHeavy
                                  ? 'bg-[#FEE4E2] text-[#D92D20] border border-[#FDA29B]'
                                  : isMod
                                  ? 'bg-[#FEF0C7] text-[#B54708] border border-[#FEDF89]'
                                  : 'bg-[#F7F7F5] text-[#98A2B3] border border-[#E6E6E6]'
                              }`}
                            >
                              {count > 0 ? `${weekHrs}h (${count} ${count === 1 ? 'task' : 'tasks'})` : '0h (0 tasks)'}
                            </span>
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-center font-bold text-[#1F2937] font-mono">
                        {totalHrs} Hours
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
