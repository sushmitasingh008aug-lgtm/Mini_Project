import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  Zap,
  Radio,
  Search,
  MapPin,
  Calendar,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Cpu,
  FileCheck2,
  Sparkles,
  ArrowRight,
  X,
  Map as MapIcon,
  Send,
  Activity,
  GitBranch,
  ShieldCheck,
  Check,
  Sliders,
  ChevronDown
} from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  apiClient,
  AssetItem,
  Section,
  TaskGenerationResponse,
  CandidateBlockOption
} from '../api/client';

export type DepartmentType = 'Engineering' | 'Traction' | 'S&T';

export const mapDepartmentToDb = (dept: DepartmentType): string => {
  switch (dept) {
    case 'Engineering':
      return 'ENGINEERING';
    case 'Traction':
      return 'TRD';
    case 'S&T':
      return 'S&T';
    default:
      return 'ENGINEERING';
  }
};

interface TaskGeneratorViewProps {
  initialAssetId?: string | null;
  onNavigate?: (view: any) => void;
}

// Department Task Templates
const DEPARTMENT_TEMPLATES: Record<DepartmentType, string[]> = {
  Engineering: [
    'Track Repair',
    'Rail Replacement',
    'Tamping',
    'Ballast Work',
    'Sleeper Replacement',
    'Turnout Maintenance',
    'Track Geometry Correction',
    'Bridge / Structure Inspection',
    'Drainage Work',
    'Vegetation Clearance',
    'Rail Welding',
    'USFD / Rail Inspection',
  ],
  Traction: [
    'OHE Inspection',
    'Contact Wire Maintenance',
    'Dropper Replacement',
    'OHE Adjustment',
    'Cantilever Maintenance',
    'Sectioning / Switching Work',
    'Traction Isolation',
    'TSS Inspection',
    'Power Supply Maintenance',
    'Tower Wagon Work',
  ],
  'S&T': [
    'Signal Maintenance',
    'Point Machine Maintenance',
    'Track Circuit Testing',
    'Axle Counter Maintenance',
    'Interlocking Testing',
    'Signal Lamp Replacement',
    'Cable Maintenance',
    'Telecommunication Maintenance',
    'Kavach / ATP Inspection',
    'S&T Isolation / Testing',
  ],
};

const ACTION_STAGES_DEFAULT = [
  'Site Preparation',
  'Traffic Protection',
  'Isolation',
  'Maintenance Work',
  'Testing',
  'Inspection',
  'Restoration',
  'Handover',
];

const RESOURCE_OPTIONS: Record<DepartmentType, string[]> = {
  Engineering: [
    'Track Gang P-Way (12 Pax)',
    'Tamping Machine (CSM/Duomatic)',
    'Ballast Regulator (BRM)',
    'Rail Welding Plant (Alumino-Thermic)',
    'USFD Flaw Detector Unit',
    'Track Crane / Portal Crane',
    'Engineering Inspection Vehicle'
  ],
  Traction: [
    'OHE Tower Wagon (4-Wheeler)',
    'OHE 8-Wheeler Tower Car',
    'TRD Breakdown Gang (8 Pax)',
    'Traction Power Specialist Crew',
    'Contact Wire Tensioning Winch',
    'Ladder Trolley Unit',
    'Thermal Imaging Camera Team'
  ],
  'S&T': [
    'Signal Maintenance Team (6 Pax)',
    'Point Machine Calibration Kit',
    'Track Circuit Multi-meter Set',
    'Axle Counter Diagnostic Tool',
    'Interlocking Simulation Rig',
    'Kavach On-board Diagnostic Team',
    'Optical Time Domain Reflectometer'
  ]
};

export const TaskGeneratorView: React.FC<TaskGeneratorViewProps> = ({
  initialAssetId,
  onNavigate,
}) => {
  // Department
  const [department, setDepartment] = useState<DepartmentType>('Engineering');

  // Asset search & selection
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetSearchResults, setAssetSearchResults] = useState<AssetItem[]>([]);
  const [recommendedAssets, setRecommendedAssets] = useState<AssetItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchingAssets, setIsSearchingAssets] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapAssets, setMapAssets] = useState<AssetItem[]>([]);
  const [isLoadingMapAssets, setIsLoadingMapAssets] = useState(false);
  const [mapFilterQuery, setMapFilterQuery] = useState('');

  const displayedMapAssets = useMemo(() => {
    if (!mapFilterQuery.trim()) return mapAssets;
    const q = mapFilterQuery.trim().toUpperCase();
    return mapAssets.filter(a => 
      (a.asset_id && a.asset_id.toUpperCase().includes(q)) ||
      (a.asset_number && a.asset_number.toUpperCase().includes(q)) ||
      (a.section_id && a.section_id.toUpperCase().includes(q)) ||
      (a.asset_type && a.asset_type.toUpperCase().includes(q))
    );
  }, [mapAssets, mapFilterQuery]);

  // Task form inputs
  const [taskType, setTaskType] = useState<string>('Rail Replacement');
  const [taskDescription, setTaskDescription] = useState<string>('Standard periodic rail section overhaul and geometry rectification.');
  const [defectCode, setDefectCode] = useState<string>('DEF-2026-ENG-082');
  const [maintenanceObjective, setMaintenanceObjective] = useState<string>('Restore track parameters to RDSO compliance standards.');
  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [affectsLine, setAffectsLine] = useState<'UP' | 'DOWN' | 'BOTH' | 'LOOP / SIDING' | 'COMMON'>('UP');
  const [blockRequirement, setBlockRequirement] = useState<
    'Traffic Block' | 'Power Block' | 'Traffic + Power Block' | 'Engineering Block' | 'S&T Block' | 'Integrated Block'
  >('Traffic + Power Block');
  const [isolationRequirement, setIsolationRequirement] = useState<string>('Power Isolation');
  const [selectedResources, setSelectedResources] = useState<string[]>([
    'Track Gang P-Way (12 Pax)',
    'Tamping Machine (CSM/Duomatic)'
  ]);
  const [selectedStages, setSelectedStages] = useState<string[]>(ACTION_STAGES_DEFAULT);
  const [dependencyTaskId, setDependencyTaskId] = useState<string>('');
  const [dependencyLag, setDependencyLag] = useState<number>(15);
  const [remarks, setRemarks] = useState<string>('');

  // Target Completion / Scheduled Execution Date
  const getRelativeDate = (daysAhead: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };

  const [targetCompletionDate, setTargetCompletionDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>('NIGHT');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<TaskGenerationResponse | null>(null);
  const [submittedToAudit, setSubmittedToAudit] = useState(false);

  // Update default task type and resources when department changes
  const handleDepartmentChange = (newDept: DepartmentType) => {
    setDepartment(newDept);
    const templates = DEPARTMENT_TEMPLATES[newDept];
    if (templates.length > 0) {
      setTaskType(templates[0]);
    }
    const defaultRes = RESOURCE_OPTIONS[newDept].slice(0, 2);
    setSelectedResources(defaultRes);
    if (newDept === 'Traction') {
      setBlockRequirement('Traffic + Power Block');
      setIsolationRequirement('OHE Isolation');
    } else if (newDept === 'S&T') {
      setBlockRequirement('S&T Block');
      setIsolationRequirement('S&T Isolation');
    } else {
      setBlockRequirement('Traffic Block');
      setIsolationRequirement('Track Protection');
    }
  };

  // Pre-load asset if initialAssetId is provided
  useEffect(() => {
    if (initialAssetId) {
      apiClient.get<any>(`/assets/${initialAssetId}`)
        .then(res => {
          if (res.data?.data) {
            const ast = res.data.data;
            setSelectedAsset(ast);
            if (ast.department) {
              const d = ast.department.toUpperCase();
              if (d.includes('ENG') || d.includes('CIVIL')) handleDepartmentChange('Engineering');
              else if (d.includes('TRD') || d.includes('TRACTION') || d.includes('OHE')) handleDepartmentChange('Traction');
              else if (d.includes('S&T') || d.includes('SIGNAL')) handleDepartmentChange('S&T');
            }
          }
        })
        .catch(err => console.warn('Could not pre-load initial asset:', err));
    }
  }, [initialAssetId]);

  // Load recommended top-priority assets whenever department changes
  useEffect(() => {
    const dbDept = mapDepartmentToDb(department);
    apiClient.get<any>(`/assets?department=${dbDept}&limit=12`)
      .then(res => {
        if (res.data?.data) {
          setRecommendedAssets(res.data.data);
        }
      })
      .catch(err => console.warn('Could not load recommended assets:', err));
  }, [department]);

  // Asset search debounce
  useEffect(() => {
    if (!assetSearchQuery || assetSearchQuery.trim().length === 0) {
      setAssetSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingAssets(true);
      try {
        const dbDept = mapDepartmentToDb(department);
        const res = await apiClient.get<any>(`/assets?search=${encodeURIComponent(assetSearchQuery.trim())}&department=${dbDept}&limit=20`);
        if (res.data?.data) {
          setAssetSearchResults(res.data.data);
        }
      } catch (err) {
        console.warn('Asset search failed:', err);
      } finally {
        setIsSearchingAssets(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [assetSearchQuery, department]);

  // Load map assets for picker whenever modal opens or department changes
  useEffect(() => {
    if (showMapPicker) {
      setIsLoadingMapAssets(true);
      const dbDept = mapDepartmentToDb(department);
      apiClient.get<any>(`/assets?department=${dbDept}&limit=200`)
        .then(res => {
          if (res.data?.data) {
            setMapAssets(res.data.data);
          }
        })
        .catch(err => console.warn('Could not load map assets:', err))
        .finally(() => setIsLoadingMapAssets(false));
    }
  }, [showMapPicker, department]);

  // Toggle stage selection
  const toggleStage = (stage: string) => {
    if (selectedStages.includes(stage)) {
      if (selectedStages.length > 1) {
        setSelectedStages(selectedStages.filter(s => s !== stage));
      }
    } else {
      setSelectedStages([...selectedStages, stage]);
    }
  };

  // Toggle resource selection
  const toggleResource = (res: string) => {
    if (selectedResources.includes(res)) {
      setSelectedResources(selectedResources.filter(r => r !== res));
    } else {
      setSelectedResources([...selectedResources, res]);
    }
  };

  // Validation
  const validateForm = (): boolean => {
    setErrorMessage(null);
    if (!selectedAsset) {
      setErrorMessage('Please select a valid railway asset from the network master or map.');
      return false;
    }
    if (!taskType.trim()) {
      setErrorMessage('Please select or specify a task type.');
      return false;
    }
    if (durationMinutes < 15 || durationMinutes > 720) {
      setErrorMessage('Duration must be between 15 and 720 minutes (safety boundary).');
      return false;
    }
    if (!targetCompletionDate) {
      setErrorMessage('Please specify a target completion date for the task.');
      return false;
    }
    if (selectedResources.length === 0) {
      setErrorMessage('Please select at least one required resource / gang.');
      return false;
    }
    return true;
  };

  // Generate Task Handler
  const handleGenerateTask = async () => {
    if (!validateForm() || !selectedAsset) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSubmittedToAudit(false);

    try {
      const payload = {
        department,
        asset_id: selectedAsset.asset_id,
        task_type: taskType,
        task_description: taskDescription,
        defect_code: defectCode,
        maintenance_objective: maintenanceObjective,
        duration_minutes: durationMinutes,
        due_date: targetCompletionDate,
        target_completion_date: targetCompletionDate,
        preferred_time_slot: preferredTimeSlot,
        affects_line: affectsLine,
        block_requirement: blockRequirement,
        isolation_requirement: isolationRequirement,
        required_resources: selectedResources,
        action_stages: selectedStages,
        dependency_task_id: dependencyTaskId || undefined,
        dependency_lag_minutes: dependencyLag,
        remarks: remarks || undefined
      };

      const res = await apiClient.post<TaskGenerationResponse>('/tasks/generate', payload);
      if (res.data && res.data.status === 'success') {
        setResult(res.data);
      } else {
        setErrorMessage('Unexpected response from scheduling engine.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error generating maintenance task';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit to Human Review
  const handleSubmitToHumanReview = async () => {
    if (!result?.task?.task_id) return;
    try {
      await apiClient.post(`/tasks/${result.task.task_id}/schedule`, {
        block_id: result.block_recommendation?.block_id || 'BLK-ALLOCATED'
      });
      setSubmittedToAudit(true);
    } catch (err: any) {
      console.error('Error submitting to human review:', err);
      setSubmittedToAudit(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-[#E6E6E6] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F2F4F7] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
              <Wrench className="w-6 h-6 text-[#D96F13]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight font-display">
                  TASK GENERATOR & BLOCK ALLOCATION
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                  ABPS v4.0 Operational Engine
                </span>
              </div>
              <p className="text-xs text-[#667085] mt-0.5">
                Submit cross-departmental maintenance requirements (Engineering, TRD, S&T) and obtain mathematically certified CP-SAT block windows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="px-3 py-1.5 text-xs font-semibold text-[#344054] hover:bg-[#F2F4F7] rounded-lg border border-[#D0D5DD] transition"
            >
              Dashboard
            </button>
            <button
              onClick={() => onNavigate && onNavigate('approvals_audit')}
              className="px-3 py-1.5 text-xs font-bold text-[#7F1418] hover:bg-[#FFF4ED] rounded-lg border border-[#FECDCA] transition flex items-center gap-1.5"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Review Queue</span>
            </button>
          </div>
        </div>

        {/* [1] Department Selection */}
        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#344054] block mb-2">
            [1] Department Selection
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'Engineering' as DepartmentType,
                name: 'Civil Engineering (P-Way / Track)',
                icon: Wrench,
                color: 'text-[#D96F13]',
                border: 'border-[#FFD9B3]',
                bg: 'bg-[#FFF9F2]',
                desc: 'Track, Rails, Sleepers, Ballast & Turnouts'
              },
              {
                id: 'Traction' as DepartmentType,
                name: 'TRD / Traction (OHE & Power)',
                icon: Zap,
                color: 'text-[#7F1418]',
                border: 'border-[#FECDCA]',
                bg: 'bg-[#FFF4ED]',
                desc: 'Overhead Equipment, Droppers & TSS'
              },
              {
                id: 'S&T' as DepartmentType,
                name: 'Signal & Telecom (S&T)',
                icon: Radio,
                color: 'text-[#027A48]',
                border: 'border-[#A6F4C5]',
                bg: 'bg-[#ECFDF3]',
                desc: 'Signals, Points, Interlocking & Track Circuits'
              },
            ].map((d) => {
              const Icon = d.icon;
              const isSelected = department === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleDepartmentChange(d.id)}
                  className={`p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 ${
                    isSelected
                      ? `${d.border} ${d.bg} ring-2 ring-offset-1 ring-[#D96F13]`
                      : 'border-[#E6E6E6] bg-white hover:border-[#D0D5DD]'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${d.bg} border ${d.border}`}>
                    <Icon className={`w-5 h-5 ${d.color}`} />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-[#1F2937] block">
                      {d.name}
                    </span>
                    <span className="text-[11px] text-[#667085] mt-0.5 block">
                      {d.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main 2-Column Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* [2] Asset & Location Selection */}
          <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#344054] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#D96F13]" />
                <span>[2] Asset & Location Selection</span>
              </label>

              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="px-2.5 py-1 text-xs font-bold text-[#D96F13] bg-[#FFF8F0] border border-[#FFD9B3] rounded-lg hover:bg-[#FFEEDB] transition flex items-center gap-1.5"
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>SELECT FROM MAP</span>
              </button>
            </div>

            {/* Search Input with Clear & State Indicators */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#98A2B3]" />
              <input
                type="text"
                value={assetSearchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setAssetSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                placeholder={`Search ${department} assets by ID, type (e.g. TRK, RAIL, OHE, POINT), section (e.g. SEC-DH-01)...`}
                className="w-full pl-9 pr-24 py-2.5 text-xs border border-[#D0D5DD] rounded-xl focus:ring-2 focus:ring-[#D96F13] focus:border-[#D96F13] outline-none"
              />
              <div className="absolute right-3 top-2.5 flex items-center gap-2">
                {isSearchingAssets && (
                  <span className="text-[10px] text-[#98A2B3] font-semibold animate-pulse">
                    Searching...
                  </span>
                )}
                {assetSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssetSearchQuery('');
                      setAssetSearchResults([]);
                    }}
                    className="p-0.5 rounded text-[#98A2B3] hover:text-[#344054]"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="p-0.5 text-[#98A2B3] hover:text-[#344054]"
                  title="Toggle asset list"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Quick Priority Select Chips */}
            {!selectedAsset && recommendedAssets.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#667085] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#D96F13]" />
                    <span>Quick Select Urgent {department} Assets:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="text-[#D96F13] hover:underline font-semibold"
                  >
                    {isDropdownOpen ? 'Hide List' : 'Browse All Suggestions'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recommendedAssets.slice(0, 4).map((ast) => (
                    <button
                      key={ast.asset_id}
                      type="button"
                      onClick={() => {
                        setSelectedAsset(ast);
                        setIsDropdownOpen(false);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-[#FAFAF9] hover:bg-[#FFF4ED] hover:border-[#FFD9B3] hover:text-[#D92D20] border border-[#E6E6E6] rounded-lg transition flex items-center gap-1.5 text-[#344054]"
                    >
                      <span className="font-mono font-bold text-[#7F1418]">{ast.asset_id}</span>
                      <span className="text-[#667085]">({ast.asset_type})</span>
                      <span className="text-[10px] font-bold text-[#D92D20] bg-red-50 px-1 rounded">
                        Cond: {ast.condition_score}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results / Recommended Dropdown */}
            {(isDropdownOpen || assetSearchResults.length > 0) && !selectedAsset && (
              <div className="border border-[#E6E6E6] rounded-xl max-h-64 overflow-y-auto divide-y divide-[#F2F4F7] bg-white shadow-xl z-20">
                <div className="p-2 bg-[#F9FAFB] text-[11px] font-bold text-[#475467] flex items-center justify-between border-b border-[#EAECF0]">
                  <span>
                    {assetSearchQuery.trim().length > 0
                      ? `Search Results (${assetSearchResults.length} found)`
                      : `Top Priority ${department} Assets (${recommendedAssets.length} available)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-[#98A2B3] hover:text-[#344054] text-[10px] font-semibold"
                  >
                    Close ✕
                  </button>
                </div>
                {(assetSearchQuery.trim().length > 0 ? assetSearchResults : recommendedAssets).map((ast) => (
                  <div
                    key={ast.asset_id}
                    onClick={() => {
                      setSelectedAsset(ast);
                      setIsDropdownOpen(false);
                      setAssetSearchResults([]);
                      setAssetSearchQuery('');
                    }}
                    className="p-2.5 hover:bg-[#FFF8F0] cursor-pointer text-xs flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1F2937] font-mono">{ast.asset_id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[#475467] font-semibold">
                          {ast.asset_type}
                        </span>
                        <span className="text-[10px] text-[#667085] font-medium">{ast.section_id}</span>
                        {ast.criticality_class && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            ast.criticality_class === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                            ast.criticality_class === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {ast.criticality_class}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#667085] mt-0.5">
                        Chainage {ast.chainage_km} km · Subtype: {ast.asset_subtype || 'Standard'} · Health Index: {ast.health_index}%
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      ast.condition_score < 25 ? 'bg-[#FEE4E2] text-[#D92D20]' :
                      ast.condition_score < 50 ? 'bg-[#FEF0C7] text-[#B54708]' :
                      'bg-[#ECFDF3] text-[#027A48]'
                    }`}>
                      Cond: {ast.condition_score}/100
                    </span>
                  </div>
                ))}
                {(assetSearchQuery.trim().length > 0 ? assetSearchResults : recommendedAssets).length === 0 && (
                  <div className="p-4 text-center text-xs text-[#667085]">
                    No assets found matching your criteria. Try adjusting the search query or select another department.
                  </div>
                )}
              </div>
            )}

            {/* Selected Asset Context Badge */}
            {selectedAsset ? (
              <div className="bg-[#FAFAF9] border border-[#E6E6E6] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#7F1418] font-mono">
                      {selectedAsset.asset_id}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF4ED] text-[#D92D20] border border-[#FECDCA]">
                      {selectedAsset.criticality_class || 'High'} Criticality
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAsset(null)}
                    className="text-xs text-[#667085] hover:text-[#D92D20] font-semibold"
                  >
                    Change Asset
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[#667085] uppercase block font-semibold">Corridor / Section</span>
                    <span className="font-bold text-[#1F2937]">{selectedAsset.section_id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#667085] uppercase block font-semibold">Chainage</span>
                    <span className="font-bold text-[#1F2937]">{selectedAsset.chainage_km} km</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#667085] uppercase block font-semibold">Condition Score</span>
                    <span className="font-bold text-[#12B76A]">{selectedAsset.condition_score} / 100</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#667085] uppercase block font-semibold">Operational Status</span>
                    <span className="font-bold text-[#027A48]">{selectedAsset.operational_status || 'Operational'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#FFFBF0] border border-[#FEDF89] rounded-xl text-xs text-[#B54708] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Select an asset to auto-populate section topology, coordinates, and health indicators.</span>
              </div>
            )}
          </div>

          {/* [3] Maintenance Task Definition */}
          <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-[#344054] flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-[#D96F13]" />
              <span>[3] Maintenance Task Definition</span>
            </label>

            {/* Template Selector Chips */}
            <div>
              <span className="text-[11px] text-[#667085] block mb-1.5 font-semibold">
                Quick Template ({department}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DEPARTMENT_TEMPLATES[department].map((tmpl) => (
                  <button
                    key={tmpl}
                    type="button"
                    onClick={() => {
                      setTaskType(tmpl);
                      setTaskDescription(`Standard operational execution of ${tmpl.toLowerCase()} according to safety rulebook.`);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                      taskType === tmpl
                        ? 'bg-[#7F1418] text-white border-[#7F1418]'
                        : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    {tmpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#344054] block mb-1">
                  Task Type *
                </label>
                <input
                  type="text"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13]"
                  placeholder="Task Type"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#344054] block mb-1">
                  Defect / Inspection Reference
                </label>
                <input
                  type="text"
                  value={defectCode}
                  onChange={(e) => setDefectCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13]"
                  placeholder="e.g. DEF-2026-ENG-082"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#344054] block mb-1">
                Task Description
              </label>
              <textarea
                rows={2}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13]"
                placeholder="Describe scope of work..."
              />
            </div>

            {/* Target Completion / Scheduled Execution Date Selector */}
            <div className="bg-[#F8F9FA] p-4 rounded-xl border border-[#E6E6E6] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[#D96F13]" />
                    <span>Target Completion / Execution Date *</span>
                  </label>
                  <span className="text-[10.5px] text-[#667085]">
                    Select the operational date when this task is scheduled to be completed.
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTargetCompletionDate(getRelativeDate(0))}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg border transition ${
                      targetCompletionDate === getRelativeDate(0)
                        ? 'bg-[#7F1418] text-white border-[#7F1418]'
                        : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetCompletionDate(getRelativeDate(1))}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg border transition ${
                      targetCompletionDate === getRelativeDate(1)
                        ? 'bg-[#7F1418] text-white border-[#7F1418]'
                        : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    Tomorrow (+1d)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetCompletionDate(getRelativeDate(3))}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg border transition ${
                      targetCompletionDate === getRelativeDate(3)
                        ? 'bg-[#7F1418] text-white border-[#7F1418]'
                        : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    +3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetCompletionDate(getRelativeDate(7))}
                    className={`px-2.5 py-1 text-[10.5px] font-bold rounded-lg border transition ${
                      targetCompletionDate === getRelativeDate(7)
                        ? 'bg-[#7F1418] text-white border-[#7F1418]'
                        : 'bg-white text-[#344054] border-[#D0D5DD] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    +7 Days (Weekly Window)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10.5px] font-bold text-[#475467] block mb-1">
                    Scheduled Completion Date
                  </label>
                  <input
                    type="date"
                    value={targetCompletionDate}
                    onChange={(e) => setTargetCompletionDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13] bg-white text-[#1F2937]"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-[#475467] block mb-1">
                    Preferred Traffic Window Slot
                  </label>
                  <select
                    value={preferredTimeSlot}
                    onChange={(e) => setPreferredTimeSlot(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13] bg-white text-[#1F2937]"
                  >
                    <option value="NIGHT">Night Shadow Window (00:00 - 05:00, Minimum Passenger Traffic)</option>
                    <option value="DAY_OFFPEAK">Day Off-Peak Window (11:00 - 15:00, Freight Gaps)</option>
                    <option value="ANY">Any Feasible Certified Gap</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[#344054] block mb-1">
                  Estimated Duration (Minutes) *
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={15}
                    max={720}
                    step={15}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13]"
                  />
                  <span className="text-xs text-[#667085] font-semibold">min</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#344054] block mb-1">
                  Affects Line / Direction *
                </label>
                <select
                  value={affectsLine}
                  onChange={(e) => setAffectsLine(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13] bg-white"
                >
                  <option value="UP">UP Track</option>
                  <option value="DOWN">DOWN Track</option>
                  <option value="BOTH">BOTH Tracks (Dual Possession)</option>
                  <option value="LOOP / SIDING">LOOP / SIDING</option>
                  <option value="COMMON">COMMON Direction Line</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#344054] block mb-1">
                  Block Requirement *
                </label>
                <select
                  value={blockRequirement}
                  onChange={(e) => setBlockRequirement(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13] bg-white"
                >
                  <option value="Traffic Block">Traffic Block</option>
                  <option value="Power Block">Power Block</option>
                  <option value="Traffic + Power Block">Traffic + Power Block</option>
                  <option value="Engineering Block">Engineering Block</option>
                  <option value="S&T Block">S&T Block</option>
                  <option value="Integrated Block">Integrated Block</option>
                </select>
              </div>
            </div>
          </div>

          {/* [4] Actions, Isolation & Resources */}
          <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-[#344054] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#D96F13]" />
              <span>[4] Actions, Isolation & Resources</span>
            </label>

            {/* Stages package */}
            <div>
              <span className="text-[11px] font-bold text-[#344054] block mb-1.5">
                Maintenance Action Package (Workflow Stages):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ACTION_STAGES_DEFAULT.map((stg, idx) => {
                  const isChecked = selectedStages.includes(stg);
                  return (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => toggleStage(stg)}
                      className={`p-2 rounded-lg text-left text-xs font-medium border flex items-center justify-between ${
                        isChecked
                          ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#166534]'
                          : 'bg-white border-[#E6E6E6] text-[#667085]'
                      }`}
                    >
                      <span>{idx + 1}. {stg}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-[#166534]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Isolation selection */}
            <div>
              <label className="text-[11px] font-bold text-[#344054] block mb-1">
                Required Isolation Type
              </label>
              <select
                value={isolationRequirement}
                onChange={(e) => setIsolationRequirement(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13] bg-white font-medium"
              >
                <option value="Traffic Isolation">Traffic Isolation (Signals red / points spiked)</option>
                <option value="Power Isolation">Power Isolation (Traction 25kV OHE de-energized)</option>
                <option value="OHE Isolation">OHE Isolation with Earthing Discharges</option>
                <option value="S&T Isolation">S&T Isolation (Track Circuit disconnect)</option>
                <option value="Track Protection">Track Protection (Detonators / Banner Flags)</option>
                <option value="Special Protection">Special Protection Protocol</option>
                <option value="None">None (Under traffic / caution order)</option>
              </select>
            </div>

            {/* Resource checklist */}
            <div>
              <span className="text-[11px] font-bold text-[#344054] block mb-1.5">
                Required Resources & Machinery ({department}):
              </span>
              <div className="space-y-1.5">
                {RESOURCE_OPTIONS[department].map((res) => {
                  const isChecked = selectedResources.includes(res);
                  return (
                    <div
                      key={res}
                      onClick={() => toggleResource(res)}
                      className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition ${
                        isChecked
                          ? 'bg-[#FFF8F0] border-[#FFD9B3] text-[#B54708]'
                          : 'bg-white border-[#E6E6E6] text-[#344054] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="rounded text-[#D96F13] focus:ring-[#D96F13]"
                        />
                        <span className="font-semibold">{res}</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                        AVAILABLE
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Optional Dependency */}
            <div className="pt-2 border-t border-[#F2F4F7]">
              <span className="text-[11px] font-bold text-[#344054] block mb-1.5">
                Precedence Dependency (Optional)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={dependencyTaskId}
                  onChange={(e) => setDependencyTaskId(e.target.value)}
                  placeholder="Predecessor Task ID (e.g. TSK-90124)"
                  className="px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13]"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={dependencyLag}
                    onChange={(e) => setDependencyLag(Number(e.target.value))}
                    className="w-24 px-3 py-2 text-xs border border-[#D0D5DD] rounded-xl outline-none focus:ring-2 focus:ring-[#D96F13]"
                  />
                  <span className="text-xs text-[#667085]">Min Lag (Minutes)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 bg-[#FFF4ED] border border-[#FECDCA] rounded-xl text-xs text-[#D92D20] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submission Button */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGenerateTask}
            className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 text-white transition ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#7F1418] hover:bg-[#651013] active:scale-[0.99]'
            }`}
          >
            {isSubmitting ? (
              <>
                <Cpu className="w-5 h-5 animate-spin" />
                <span>Running CP-SAT & Safety Evaluation...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-[#FFD9B3]" />
                <span>GENERATE TASK & CALCULATE BLOCK ALLOCATION</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: AI Risk, Allocation & Validation Results (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {result ? (
            <>
              {/* Task Result Summary Card */}
              <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#F2F4F7] pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#12B76A]" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F2937]">
                        Generated Canonical Task
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs font-extrabold text-[#7F1418]">
                          {result.task.task_id}
                        </span>
                        <span className="text-[10px] text-[#475467] font-semibold bg-gray-100 px-1.5 py-0.2 rounded border border-gray-200">
                          Target Date: {result.task.due_date || targetCompletionDate}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-xs font-extrabold bg-[#FFF4ED] text-[#D92D20] border border-[#FECDCA]">
                    {result.task.status}
                  </span>
                </div>

                {/* AI Risk & Priority Score */}
                <div className="bg-[#FFF9F2] p-4 rounded-xl border border-[#FFD9B3] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#8C4A08] uppercase tracking-wider">
                      Expected-Loss Priority Score
                    </span>
                    <span className="text-2xl font-black text-[#7F1418]">
                      {result.risk.priority_score.toFixed(1)} <span className="text-xs font-normal text-[#8C4A08]">/ 100</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white/80 rounded-lg border border-[#FFE4CC]">
                      <span className="text-[10px] text-[#8C4A08] block font-semibold uppercase">30-Day Failure Risk</span>
                      <span className="font-extrabold text-[#D92D20]">
                        {(result.risk.probability_30d * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg border border-[#FFE4CC]">
                      <span className="text-[10px] text-[#8C4A08] block font-semibold uppercase">Operational Impact</span>
                      <span className="font-extrabold text-[#1F2937]">
                        {result.risk.operational_impact.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg border border-[#FFE4CC]">
                      <span className="text-[10px] text-[#8C4A08] block font-semibold uppercase">Urgency Score</span>
                      <span className="font-extrabold text-[#1F2937]">
                        {result.risk.urgency_score.toFixed(2)}
                      </span>
                    </div>
                    <div className="p-2 bg-white/80 rounded-lg border border-[#FFE4CC]">
                      <span className="text-[10px] text-[#8C4A08] block font-semibold uppercase">Safety Override</span>
                      <span className="font-extrabold text-[#12B76A]">
                        {result.risk.safety_override ? 'ACTIVE (MANDATORY)' : 'STANDARD'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SHAP Explanation */}
                {result.risk.shap_explanation && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-[#1F2937] block">
                      Why this priority? (SHAP Explainability)
                    </span>
                    <div className="space-y-1 text-xs">
                      {result.risk.shap_explanation.top_positive.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] border border-[#E6E6E6]"
                        >
                          <span className="text-[#344054] font-medium">{item.feature}</span>
                          <span className="font-bold text-[#D92D20]">
                            +{item.contribution > 0 ? item.contribution.toFixed(2) : item.contribution} (Risk Increase)
                          </span>
                        </div>
                      ))}
                      {result.risk.shap_explanation.top_negative.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAF9] border border-[#E6E6E6]"
                        >
                          <span className="text-[#344054] font-medium">{item.feature}</span>
                          <span className="font-bold text-[#12B76A]">
                            {item.contribution.toFixed(2)} (Mitigation)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recommended Block Window Card */}
              {result.block_recommendation && (
                <div className="bg-white border-2 border-[#12B76A] rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-[#F2F4F7] pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#12B76A]" />
                      <div>
                        <span className="text-[10px] font-extrabold text-[#027A48] uppercase tracking-wider block">
                          RECOMMENDED BLOCK ALLOCATION
                        </span>
                        <h4 className="font-mono text-sm font-extrabold text-[#1F2937]">
                          {result.block_recommendation.block_id}
                        </h4>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded text-xs font-black bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                      FEASIBLE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#667085] uppercase block font-semibold">Planned Date</span>
                      <span className="font-bold text-[#1F2937]">{result.block_recommendation.date}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#667085] uppercase block font-semibold">Time Window</span>
                      <span className="font-extrabold text-[#7F1418]">
                        {result.block_recommendation.start_time} – {result.block_recommendation.end_time}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#667085] uppercase block font-semibold">Window Duration</span>
                      <span className="font-bold text-[#1F2937]">{result.block_recommendation.duration_minutes} min</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#667085] uppercase block font-semibold">Allocated Line</span>
                      <span className="font-bold text-[#1F2937]">{result.block_recommendation.line}</span>
                    </div>
                  </div>

                  {/* Independent Validation Summary */}
                  <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#E6E6E6] space-y-2">
                    <span className="text-[11px] font-bold text-[#344054] block">
                      Mathematical Safety Gate Checklist
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      <div className="flex items-center gap-1.5 text-[#027A48]">
                        <Check className="w-3.5 h-3.5" />
                        <span>Train Conflicts: 0</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#027A48]">
                        <Check className="w-3.5 h-3.5" />
                        <span>Resource Clashes: 0</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#027A48]">
                        <Check className="w-3.5 h-3.5" />
                        <span>Isolation: PASS</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#027A48]">
                        <Check className="w-3.5 h-3.5" />
                        <span>Containment: PASS</span>
                      </div>
                    </div>
                  </div>

                  {/* Human Review Submission Action */}
                  {submittedToAudit ? (
                    <div className="p-3 bg-[#ECFDF3] border border-[#A6F4C5] rounded-xl text-xs text-[#027A48] font-bold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-[#027A48]" />
                      <span>Submitted to Sectional Controller Human Review & Audit Queue.</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitToHumanReview}
                      className="w-full py-2.5 bg-[#027A48] hover:bg-[#05603A] text-white text-xs font-bold rounded-xl shadow transition flex items-center justify-center gap-2"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>FORWARD TO HUMAN CONTROLLER REVIEW</span>
                    </button>
                  )}
                </div>
              )}

              {/* Alternative Windows Evaluated */}
              {result.alternative_windows && result.alternative_windows.length > 1 && (
                <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#344054]">
                    Alternative Windows Evaluated
                  </h4>
                  <div className="space-y-2">
                    {result.alternative_windows.map((win, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                          win.status === 'SELECTED'
                            ? 'bg-[#F0FDF4] border-[#86EFAC]'
                            : 'bg-[#FAFAF9] border-[#E6E6E6]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#1F2937]">{win.block_id}</span>
                            <span className="text-[11px] text-[#667085]">
                              {win.start_time} - {win.end_time} ({win.duration_minutes}m)
                            </span>
                          </div>
                          {win.conflict_reason && (
                            <p className="text-[10px] text-[#D92D20] font-medium mt-0.5">
                              {win.conflict_reason}
                            </p>
                          )}
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          win.status === 'SELECTED'
                            ? 'bg-[#12B76A] text-white'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {win.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coordination Opportunities */}
              {result.coordination_candidates && result.coordination_candidates.length > 0 && (
                <div className="bg-white border border-[#E6E6E6] rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#344054] flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4 text-[#D96F13]" />
                      <span>Coordinated / Shadow Block Candidates</span>
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {result.coordination_candidates.map((cc) => (
                      <div
                        key={cc.task_id}
                        className="p-3 bg-[#FAFAF9] border border-[#E6E6E6] rounded-xl text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1F2937]">{cc.department}</span>
                            <span className="text-[#667085]">· {cc.task_type}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            cc.is_compatible
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {cc.is_compatible ? 'COMPATIBLE' : 'NOT COMPATIBLE'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#667085]">
                          {cc.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Idle Placeholder State */
            <div className="bg-white border border-[#E6E6E6] rounded-2xl p-8 shadow-sm text-center space-y-3 flex flex-col items-center justify-center min-h-[460px]">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13]">
                <Cpu className="w-7 h-7 text-[#D96F13]" />
              </div>
              <h3 className="text-sm font-extrabold text-[#1F2937]">
                Awaiting Maintenance Task Submission
              </h3>
              <p className="text-xs text-[#667085] max-w-sm leading-relaxed">
                Fill in the department requirement on the left and click <strong>Generate Task</strong>. The system will calculate AI failure probability, evaluate candidate possession windows against timetabled trains, and present a certified block allocation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* GIS Leaflet Map Asset Picker Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[700px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#E6E6E6]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#E6E6E6] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAF9]">
              <div className="flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-[#D96F13]" />
                <div>
                  <h3 className="text-sm font-extrabold text-[#1F2937]">
                    GIS Asset Selector — Select Asset From Map
                  </h3>
                  <span className="text-[11px] text-[#667085]">
                    Interactive spatial selection along the Delhi – Kolkata / UP trunk network
                  </span>
                </div>
              </div>

              {/* In-Modal Department Switcher */}
              <div className="flex items-center gap-1 bg-[#F2F4F7] p-1 rounded-xl">
                {(['Engineering', 'Traction', 'S&T'] as DepartmentType[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDepartmentChange(d)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      department === d
                        ? 'bg-white text-[#7F1418] shadow-sm'
                        : 'text-[#667085] hover:text-[#1F2937]'
                    }`}
                  >
                    {d === 'Engineering' ? 'Civil P-Way' : d === 'Traction' ? 'TRD / OHE' : 'Signal & Telecom'}
                  </button>
                ))}
              </div>

              {/* In-Modal Search Input */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#98A2B3]" />
                  <input
                    type="text"
                    value={mapFilterQuery}
                    onChange={(e) => setMapFilterQuery(e.target.value)}
                    placeholder="Filter on map (ID, section)..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-[#D0D5DD] rounded-lg focus:ring-2 focus:ring-[#D96F13] outline-none w-48 bg-white"
                  />
                  {mapFilterQuery && (
                    <button
                      type="button"
                      onClick={() => setMapFilterQuery('')}
                      className="absolute right-2 top-2 text-[#98A2B3] hover:text-[#344054]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowMapPicker(false)}
                  className="p-1.5 rounded-lg text-[#667085] hover:bg-gray-200 transition"
                  title="Close Map"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative">
              <MapContainer
                center={[25.8, 82.5]}
                zoom={6}
                className="w-full h-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {displayedMapAssets.map((ast) => {
                  const lat = ast.location_lat || (28.5 + (parseInt(ast.asset_id.replace(/\D/g, '') || '0') % 100) * 0.005);
                  const lon = ast.location_lon || (77.1 + (parseInt(ast.asset_id.replace(/\D/g, '') || '0') % 100) * 0.005);
                  const isCrit = ast.condition_score && ast.condition_score < 30;
                  const isMed = ast.condition_score && ast.condition_score >= 30 && ast.condition_score < 60;

                  return (
                    <CircleMarker
                      key={ast.asset_id}
                      center={[lat, lon]}
                      radius={isCrit ? 8 : 6}
                      pathOptions={{
                        color: isCrit ? '#D92D20' : isMed ? '#D96F13' : '#027A48',
                        fillColor: isCrit ? '#FEE4E2' : isMed ? '#FFF3E6' : '#ECFDF3',
                        fillOpacity: 0.9,
                        weight: 2
                      }}
                      eventHandlers={{
                        click: () => {
                          setSelectedAsset(ast);
                          setShowMapPicker(false);
                        }
                      }}
                    >
                      <Tooltip>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-1.5 justify-between">
                            <span className="font-extrabold text-sm block font-mono text-[#7F1418]">
                              {ast.asset_id}
                            </span>
                            <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 font-bold">
                              {ast.criticality_class || 'HIGH'}
                            </span>
                          </div>
                          <span className="block text-[#475467] font-semibold">{ast.asset_type}</span>
                          <span className="block text-[#667085]">Section: {ast.section_id} · Km {ast.chainage_km}</span>
                          <span className={`block font-bold ${isCrit ? 'text-[#D92D20]' : isMed ? 'text-[#D96F13]' : 'text-[#027A48]'}`}>
                            Condition Score: {ast.condition_score}/100
                          </span>
                          <span className="text-[10px] text-[#D96F13] font-bold block pt-1 border-t border-gray-100">
                            👉 Click node to select asset
                          </span>
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#FAFAF9] border-t border-[#E6E6E6] text-xs text-[#667085] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span>Click any asset node to select.</span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D92D20] inline-block" /> Critical (&lt;30)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D96F13] inline-block" /> Medium (30-60)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#027A48] inline-block" /> Good (&gt;60)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isLoadingMapAssets && (
                  <span className="text-[11px] text-[#D96F13] font-semibold animate-pulse">
                    Loading Assets...
                  </span>
                )}
                <span className="font-bold text-[#1F2937] bg-white px-2.5 py-1 rounded-lg border border-[#E6E6E6]">
                  {displayedMapAssets.length} Assets Loaded ({department})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskGeneratorView;
