import React from 'react';
import irLogo from '../assets/indian-railways-logo.png';
import {
  LayoutDashboard,
  Layers,
  ListTodo,
  BrainCircuit,
  Combine,
  CalendarRange,
  GitCompare,
  CalendarDays,
  AlertOctagon,
  Wrench,
  FileCheck2,
  ShieldCheck,
  UploadCloud,
  Database,
  GitBranch,
  Activity,
  X
} from 'lucide-react';

export type ViewType =
  // OPERATIONS
  | 'dashboard'
  | 'asset_backlog'
  | 'task_generator'
  | 'weekly_planner'
  | 'monthly_forecast'
  // COORDINATION
  | 'coordination'
  | 'shadow_blocks'
  | 'train_conflicts'
  // INTELLIGENCE
  | 'ai_priority'
  | 'failure_intelligence'
  | 'asset_health'
  // DATA
  | 'data_ingestion'
  | 'data_quality'
  | 'model_versions'
  // CONTROL
  | 'approvals_audit'
  | 'verification_suite'
  // Legacy aliases
  | 'command_center'
  | 'network_sections'
  | 'maintenance_tasks'
  | 'block_planner'
  | 'planning'
  | 'before_after'
  | 'weekly_monthly'
  | 'demand'
  | 'networkmap'
  | 'alerts';

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const navSections = [
    {
      heading: 'OPERATIONS',
      items: [
        { id: 'dashboard' as ViewType, legacyId: 'command_center' as ViewType, label: '1. Dashboard / GIS Map', icon: LayoutDashboard },
        { id: 'asset_backlog' as ViewType, legacyId: 'maintenance_tasks' as ViewType, label: '2. Asset Backlog', icon: ListTodo },
        { id: 'task_generator' as ViewType, label: '3. Task Generator', icon: Wrench, badge: 'v4' },
        { id: 'weekly_planner' as ViewType, legacyId: 'block_planner' as ViewType, label: '4. Weekly Block Planner', icon: CalendarRange },
        { id: 'monthly_forecast' as ViewType, legacyId: 'weekly_monthly' as ViewType, label: '5. Monthly Forecast', icon: CalendarDays },
      ],
    },
    {
      heading: 'COORDINATION',
      items: [
        { id: 'coordination' as ViewType, label: '6. Coordination Centre', icon: Combine },
        { id: 'shadow_blocks' as ViewType, legacyId: 'before_after' as ViewType, label: '7. Integrated / Shadow Blocks', icon: Layers },
        { id: 'train_conflicts' as ViewType, label: '8. Train & Block Conflicts', icon: GitCompare, badge: 'v4' },
      ],
    },
    {
      heading: 'INTELLIGENCE',
      items: [
        { id: 'ai_priority' as ViewType, label: '9. AI Risk & Priority', icon: BrainCircuit },
        { id: 'failure_intelligence' as ViewType, label: '10. Failure Intelligence', icon: AlertOctagon },
        { id: 'asset_health' as ViewType, legacyId: 'network_sections' as ViewType, label: '11. Asset Health', icon: Activity },
      ],
    },
    {
      heading: 'DATA',
      items: [
        { id: 'data_ingestion' as ViewType, label: '12. Data Ingestion', icon: UploadCloud, badge: 'v4' },
        { id: 'data_quality' as ViewType, label: '13. Data Quality', icon: Database, badge: 'v4' },
        { id: 'model_versions' as ViewType, label: '14. Model / Data Versions', icon: GitBranch, badge: 'v4' },
      ],
    },
    {
      heading: 'CONTROL',
      items: [
        { id: 'approvals_audit' as ViewType, label: '15. Human Review & Audit', icon: FileCheck2 },
        { id: 'verification_suite' as ViewType, legacyId: 'alerts' as ViewType, label: '16. Verification Suite', icon: ShieldCheck },
      ],
    },
  ];

  const handleNavClick = (id: ViewType) => {
    setActiveView(id);
    if (onCloseMobile) onCloseMobile();
  };

  const isItemActive = (id: ViewType, legacyId?: ViewType) => {
    return activeView === id || (legacyId && activeView === legacyId);
  };

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-[#E6E6E6] select-none shadow-sm w-72 shrink-0">
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-[#E6E6E6] bg-gradient-to-b from-white to-[#FDFBF9] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src={irLogo}
            alt="Indian Railways"
            className="w-9 h-9 object-contain shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/indian-railways-logo.png';
            }}
          />
          <div>
            <span className="font-extrabold text-[13px] text-[#7F1418] tracking-wider uppercase font-display block leading-tight">
              ABPS CONTROL
            </span>
            <p className="text-[10px] text-[#667085] font-semibold tracking-wide leading-tight mt-0.5">
              Delhi Division
            </p>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100"
            aria-label="Close Navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="px-2.5 py-2.5 flex-1 space-y-3.5 overflow-y-auto">
        {navSections.map((group) => (
          <div key={group.heading}>
            <p className="px-2.5 mb-1 text-[9px] font-bold uppercase tracking-wider text-[#667085]">
              {group.heading}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.id, item.legacyId);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-[#7F1418] text-white shadow-sm font-semibold'
                        : 'text-[#344054] hover:bg-[#F7F7F5] hover:text-[#1F2937]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#FF9933]' : 'text-[#667085]'}`} />
                      <span className="truncate text-left">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        active ? 'bg-[#FF9933] text-[#5E0E11]' : 'bg-[#FFF3E6] text-[#D96F13] border border-[#FFD9B3]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer System Mode */}
      <div className="p-3 border-t border-[#E6E6E6] bg-[#FAFAF9] text-[11px] text-[#475467]">
        <div className="flex items-center justify-between font-semibold mb-1">
          <span className="text-[10px] text-[#667085] uppercase tracking-wider">System State</span>
          <span className="text-[#12B76A] flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] animate-pulse"></span> ONLINE
          </span>
        </div>
        <p className="text-[10px] text-[#667085]">21 Datasets · 252K Records</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block h-screen sticky top-0 z-30">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
