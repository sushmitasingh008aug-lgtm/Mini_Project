import React, { useState } from 'react';
import { Layers, Flame, AlertOctagon, TrendingDown, TrainFront, CheckCircle2, MapPin } from 'lucide-react';
import { SectionRisk, Section, ScheduledTask } from '../api/client';
import { ViewType } from './Sidebar';

interface NetworkSectionsProps {
  sectionRisks: SectionRisk[];
  sections: Section[];
  schedule: ScheduledTask[];
  onNavigate: (view: ViewType) => void;
}

export const NetworkSectionsView: React.FC<NetworkSectionsProps> = ({
  sectionRisks,
  sections,
  schedule,
  onNavigate,
}) => {
  const [selectedSecId, setSelectedSecId] = useState<string>(
    sectionRisks.length > 0 ? sectionRisks[0].section_id : 'SEC_BSB_LKO_01'
  );

  const activeRisk = sectionRisks.find(s => s.section_id === selectedSecId) || sectionRisks[0];
  const activeSection = sections.find(s => s.section_id === selectedSecId);
  const sectionTasks = schedule.filter(t => t.section_id === selectedSecId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E6E6E6] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
              <Layers className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2937] font-display">
              Network Corridors &amp; Operational Sections
            </h2>
          </div>
          <p className="text-xs text-[#667085] mt-1 ml-10">
            Spatial distribution of maintenance backlog, critical asset condition, and train density
          </p>
        </div>
        <button
          onClick={() => onNavigate('networkmap')}
          className="px-4 py-2 bg-[#FF9933] hover:bg-[#D96F13] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 self-start sm:self-auto"
        >
          <MapPin className="w-4 h-4" />
          View on True GPS Map →
        </button>
      </div>

      {/* Corridor Sections Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sectionRisks.map((sec) => {
          const isSelected = sec.section_id === selectedSecId;
          const isCrit = sec.risk_level === 'CRITICAL';
          const isHigh = sec.risk_level === 'HIGH';

          return (
            <div
              key={sec.section_id}
              onClick={() => setSelectedSecId(sec.section_id)}
              className={`cursor-pointer p-4 rounded-2xl border transition-all text-left ${
                isSelected
                  ? 'border-[#FF9933] bg-[#FFF9F2] shadow-md border-l-4 border-l-[#FF9933]'
                  : 'border-[#E6E6E6] bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#1F2937]">{sec.section_id}</span>
                <span
                  className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    isCrit
                      ? 'bg-[#FEE4E2] text-[#D92D20]'
                      : isHigh
                      ? 'bg-[#FEF0C7] text-[#B54708]'
                      : 'bg-[#D1FADF] text-[#0F7644]'
                  }`}
                >
                  {sec.risk_level}
                </span>
              </div>
              <h4 className="text-xs font-bold text-[#1F2937] mb-2 truncate">{sec.name}</h4>

              <div className="grid grid-cols-2 gap-2 text-[10.5px] border-t border-gray-100 pt-2 text-[#667085]">
                <div>
                  <span className="block text-[9.5px] text-[#667085]">Track Length</span>
                  <span className="font-bold text-[#1F2937]">{sec.length_km} km</span>
                </div>
                <div>
                  <span className="block text-[9.5px] text-[#667085]">Critical Tasks</span>
                  <span className={`font-bold ${sec.critical_tasks > 0 ? 'text-[#D92D20]' : 'text-[#1F2937]'}`}>
                    {sec.critical_tasks}
                  </span>
                </div>
                <div>
                  <span className="block text-[9.5px] text-[#667085]">Condition Score</span>
                  <span className="font-bold text-[#1F2937]">{sec.avg_condition} / 100</span>
                </div>
                <div>
                  <span className="block text-[9.5px] text-[#667085]">Mean Priority</span>
                  <span className="font-bold text-[#D96F13]">{sec.avg_priority}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Section Details & Backlog */}
      {activeRisk && (
        <div className="bg-white rounded-2xl border border-[#E6E6E6] shadow-sm p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-[#E6E6E6] pb-3 gap-2">
            <div>
              <span className="text-[10px] font-bold text-[#D96F13] uppercase tracking-wider block">
                Selected Operational Section Breakdown
              </span>
              <h3 className="text-base font-bold text-[#1F2937] font-display">
                {activeRisk.section_id}: {activeRisk.name}
              </h3>
            </div>
            <span className="text-xs text-[#667085]">
              {sectionTasks.length} Planned Maintenance Tasks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-[#F7F7F5] border-b border-[#E6E6E6] uppercase text-[10px] tracking-wider text-[#667085]">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Task ID</th>
                  <th className="py-2.5 px-3 font-bold">Dept</th>
                  <th className="py-2.5 px-3 font-bold">Task Type</th>
                  <th className="py-2.5 px-3 font-bold">Criticality</th>
                  <th className="py-2.5 px-3 font-bold">Priority</th>
                  <th className="py-2.5 px-3 font-bold">Duration</th>
                  <th className="py-2.5 px-3 font-bold">Window Slot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E6]">
                {sectionTasks.slice(0, 10).map((t) => (
                  <tr key={t.task_id} className="hover:bg-[#FFF9F2] transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#1F2937]">{t.task_id}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase bg-[#F1F5F9] text-[#475467]">
                        {t.department}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#1F2937]">{t.task_type}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-bold ${t.criticality === 'Critical' ? 'text-[#D92D20]' : 'text-[#B54708]'}`}>
                        {t.criticality}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#D92D20] font-mono">{t.priority_score.toFixed(1)}</td>
                    <td className="py-2.5 px-3 font-mono text-[#667085]">{t.duration_minutes}m</td>
                    <td className="py-2.5 px-3 font-mono text-[#475467]">
                      {t.assigned_start_time.slice(11)} → {t.assigned_end_time.slice(11)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
