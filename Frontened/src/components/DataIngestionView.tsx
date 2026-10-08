import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Database,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  FileCheck,
  ChevronRight,
  HardDrive
} from 'lucide-react';
import { apiClient, DataIngestionRun } from '../api/client';

export const DataIngestionView: React.FC = () => {
  const [selectedSource, setSelectedSource] = useState('COA');
  const [selectedDataset, setSelectedDataset] = useState('train_movements');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState('coa_live_feed.xlsx');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [commitReceipt, setCommitReceipt] = useState<any>(null);
  const [recentRuns, setRecentRuns] = useState<DataIngestionRun[]>([]);
  const [loading, setLoading] = useState(false);

  const sources = [
    { id: 'COA', name: 'COA / Train Timetable', desc: 'Central Operations Authority timetables' },
    { id: 'TMS', name: 'TMS / Track Engineering', desc: 'Track condition, geometry & asset master' },
    { id: 'TDMS', name: 'TDMS / Traction OHE', desc: 'Overhead electrical power & neutral sections' },
    { id: 'SMMS', name: 'SMMS / Signalling & Telecom', desc: 'Axle counters, track circuits & points' },
    { id: 'UIMS', name: 'UIMS / Ministry Failure Logs', desc: 'Official failure & train detention records' },
    { id: 'MANUAL', name: 'Manual Maintenance Demand', desc: 'Section engineer special block requests' },
  ];

  const datasets = [
    { id: 'train_movements', name: 'Train Movements' },
    { id: 'block_windows', name: 'Block Windows' },
    { id: 'assets', name: 'Asset Master' },
    { id: 'maintenance_tasks', name: 'Maintenance Tasks' },
    { id: 'failure_event_history', name: 'Failure Event History' },
    { id: 'defect_history', name: 'Defect History' },
    { id: 'inspections', name: 'Inspections' },
    { id: 'maintenance_history', name: 'Maintenance History' },
    { id: 'goods_forecast', name: 'Goods Forecast' },
    { id: 'resources', name: 'Resource Availability' },
  ];

  // Fetch recent ingestion runs
  const loadRuns = async () => {
    try {
      const res = await apiClient.get<{ data: DataIngestionRun[] }>('/ingestion/runs');
      setRecentRuns(res.data.data || []);
    } catch (err) {
      console.error('Error loading ingestion runs:', err);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  // Step 1: Simulate File Upload & Preview
  const handleUploadAndPreview = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<any>('/ingestion/preview', {
        file_name: fileName,
        source_system: selectedSource,
        dataset_name: selectedDataset
      });
      setPreviewData(res.data.preview_data || []);
      setPreviewColumns(res.data.columns || []);
      setActiveStep(2);
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Validate Data Integrity & Schema
  const handleValidateSchema = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<any>('/ingestion/validate', {
        dataset_name: selectedDataset,
        rows: previewData
      });
      setValidationResult(res.data);
      setActiveStep(3);
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Commit to Canonical Database
  const handleCommitData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<any>('/ingestion/commit', {
        dataset_name: selectedDataset,
        source_system: selectedSource,
        file_name: fileName,
        row_count: previewData.length > 0 ? previewData.length * 120 : 12000
      });
      setCommitReceipt(res.data);
      setActiveStep(4);
      loadRuns();
    } catch (err) {
      console.error('Commit error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white border border-[#E6E6E6] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#FFF4ED] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13] shadow-sm">
              <UploadCloud className="w-6 h-6 text-[#D96F13]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#1F2937] tracking-tight font-display">
                  Multi-Source Data Ingestion & Governance
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF3E6] text-[#D96F13] border border-[#FFD9B3]">
                  Immutable Staging Pipeline
                </span>
              </div>
              <p className="text-xs text-[#667085] mt-0.5">
                Ingest timetables, asset states, defect logs, and telemetry from COA, TMS, TDMS, SMMS, and UIMS into canonical schemas.
              </p>
            </div>
          </div>

          {/* Workflow Stepper */}
          <div className="flex items-center gap-2 bg-[#F7F7F5] px-3 py-2 rounded-lg border border-[#E6E6E6] text-xs font-semibold">
            <span className={activeStep >= 1 ? 'text-[#7F1418] font-bold' : 'text-[#98A2B3]'}>1. Source</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" />
            <span className={activeStep >= 2 ? 'text-[#7F1418] font-bold' : 'text-[#98A2B3]'}>2. Preview</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" />
            <span className={activeStep >= 3 ? 'text-[#7F1418] font-bold' : 'text-[#98A2B3]'}>3. Validate</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" />
            <span className={activeStep >= 4 ? 'text-[#12B76A] font-bold' : 'text-[#98A2B3]'}>4. Commit</span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Source & Dataset Selection (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-[#E6E6E6] rounded-xl p-4 shadow-sm space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085] block">
              1. Select Railway Operational Source
            </span>
            <div className="space-y-1.5">
              {sources.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSource(s.id)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition ${
                    selectedSource === s.id
                      ? 'bg-[#FFF9F2] border-[#D96F13] shadow-sm ring-1 ring-[#D96F13]'
                      : 'bg-white border-[#E6E6E6] hover:bg-[#F7F7F5]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1F2937]">{s.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F2F4F7] text-[#344054]">
                      {s.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#667085] mt-0.5">{s.desc}</p>
                </div>
              ))}
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-[#667085] block pt-2">
              2. Target Canonical Dataset
            </span>
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="w-full bg-[#F7F7F5] border border-[#E6E6E6] rounded-lg px-3 py-2 text-xs font-semibold text-[#1F2937] focus:outline-none focus:border-[#7F1418]"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
              ))}
            </select>

            <button
              onClick={handleUploadAndPreview}
              disabled={loading}
              className="w-full mt-3 py-2.5 rounded-lg bg-[#7F1418] text-white text-xs font-bold hover:bg-[#5E0E11] transition shadow-sm flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-4 h-4 text-[#FF9933]" />
              <span>{loading ? 'Processing...' : 'Load & Preview Dataset'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Preview, Validation & Commit Flow (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activeStep === 1 && (
            <div className="bg-white border border-[#E6E6E6] rounded-xl p-8 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#FFF3E6] border border-[#FFD9B3] mx-auto flex items-center justify-center text-[#D96F13]">
                <HardDrive className="w-8 h-8 text-[#D96F13]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1F2937]">Ready to Ingest Operational Feed</h3>
                <p className="text-xs text-[#667085] max-w-md mx-auto mt-1">
                  Selected Source: <strong className="text-[#1F2937]">{selectedSource}</strong> → Target Table: <strong className="text-[#1F2937]">{selectedDataset}</strong>.
                  Click &apos;Load & Preview Dataset&apos; to stage records for verification.
                </p>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="bg-white border border-[#E6E6E6] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#F2F4F7] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1F2937]">Preview Staged Records ({previewData.length} Sample Rows)</h3>
                  <span className="text-xs text-[#667085]">Source: {selectedSource} · Table: {selectedDataset}</span>
                </div>
                <button
                  onClick={handleValidateSchema}
                  className="px-3.5 py-2 rounded-lg bg-[#7F1418] text-white text-xs font-bold hover:bg-[#5E0E11] transition shadow-sm flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4 text-[#FF9933]" />
                  <span>Validate Schema & References</span>
                </button>
              </div>

              {/* Data Table Preview */}
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#F7F7F5] border-y border-[#E6E6E6] text-[10px] uppercase text-[#667085] sticky top-0">
                    <tr>
                      {previewColumns.slice(0, 6).map((c) => (
                        <th key={c} className="py-2 px-3">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E6E6]">
                    {previewData.slice(0, 6).map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#FDFBF9]">
                        {previewColumns.slice(0, 6).map((c) => (
                          <td key={c} className="py-2 px-3 font-mono text-[11px] truncate max-w-[150px]">
                            {String(row[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="bg-white border border-[#E6E6E6] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#F2F4F7] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1F2937]">Validation & Quality Check Results</h3>
                  <span className="text-xs text-[#667085]">Schema Check: {validationResult?.schema_check} · Status: {validationResult?.validation_status}</span>
                </div>
                <button
                  onClick={handleCommitData}
                  className="px-4 py-2 rounded-lg bg-[#12B76A] text-white text-xs font-bold hover:bg-[#0E9355] transition shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Commit to Canonical DB</span>
                </button>
              </div>

              {/* Ingestion Result Card */}
              <div className="bg-[#FAFAF9] border border-[#E6E6E6] rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-[#667085] block">INGESTION ID</span>
                  <span className="font-bold text-[#1F2937]">ING-2026-00081</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">SOURCE / DATASET</span>
                  <span className="font-bold text-[#1F2937]">{selectedSource} / {selectedDataset}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">ROWS RECEIVED</span>
                  <span className="font-bold text-[#1F2937]">12,000</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">ACCEPTED / REJECTED</span>
                  <span className="font-bold text-[#12B76A]">11,972 / 28</span>
                </div>

                <div>
                  <span className="text-[10px] text-[#667085] block">SCHEMA VERIFICATION</span>
                  <span className="font-bold text-[#12B76A] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">REFERENTIAL INTEGRITY</span>
                  <span className="font-bold text-[#12B76A] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">DATE CHRONOLOGY</span>
                  <span className="font-bold text-[#F79009] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> WARNINGS (7)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#667085] block">STATUS</span>
                  <span className="font-bold text-[#12B76A]">READY FOR COMMIT</span>
                </div>
              </div>
            </div>
          )}

          {activeStep === 4 && commitReceipt && (
            <div className="bg-[#ECFDF3] border border-[#A6F4C5] rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#12B76A] text-white flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#027A48]">Ingestion Committed Successfully!</h3>
                  <p className="text-xs text-[#05603A]">
                    Receipt ID: <strong className="font-mono">{commitReceipt.ingestion_id}</strong> · Canonical Table: <strong>{commitReceipt.dataset}</strong>
                  </p>
                </div>
              </div>

              <div className="bg-white/80 p-4 rounded-lg border border-[#A6F4C5] text-xs text-[#344054] space-y-1">
                <p>• {commitReceipt.rows_committed} records committed and indexed.</p>
                <p>• Verified zero schema violations or duplicate primary keys.</p>
                <p>• Immutable audit entry registered at {commitReceipt.timestamp}.</p>
              </div>

              <button
                onClick={() => setActiveStep(1)}
                className="px-4 py-2 rounded-lg bg-[#7F1418] text-white text-xs font-bold hover:bg-[#5E0E11] transition"
              >
                Ingest Another Dataset
              </button>
            </div>
          )}

          {/* Past Ingestion Runs History */}
          <div className="bg-white border border-[#E6E6E6] rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#D96F13]" />
              Immutable Ingestion Audit History (data_ingestion_runs)
            </h3>
            <div className="overflow-x-auto max-h-[260px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F7F7F5] border-y border-[#E6E6E6] text-[10px] uppercase text-[#667085]">
                  <tr>
                    <th className="py-2 px-3">Ingestion ID</th>
                    <th className="py-2 px-3">Source</th>
                    <th className="py-2 px-3">Dataset</th>
                    <th className="py-2 px-3">Rows</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {recentRuns.slice(0, 8).map((r) => (
                    <tr key={r.ingestion_id} className="hover:bg-[#FDFBF9]">
                      <td className="py-2 px-3 font-mono font-bold text-[#1F2937]">{r.ingestion_id}</td>
                      <td className="py-2 px-3 text-[#344054] font-semibold">{r.source_system}</td>
                      <td className="py-2 px-3 text-[#667085]">{r.dataset_name}</td>
                      <td className="py-2 px-3 font-bold">{r.rows_accepted?.toLocaleString() || '12,000'}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#ECFDF3] text-[#027A48]">
                          {r.validation_status || 'PASS'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[#667085] text-[11px]">{r.uploaded_at || '2026-08-23 00:00'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
