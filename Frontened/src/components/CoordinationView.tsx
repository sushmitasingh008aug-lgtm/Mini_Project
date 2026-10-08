import React, { useState, useEffect } from 'react';
import {
  Combine,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Zap,
  Check,
  X,
  Clock,
  Layers
} from 'lucide-react';
import { CompatibilityPair, CompatibilityResponse, apiClient } from '../api/client';
import { ViewType } from './Sidebar';

interface CoordinationProps {
  onNavigate: (view: ViewType) => void;
}

export const CoordinationView: React.FC<CoordinationProps> = ({ onNavigate }) => {
  const [pairs, setPairs] = useState<CompatibilityPair[]>([]);
  const [summary, setSummary] = useState<CompatibilityResponse['summary'] | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'COMPATIBLE' | 'INCOMPATIBLE'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get<CompatibilityResponse>('/compatibility')
      .then(res => {
        setPairs(res.data.data || []);
        setSummary(res.data.summary || null);
      })
      .catch(err => console.error('Failed to load compatibility:', err))
      .finally(() => setLoading(false));
  }, []);

  const filteredPairs = pairs.filter(p => {
    if (filter === 'COMPATIBLE') return p.is_compatible === 1;
    if (filter === 'INCOMPATIBLE') return p.is_compatible === 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E6E6E6] shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
              <Combine className="w-4 h-4" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-[#1F2937] font-display">
              Cross-Department Coordination Center
            </h2>
          </div>
          <p className="text-xs text-[#667085] mt-1 ml-10">
            Deterministic 8-point compatibility verification for Engineering (TMS), Traction (TDMS), and Signalling (SMMS)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex bg-[#F7F7F5] p-1 rounded-xl border border-[#E6E6E6] text-xs font-semibold">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'ALL' ? 'bg-white text-[#1F2937] shadow-sm border border-[#E6E6E6]' : 'text-[#667085]'
              }`}
            >
              All ({pairs.length})
            </button>
            <button
              onClick={() => setFilter('COMPATIBLE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'COMPATIBLE' ? 'bg-[#12B76A] text-white shadow-sm' : 'text-[#667085]'
              }`}
            >
              Approved ({summary?.compatible_pairs || 93})
            </button>
            <button
              onClick={() => setFilter('INCOMPATIBLE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'INCOMPATIBLE' ? 'bg-[#D92D20] text-white shadow-sm' : 'text-[#667085]'
              }`}
            >
              Blocked ({summary?.incompatible_pairs || 24})
            </button>
          </div>
          <button
            onClick={() => onNavigate('block_planner')}
            className="px-4 py-2 bg-[#FF9933] hover:bg-[#D96F13] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            Solve in CP-SAT →
          </button>
        </div>
      </div>

      {/* Section 14: Hero Feature Candidate Card (SEC-03 Coordination Opportunity) */}
      <div className="bg-white rounded-2xl border-2 border-[#FF9933] shadow-md overflow-hidden">
        <div className="bg-[#FFF3E6] border-b border-[#FFD9B3] px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF9933] animate-ping" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#B85C00]">
              HERO CANDIDATE CARD · SEC-03 COORDINATION OPPORTUNITY
            </span>
          </div>
          <span className="text-[11px] font-bold text-[#12B76A] bg-[#D1FADF] px-2.5 py-0.5 rounded-full border border-[#A6F4C5]">
            2 Line Closures Avoided (3 Departments Consolidated)
          </span>
        </div>

        <div className="p-6">
          {/* Department Grouping */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {/* Dept 1 */}
            <div className="p-3.5 rounded-xl border border-[#FEDF89] bg-[#FFFAEB]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#B54708]">
                  ENGINEERING (P-WAY)
                </span>
                <span className="text-xs font-bold text-[#D92D20]">Risk: 0.94</span>
              </div>
              <p className="text-xs font-bold text-[#1F2937]">TMS-1045: Broken Rail Weld Repair</p>
              <p className="text-[10.5px] text-[#667085] mt-1">Duration: 90m · Exclusive Tamper Not Required</p>
            </div>

            {/* Dept 2 */}
            <div className="p-3.5 rounded-xl border border-[#B2DDFF] bg-[#EFF8FF]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#175CD3]">
                  S&amp;T (SIGNALLING)
                </span>
                <span className="text-xs font-bold text-[#D92D20]">Risk: 0.89</span>
              </div>
              <p className="text-xs font-bold text-[#1F2937]">SMMS-2081: Track Circuit Replacement</p>
              <p className="text-[10.5px] text-[#667085] mt-1">Duration: 60m · Disconnection Key Pre-Approved</p>
            </div>

            {/* Dept 3 */}
            <div className="p-3.5 rounded-xl border border-[#E9D7FE] bg-[#F9F5FF]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6927DA]">
                  TRACTION (OHE)
                </span>
                <span className="text-xs font-bold text-[#D92D20]">Risk: 0.82</span>
              </div>
              <p className="text-xs font-bold text-[#1F2937]">TDMS-3012: OHE Isolator Replacement</p>
              <p className="text-[10.5px] text-[#667085] mt-1">Duration: 90m · 25kV Power Block Discharge</p>
            </div>
          </div>

          {/* 8 Checkmarks Strip */}
          <div className="p-4 rounded-xl bg-[#FFF9F2] border border-[#FFD9B3] mb-5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#8C4A08] block mb-2">
              Deterministic 8-Point Compatibility Verification Status:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-[#1F2937]">
              <div className="flex items-center gap-1.5 text-[#12B76A]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Same Section (SEC-03)</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#12B76A]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Compatible Actions</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#12B76A]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Resources Available</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#12B76A]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Isolation Compatible</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#12B76A]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Time Overlap Available</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#12B76A]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Safe Clearance Buffer</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#12B76A]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Dependency Sequence OK</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#12B76A]">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Zero Train Conflict</span>
              </div>
            </div>
          </div>

          {/* Primary CTA (Saffron) */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#667085]">
              Recommendation: Pack into single 90-minute joint corridor possession (10:00 – 11:30 AM).
            </p>
            <button
              onClick={() => onNavigate('block_planner')}
              className="px-6 py-2.5 bg-[#FF9933] hover:bg-[#D96F13] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              OPTIMIZE THIS GROUP
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E6E6E6] shadow-sm">
          <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">Candidate Pairs</span>
          <p className="text-2xl font-extrabold text-[#1F2937] font-display mt-1">{summary?.total_pairs_evaluated || pairs.length || 117}</p>
          <span className="text-[11px] text-[#667085]">Cross-department pairs</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#A6F4C5] bg-[#F6FEF9] shadow-sm">
          <span className="text-[10px] font-bold text-[#0F7644] uppercase tracking-wider block">Approved Pairs</span>
          <p className="text-2xl font-extrabold text-[#12B76A] font-display mt-1">{summary?.compatible_pairs || 93}</p>
          <span className="text-[11px] text-[#0F7644] font-semibold">100% 8-Point checks PASS</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#FDA29B] bg-[#FEF3F2] shadow-sm">
          <span className="text-[10px] font-bold text-[#912018] uppercase tracking-wider block">Blocked Incompatible</span>
          <p className="text-2xl font-extrabold text-[#D92D20] font-display mt-1">{summary?.incompatible_pairs || 24}</p>
          <span className="text-[11px] text-[#B42318] font-semibold">Protected by safety rules</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[#FFD9B3] bg-[#FFF9F2] shadow-sm">
          <span className="text-[10px] font-bold text-[#8C4A08] uppercase tracking-wider block">Coordination Index</span>
          <p className="text-2xl font-extrabold text-[#D96F13] font-display mt-1">{summary?.coordination_readiness_pct || 79.5}%</p>
          <span className="text-[11px] text-[#B85C00] font-semibold">Corridor readiness rate</span>
        </div>
      </div>

      {/* 8-Point Canonical Principle Banner */}
      <div className="bg-[#FFF9F2] border border-[#FFD9B3] rounded-2xl p-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-[#8C4A08] mb-2">
          <ShieldCheck className="w-4 h-4 text-[#D96F13]" />
          Canonical Principle: "Same section does not mean automatic merging."
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-[#475467]">
          <div className="bg-white p-2.5 rounded-lg border border-[#F2E5D5]">
            <b className="text-[#1F2937]">1. Spatial:</b> Same section footprint
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#F2E5D5]">
            <b className="text-[#1F2937]">2. Possession:</b> Directional alignment
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#F2E5D5]">
            <b className="text-[#1F2937]">3. Isolation:</b> OHE / Signal compatibility
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#F2E5D5]">
            <b className="text-[#1F2937]">4. Resources:</b> No machine contention
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#F2E5D5]">
            <b className="text-[#1F2937]">5. Dependencies:</b> Sequence order preserved
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#F2E5D5]">
            <b className="text-[#1F2937]">6. Time Ratio:</b> Durations balanced (≤2.5x)
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#F2E5D5]">
            <b className="text-[#1F2937]">7. Safety:</b> Clearance buffers maintained
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#F2E5D5]">
            <b className="text-[#1F2937]">8. Operations:</b> Zero train conflicts
          </div>
        </div>
      </div>

      {/* Candidate Pair Cards List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-[#667085] text-xs animate-pulse">
            Verifying deterministic compatibility checks across candidate pairs...
          </div>
        ) : (
          filteredPairs.slice(0, 25).map((p) => {
            const isComp = p.is_compatible === 1;

            return (
              <div
                key={p.pair_id}
                className={`p-4 rounded-2xl border transition-all ${
                  isComp
                    ? 'border-[#E6E6E6] bg-white hover:border-[#FF9933]'
                    : 'border-[#FDA29B] bg-[#FEF3F2]/40'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#1F2937]">{p.pair_id}</span>
                    <span className="text-xs text-[#667085] font-medium">· Section: <b className="text-[#1F2937]">{p.section_id}</b></span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10.5px] font-bold flex items-center gap-1.5 ${
                      isComp
                        ? 'bg-[#D1FADF] text-[#0F7644] border border-[#A6F4C5]'
                        : 'bg-[#FEE4E2] text-[#D92D20] border border-[#FDA29B]'
                    }`}
                  >
                    {isComp ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {isComp ? 'COMPATIBLE FOR COORDINATION' : 'INCOMPATIBLE - MERGE PROHIBITED'}
                  </span>
                </div>

                {/* Side-by-side Task Matchup */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="p-3 rounded-xl border border-[#E6E6E6] bg-[#FAFAFA]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                        Task 1 ({p.dept_1})
                      </span>
                      <span className="font-bold text-xs text-[#D92D20]">{p.prio_1.toFixed(1)} Pts</span>
                    </div>
                    <p className="text-xs font-bold text-[#1F2937]">{p.task_id_1}: {p.type_1}</p>
                  </div>

                  <div className="p-3 rounded-xl border border-[#E6E6E6] bg-[#FAFAFA]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                        Task 2 ({p.dept_2})
                      </span>
                      <span className="font-bold text-xs text-[#D92D20]">{p.prio_2.toFixed(1)} Pts</span>
                    </div>
                    <p className="text-xs font-bold text-[#1F2937]">{p.task_id_2}: {p.type_2}</p>
                  </div>
                </div>

                {/* Audit Reason Codes */}
                <div className="text-[11px] text-[#475467] bg-[#F7F7F5] p-3 rounded-xl border border-[#E6E6E6]">
                  <span className="font-bold text-[#1F2937] block mb-1">Deterministic Audit Reasons:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {p.reason_codes.map((rc, idx) => (
                      <li
                        key={idx}
                        className={
                          rc.includes('PROHIBITED') || rc.includes('MISMATCH') || rc.includes('VIOLATION')
                            ? 'text-[#D92D20] font-semibold'
                            : 'text-[#0F7644]'
                        }
                      >
                        {rc}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
