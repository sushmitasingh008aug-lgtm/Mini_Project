import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, ViewType } from './components/Sidebar';
import { Header } from './components/Header';
import { CommandCenterView } from './components/CommandCenterView';
import { NetworkSectionsView } from './components/NetworkSectionsView';
import { TasksView } from './components/TasksView';
import { AIPriorityView } from './components/AIPriorityView';
import { CoordinationView } from './components/CoordinationView';
import { GanttTab } from './components/GanttTab';
import { BeforeAfterView } from './components/BeforeAfterView';
import { WeeklyMonthlyView } from './components/WeeklyMonthlyView';
import { FailureIntelligenceView } from './components/FailureIntelligenceView';
import { ApprovalAuditView } from './components/ApprovalAuditView';
import { SubmitTab } from './components/SubmitTab';
import { MapView } from './components/MapView';
import { AlertsView } from './components/AlertsView';
import { TrainConflictsView } from './components/TrainConflictsView';
import { AssetHealthView } from './components/AssetHealthView';
import { DataIngestionView } from './components/DataIngestionView';
import { DataQualityView } from './components/DataQualityView';
import { ModelVersionsView } from './components/ModelVersionsView';
import { TaskGeneratorView } from './components/TaskGeneratorView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PlanningCalendarProvider, usePlanningCalendar } from './context/PlanningCalendarContext';
import {
  MetricsResponse,
  ScheduledTask,
  Section,
  TestStatusResponse,
  ImpactResponse,
  TrainMovement,
  SectionRisk,
  apiClient,
} from './api/client';

function AppContent() {
  const getInitialView = (): ViewType => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || window.location.hash.replace('#', '');
      if (tab) return tab as ViewType;
    } catch {}
    return 'dashboard';
  };
  const [activeView, setActiveView] = useState<ViewType>(getInitialView);
  const [taskGenAssetId, setTaskGenAssetId] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [schedule, setSchedule] = useState<ScheduledTask[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionRisks, setSectionRisks] = useState<SectionRisk[]>([]);
  const [testStatus, setTestStatus] = useState<TestStatusResponse | null>(null);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [trains, setTrains] = useState<TrainMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const { state: calendarState, horizonDays, setMode } = usePlanningCalendar();

  const fetchAllData = useCallback(async (showLoading = true, days = horizonDays) => {
    try {
      if (showLoading) setLoading(true);
      const [mRes, sRes, secRes, iRes, trRes, rRes] = await Promise.all([
        apiClient.get<MetricsResponse>('/metrics').catch(() => null),
        apiClient.get<{ data: ScheduledTask[] }>('/schedule').catch(() => null),
        apiClient.get<{ data: Section[] }>('/sections').catch(() => null),
        apiClient.get<ImpactResponse>(`/impact?horizon_days=${days}`).catch(() => null),
        apiClient.get<{ data: TrainMovement[] }>('/trains').catch(() => null),
        apiClient.get<{ data: SectionRisk[] }>('/sections/risk').catch(() => null),
      ]);

      if (mRes) setMetrics(mRes.data);
      if (sRes) setSchedule(sRes.data.data || []);
      if (secRes) setSections(secRes.data.data || []);
      if (iRes) setImpact(iRes.data);
      if (trRes) setTrains(trRes.data.data || []);
      if (rRes) setSectionRisks(rRes.data.data || []);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [horizonDays]);

  // Only fetch test suite when the user actually navigates to verification_suite or alerts
  useEffect(() => {
    if ((activeView === 'verification_suite' || activeView === 'alerts') && !testStatus) {
      apiClient.get<TestStatusResponse>('/tests/status')
        .then((res) => { if (res) setTestStatus(res.data); })
        .catch(() => null);
    }
  }, [activeView, testStatus]);

  // Initial fetch
  useEffect(() => {
    fetchAllData(true);
  }, [fetchAllData]);

  // Refresh data on view change
  useEffect(() => {
    fetchAllData(false);
  }, [activeView, fetchAllData]);

  const [weeklyPlannerSearch, setWeeklyPlannerSearch] = useState('');

  // Plain navigation (clears any pre-selected Task Generator asset)
  const navigateTo = useCallback((view: ViewType, search?: string) => {
    if (view === 'task_generator') setTaskGenAssetId(null);
    if (search !== undefined) setWeeklyPlannerSearch(search);
    setActiveView(view);
  }, []);

  // Open Task Generator, optionally pre-populated with an asset context
  const openTaskGenerator = useCallback((assetId?: string | null) => {
    setTaskGenAssetId(assetId ?? null);
    setActiveView('task_generator');
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#1F2937] flex flex-row font-sans antialiased">
      {/* Left Sidebar (Desktop fixed + Mobile off-canvas drawer) */}
      <Sidebar
        activeView={activeView}
        setActiveView={navigateTo}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        {/* Top App Header with Indian Railways Logo, Working Calendar & 24-Hr Live Clock */}
        <Header
          onToggleSidebar={() => setIsMobileNavOpen(!isMobileNavOpen)}
          onNavigate={(view: any) => navigateTo(view)}
          horizonDays={horizonDays}
        />

        {/* Dynamic Body Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-4 pb-12 w-full max-w-[1720px] mx-auto">
          <ErrorBoundary key={activeView} fallbackTitle={`Error Loading ${activeView.replace(/_/g, ' ')}`}>
          {/* OPERATIONS */}
          {(activeView === 'dashboard' || activeView === 'command_center') && (
            <CommandCenterView
              metrics={metrics}
              impact={impact}
              schedule={schedule}
              sections={sections}
              sectionRisks={sectionRisks}
              trains={trains}
              loading={loading}
              onNavigate={navigateTo}
              onOpenTaskGenerator={openTaskGenerator}
            />
          )}

          {(activeView === 'asset_backlog' || activeView === 'maintenance_tasks') && (
            <TasksView
              schedule={schedule}
              sections={sections}
              onOpenTaskGenerator={openTaskGenerator}
            />
          )}

          {activeView === 'task_generator' && (
            <TaskGeneratorView
              initialAssetId={taskGenAssetId}
              onNavigate={(view) => navigateTo(view as ViewType)}
            />
          )}

          {(activeView === 'weekly_planner' || activeView === 'block_planner') && (
            <GanttTab
              schedule={schedule}
              trains={trains}
              sections={sections}
              loading={loading}
              onRefreshSchedule={() => fetchAllData(false)}
              onNavigate={navigateTo}
              onOpenTaskGenerator={openTaskGenerator}
              initialSearch={weeklyPlannerSearch}
            />
          )}

          {(activeView === 'monthly_forecast' || activeView === 'weekly_monthly') && (
            <WeeklyMonthlyView
              schedule={schedule}
              sections={sections}
              loading={loading}
              onHorizonChange={(days) => {
                if (days >= 30) setMode('month');
                else if (days <= 1) setMode('day');
                else setMode('week');
              }}
            />
          )}

          {/* COORDINATION */}
          {activeView === 'coordination' && (
            <CoordinationView
              onNavigate={navigateTo}
            />
          )}

          {(activeView === 'shadow_blocks' || activeView === 'before_after') && (
            <BeforeAfterView
              onNavigate={navigateTo}
            />
          )}

          {activeView === 'train_conflicts' && (
            <TrainConflictsView
              sections={sections}
              trains={trains}
              schedule={schedule}
            />
          )}

          {/* INTELLIGENCE */}
          {activeView === 'ai_priority' && (
            <AIPriorityView
              schedule={schedule}
            />
          )}

          {activeView === 'failure_intelligence' && (
            <FailureIntelligenceView />
          )}

          {activeView === 'asset_health' && (
            <AssetHealthView onOpenTaskGenerator={openTaskGenerator} />
          )}

          {/* DATA */}
          {activeView === 'data_ingestion' && (
            <DataIngestionView />
          )}

          {activeView === 'data_quality' && (
            <DataQualityView />
          )}

          {activeView === 'model_versions' && (
            <ModelVersionsView />
          )}

          {/* CONTROL */}
          {activeView === 'approvals_audit' && (
            <ApprovalAuditView
              onNavigate={(view: string, initialSearch?: string) =>
                navigateTo(view as ViewType, initialSearch)
              }
            />
          )}

          {(activeView === 'verification_suite' || activeView === 'alerts') && (
            <AlertsView
              testStatus={testStatus}
              onRefreshTests={async () => {
                const res = await apiClient.get<TestStatusResponse>('/tests/status').catch(() => null);
                if (res) setTestStatus(res.data);
              }}
            />
          )}

          {/* Legacy Extra Views */}
          {activeView === 'network_sections' && (
            <NetworkSectionsView
              sectionRisks={sectionRisks}
              sections={sections}
              schedule={schedule}
              onNavigate={navigateTo}
            />
          )}

          {activeView === 'demand' && (
            <SubmitTab
              sections={sections}
              onSubmissionSuccess={() => fetchAllData(false)}
              onNavigate={navigateTo}
            />
          )}

          {activeView === 'networkmap' && (
            <MapView
              sections={sections}
              schedule={schedule}
              trains={trains}
              onCreateTaskForAsset={openTaskGenerator}
            />
          )}
          </ErrorBoundary>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#E6E6E6] py-3 px-6 text-center text-xs text-[#667085] bg-white flex flex-col sm:flex-row items-center justify-between gap-2 select-none">
          <span>ABPS CONTROL — Indian Railways Automated Block Planning System (Delhi Division · SIMULATION MODE)</span>
          <span className="text-[11px] text-[#98A2B3]">Ministry of Railways · Smart India Hackathon 2026</span>
        </footer>
      </div>
    </div>
  );
}

export function App() {
  return (
    <PlanningCalendarProvider>
      <AppContent />
    </PlanningCalendarProvider>
  );
}

export default App;
