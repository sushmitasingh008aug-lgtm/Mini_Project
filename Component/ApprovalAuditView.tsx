import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  History,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Check,
  Clock,
  RefreshCw,
  Calendar,
  Search,
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';
import { ScheduleVersion, AuditEntry, apiClient } from '../api/client';

export interface PendingBlockRequest {
  task_id: string;
  asset_id: string;
  department: string;
  task_type: string;
  criticality: string;
  priority_score: number;
  section_id: string;
  section_name: string;
  duration_minutes: number;
  start_minute: number;
  end_minute: number;
  combined_group_id: string;
  block_id: string;
  affects_line: string;
  status: string;
  updated_at?: string;
  created_at?: string;
  window_display: string;
  train_conflicts_count: number;
}

interface ApprovalAuditViewProps {
  onNavigate?: (view: string, initialSearch?: string) => void;
}

export const ApprovalAuditView: React.FC<ApprovalAuditViewProps> = ({ onNavigate }) => {
  const [version, setVersion] = useState<ScheduleVersion | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [supervisorName, setSupervisorName] = useState('Chief Section Controller, BSB Division');
  const [remarks, setRemarks] = useState('Corridor possession schedule reviewed. Timetable interval walls and 0 train conflicts verified.');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  // Individual Block Requests Queue State
  const [pendingRequests, setPendingRequests] = useState<PendingBlockRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null);
  const [requestSearch, setRequestSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error';
    text: string;
    blockId?: string;
    taskId?: string;
  } | null>(null);

  const loadData = () => {
    apiClient.get<{ data: ScheduleVersion }>('/approvals')
      .then(res => setVersion(res.data.data))
      .catch(err => console.error('Failed to load version:', err));

    apiClient.get<{ data: AuditEntry[] }>('/audit')
      .then(res => setAuditLogs(res.data.data || []))
      .catch(err => console.error('Failed to load audit logs:', err));
  };

  const loadRequests = () => {
    setLoadingRequests(true);
    apiClient.get<{ status: string; count: number; data: PendingBlockRequest[] }>('/approvals/requests')
      .then(res => {
        setPendingRequests(res.data.data || []);
      })
      .catch(err => console.error('Failed to load pending block requests:', err))
      .finally(() => setLoadingRequests(false));
  };

  useEffect(() => {
    loadData();
    loadRequests();
  }, []);

  const handleDecision = (status: 'APPROVED' | 'REJECTED') => {
    setSubmitting(true);
    apiClient.post('/approvals', {
      version_id: version?.version_id,
      status,
      supervisor_name: supervisorName,
      remarks
    })
      .then(() => {
        setMsg(`Plan has been successfully marked as ${status === 'APPROVED' ? 'APPROVED' : 'REVISION REQUIRED'}.`);
        loadData();
      })
      .catch(err => {
        setMsg('Failed to submit approval: ' + err.message);
      })
      .finally(() => setSubmitting(false));
  };

  const handleApproveRequest = async (req: PendingBlockRequest) => {
    setApprovingTaskId(req.task_id);
    setActionNotice(null);
    try {
      const res = await apiClient.post<{
        status: string;
        message: string;
        block_id: string;
        task_id: string;
        assigned_window: string;
      }>(`/approvals/requests/${req.task_id}/approve`, {
        supervisor_name: supervisorName,
        remarks: remarks || `Block possession window approved for ${req.task_type} on ${req.section_name}.`,
        block_id: req.block_id
      });

      setActionNotice({
        type: 'success',
        text: res.data?.message || `Block ${req.block_id} for Task ${req.task_id} approved and assigned to Weekly Block Planner.`,
        blockId: res.data?.block_id || req.block_id,
        taskId: req.task_id
      });

      // Immediately refresh queue and immutable audit trail
      loadRequests();
      loadData();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: 'Approval failed: ' + (err.response?.data?.message || err.message)
      });
    } finally {
      setApprovingTaskId(null);
    }
  };

  const handleRejectRequest = async (req: PendingBlockRequest) => {
    setRejectingTaskId(req.task_id);
    setActionNotice(null);
    try {
      const res = await apiClient.post<{ status: string; message: string }>(
        `/approvals/requests/${req.task_id}/reject`,
        {
          supervisor_name: supervisorName,
          remarks: remarks || `Possession request rejected/deferred by controller.`
        }
      );

      setActionNotice({
        type: 'success',
        text: res.data?.message || `Block request for Task ${req.task_id} rejected and returned to backlog.`
      });

      loadRequests();
      loadData();
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        text: 'Rejection failed: ' + (err.response?.data?.message || err.message)
      });
    } finally {
      setRejectingTaskId(null);
    }
  };

  const isApproved = version?.status === 'APPROVED';

  // Section 21 Stepper Stages
  const stages = [
    { label: 'AI RECOMMENDED', active: true, done: true },
    { label: 'SUPERVISOR REVIEW', active: true, done: isApproved },
    { label: 'MODIFIED', active: false, done: isApproved },
    { label: 'APPROVED', active: isApproved, done: isApproved },
    { label: 'EXECUTION', active: isApproved, done: false },
    { label: 'VERIFIED', active: false, done: false },
  ];

  // Filter pending requests
  const filteredRequests = pendingRequests.filter(req => {
    const matchesDept = selectedDept === 'All' || req.department?.toLowerCase() === selectedDept.toLowerCase();
    const q = requestSearch.toLowerCase().trim();
    const matchesSearch = !q ||
      req.block_id?.toLowerCase().includes(q) ||
      req.task_id?.toLowerCase().includes(q) ||
      req.asset_id?.toLowerCase().includes(q) ||
      req.section_name?.toLowerCase().includes(q) ||
      req.section_id?.toLowerCase().includes(q) ||
      req.task_type?.toLowerCase().includes(q);
    return matchesDept && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E6E6E6] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
              <FileCheck2 className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2937] font-display">
              Human Review &amp; Audit Trail
            </h2>
          </div>
          <p className="text-xs text-[#667085] mt-1 ml-10">
            Section Controller sign-off, live block possession authorization, and immutable governance ledger
          </p>
        </div>
        <span className="text-xs font-bold text-[#D96F13] bg-[#FFF3E6] px-3 py-1.5 rounded-xl border border-[#FFD9B3] self-start sm:self-auto">
          L4 Controller Authority
        </span>
      </div>

      {msg && (
        <div className="p-3.5 bg-[#D1FADF] border border-[#A6F4C5] text-[#0F7644] text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {msg}
        </div>
      )}

      {/* Section 21: Stepper Workflow Card */}
      <div className="bg-white p-5 rounded-2xl border border-[#E6E6E6] shadow-sm">
        <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block mb-3">
          Schedule Governance Lifecycle Stepper
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {stages.map((st, idx) => (
            <div
              key={st.label}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                st.done
                  ? 'bg-[#F6FEF9] border-[#A6F4C5] text-[#0F7644]'
                  : st.active
                  ? 'bg-[#FFF3E6] border-[#FF9933] text-[#B85C00] font-bold ring-1 ring-[#FF9933]'
                  : 'bg-[#F7F7F5] border-[#E6E6E6] text-[#667085]'
              }`}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center bg-current/10">
                  {st.done ? <Check className="w-3 h-3" /> : idx + 1}
                </span>
              </div>
              <p className="text-[10.5px] font-extrabold truncate">{st.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: PENDING BLOCK REQUESTS & CONTROLLER REVIEW QUEUE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-[#E6E6E6] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#E6E6E6] bg-[#FCFCFD] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-[#EFF8FF] border border-[#B2DDFF] flex items-center justify-center text-[#175CD3]">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider font-display">
                    Pending Block Requests &amp; Controller Review Queue
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#FFF3E6] text-[#B85C00] border border-[#FFD9B3]">
                    {pendingRequests.length} Pending Approval
                  </span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5">
                  Requested block possessions requiring Section Controller authorization before assignment into Weekly Block Planner.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => { loadRequests(); loadData(); }}
              disabled={loadingRequests}
              className="px-3 py-1.5 border border-[#E6E6E6] bg-white hover:bg-[#F7F7F5] text-xs font-semibold text-[#344054] rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
              title="Refresh requests queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? 'animate-spin text-[#FF9933]' : 'text-[#667085]'}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Action / Notification Banner */}
        {actionNotice && (
          <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            actionNotice.type === 'success'
              ? 'bg-[#F6FEF9] border-[#A6F4C5] text-[#0F7644]'
              : 'bg-[#FEF3F2] border-[#FDA29B] text-[#D92D20]'
          }`}>
            <div className="flex items-center gap-2.5">
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-[#0F7644] shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[#D92D20] shrink-0" />
              )}
              <span className="text-xs font-bold">{actionNotice.text}</span>
            </div>

            {actionNotice.blockId && onNavigate && (
              <button
                onClick={() => onNavigate('weekly_planner', actionNotice.blockId)}
                className="px-3.5 py-1.5 bg-[#0F7644] hover:bg-[#085d34] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <span>View in Weekly Block Planner (Search <span className="font-mono underline">{actionNotice.blockId}</span>)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Filter bar */}
        <div className="p-4 bg-[#F9FAFB] border-b border-[#E6E6E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-[#667085] flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Department:
            </span>
            {['All', 'Engineering', 'TRD', 'S&T'].map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  selectedDept === dept
                    ? 'bg-[#1F2937] text-white shadow-sm'
                    : 'bg-white border border-[#E6E6E6] text-[#475467] hover:bg-gray-100'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Block ID, Task ID, Section..."
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-[#E6E6E6] rounded-xl bg-white text-[#1F2937] focus:outline-none focus:border-[#FF9933]"
            />
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] mx-auto flex items-center justify-center text-[#16A34A] mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#1F2937]">No Pending Block Requests</h4>
              <p className="text-xs text-[#667085] max-w-md mx-auto mt-1">
                {requestSearch || selectedDept !== 'All'
                  ? 'No block requests match your current filters. Clear search or select All departments.'
                  : 'All requested track blocks have been approved or processed. New requests generated from Section 3 (Task Generator) or Section 4 (Weekly Planner) will appear here instantly.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-[#F7F7F5] border-b border-[#E6E6E6] uppercase text-[10px] tracking-wider text-[#667085]">
                <tr>
                  <th className="py-3 px-4 font-bold">Assigned Block ID</th>
                  <th className="py-3 px-4 font-bold">Task &amp; Asset</th>
                  <th className="py-3 px-4 font-bold">Department / Type</th>
                  <th className="py-3 px-4 font-bold">Corridor Section</th>
                  <th className="py-3 px-4 font-bold">Proposed Possession Window</th>
                  <th className="py-3 px-4 font-bold">Safety &amp; Train Overlaps</th>
                  <th className="py-3 px-4 font-bold">Priority</th>
                  <th className="py-3 px-4 font-bold text-right">Controller Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E6]">
                {filteredRequests.map((req) => {
                  const isApproving = approvingTaskId === req.task_id;
                  const isRejecting = rejectingTaskId === req.task_id;

                  const deptColor =
                    req.department?.toUpperCase() === 'TRD' || req.department?.toUpperCase() === 'TRACTION'
                      ? 'bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]'
                      : req.department?.toUpperCase() === 'S&T' || req.department?.toUpperCase() === 'SIGNALING'
                      ? 'bg-[#FDF2FA] text-[#C11574] border-[#FCCEEE]'
                      : 'bg-[#FFF3E6] text-[#B85C00] border-[#FFD9B3]';

                  return (
                    <tr key={req.task_id} className="hover:bg-[#FFFDF9] transition group">
                      {/* Block ID */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-xs bg-[#FFF3E6] text-[#D96F13] px-2.5 py-1 rounded-lg border border-[#FFD9B3] inline-flex items-center gap-1.5 shadow-xs">
                          <Sparkles className="w-3 h-3 text-[#FF9933]" />
                          {req.block_id}
                        </span>
                      </td>

                      {/* Task & Asset */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-xs text-[#1F2937]">{req.task_id}</div>
                        <div className="font-mono text-[11px] text-[#667085] mt-0.5">{req.asset_id || 'Track Asset'}</div>
                      </td>

                      {/* Department / Type */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${deptColor}`}>
                          {req.department}
                        </span>
                        <div className="text-xs font-semibold text-[#344054] mt-1">{req.task_type}</div>
                      </td>

                      {/* Section */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-xs text-[#1F2937]">{req.section_name}</div>
                        <div className="text-[10.5px] font-mono text-[#667085] mt-0.5">
                          {req.section_id} ({req.affects_line || 'BOTH'} Line)
                        </div>
                      </td>

                      {/* Proposed Possession Window */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-[#1F2937]">
                          <Calendar className="w-3.5 h-3.5 text-[#D96F13]" />
                          {req.window_display}
                        </div>
                        <div className="text-[11px] text-[#667085] mt-0.5 font-mono">
                          Duration: {req.duration_minutes} mins (Min {req.start_minute}-{req.end_minute})
                        </div>
                      </td>

                      {/* Safety & Train Conflicts */}
                      <td className="py-3 px-4">
                        {req.train_conflicts_count === 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D1FADF] text-[#0F7644] border border-[#A6F4C5] inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            0 Train Conflicts (Safe)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3F2] text-[#D92D20] border border-[#FDA29B] inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {req.train_conflicts_count} Potential Overlaps
                          </span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            req.criticality === 'HIGH'
                              ? 'bg-[#FEF3F2] text-[#D92D20]'
                              : req.criticality === 'MEDIUM'
                              ? 'bg-[#FFF3E6] text-[#B85C00]'
                              : 'bg-[#F0FDF4] text-[#16A34A]'
                          }`}
                        >
                          {req.criticality || 'MEDIUM'}
                        </span>
                        <div className="text-[10px] font-mono text-[#667085] mt-0.5">
                          Score: {req.priority_score}
                        </div>
                      </td>

                      {/* Controller Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRejectRequest(req)}
                            disabled={isApproving || isRejecting}
                            className="px-2.5 py-1.5 border border-[#FDA29B] bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#D92D20] text-xs font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-1"
                            title="Reject possession request"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {isRejecting ? 'Rejecting...' : 'Reject'}
                          </button>
                          <button
                            onClick={() => handleApproveRequest(req)}
                            disabled={isApproving || isRejecting}
                            className="px-3.5 py-1.5 bg-[#0F7644] hover:bg-[#085d34] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                            title="Approve and assign block to Weekly Planner"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isApproving ? 'Approving...' : 'Approve & Assign'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Main Review Card */}
      <div className="bg-white p-6 rounded-2xl border border-[#E6E6E6] shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between border-b border-[#E6E6E6] pb-4 gap-3">
          <div>
            <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
              Schedule Version: {version?.version_id || 'VER_2026_01'}
            </span>
            <h3 className="text-base font-bold text-[#1F2937] mt-0.5 font-display">
              CP-SAT Coordinated Block Schedule ({version?.horizon_days || 7}-Day Horizon)
            </h3>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isApproved
                ? 'bg-[#D1FADF] text-[#0F7644] border border-[#A6F4C5]'
                : 'bg-[#FFF3E6] text-[#B85C00] border border-[#FFD9B3]'
            }`}
          >
            Status: {version?.status || 'PROPOSED'}
          </span>
        </div>

        {/* Plan Governance Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#1F2937] uppercase tracking-wider block mb-1.5">
              Reviewing Supervisor / Section Controller
            </label>
            <input
              type="text"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
              className="w-full text-xs border border-[#E6E6E6] rounded-xl p-2.5 bg-[#F7F7F5] font-semibold text-[#1F2937] focus:outline-none focus:border-[#FF9933]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#1F2937] uppercase tracking-wider block mb-1.5">
              Official Review Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full text-xs border border-[#E6E6E6] rounded-xl p-2.5 bg-[#F7F7F5] text-[#1F2937] focus:outline-none focus:border-[#FF9933]"
            />
          </div>
        </div>

        {/* Action Buttons (Section 21: 'Approve Recommended Plan') */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#E6E6E6] gap-3">
          <p className="text-xs text-[#667085]">
            Signing records immutable audit stamp with SHA-256 integrity hash into <code className="font-mono text-[#D96F13]">audit_log</code>.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDecision('REJECTED')}
              disabled={submitting || isApproved}
              className="px-4 py-2 border border-[#FDA29B] bg-[#FEF3F2] text-[#D92D20] text-xs font-bold rounded-xl hover:bg-[#FEE4E2] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Revision Required
            </button>
            <button
              onClick={() => handleDecision('APPROVED')}
              disabled={submitting || isApproved}
              className="px-6 py-2 bg-[#FF9933] hover:bg-[#D96F13] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isApproved ? 'Plan Approved (Locked)' : 'Approve Recommended Plan'}
            </button>
          </div>
        </div>
      </div>

      {/* Immutable Audit Trail Log */}
      <div className="bg-white rounded-2xl border border-[#E6E6E6] shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E6E6E6] bg-[#F7F7F5] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-[#D96F13]" />
            Chronological Immutable Audit Log
          </h3>
          <span className="text-[11px] text-[#667085]">Tamper-resistant database trail</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1F2937]">
            <thead className="bg-[#F7F7F5] border-b border-[#E6E6E6] uppercase text-[10px] tracking-wider text-[#667085]">
              <tr>
                <th className="py-3 px-4 font-bold">Log ID</th>
                <th className="py-3 px-4 font-bold">Action</th>
                <th className="py-3 px-4 font-bold">Authorized By</th>
                <th className="py-3 px-4 font-bold">Timestamp</th>
                <th className="py-3 px-4 font-bold">Entity / Version</th>
                <th className="py-3 px-4 font-bold">Remarks &amp; Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E6E6]">
              {auditLogs.map((log) => {
                const actionName = (log as any).action || log.event_type || 'SYSTEM_EVENT';
                const versionOrEntity = (log as any).schedule_version || log.details?.schedule_version || log.entity_id || 'VER_2026_01';
                const remarksText = (log as any).remarks || (typeof log.details === 'string' ? log.details : log.details?.remarks || log.details?.action || 'Operational review completed');
                const blockId = log.details?.block_id || '';

                return (
                  <tr key={log.log_id} className="hover:bg-[#FFF9F2] transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#1F2937]">{log.log_id}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                          actionName.includes('APPROVED')
                            ? 'bg-[#D1FADF] text-[#0F7644]'
                            : actionName.includes('OPTIMIZATION') || actionName.includes('SUBMITTED')
                            ? 'bg-[#FFF3E6] text-[#B85C00]'
                            : 'bg-[#EFF8FF] text-[#175CD3]'
                        }`}
                      >
                        {actionName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#1F2937]">{log.user_id}</td>
                    <td className="py-3 px-4 font-mono text-[#667085]">{log.timestamp}</td>
                    <td className="py-3 px-4 font-mono text-[#667085]">{versionOrEntity}</td>
                    <td className="py-3 px-4 text-[#475467]">
                      {blockId ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[11px] text-[#D96F13] bg-[#FFF3E6] px-1.5 py-0.5 rounded">
                            {blockId}
                          </span>
                          <span>{remarksText}</span>
                        </div>
                      ) : (
                        remarksText
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
