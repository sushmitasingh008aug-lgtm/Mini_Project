import React, { useState } from 'react';
import { Bell, ChevronDown, Menu, HelpCircle } from 'lucide-react';
import { ViewType } from './Sidebar';
import { WorkingCalendar } from './WorkingCalendar';
import { LiveClock } from './LiveClock';
import irLogo from '../assets/indian-railways-logo.png';

interface HeaderProps {
  onToggleSidebar?: () => void;
  onNavigate?: (view: ViewType) => void;
  horizonDays?: number;
  onHorizonChange?: (days: number) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onNavigate }) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSimTooltip, setShowSimTooltip] = useState(false);

  return (
    <header className="bg-white border-b border-[#E6E6E6] px-3 sm:px-5 py-2 flex items-center justify-between sticky top-0 z-20 select-none shadow-sm gap-2">
      {/* Left: Mobile Toggle & Indian Railways Brand Identity */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="text-[#475467] hover:text-[#1F2937] lg:hidden p-1.5 rounded-lg hover:bg-[#F7F7F5] transition shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Top-Left Brand Block: Indian Railways Logo + ABPS CONTROL */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <img
            src={irLogo}
            alt="Indian Railways"
            className="h-9 w-9 sm:h-10 sm:w-10 object-contain shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/indian-railways-logo.png';
            }}
          />

          <div className="leading-tight">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-[14px] sm:text-[15px] text-[#7F1418] tracking-tight font-display whitespace-nowrap">
                ABPS CONTROL
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F7F7F5] text-[#344054] border border-[#E6E6E6] whitespace-nowrap">
                Delhi Division
              </span>
            </div>
            <div className="text-[10.5px] text-[#667085] font-medium hidden sm:block">
              Automated Block Planning System
            </div>
          </div>
        </div>

        {/* Operational State: Simulation Mode */}
        <div className="relative hidden md:block shrink-0">
          <span
            onMouseEnter={() => setShowSimTooltip(true)}
            onMouseLeave={() => setShowSimTooltip(false)}
            onClick={() => setShowSimTooltip(!showSimTooltip)}
            className="cursor-pointer inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF3E6] text-[#B85C00] border border-[#FFD9B3] whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9933]"></span>
            <span>SIMULATION MODE</span>
            <HelpCircle className="w-3 h-3 text-[#D96F13] opacity-75" />
          </span>
          {showSimTooltip && (
            <div className="absolute left-0 mt-1.5 w-72 bg-[#1F2937] text-white text-[11px] rounded-xl p-3 shadow-xl z-50 leading-relaxed border border-[#374151]">
              <p className="font-bold text-[#FF9933] mb-1">Demonstration & Prototype Environment</p>
              Decision support and optimization prototype. Operates on verified operational datasets. Requires controller review and formal safety validation prior to dispatch.
            </div>
          )}
        </div>

        {/* Synchronized feeds status */}
        <div className="flex items-center gap-2 text-[10px] text-[#667085] hidden xl:flex pl-2 border-l border-[#E6E6E6] shrink-0 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]"></span> COA
          </span>
          <span className="text-[#D0D5DD]">·</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]"></span> TMS
          </span>
          <span className="text-[#D0D5DD]">·</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]"></span> SMMS
          </span>
          <span className="text-[#D0D5DD]">·</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]"></span> TDMS
          </span>
        </div>
      </div>

      {/* Right: Working Operational Calendar, Alerts, Controller & Top-Right Live Clock */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Working Operational Planning Calendar */}
        <WorkingCalendar />

        {/* Verification / Alert Bell */}
        <button
          onClick={() => onNavigate && onNavigate('alerts')}
          title="Verification suite alerts"
          className="relative p-2 rounded-lg bg-white border border-[#E6E6E6] text-[#475467] hover:text-[#1F2937] hover:border-[#CBD5E1] transition shadow-sm"
          aria-label="Alerts"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D92D20] text-white text-[9.5px] font-bold flex items-center justify-center border-2 border-white shadow-sm">
            0
          </span>
        </button>

        {/* User / Controller Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileModal(!showProfileModal)}
            className="flex items-center gap-2 pl-1.5 sm:pl-2.5 border-l border-[#E6E6E6] hover:opacity-90 transition text-left"
            aria-label="Controller profile menu"
          >
            <div className="w-8 h-8 rounded-full bg-[#FFF3E6] border border-[#FFD9B3] flex items-center justify-center text-[#D96F13] text-xs font-bold shadow-sm shrink-0">
              CP
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="text-xs font-bold text-[#1F2937] leading-tight">Central Controller</p>
              <p className="text-[10px] text-[#667085] font-medium">Delhi Div</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#667085] hidden sm:block" />
          </button>

          {showProfileModal && (
            <div className="absolute right-0 mt-2 w-60 bg-white border border-[#E6E6E6] rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-[#F1F5F9]">
                <p className="text-xs font-bold text-[#1F2937]">Senior Section Controller</p>
                <p className="text-[11px] text-[#667085]">controller@delhi.railnet.gov.in</p>
                <p className="text-[10px] text-[#D96F13] font-semibold mt-0.5">Authorization: L4 Chief Dispatcher</p>
              </div>
              <div className="pt-1.5 space-y-0.5">
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    if (onNavigate) onNavigate('approvals_audit');
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-[#FFF3E6] hover:text-[#B85C00] text-[#344054] font-medium"
                >
                  Pending Approvals
                </button>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    if (onNavigate) onNavigate('alerts');
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-[#FFF3E6] hover:text-[#B85C00] text-[#344054] font-medium"
                >
                  Verification Suite
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Corner: 24-Hour Live Operational Clock (IST) */}
        <div className="pl-1 sm:pl-2 border-l border-[#E6E6E6] shrink-0">
          <LiveClock />
        </div>
      </div>
    </header>
  );
};
