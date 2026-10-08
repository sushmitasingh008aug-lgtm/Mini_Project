import React, { useState, useEffect } from 'react';
import { Section, SubmitBlockRequest, SubmitBlockResponse, ScheduledTask, apiClient } from '../api/client';
import { Minus, Plus, CheckCircle2, AlertCircle, RefreshCw, Calendar, ArrowRight, Clock, MapPin, Check, ClipboardList } from 'lucide-react';
import { ViewType } from './Sidebar';

interface SubmitTabProps {
  sections: Section[];
  onSubmissionSuccess?: () => void;
  onNavigate?: (view: ViewType) => void;
}

export const SubmitTab: React.FC<SubmitTabProps> = ({ sections, onSubmissionSuccess, onNavigate }) => {
  const [department, setDepartment] = useState('Engineering');
  const [targetSection, setTargetSection] = useState(sections[0]?.section_id || 'SEC_BSB_LKO_01');
  const [taskType, setTaskType] = useState('Broken Rail Weld Repair');
  const [criticality, setCriticality] = useState('High');
  const [duration, setDuration] = useState(90);
  const [dueDate, setDueDate] = useState('2026-08-25');

  const [submitting, setSubmitting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitBlockResponse | null>(null);
  const [scheduledTask, setScheduledTask] = useState<ScheduledTask | null>(null);

  const taskOptions: Record<string, string[]> = {
    Engineering: [
      'Broken Rail Weld Repair',
      'Track Gauge Spread Correction',
      'Ballast Deep Screening & Tamping',
      'Point Machine Mechanical Overhaul',
      'Fishplate & Fastener Replacement',
    ],
    Traction: [
      'OHE Dropper Broken Replacement',
      'Cantilever Insulator Flashover Repair',
      'Contact Wire Tension & Sag Correction',
      'Neutral Section Inspection',
      'Substation Switchgear Maintenance',
    ],
    'S&T': [
      'Track Circuit Short-Circuit Rectification',
      'Axle Counter Counting Sensor Error',
      'Signal Aspect Lamp / LED Failure',
      'Point Machine Detection Circuit Fault',
      'Interlocking Relay Bank Servicing',
    ],
  };

  const handleDeptChange = (dept: string) => {
    setDepartment(dept);
    setTaskType(taskOptions[dept]?.[0] || 'Routine Maintenance');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setOptimizing(false);
    setErrorMsg(null);
    setResult(null);
    setScheduledTask(null);

    const payload: SubmitBlockRequest = {
      department,
      target_section: targetSection,
      task_type: taskType,
      criticality,
      duration_minutes: duration,
      due_date: dueDate,
    };

    try {
      const res = await apiClient.post<SubmitBlockResponse>('/tasks/submit', payload);
      const newResult = res.data;
      setResult(newResult);
      setSubmitting(false);
      setOptimizing(true);

      // Trigger CP-SAT optimizer to place this task into the schedule
      await apiClient.post('/schedule/generate?horizon_days=7').catch(() => {});

      // Poll until optimizer finishes
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await apiClient.get('/schedule/status');
          if (!statusRes.data?.running) {
            clearInterval(pollInterval);
            setOptimizing(false);
            if (onSubmissionSuccess) onSubmissionSuccess();

            // Fetch updated schedule
            const schedRes = await apiClient.get<{ data: ScheduledTask[] }>('/schedule');
            const found = (schedRes.data.data || []).find((t) => t.task_id === newResult.task_id);
            if (found) {
              setScheduledTask(found);
            }
          }
        } catch {
          // Ignore transient poll error
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setOptimizing(false);
        if (onSubmissionSuccess) onSubmissionSuccess();
      }, 30000);

    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit block request. Please check inputs.');
      setSubmitting(false);
      setOptimizing(false);
    }
  };

  const critValues = ['Low', 'Medium', 'High', 'Critical'];
  const getCritIndex = () => critValues.indexOf(criticality);
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCriticality(critValues[parseInt(e.target.value, 10)]);
  };

  const inputCls =
    'w-full bg-[#F7F7F5] border border-[#E6E6E6] rounded-xl px-4 py-2.5 text-[#1F2937] text-xs font-semibold focus:outline-none focus:border-[#FF9933] focus:bg-white transition-all';

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E6E6E6] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
              <ClipboardList className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2937] font-display">
              Demand Submission &amp; Block Requisition
            </h2>
          </div>
          <p className="text-xs text-[#667085] mt-1 ml-10">
            Submit new departmental maintenance requirement for automated AI prioritization and CP-SAT block fitting
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#E6E6E6] rounded-2xl p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#1F2937] uppercase tracking-wider mb-2">
                  Department
                </label>
                <select value={department} onChange={(e) => handleDeptChange(e.target.value)} className={inputCls}>
                  <option value="Engineering">Engineering (TMS)</option>
                  <option value="Traction">Traction (TDMS)</option>
                  <option value="S&T">Signalling &amp; Telecom (SMMS)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2937] uppercase tracking-wider mb-2">
                  Target Section
                </label>
                <select value={targetSection} onChange={(e) => setTargetSection(e.target.value)} className={inputCls}>
                  {sections.map((sec) => (
                    <option key={sec.section_id} value={sec.section_id}>
                      {sec.section_id} ({sec.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2937] uppercase tracking-wider mb-2">
                  Maintenance Task Type
                </label>
                <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className={inputCls}>
                  {(taskOptions[department] || []).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-[#1F2937] uppercase tracking-wider">
                    Criticality Level
                  </label>
                  <span className={`text-xs font-extrabold ${
                    criticality === 'Critical' ? 'text-[#D92D20]'
                    : criticality === 'High' ? 'text-[#F79009]'
                    : criticality === 'Medium' ? 'text-[#2563EB]'
                    : 'text-[#12B76A]'
                  }`}>
                    {criticality}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  value={getCritIndex()}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FF9933]"
                />
                <div className="flex justify-between text-[11px] text-[#667085] mt-1">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                  <span className="text-[#D92D20] font-bold">Critical</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2937] uppercase tracking-wider mb-2">
                  Required Duration (Minutes)
                </label>
                <div className="flex items-center bg-[#F7F7F5] border border-[#E6E6E6] rounded-xl overflow-hidden">
                  <input
                    type="number"
                    min="15"
                    max="720"
                    step="15"
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value, 10) || 60)}
                    className="w-full bg-transparent px-4 py-2.5 text-[#1F2937] text-xs font-bold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setDuration(Math.max(15, duration - 15))}
                    className="p-2.5 text-[#667085] hover:text-[#1F2937] hover:bg-gray-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration(duration + 15)}
                    className="p-2.5 text-[#667085] hover:text-[#1F2937] hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2937] uppercase tracking-wider mb-2">
                  Target Completion Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E6E6E6] flex justify-end">
            <button
              type="submit"
              disabled={submitting || optimizing}
              className="px-6 py-2.5 bg-[#FF9933] hover:bg-[#D96F13] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Block Requisition...</span>
                </>
              ) : optimizing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>CP-SAT Optimizer Running...</span>
                </>
              ) : (
                <span>Calculate Priority &amp; Request Block Window →</span>
              )}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="mt-6 p-4 rounded-xl bg-[#FEF3F2] border border-[#FDA29B] text-[#D92D20] text-xs font-semibold flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <div className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between ${
              optimizing 
                ? 'bg-[#FFF3E6] border-[#FFD9B3] text-[#B85C00]' 
                : 'bg-[#D1FADF] border-[#A6F4C5] text-[#0F7644]'
            }`}>
              <div className="flex items-center gap-2">
                {optimizing ? (
                  <RefreshCw className="w-4 h-4 text-[#D96F13] animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0" />
                )}
                <span>
                  {optimizing 
                    ? `Task ${result.task_id} registered. CP-SAT solver is currently finding a conflict-free corridor slot...` 
                    : `Task ${result.task_id} successfully scheduled into optimal corridor block!`
                  }
                </span>
              </div>
              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-current">
                Priority: {(result.computed_priority_score || 0).toFixed(1)} / 100
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
