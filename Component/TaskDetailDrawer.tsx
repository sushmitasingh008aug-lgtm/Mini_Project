import React, { useState, useEffect } from 'react';
import {
  X,
  ListTodo,
  Layers,
  Clock,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  Combine,
  GitBranch,
  CalendarRange
} from 'lucide-react';
import { apiClient, TaskAction, TaskDependency } from '../api/client';

interface TaskDetailDrawerProps {
  taskId: string | null;
  taskData?: any;
  onClose: () => void;
  onCreateTaskForAsset?: (assetId: string) => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({ taskId, taskData, onClose, onCreateTaskForAsset }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'actions' | 'dependencies' | 'compatibility'>('details');
  const [actions, setActions] = useState<TaskAction[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [compatibility, setCompatibility] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    async function loadTaskSubDetails() {
      setLoading(true);
      try {
        const [aRes, dRes, cRes] = await Promise.all([
          apiClient.get<any>(`/tasks/${taskId}/actions`).catch(() => null),
          apiClient.get<any>(`/tasks/${taskId}/dependencies`).catch(() => null),
          apiClient.get<any>(`/tasks/${taskId}/compatibility`).catch(() => null),
        ]);
        if (aRes?.data?.data) setActions(aRes.data.data);
        if (dRes?.data?.data) setDependencies(dRes.data.data);
        if (cRes?.data?.data) setCompatibility(cRes.data.data);
      } catch (err) {
        console.error('Error loading task details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTaskSubDetails();
  }, [taskId]);

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="p-4 border-b border-[#E6E6E6] bg-gradient-to-b from-white to-[#FAFAF9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#7F1418]">
              <ListTodo className="w-5 h-5 text-[#7F1418]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#1F2937] font-mono">{taskId}</h2>
                <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                  taskData?.criticality === 'Critical'
                    ? 'bg-[#FFF4ED] text-[#D92D20] border border-[#FECDCA]'
                    : 'bg-[#F2F4F7] text-[#344054]'
                }`}>
                  {taskData?.criticality || 'Normal'}
                </span>
              </div>
              <p className="text-xs text-[#667085]">{taskData?.task_type || 'Maintenance Task'} · {taskData?.department}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCreateTaskForAsset && taskData?.asset_id && (
              <button
                onClick={() => onCreateTaskForAsset(taskData.asset_id)}
                className="px-2.5 py-1.5 bg-[#7F1418] hover:bg-[#651013] text-white text-[10.5px] font-bold rounded-lg transition flex items-center gap-1.5"
              >
                <Wrench className="w-3 h-3 text-[#FF9933]" />
                <span>CREATE MAINTENANCE TASK</span>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#667085] hover:bg-[#F7F7F5] hover:text-[#1F2937]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-[#E6E6E6] bg-[#F7F7F5] px-4 text-xs font-semibold">
          {[
            { id: 'details', label: 'Identity & Status', icon: Layers },
            { id: 'actions', label: `Actions (${actions.length})`, icon: Wrench },
            { id: 'dependencies', label: `Dependencies (${dependencies.length})`, icon: GitBranch },
            { id: 'compatibility', label: `Compatibility (${compatibility.length})`, icon: Combine },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3 flex items-center gap-1.5 border-b-2 transition ${
                  active
                    ? 'border-[#7F1418] text-[#7F1418] font-bold bg-white'
                    : 'border-transparent text-[#667085] hover:text-[#1F2937]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'details' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 bg-[#FAFAF9] p-4 rounded-xl border border-[#E6E6E6]">
                <div>
                  <span className="text-[10px] text-[#667085] block">Target Asset</span>
                  <span className="font-bold text-[#1F2937]">{taskData?.asset_id || 'AST_00124'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">Section</span>
                  <span className="font-bold text-[#1F2937]">{taskData?.section_id || 'SEC_BSB_LKO_01'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">Work Duration</span>
                  <span className="font-bold text-[#1F2937]">{taskData?.duration_minutes || 60} min</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">Statutory Due Date</span>
                  <span className="font-bold text-[#D96F13]">{taskData?.due_date || '2026-08-30'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">Priority Score</span>
                  <span className="font-extrabold text-[#7F1418]">{taskData?.priority_score || 85.0} / 100</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">Isolation Requirement</span>
                  <span className="font-bold text-[#1F2937]">{taskData?.isolation_requirement || 'Track Possession'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                Concrete Action Sequence ({actions.length} Steps)
              </h3>
              {actions.length > 0 ? (
                <div className="space-y-2">
                  {actions.map((act, idx) => (
                    <div key={act.action_id || idx} className="p-3 bg-white border border-[#E6E6E6] rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1F2937]">{idx + 1}. {act.action_type}</span>
                        <span className="text-[11px] font-semibold text-[#667085]">{act.work_duration_minutes} min (Setup: {act.setup_minutes}m)</span>
                      </div>
                      <p className="text-[11px] text-[#667085]">Crew: {act.required_crew} · Resources: {act.required_resources}</p>
                      {act.verification_required === 1 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#027A48]">
                          <CheckCircle2 className="w-3 h-3 text-[#12B76A]" /> Joint Verification Required
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {['1. Section Protection & Flagging', '2. Power & Track Circuit Isolation', '3. Physical Maintenance Execution', '4. Optical & Electrical Testing', '5. Joint Section Controller Handover'].map((step, i) => (
                    <div key={i} className="p-2.5 bg-[#FAFAF9] border border-[#E6E6E6] rounded-lg font-semibold text-[#344054]">
                      {step}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                Precedence Constraints (min_lag_minutes)
              </h3>
              {dependencies.length > 0 ? (
                <div className="space-y-2">
                  {dependencies.map((dep, idx) => (
                    <div key={idx} className="p-3 bg-white border border-[#E6E6E6] rounded-lg">
                      <span className="font-bold text-[#1F2937] block">{dep.dependency_type}</span>
                      <span className="text-[11px] text-[#667085]">
                        Predecessor: <strong className="text-[#1F2937]">{dep.predecessor_task_id}</strong> → Lag: {dep.min_lag_minutes} min
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-[#FAFAF9] rounded-lg text-center text-[#667085]">
                  Independent task without blocking predecessors.
                </div>
              )}
            </div>
          )}

          {activeTab === 'compatibility' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                Evaluated Coordinated Block Pairs
              </h3>
              {compatibility.length > 0 ? (
                <div className="space-y-2">
                  {compatibility.slice(0, 5).map((cp, idx) => (
                    <div key={idx} className="p-3 bg-white border border-[#E6E6E6] rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1F2937]">Pair with {cp.task_id_1 === taskId ? cp.task_id_2 : cp.task_id_1}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                          cp.is_compatible === 1 ? 'bg-[#ECFDF3] text-[#027A48]' : 'bg-[#FFF4ED] text-[#D92D20]'
                        }`}>
                          {cp.is_compatible === 1 ? 'COMPATIBLE' : 'INCOMPATIBLE'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#667085] block">
                        Reasons: {Array.isArray(cp.reason_codes) ? cp.reason_codes.join(', ') : cp.reason_codes}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-[#FAFAF9] rounded-lg text-center text-[#667085]">
                  Evaluated across sectional compatibility rules.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
