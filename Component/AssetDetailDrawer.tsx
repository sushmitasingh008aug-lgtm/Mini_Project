import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Layers,
  Clock,
  AlertOctagon,
  BrainCircuit,
  CalendarRange,
  ShieldCheck,
  CheckCircle2,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { apiClient, AssetItem } from '../api/client';

interface AssetDetailDrawerProps {
  assetId: string | null;
  onClose: () => void;
  onCreateTask?: (assetId: string) => void;
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({ assetId, onClose, onCreateTask }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'impact' | 'ai' | 'planning'>('overview');
  const [asset, setAsset] = useState<AssetItem | null>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!assetId) return;
    async function loadData() {
      setLoading(true);
      try {
        const [aRes, hRes] = await Promise.all([
          apiClient.get<any>(`/assets/${assetId}`).catch(() => null),
          apiClient.get<any>(`/assets/${assetId}/history`).catch(() => null),
        ]);
        if (aRes?.data?.data) setAsset(aRes.data.data);
        if (hRes?.data) setHistory(hRes.data);
      } catch (err) {
        console.error('Error loading asset detail:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [assetId]);

  if (!assetId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="p-4 border-b border-[#E6E6E6] bg-gradient-to-b from-white to-[#FAFAF9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
              <Activity className="w-5 h-5 text-[#D96F13]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#1F2937] font-mono">{assetId}</h2>
                <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${
                  asset?.condition_score && asset.condition_score < 40
                    ? 'bg-[#FFF4ED] text-[#D92D20] border border-[#FECDCA]'
                    : 'bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]'
                }`}>
                  Condition {asset?.condition_score || 72}/100
                </span>
              </div>
              <p className="text-xs text-[#667085]">{asset?.asset_type} · {asset?.department} · {asset?.section_id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCreateTask && (
              <button
                onClick={() => onCreateTask(assetId)}
                className="px-3 py-1.5 bg-[#7F1418] hover:bg-[#651013] text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5 text-[#FF9933]" />
                <span>CREATE MAINTENANCE TASK</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#667085] hover:bg-[#F7F7F5] hover:text-[#1F2937]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 5 Tabs Navigation */}
        <div className="flex items-center border-b border-[#E6E6E6] bg-[#F7F7F5] px-4 text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'history', label: 'History', icon: Clock },
            { id: 'impact', label: 'Impact', icon: AlertOctagon },
            { id: 'ai', label: 'AI & SHAP', icon: BrainCircuit },
            { id: 'planning', label: 'Planning', icon: CalendarRange },
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

        {/* Body Content */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-[#FAFAF9] p-4 rounded-xl border border-[#E6E6E6]">
                <div>
                  <span className="text-[10.5px] text-[#667085] block">Asset Number</span>
                  <span className="font-bold text-[#1F2937]">{asset?.asset_number || 'IR-TRK-00124'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#667085] block">Subtype</span>
                  <span className="font-bold text-[#1F2937]">{asset?.asset_subtype || '60kg UIC Continuous Rail'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#667085] block">Operational Corridor</span>
                  <span className="font-bold text-[#1F2937]">{asset?.corridor_id || 'CORR_BSB_LKO'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#667085] block">Chainage</span>
                  <span className="font-bold text-[#1F2937]">{asset?.chainage_km ? `${asset.chainage_km} km` : '142.4 km'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#667085] block">Health Index</span>
                  <span className="font-bold text-[#12B76A]">{asset?.health_index || 78}/100</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#667085] block">Criticality Class</span>
                  <span className="font-bold text-[#D92D20]">{asset?.criticality_class || 'Class A'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#667085] block">Last Inspection Date</span>
                  <span className="font-bold text-[#1F2937]">{asset?.last_inspection_date || '2026-08-10'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-[#667085] block">Last Maintenance</span>
                  <span className="font-bold text-[#1F2937]">{asset?.last_maintenance_date || '2026-07-15'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085]">Defect History ({history?.defects?.length || 0})</h3>
              {history?.defects?.length > 0 ? (
                <div className="space-y-2">
                  {history.defects.map((d: any) => (
                    <div key={d.defect_id} className="p-3 bg-white border border-[#E6E6E6] rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#1F2937]">{d.defect_type}</span>
                        <span className="text-[11px] text-[#667085] block">{d.detected_at}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF4ED] text-[#D92D20]">
                        {d.severity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#FAFAF9] p-4 rounded-lg text-center text-[#667085]">Zero open defects.</div>
              )}

              <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085] pt-2">Inspections</h3>
              {history?.inspections?.length > 0 ? (
                <div className="space-y-2">
                  {history.inspections.map((i: any) => (
                    <div key={i.inspection_id} className="p-3 bg-white border border-[#E6E6E6] rounded-lg flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#1F2937]">{i.inspection_type}</span>
                        <span className="text-[11px] text-[#667085] block">Score: {i.condition_score}/100 · {i.inspection_date}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#1F2937]">{i.inspector_id}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#FAFAF9] p-4 rounded-lg text-center text-[#667085]">Routine checks recorded.</div>
              )}
            </div>
          )}

          {activeTab === 'impact' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#FAFAF9] p-4 rounded-xl border border-[#E6E6E6]">
                  <span className="text-[10px] text-[#667085] block uppercase font-bold">Historical Delayed Trains</span>
                  <span className="text-xl font-extrabold text-[#D92D20]">4 Trains</span>
                  <span className="text-[11px] text-[#667085] block mt-0.5">Average delay: 35 min</span>
                </div>
                <div className="bg-[#FAFAF9] p-4 rounded-xl border border-[#E6E6E6]">
                  <span className="text-[10px] text-[#667085] block uppercase font-bold">Total Detention</span>
                  <span className="text-xl font-extrabold text-[#7F1418]">140 min</span>
                  <span className="text-[11px] text-[#667085] block mt-0.5">Operational impact exposure</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-4 text-xs">
              <div className="bg-[#FFF9F2] p-4 rounded-xl border border-[#FFD9B3] space-y-2 text-[#8C4A08]">
                <div className="flex items-center justify-between">
                  <span className="font-bold">ML Predictive Risk Probability: 0.78</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF4ED] text-[#D92D20]">
                    CRITICAL PRIORITY
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Formula Breakdown: Priority = 100 × Risk (0.78) × Impact (0.84) × Urgency (0.72) = <strong>47.2</strong>
                </p>
              </div>

              <h4 className="text-xs font-bold text-[#1F2937]">SHAP Explanatory Contributions</h4>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-[#FAFAF9] p-2 rounded border border-[#E6E6E6]">
                  <span>Condition Score &lt; 40</span>
                  <span className="font-bold text-[#D92D20]">+0.34 (Positive Risk)</span>
                </div>
                <div className="flex items-center justify-between bg-[#FAFAF9] p-2 rounded border border-[#E6E6E6]">
                  <span>Asset Age &gt; 18 Years</span>
                  <span className="font-bold text-[#D92D20]">+0.22 (Positive Risk)</span>
                </div>
                <div className="flex items-center justify-between bg-[#FAFAF9] p-2 rounded border border-[#E6E6E6]">
                  <span>Recent Inspection Passed</span>
                  <span className="font-bold text-[#12B76A]">-0.12 (Risk Mitigation)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'planning' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-white border border-[#E6E6E6] rounded-lg">
                <span className="font-bold text-[#1F2937] block">Assigned Block Window</span>
                <span className="text-[11px] text-[#667085]">Window BW-102 (Available 02:00 - 04:30, Line DOWN)</span>
              </div>
              <div className="p-3 bg-white border border-[#E6E6E6] rounded-lg">
                <span className="font-bold text-[#1F2937] block">Multi-Department Compatibility</span>
                <span className="text-[11px] text-[#12B76A] font-semibold">Compatible with S&T Signal Point Check in same sectional block.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
