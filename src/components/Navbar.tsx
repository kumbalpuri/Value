import React from 'react';
import {
  Layers,
  BookOpen,
  Printer,
  Plus,
  GitBranch,
  GitCompare,
  PanelLeft,
} from 'lucide-react';
import { ValueStreamMap } from '../types/vsm';

export type ActiveTab = 'canvas' | 'wizard' | 'compare' | 'kaizen' | 'archive';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeMap: ValueStreamMap;
  maps: ValueStreamMap[];
  onSelectMap: (id: string) => void;
  onCloneToFuture: (source: ValueStreamMap) => void;
  onNewMap: () => void;
  onOpenLegend: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  activeMap,
  maps,
  onSelectMap,
  onCloneToFuture,
  onNewMap,
  onOpenLegend,
  sidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const handlePrint = () => {
    if (activeTab !== 'canvas') {
      onSelectTab('canvas');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('vsm-trigger-print'));
      }, 120);
    } else {
      window.dispatchEvent(new CustomEvent('vsm-trigger-print'));
    }
  };

  return (
    <header className="flex items-center justify-between gap-4 px-3 py-1.5 bg-white border-b border-slate-200 shrink-0 no-print">
      {/* Left: Sidebar Toggle + Brand Wordmark + Compact Stream Selector */}
      <div className="flex items-center gap-2.5 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold border transition-colors ${
              !sidebarCollapsed
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
            title="Toggle Left Navigation Menu & Submenus"
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span>Menu</span>
          </button>
        )}

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('archive');
          }}
          className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2 whitespace-nowrap"
        >
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span>VSM Studio</span>
        </a>

        <div className="h-4 w-px bg-slate-200" />

        <select
          value={activeMap.id}
          onChange={(e) => onSelectMap(e.target.value)}
          className="text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 py-1 px-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer max-w-[260px] truncate"
          title="Switch Active Value Stream Map"
        >
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} ({m.stateType === 'future' ? 'Future' : 'Current'})
            </option>
          ))}
        </select>
      </div>

      {/* Center: 5 Single-Line Navigation Links */}
      <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-slate-600">
        <button
          onClick={() => onSelectTab('archive')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
            activeTab === 'archive'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          All VSMs ({maps.filter((m) => m.stateType === 'current').length} Current)
        </button>

        <button
          onClick={() => onSelectTab('canvas')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
            activeTab === 'canvas'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Diagram Canvas
        </button>

        <button
          onClick={() => onSelectTab('wizard')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
            activeTab === 'wizard'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Data Wizard
        </button>

        <button
          onClick={() => onSelectTab('compare')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
            activeTab === 'compare'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Before vs. Future
        </button>

        <button
          onClick={() => onSelectTab('kaizen')}
          className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
            activeTab === 'kaizen'
              ? 'border-amber-500 text-amber-600 font-bold'
              : 'border-transparent hover:text-slate-900'
          }`}
        >
          Kaizen Board ({activeMap.kaizenBursts.length})
        </button>
      </nav>

      {/* Right: Stream Actions & Utilities */}
      <div className="flex items-center gap-2 shrink-0">
        {activeMap.stateType === 'current' ? (
          <button
            onClick={() => onCloneToFuture(activeMap)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors whitespace-nowrap"
            title="Clone Current State into a Lean Future State"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Future State</span>
          </button>
        ) : (
          <button
            onClick={() => onSelectTab('compare')}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors whitespace-nowrap"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare</span>
          </button>
        )}

        <button
          onClick={onNewMap}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New VSM</span>
        </button>

        <button
          onClick={onOpenLegend}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          title="View Standard Lean Symbols Reference"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden xl:inline">Symbols</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
          title="Print to PDF (A3 / A4 Landscape Report)"
        >
          <Printer className="w-3.5 h-3.5 text-slate-700" />
          <span className="hidden xl:inline">Print PDF</span>
        </button>
      </div>
    </header>
  );
};
