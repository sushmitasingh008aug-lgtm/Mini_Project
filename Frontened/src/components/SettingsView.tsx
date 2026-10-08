import React, { useState } from 'react';
import { Settings, Database, Cpu, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [dbMode, setDbMode] = useState('PostgreSQL (Go Fiber API)');
  const [solverTime, setSolverTime] = useState('30 Seconds');
  const [horizon, setHorizon] = useState('7 Days (Weekly)');
  const [irPolicy, setIrPolicy] = useState(true);

  const selectCls =
    'w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none transition';

  return (
    <div className="space-y-6 pb-8 select-none">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <span>System Settings &amp; Solver Configuration</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Engine parameters, CP-SAT solver time limits, Indian Railways domain policies, and database connection state.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Config Saved</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CP-SAT Solver Config */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>CP-SAT Optimizer Settings</span>
          </h3>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Max Solver Wall-Time Limit</label>
            <select value={solverTime} onChange={(e) => setSolverTime(e.target.value)} className={selectCls}>
              <option>15 Seconds (Fast Preview)</option>
              <option>30 Seconds (Optimal Quality)</option>
              <option>60 Seconds (Deep Search)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Planning Horizon</label>
            <select value={horizon} onChange={(e) => setHorizon(e.target.value)} className={selectCls}>
              <option>7 Days (Weekly Plan)</option>
              <option>30 Days (Monthly Plan)</option>
            </select>
          </div>
        </div>

        {/* Domain Policy Config */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>Indian Railways Operating Constraints</span>
          </h3>

          <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-800">12:00–18:00 Peak Window Restriction</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Prohibit non-critical maintenance blocks during 12:00 PM – 6:00 PM peak passenger window.
              </p>
            </div>
            <input
              type="checkbox"
              checked={irPolicy}
              onChange={(e) => setIrPolicy(e.target.checked)}
              className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
              <Database className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
              Database Connection Mode
            </label>
            <select value={dbMode} onChange={(e) => setDbMode(e.target.value)} className={selectCls}>
              <option>PostgreSQL (Go Fiber API)</option>
              <option>SQLite / PostgreSQL Auto-Fallback</option>
              <option>PostgreSQL Production Instance</option>
            </select>
          </div>
        </div>
      </div>

      {/* API Info Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4">
          Backend API Configuration
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'API Server', value: 'Go Fiber (main.go)', icon: '⚡' },
            { label: 'Port', value: 'localhost:3000', icon: '🔌' },
            { label: 'Database', value: 'PostgreSQL 16', icon: '🗄️' },
            { label: 'Fallback DB', value: 'SQLite (block_planning.db)', icon: '💾' },
          ].map((item) => (
            <div key={item.label} className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <p className="text-lg mb-1">{item.icon}</p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{item.label}</p>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
