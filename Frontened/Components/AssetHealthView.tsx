import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  Layers,
  Clock,
  ArrowRight
} from 'lucide-react';
import { apiClient, AssetItem, PaginatedResponse } from '../api/client';
import { AssetDetailDrawer } from './AssetDetailDrawer';

interface AssetHealthViewProps {
  onOpenTaskGenerator?: (assetId?: string | null) => void;
}

export const AssetHealthView: React.FC<AssetHealthViewProps> = ({ onOpenTaskGenerator }) => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [total, setTotal] = useState(12000);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedCrit, setSelectedCrit] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (selectedDept) params.append('department', selectedDept);
      if (selectedCrit) params.append('criticality', selectedCrit);
      if (searchQuery) params.append('search', searchQuery);

      const res = await apiClient.get<PaginatedResponse<AssetItem>>(`/assets?${params.toString()}`);
      setAssets(res.data.data || []);
      setTotal(res.data.total || 12000);
    } catch (err) {
      console.error('Error loading assets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [page, selectedDept, selectedCrit]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadAssets();
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white border border-[#E6E6E6] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#FFF4ED] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13] shadow-sm">
              <Activity className="w-6 h-6 text-[#D96F13]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#1F2937] tracking-tight font-display">
                  Asset Health & Physical Degradation Monitor
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF3E6] text-[#D96F13] border border-[#FFD9B3]">
                  12,000 Canonical Assets
                </span>
              </div>
              <p className="text-xs text-[#667085] mt-0.5">
                Full lifecycle condition monitoring across Engineering (Track), Traction (OHE), and S&T (Signalling & Telecom) assets.
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Asset ID / Type..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#F7F7F5] border border-[#E6E6E6] rounded-lg text-xs focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-[#7F1418] text-white text-xs font-bold hover:bg-[#5E0E11] transition shadow-sm"
            >
              Filter
            </button>
          </form>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E6E6E6] rounded-xl p-3 shadow-sm flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#667085] uppercase text-[10px]">Department:</span>
          {['', 'Engineering', 'Traction', 'S&T'].map((d) => (
            <button
              key={d}
              onClick={() => { setSelectedDept(d); setPage(1); }}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                selectedDept === d
                  ? 'bg-[#7F1418] text-white'
                  : 'bg-[#F7F7F5] text-[#344054] hover:bg-[#E6E6E6]'
              }`}
            >
              {d || 'All Departments'}
            </button>
          ))}

          <span className="font-bold text-[#667085] uppercase text-[10px] ml-4">Criticality:</span>
          {['', 'Class A+', 'Class A', 'Class B', 'Class C'].map((c) => (
            <button
              key={c}
              onClick={() => { setSelectedCrit(c); setPage(1); }}
              className={`px-2.5 py-1 rounded-md font-semibold transition ${
                selectedCrit === c
                  ? 'bg-[#D96F13] text-white'
                  : 'bg-[#F7F7F5] text-[#344054] hover:bg-[#E6E6E6]'
              }`}
            >
              {c || 'All Classes'}
            </button>
          ))}
        </div>

        <span className="text-xs text-[#667085]">
          Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} assets
        </span>
      </div>

      {/* Asset Table */}
      <div className="bg-white border border-[#E6E6E6] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F7F7F5] border-b border-[#E6E6E6] text-[10px] uppercase text-[#667085]">
              <tr>
                <th className="py-2.5 px-3">Asset ID</th>
                <th className="py-2.5 px-3">Asset Number</th>
                <th className="py-2.5 px-3">Type / Subtype</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Section</th>
                <th className="py-2.5 px-3">Condition</th>
                <th className="py-2.5 px-3">Health Index</th>
                <th className="py-2.5 px-3">Criticality</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E6E6]">
              {assets.map((a) => (
                <tr
                  key={a.asset_id}
                  onClick={() => setSelectedAssetId(a.asset_id)}
                  className="hover:bg-[#FDFBF9] cursor-pointer transition"
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-[#1F2937]">{a.asset_id}</td>
                  <td className="py-2.5 px-3 text-[#667085]">{a.asset_number}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-[#1F2937] block">{a.asset_type}</span>
                    <span className="text-[10px] text-[#667085] block truncate max-w-[150px]">{a.asset_subtype}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#F2F4F7] text-[#344054]">
                      {a.department}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-[#667085]">{a.section_id}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                        <div
                          style={{ width: `${a.condition_score}%` }}
                          className={`h-full rounded-full ${
                            a.condition_score < 40
                              ? 'bg-[#D92D20]'
                              : a.condition_score < 70
                              ? 'bg-[#F79009]'
                              : 'bg-[#12B76A]'
                          }`}
                        />
                      </div>
                      <span className="font-bold text-[#1F2937]">{a.condition_score}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-[#12B76A]">{a.health_index} / 100</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                      a.criticality_class?.includes('A')
                        ? 'bg-[#FFF4ED] text-[#D92D20]'
                        : 'bg-[#F2F4F7] text-[#344054]'
                    }`}>
                      {a.criticality_class || 'Class B'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAssetId(a.asset_id);
                      }}
                      className="text-[11px] font-bold text-[#7F1418] hover:underline"
                    >
                      Inspect v4
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-[#E6E6E6] bg-[#FAFAF9] flex items-center justify-between text-xs">
          <span className="text-[#667085]">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total.toLocaleString()} total assets)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded border border-[#E6E6E6] bg-white text-[#344054] hover:bg-[#F7F7F5] disabled:opacity-40 flex items-center gap-1 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded border border-[#E6E6E6] bg-white text-[#344054] hover:bg-[#F7F7F5] disabled:opacity-40 flex items-center gap-1 font-semibold"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5-Tab Asset Detail Drawer */}
      <AssetDetailDrawer
        assetId={selectedAssetId}
        onClose={() => setSelectedAssetId(null)}
        onCreateTask={(assetId) => {
          setSelectedAssetId(null);
          if (onOpenTaskGenerator) onOpenTaskGenerator(assetId);
        }}
      />
    </div>
  );
};
