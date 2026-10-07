import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  usePlanningCalendar,
  OPERATIONAL_TODAY,
} from '../context/PlanningCalendarContext';
import {
  PlanningCalendarMode,
  PlanningCalendarState,
  padZero,
  getWeekRange,
  getMonthRange,
  formatDisplayRange,
  formatReadableDate,
} from '../types/planningCalendar';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const WorkingCalendar: React.FC = () => {
  const { state: globalState, applyState, setToday: applyToday, clearSelection: applyClear } = usePlanningCalendar();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Staged state inside the popover before applying
  const [draftMode, setDraftMode] = useState<PlanningCalendarMode>(globalState.mode);
  const [draftDates, setDraftDates] = useState<string[]>(globalState.selectedDates);
  const [draftStart, setDraftStart] = useState<string | null>(globalState.startDate);
  const [draftEnd, setDraftEnd] = useState<string | null>(globalState.endDate);

  // Visible month in the calendar grid (default: month of reference/today)
  const initialDate = globalState.startDate || OPERATIONAL_TODAY;
  const [viewYear, setViewYear] = useState<number>(() => Number(initialDate.split('-')[0]) || 2026);
  const [viewMonth, setViewMonth] = useState<number>(() => Number(initialDate.split('-')[1]) - 1 || 8); // 8 = Sep (0-indexed)

  // Sync draft with global state whenever popover opens
  useEffect(() => {
    if (isOpen) {
      setDraftMode(globalState.mode);
      setDraftDates(globalState.selectedDates);
      setDraftStart(globalState.startDate);
      setDraftEnd(globalState.endDate);
      const ref = globalState.startDate || OPERATIONAL_TODAY;
      const [y, m] = ref.split('-').map(Number);
      setViewYear(y || 2026);
      setViewMonth((m || 9) - 1);
    }
  }, [isOpen, globalState]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Month navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build calendar matrix (Monday as first day of week)
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1, 12, 0, 0);
    const lastDay = new Date(viewYear, viewMonth + 1, 0, 12, 0, 0);
    const daysInMonth = lastDay.getDate();

    // getDay: 0 = Sun, 1 = Mon ... 6 = Sat
    // Convert to Mon=0 ... Sun=6
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0, 12, 0, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      days.push({
        dateStr: `${prevY}-${padZero(prevM + 1)}-${padZero(dayNum)}`,
        dayNum,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      days.push({
        dateStr: `${viewYear}-${padZero(viewMonth + 1)}-${padZero(dayNum)}`,
        dayNum,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill complete weeks (multiples of 7)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
        const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
        days.push({
          dateStr: `${nextY}-${padZero(nextM + 1)}-${padZero(i)}`,
          dayNum: i,
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [viewYear, viewMonth]);

  // Handle clicking a day cell based on active draft mode
  const handleDateClick = (dateStr: string) => {
    if (draftMode === 'day') {
      setDraftDates([dateStr]);
      setDraftStart(dateStr);
      setDraftEnd(dateStr);
    } else if (draftMode === 'multi-day') {
      let updated = draftDates.includes(dateStr)
        ? draftDates.filter((d) => d !== dateStr)
        : [...draftDates, dateStr];
      updated.sort();
      setDraftDates(updated);
      setDraftStart(updated.length > 0 ? updated[0] : null);
      setDraftEnd(updated.length > 0 ? updated[updated.length - 1] : null);
    } else if (draftMode === 'week') {
      const range = getWeekRange(dateStr);
      setDraftDates(range.dates);
      setDraftStart(range.startDate);
      setDraftEnd(range.endDate);
    } else if (draftMode === 'month') {
      const parts = dateStr.split('-').map(Number);
      const range = getMonthRange(parts[0], parts[1] - 1);
      setDraftDates(range.dates);
      setDraftStart(range.startDate);
      setDraftEnd(range.endDate);
    }
  };

  // Switch mode inside draft
  const handleModeChange = (newMode: PlanningCalendarMode) => {
    setDraftMode(newMode);
    const ref = draftDates.length > 0 ? draftDates[0] : OPERATIONAL_TODAY;
    if (newMode === 'day') {
      setDraftDates([ref]);
      setDraftStart(ref);
      setDraftEnd(ref);
    } else if (newMode === 'week') {
      const w = getWeekRange(ref);
      setDraftDates(w.dates);
      setDraftStart(w.startDate);
      setDraftEnd(w.endDate);
    } else if (newMode === 'month') {
      const m = getMonthRange(viewYear, viewMonth);
      setDraftDates(m.dates);
      setDraftStart(m.startDate);
      setDraftEnd(m.endDate);
    }
  };

  // Select Entire Month shortcut
  const handleSelectEntireMonth = () => {
    setDraftMode('month');
    const range = getMonthRange(viewYear, viewMonth);
    setDraftDates(range.dates);
    setDraftStart(range.startDate);
    setDraftEnd(range.endDate);
  };

  // Apply drafted calendar state to global app
  const handleApply = () => {
    let horizon = 7;
    if (draftMode === 'day') horizon = 1;
    else if (draftMode === 'week') horizon = 7;
    else if (draftMode === 'month') horizon = 30;
    else horizon = Math.max(1, Math.min(30, draftDates.length));

    const displayText = formatDisplayRange(draftMode, draftDates, draftStart, draftEnd);

    applyState({
      mode: draftMode,
      selectedDates: draftDates,
      startDate: draftStart,
      endDate: draftEnd,
      displayText,
      horizonDays: horizon,
    });
    setIsOpen(false);
  };

  // Today shortcut
  const handleTodayShortcut = () => {
    setDraftMode('day');
    setDraftDates([OPERATIONAL_TODAY]);
    setDraftStart(OPERATIONAL_TODAY);
    setDraftEnd(OPERATIONAL_TODAY);
    const [y, m] = OPERATIONAL_TODAY.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
  };

  // Clear selection
  const handleClear = () => {
    setDraftDates([]);
    setDraftStart(null);
    setDraftEnd(null);
  };

  const draftDisplayText = useMemo(
    () => formatDisplayRange(draftMode, draftDates, draftStart, draftEnd),
    [draftMode, draftDates, draftStart, draftEnd]
  );

  return (
    <div className="relative" ref={containerRef}>
      {/* Header Operational Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition select-none shadow-sm ${
          isOpen
            ? 'bg-[#FFF3E6] border border-[#D96F13] text-[#B85C00]'
            : 'bg-white border border-[#E6E6E6] hover:border-[#D96F13] text-[#1F2937]'
        }`}
        aria-label="Working planning calendar"
        title="Open Operational Working Calendar"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-[#D96F13] shrink-0" />
        <span className="truncate max-w-[150px] sm:max-w-[190px] font-medium text-[#1F2937]">
          {globalState.displayText || 'Working Calendar'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#667085] transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[#D96F13]' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[370px] bg-white border border-[#E6E6E6] rounded-2xl shadow-2xl p-4 z-50 text-[#1F2937] animate-in fade-in zoom-in-95 duration-100">
          {/* Top Bar: Title & Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D96F13]"></span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7F1418] font-display">
                WORKING CALENDAR
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-[#667085] hover:text-[#1F2937] hover:bg-[#F7F7F5] transition"
              aria-label="Close calendar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Selector Tabs */}
          <div className="mb-3.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1.5 px-0.5">
              <span>PLANNING HORIZON MODE</span>
              <span className="text-[#D96F13] font-semibold">{draftMode.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#F7F7F5] rounded-xl border border-[#E6E6E6]">
              {(['day', 'multi-day', 'week', 'month'] as PlanningCalendarMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`py-1.5 text-center text-[11px] font-bold rounded-lg transition capitalize ${
                    draftMode === m
                      ? 'bg-white text-[#7F1418] shadow-sm border border-[#E6E6E6]'
                      : 'text-[#475467] hover:text-[#1F2937] hover:bg-white/60'
                  }`}
                >
                  {m === 'multi-day' ? 'Multi' : m}
                </button>
              ))}
            </div>
          </div>

          {/* Month Navigation & Title */}
          <div className="flex items-center justify-between px-1 mb-2">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg border border-[#E6E6E6] hover:bg-[#F7F7F5] text-[#475467] hover:text-[#1F2937] transition"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <span className="font-extrabold text-sm text-[#1F2937] tracking-tight">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              {draftMode === 'month' && (
                <span className="block text-[10px] font-semibold text-[#12B76A]">
                  Entire Month Active
                </span>
              )}
            </div>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg border border-[#E6E6E6] hover:bg-[#F7F7F5] text-[#475467] hover:text-[#1F2937] transition"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {WEEKDAY_NAMES.map((d) => (
              <span key={d} className="text-[10px] font-bold uppercase text-[#667085] py-1">
                {d}
              </span>
            ))}
          </div>

          {/* Monthly Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-3.5">
            {calendarGrid.map((cell) => {
              const isSelected = draftDates.includes(cell.dateStr);
              const isToday = cell.dateStr === OPERATIONAL_TODAY;

              // Check if part of week range or month selection
              const inRange =
                (draftMode === 'week' || draftMode === 'month') &&
                draftStart &&
                draftEnd &&
                cell.dateStr >= draftStart &&
                cell.dateStr <= draftEnd;

              return (
                <button
                  key={cell.dateStr}
                  onClick={() => handleDateClick(cell.dateStr)}
                  className={`h-8 sm:h-9 text-xs rounded-lg font-medium relative transition flex items-center justify-center ${
                    !cell.isCurrentMonth
                      ? 'text-[#98A2B3] opacity-50'
                      : isSelected
                      ? 'bg-[#7F1418] text-white font-bold shadow-sm'
                      : inRange
                      ? 'bg-[#FFF3E6] text-[#B85C00] font-semibold'
                      : 'text-[#1F2937] hover:bg-[#F7F7F5]'
                  } ${isToday && !isSelected ? 'ring-1.5 ring-[#D96F13] font-bold text-[#D96F13]' : ''}`}
                  title={`${cell.dateStr}${isToday ? ' (Today - Live Operational Date)' : ''}`}
                >
                  <span>{cell.dayNum}</span>
                  {isToday && (
                    <span
                      className={`absolute bottom-1 w-1 h-1 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-[#D96F13]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Month / Week helpers */}
          <div className="flex items-center justify-between gap-1.5 pb-3 border-b border-[#F1F5F9] mb-3 text-[11px]">
            <button
              onClick={handleTodayShortcut}
              className="px-2.5 py-1 rounded-md bg-[#F7F7F5] border border-[#E6E6E6] hover:border-[#D96F13] text-[#344054] font-semibold hover:text-[#B85C00] transition flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-[#D96F13]" />
              <span>Today (18 Sep)</span>
            </button>
            <button
              onClick={handleSelectEntireMonth}
              className="px-2.5 py-1 rounded-md bg-[#F7F7F5] border border-[#E6E6E6] hover:border-[#D96F13] text-[#344054] font-semibold hover:text-[#B85C00] transition"
            >
              Select Full Month
            </button>
          </div>

          {/* Selected Summary & Action Buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-[#667085] block">
                Selected Window
              </span>
              <p className="text-xs font-bold text-[#7F1418] truncate" title={draftDisplayText}>
                {draftDisplayText}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleClear}
                className="px-2.5 py-1.5 rounded-lg border border-[#E6E6E6] hover:bg-[#F7F7F5] text-xs font-semibold text-[#667085] hover:text-[#1F2937] transition flex items-center gap-1"
                title="Reset Selection"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1.5 rounded-lg bg-[#7F1418] hover:bg-[#681013] text-white text-xs font-bold shadow-sm transition flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
