import React, { useState } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
  Sliders,
  GitCompare,
  Flame,
  FolderKanban,
  Move,
  Play,
  MousePointer,
  RotateCcw,
  Plus,
  Building2,
  Factory,
  Cpu,
  Box,
  Repeat,
  StickyNote,
  Gauge,
  Eye,
  Calculator,
  Maximize2,
  Scan,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  BookOpen,
  Printer,
  Download,
  Upload,
  FileJson,
  GitBranch,
} from 'lucide-react';
import { ValueStreamMap } from '../types/vsm';
import { calculateVsmMetrics, getNormalizedSupplyChain } from '../utils/vsmMath';
import { ActiveTab } from './Navbar';

export type CanvasCommand =
  | { action: 'screen-fit' }
  | { action: 'zoom-window' }
  | { action: 'zoom-in' }
  | { action: 'zoom-out' }
  | { action: 'toggle-grid' }
  | { action: 'set-mode'; mode: 'edit' | 'simulate' | 'view' }
  | { action: 'auto-align' }
  | { action: 'add-step' }
  | { action: 'add-kaizen' }
  | {
      action: 'select-node';
      nodeType: 'process' | 'buffer' | 'supplier' | 'customer' | 'control' | 'metrics' | 'bottlenecks';
      nodeId?: string;
    }
  | { action: 'add-symbol'; symbolType: 'heijunka_box' | 'safety_stock' | 'kanban_post' | 'note_box'; label: string }
  | { action: 'toggle-bottlenecks' }
  | { action: 'export-png' }
  | { action: 'print-pdf'; paperSize?: 'A3' | 'A4' };

interface LeftSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeMap: ValueStreamMap;
  maps: ValueStreamMap[];
  onSelectMap: (id: string) => void;
  onNewMap: () => void;
  onCloneToFuture: (source: ValueStreamMap) => void;
  onOpenLegend: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  canvasState: {
    mode: 'edit' | 'simulate' | 'view';
    showGrid: boolean;
    highlightBottlenecks: boolean;
    activeInspector: string | null;
  };
  onDispatchCanvasCommand: (cmd: CanvasCommand) => void;
  performanceDashboardOpen?: boolean;
  onTogglePerformanceDashboard?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  activeMap,
  maps,
  onSelectMap,
  onNewMap,
  onCloneToFuture,
  onOpenLegend,
  onExportJson,
  onImportJson,
  canvasState,
  onDispatchCanvasCommand,
  performanceDashboardOpen = true,
  onTogglePerformanceDashboard,
}) => {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    streams: true,
    views: true,
    modes: true,
    builder: true,
    analytics: true,
    utilities: true,
  });

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const metrics = calculateVsmMetrics(activeMap);
  const supplyChain = getNormalizedSupplyChain(activeMap.supplier);

  const runCanvasAction = (cmd: CanvasCommand) => {
    if (activeTab !== 'canvas') {
      onSelectTab('canvas');
      setTimeout(() => {
        onDispatchCanvasCommand(cmd);
      }, 60);
    } else {
      onDispatchCanvasCommand(cmd);
    }
  };

  if (collapsed) {
    return (
      <aside className="w-12 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col items-center py-2.5 gap-2 shrink-0 select-none no-print z-20">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg bg-slate-800 hover:bg-blue-600 text-white transition-colors"
          title="Expand Left Navigation Menu"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-slate-800 my-0.5" />

        <button
          onClick={() => onSelectTab('canvas')}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === 'canvas'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Diagram Canvas"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTab('archive')}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === 'archive'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="All VSMs Table"
        >
          <FolderKanban className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTab('wizard')}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === 'wizard'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Guided Data Wizard"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTab('compare')}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === 'compare'
              ? 'bg-blue-600 text-white'
              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Before vs. Future State"
        >
          <GitCompare className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectTab('kaizen')}
          className={`p-2 rounded-lg transition-colors ${
            activeTab === 'kaizen'
              ? 'bg-amber-500 text-slate-950'
              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
          }`}
          title={`Kaizen Board (${activeMap.kaizenBursts.length})`}
        >
          <Flame className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-slate-800 my-0.5" />

        <button
          onClick={() => runCanvasAction({ action: 'screen-fit' })}
          className="p-2 rounded-lg hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 transition-colors"
          title="Screen Fit Diagram"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => runCanvasAction({ action: 'add-step' })}
          className="p-2 rounded-lg hover:bg-slate-800 text-blue-400 hover:text-blue-300 transition-colors"
          title="Add Process Step"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          onClick={() =>
            runCanvasAction({ action: 'select-node', nodeType: 'bottlenecks' })
          }
          className="p-2 rounded-lg hover:bg-slate-800 text-rose-400 hover:text-rose-300 transition-colors relative"
          title="Bottleneck Radar (C/T vs. Takt)"
        >
          <Gauge className="w-4 h-4" />
          {metrics.overTaktCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
          )}
        </button>

        <button
          onClick={() =>
            runCanvasAction({ action: 'select-node', nodeType: 'metrics' })
          }
          className="p-2 rounded-lg hover:bg-slate-800 text-sky-400 hover:text-sky-300 transition-colors"
          title="Lead Time & PCE Calculator"
        >
          <Calculator className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col h-full shrink-0 select-none no-print z-20">
      {/* Sidebar Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <span className="text-xs font-extrabold tracking-tight text-white block leading-none">
              VSM Navigation
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Menus &amp; Submenus
            </span>
          </div>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Collapse Left Menu to maximize canvas"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Accordion Menus & Submenus */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5 text-xs">
        {/* ================= MENU 1: WORKSPACE VIEWS ================= */}
        <div className="rounded-lg bg-slate-950/40 border border-slate-800/80 overflow-hidden">
          <button
            onClick={() => toggleMenu('views')}
            className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
              <span>1. Workspace Views</span>
            </span>
            {openMenus.views ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {openMenus.views && (
            <div className="px-1.5 pb-2 pt-0.5 space-y-0.5 border-t border-slate-800/60">
              <button
                onClick={() => onSelectTab('canvas')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'canvas'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Diagram Canvas</span>
                </span>
                <span className="text-[10px] font-mono opacity-80">
                  {activeMap.processes.length} Steps
                </span>
              </button>

              <button
                onClick={() => onSelectTab('archive')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'archive'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>All VSMs Table</span>
                </span>
                <span className="text-[10px] font-mono opacity-80">
                  {maps.length} Maps
                </span>
              </button>

              <button
                onClick={() => onSelectTab('wizard')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'wizard'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Guided Data Wizard</span>
                </span>
              </button>

              <button
                onClick={() => onSelectTab('compare')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'compare'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Before vs. Future</span>
                </span>
              </button>

              <button
                onClick={() => onSelectTab('kaizen')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'kaizen'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Kaizen Event Board</span>
                </span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 text-[10px] font-mono font-bold">
                  {activeMap.kaizenBursts.length}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ================= MENU 2: VALUE STREAMS & STATES ================= */}
        <div className="rounded-lg bg-slate-950/40 border border-slate-800/80 overflow-hidden">
          <button
            onClick={() => toggleMenu('streams')}
            className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Value Streams</span>
            </span>
            {openMenus.streams ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {openMenus.streams && (
            <div className="px-1.5 pb-2 pt-1 space-y-1 border-t border-slate-800/60">
              <div className="max-h-36 overflow-y-auto space-y-0.5 pr-0.5">
                {maps.map((m) => {
                  const isActive = m.id === activeMap.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        onSelectMap(m.id);
                        if (activeTab === 'archive') onSelectTab('canvas');
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between gap-1.5 transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate font-medium text-[11px]">
                        {m.title}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          m.stateType === 'future'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {m.stateType === 'future' ? 'Future' : 'Current'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-1 border-t border-slate-800/80 flex flex-col gap-1">
                <button
                  onClick={onNewMap}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Create New VSM</span>
                </button>

                {activeMap.stateType === 'current' && (
                  <button
                    onClick={() => onCloneToFuture(activeMap)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold transition-colors"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Clone to Future State</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ================= MENU 3: CANVAS MODES & SCREEN FIT ================= */}
        <div className="rounded-lg bg-slate-950/40 border border-slate-800/80 overflow-hidden">
          <button
            onClick={() => toggleMenu('modes')}
            className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Move className="w-3.5 h-3.5 text-sky-400" />
              <span>3. Canvas Mode &amp; Fit</span>
            </span>
            {openMenus.modes ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {openMenus.modes && (
            <div className="px-1.5 pb-2 pt-0.5 space-y-0.5 border-t border-slate-800/60">
              <button
                onClick={() => runCanvasAction({ action: 'screen-fit' })}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs transition-colors mb-1"
              >
                <span className="flex items-center gap-2">
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Screen Fit Diagram</span>
                </span>
                <span className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded">
                  Auto-Fit
                </span>
              </button>

              <button
                onClick={() =>
                  runCanvasAction({ action: 'set-mode', mode: 'edit' })
                }
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'canvas' && canvasState.mode === 'edit'
                    ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Move className="w-3.5 h-3.5 text-blue-400" />
                <span>Interactive Edit Mode</span>
              </button>

              <button
                onClick={() =>
                  runCanvasAction({ action: 'set-mode', mode: 'simulate' })
                }
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'canvas' && canvasState.mode === 'simulate'
                    ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simulate Material Flow</span>
              </button>

              <button
                onClick={() =>
                  runCanvasAction({ action: 'set-mode', mode: 'view' })
                }
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'canvas' && canvasState.mode === 'view'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5 text-slate-400" />
                <span>Presentation View Mode</span>
              </button>

              <button
                onClick={() => runCanvasAction({ action: 'auto-align' })}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Auto-Align Layout Grid</span>
              </button>
            </div>
          )}
        </div>

        {/* ================= MENU 4: ADD VSM ELEMENTS (BUILDER SUBMENU) ================= */}
        <div className="rounded-lg bg-slate-950/40 border border-slate-800/80 overflow-hidden">
          <button
            onClick={() => toggleMenu('builder')}
            className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>4. Add VSM Elements</span>
            </span>
            {openMenus.builder ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {openMenus.builder && (
            <div className="px-1.5 pb-2 pt-0.5 space-y-0.5 border-t border-slate-800/60">
              <button
                onClick={() => runCanvasAction({ action: 'add-step' })}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-200 hover:bg-slate-800 hover:text-white font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>+ Add Process Step</span>
                </span>
              </button>

              <button
                onClick={() => runCanvasAction({ action: 'add-kaizen' })}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-200 hover:bg-slate-800 hover:text-white font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Add Kaizen Burst</span>
                </span>
              </button>

              <button
                onClick={() =>
                  runCanvasAction({ action: 'select-node', nodeType: 'supplier' })
                }
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  canvasState.activeInspector === 'supplier'
                    ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vendors &amp; Raw Mat</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-300">
                  {supplyChain.vendors.length}V/{supplyChain.rawMaterials.length}M
                </span>
              </button>

              <button
                onClick={() =>
                  runCanvasAction({ action: 'select-node', nodeType: 'customer' })
                }
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  canvasState.activeInspector === 'customer'
                    ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Factory className="w-3.5 h-3.5 text-sky-400" />
                  <span>Customer &amp; Takt Config</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {metrics.taktTimeSeconds}s
                </span>
              </button>

              <button
                onClick={() =>
                  runCanvasAction({ action: 'select-node', nodeType: 'control' })
                }
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  canvasState.activeInspector === 'control'
                    ? 'bg-blue-600/30 text-blue-200 border border-blue-500/40'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Production Control / ERP</span>
                </span>
              </button>

              <div className="pt-1 mt-1 border-t border-slate-800/60">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Lean Floor Symbols
                </span>
                <button
                  onClick={() =>
                    runCanvasAction({
                      action: 'add-symbol',
                      symbolType: 'heijunka_box',
                      label: 'Heijunka Box',
                    })
                  }
                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <span className="font-mono text-[9px] font-black text-blue-400 w-4">
                    OX
                  </span>
                  <span>+ Heijunka Box</span>
                </button>
                <button
                  onClick={() =>
                    runCanvasAction({
                      action: 'add-symbol',
                      symbolType: 'safety_stock',
                      label: 'Safety Stock',
                    })
                  }
                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Box className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Safety Stock Buffer</span>
                </button>
                <button
                  onClick={() =>
                    runCanvasAction({
                      action: 'add-symbol',
                      symbolType: 'kanban_post',
                      label: 'Kanban Post',
                    })
                  }
                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <Repeat className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ Kanban Post Signal</span>
                </button>
                <button
                  onClick={() =>
                    runCanvasAction({
                      action: 'add-symbol',
                      symbolType: 'note_box',
                      label: 'Floor Note',
                    })
                  }
                  className="w-full flex items-center gap-2 px-2.5 py-1 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <StickyNote className="w-3.5 h-3.5 text-yellow-400" />
                  <span>+ Floor Annotation Note</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= MENU 5: BOTTLENECKS & LEAN ANALYTICS ================= */}
        <div className="rounded-lg bg-slate-950/40 border border-slate-800/80 overflow-hidden">
          <button
            onClick={() => toggleMenu('analytics')}
            className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-rose-400" />
              <span>5. Bottlenecks &amp; Metrics</span>
            </span>
            {openMenus.analytics ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {openMenus.analytics && (
            <div className="px-1.5 pb-2 pt-0.5 space-y-0.5 border-t border-slate-800/60">
              <button
                onClick={() =>
                  runCanvasAction({
                    action: 'select-node',
                    nodeType: 'bottlenecks',
                  })
                }
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  canvasState.activeInspector === 'bottlenecks'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Gauge className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">Bottleneck Radar</span>
                </span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 ${
                    metrics.overTaktCount > 0
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {metrics.maxCtToTaktRatio}x
                </span>
              </button>

              <button
                onClick={() => runCanvasAction({ action: 'toggle-bottlenecks' })}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  <span>Bottleneck Highlight</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    canvasState.highlightBottlenecks
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {canvasState.highlightBottlenecks ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                onClick={() =>
                  runCanvasAction({ action: 'select-node', nodeType: 'metrics' })
                }
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  canvasState.activeInspector === 'metrics'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Calculator className="w-3.5 h-3.5 text-sky-400" />
                  <span>Lead Time &amp; PCE Calc</span>
                </span>
                <span className="text-[10px] font-mono text-sky-300">
                  {metrics.flowEfficiencyPercent}%
                </span>
              </button>

              {onTogglePerformanceDashboard && (
                <button
                  onClick={() => {
                    if (activeTab !== 'canvas') onSelectTab('canvas');
                    onTogglePerformanceDashboard();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Performance Dashboard</span>
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      performanceDashboardOpen
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {performanceDashboardOpen ? 'OPEN' : 'RAIL'}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* ================= MENU 6: ZOOM, GRID & EXPORT UTILITIES ================= */}
        <div className="rounded-lg bg-slate-950/40 border border-slate-800/80 overflow-hidden">
          <button
            onClick={() => toggleMenu('utilities')}
            className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5 text-purple-400" />
              <span>6. Zoom, Grid &amp; Export</span>
            </span>
            {openMenus.utilities ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>

          {openMenus.utilities && (
            <div className="px-1.5 pb-2 pt-0.5 space-y-0.5 border-t border-slate-800/60">
              <button
                onClick={() => runCanvasAction({ action: 'zoom-window' })}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
              >
                <Scan className="w-3.5 h-3.5 text-blue-400" />
                <span>Zoom Window (Box Select)</span>
              </button>

              <div className="grid grid-cols-2 gap-1 px-1 py-0.5">
                <button
                  onClick={() => runCanvasAction({ action: 'zoom-in' })}
                  className="flex items-center justify-center gap-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Zoom In</span>
                </button>
                <button
                  onClick={() => runCanvasAction({ action: 'zoom-out' })}
                  className="flex items-center justify-center gap-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                  <span>Zoom Out</span>
                </button>
              </div>

              <button
                onClick={() => runCanvasAction({ action: 'toggle-grid' })}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Grid3X3 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Canvas Grid</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    canvasState.showGrid
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {canvasState.showGrid ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                onClick={onOpenLegend}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>Lean VSM Symbol Legend</span>
              </button>

              <button
                onClick={() =>
                  runCanvasAction({ action: 'print-pdf', paperSize: 'A3' })
                }
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Print to PDF (A3/A4 Report)</span>
              </button>

              <button
                onClick={() => runCanvasAction({ action: 'export-png' })}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Export High-Res PNG</span>
              </button>

              <button
                onClick={onExportJson}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-400" />
                <span>Export JSON Backup</span>
              </button>

              <label className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-purple-400" />
                <span>Import JSON File</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportJson(file);
                  }}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
