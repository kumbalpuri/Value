import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { ValueStreamMap } from './types/vsm';
import {
  getStoredMaps,
  saveStoredMaps,
  getActiveMapId,
  setActiveMapId as setStoredActiveId,
  saveSingleMap,
  createNewMap,
  cloneToFutureState,
  deleteMap,
  exportMapsToJson,
  importMapsFromJson,
  resetToInitialDatasets,
} from './services/storage';
import { Navbar, ActiveTab } from './components/Navbar';
import { LeftSidebar, CanvasCommand } from './components/LeftSidebar';
import { VSMCanvas } from './components/VSMCanvas';
import { VSMWizard } from './components/VSMWizard';
import { ComparisonView } from './components/ComparisonView';
import { KaizenTracker } from './components/KaizenTracker';
import { ArchiveLibrary } from './components/ArchiveLibrary';
import { SymbolLegendModal } from './components/SymbolLegendModal';
import { PerformanceDashboard } from './components/PerformanceDashboard';

export default function App() {
  const [maps, setMaps] = useState<ValueStreamMap[]>([]);
  const [activeMapId, setActiveMapId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [performanceDashboardCollapsed, setPerformanceDashboardCollapsed] = useState<boolean>(false);
  const [canvasState, setCanvasState] = useState<{
    mode: 'edit' | 'simulate' | 'view';
    showGrid: boolean;
    highlightBottlenecks: boolean;
    activeInspector: string | null;
  }>({
    mode: 'edit',
    showGrid: true,
    highlightBottlenecks: true,
    activeInspector: null,
  });
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [whatIfBaselines, setWhatIfBaselines] = useState<Record<string, ValueStreamMap>>({});

  const handleDispatchCanvasCommand = (cmd: CanvasCommand) => {
    window.dispatchEvent(new CustomEvent('vsm-canvas-command', { detail: cmd }));
  };

  // New Map Form
  const [newTitle, setNewTitle] = useState('');
  const [newOrg, setNewOrg] = useState('');
  const [newProductFamily, setNewProductFamily] = useState('');
  const [newState, setNewState] = useState<'current' | 'future'>('current');

  const mapsRef = useRef<ValueStreamMap[]>(maps);
  const activeMapIdRef = useRef<string>(activeMapId);

  useEffect(() => {
    mapsRef.current = maps;
  }, [maps]);

  useEffect(() => {
    activeMapIdRef.current = activeMapId;
  }, [activeMapId]);

  useEffect(() => {
    const stored = getStoredMaps();
    setMaps(stored);
    const active = getActiveMapId();
    if (stored.some((m) => m.id === active)) {
      setActiveMapId(active);
    } else if (stored.length > 0) {
      setActiveMapId(stored[0].id);
    }
  }, []);

  // 30-Second Auto-Save Interval + Tab Hide / Unload Persistence to LocalStorage
  useEffect(() => {
    const persistCurrentVsmState = () => {
      if (mapsRef.current && mapsRef.current.length > 0) {
        saveStoredMaps(mapsRef.current);
      }
      if (activeMapIdRef.current) {
        setStoredActiveId(activeMapIdRef.current);
      }
    };

    const autoSaveInterval = window.setInterval(persistCurrentVsmState, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistCurrentVsmState();
      }
    };

    window.addEventListener('beforeunload', persistCurrentVsmState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(autoSaveInterval);
      window.removeEventListener('beforeunload', persistCurrentVsmState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const activeMap = maps.find((m) => m.id === activeMapId) || maps[0];

  // Snapshot baseline for active map when entering What-If Simulation mode (or initialize on first load)
  useEffect(() => {
    if (!activeMap) return;
    setWhatIfBaselines((prev) => {
      if (prev[activeMap.id]) return prev;
      return {
        ...prev,
        [activeMap.id]: JSON.parse(JSON.stringify(activeMap)),
      };
    });
  }, [activeMap, canvasState.mode]);

  const activeBaselineMap = activeMap ? whatIfBaselines[activeMap.id] || null : null;

  const handleResetWhatIfBaseline = () => {
    if (!activeMap || !activeBaselineMap) return;
    const restored: ValueStreamMap = JSON.parse(JSON.stringify(activeBaselineMap));
    handleUpdateMap(restored);
    showToast('Reset What-If Simulation to baseline');
  };

  const handleCommitWhatIfBaseline = () => {
    if (!activeMap) return;
    setWhatIfBaselines((prev) => ({
      ...prev,
      [activeMap.id]: JSON.parse(JSON.stringify(activeMap)),
    }));
    showToast('Updated What-If baseline to current values');
  };

  const handleSelectMap = (id: string) => {
    setActiveMapId(id);
    setStoredActiveId(id);
    setActiveTab('canvas');
  };

  const handleOpenWizardForMap = (id: string) => {
    setActiveMapId(id);
    setStoredActiveId(id);
    setActiveTab('wizard');
  };

  const handleCompareMap = (id: string) => {
    setActiveMapId(id);
    setStoredActiveId(id);
    setActiveTab('compare');
  };

  const handleUpdateMap = (updated: ValueStreamMap) => {
    const updatedMaps = saveSingleMap(updated);
    setMaps(updatedMaps);
  };

  const handleCloneToFuture = (source: ValueStreamMap) => {
    const cloned = cloneToFutureState(source);
    setMaps(getStoredMaps());
    setActiveMapId(cloned.id);
    setActiveTab('compare');
    showToast(`Generated Lean Future State for "${source.title}"`);
  };

  const handleDeleteMap = (id: string) => {
    const updated = deleteMap(id);
    setMaps(updated);
    const newActive = getActiveMapId();
    setActiveMapId(newActive);
    showToast('Value stream map removed from archive');
  };

  const handleCreateNewMap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const created = createNewMap({
      title: newTitle,
      organization: newOrg || 'Enterprise Operations',
      productFamily: newProductFamily || 'Custom Product Line',
      author: 'Value Stream Team',
      stateType: newState,
    });
    setMaps(getStoredMaps());
    setActiveMapId(created.id);
    setIsNewModalOpen(false);
    setNewTitle('');
    setNewOrg('');
    setNewProductFamily('');
    setActiveTab('wizard');
    showToast(`Created "${created.title}"`);
  };

  const handleExportArchiveJson = () => {
    const jsonStr = exportMapsToJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vsm_studio_archive_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported VSM Archive backup file');
  };

  const handleImportArchiveJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const res = importMapsFromJson(text);
      if (res.success) {
        setMaps(getStoredMaps());
        showToast(`Imported ${res.count} value stream map(s)`);
      } else {
        showToast(`Import error: ${res.error}`);
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    const reset = resetToInitialDatasets();
    setMaps(reset);
    setActiveMapId(reset[0].id);
    showToast('Restored default Masterclass models');
  };

  const getPairedMaps = () => {
    if (!activeMap) return { current: null, future: null };

    if (activeMap.stateType === 'future') {
      const parent = maps.find((m) => m.id === activeMap.parentMapId);
      if (parent) {
        return { current: parent, future: activeMap };
      }
      const matchingCurrent =
        maps.find(
          (m) => m.stateType === 'current' && m.productFamily === activeMap.productFamily
        ) ||
        maps.find((m) => m.stateType === 'current') ||
        activeMap;
      return { current: matchingCurrent, future: activeMap };
    } else {
      const matchingFuture = maps.find(
        (m) =>
          m.parentMapId === activeMap.id ||
          (m.stateType === 'future' && m.productFamily === activeMap.productFamily)
      );
      if (matchingFuture) {
        return { current: activeMap, future: matchingFuture };
      }
      const anyFuture = maps.find((m) => m.stateType === 'future');
      return { current: activeMap, future: anyFuture || activeMap };
    }
  };

  if (!activeMap) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-900">
        <div className="text-center space-y-3">
          <Layers className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-sm font-medium">Loading VSM Studio...</p>
        </div>
      </div>
    );
  }

  const { current: comparisonCurrent, future: comparisonFuture } = getPairedMaps();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Row 1: Ultra-Compact Global Header & Stream Switcher */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeMap={activeMap}
        maps={maps}
        onSelectMap={handleSelectMap}
        onCloneToFuture={handleCloneToFuture}
        onNewMap={() => setIsNewModalOpen(true)}
        onOpenLegend={() => setIsLegendOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
      />

      {/* Workspace Body: Left Menu with Submenus + Full-Screen-Fit Main Viewport */}
      <div className="flex-1 flex overflow-hidden relative">
        <LeftSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeMap={activeMap}
          maps={maps}
          onSelectMap={handleSelectMap}
          onNewMap={() => setIsNewModalOpen(true)}
          onCloneToFuture={handleCloneToFuture}
          onOpenLegend={() => setIsLegendOpen(true)}
          onExportJson={handleExportArchiveJson}
          onImportJson={handleImportArchiveJson}
          canvasState={canvasState}
          onDispatchCanvasCommand={handleDispatchCanvasCommand}
          performanceDashboardOpen={!performanceDashboardCollapsed}
          onTogglePerformanceDashboard={() =>
            setPerformanceDashboardCollapsed((prev) => !prev)
          }
        />

        <main className="flex-1 overflow-hidden relative">
          {activeTab === 'canvas' && (
            <div className="w-full h-full flex overflow-hidden">
              <div className="flex-1 h-full overflow-hidden relative">
                <VSMCanvas
                  map={activeMap}
                  onUpdateMap={handleUpdateMap}
                  onOpenWizard={() => setActiveTab('wizard')}
                  onOpenKaizenModal={() => setActiveTab('kaizen')}
                  onOpenLegend={() => setIsLegendOpen(true)}
                  baselineMap={activeBaselineMap}
                  onResetWhatIfBaseline={handleResetWhatIfBaseline}
                  onCommitWhatIfBaseline={handleCommitWhatIfBaseline}
                  onCanvasStateChange={setCanvasState}
                />
              </div>
              <PerformanceDashboard
                map={activeMap}
                onUpdateMap={handleUpdateMap}
                baselineMap={activeBaselineMap}
                isWhatIfMode={canvasState.mode === 'simulate'}
                onToggleWhatIfMode={() =>
                  handleDispatchCanvasCommand({
                    action: 'set-mode',
                    mode: canvasState.mode === 'simulate' ? 'edit' : 'simulate',
                  })
                }
                onResetWhatIfBaseline={handleResetWhatIfBaseline}
                collapsed={performanceDashboardCollapsed}
                onToggleCollapse={() =>
                  setPerformanceDashboardCollapsed((prev) => !prev)
                }
                onSelectNodeOnCanvas={(nodeType, nodeId) =>
                  handleDispatchCanvasCommand({
                    action: 'select-node',
                    nodeType,
                    nodeId,
                  })
                }
                onOpenWizard={() => setActiveTab('wizard')}
                onCloneToFuture={() => handleCloneToFuture(activeMap)}
              />
            </div>
          )}

        {activeTab === 'wizard' && (
          <VSMWizard
            map={activeMap}
            onAutoSave={(updated) => {
              handleUpdateMap(updated);
            }}
            onSave={(updated) => {
              handleUpdateMap(updated);
              setActiveTab('canvas');
              showToast('Updated Value Stream parameters');
            }}
            onCancel={() => setActiveTab('canvas')}
          />
        )}

        {activeTab === 'compare' && comparisonCurrent && comparisonFuture && (
          <ComparisonView
            currentMap={comparisonCurrent}
            futureMap={comparisonFuture}
            onUpdateCurrent={handleUpdateMap}
            onUpdateFuture={handleUpdateMap}
          />
        )}

        {activeTab === 'kaizen' && (
          <KaizenTracker
            map={activeMap}
            onUpdateMap={handleUpdateMap}
            onSelectBurstOnMap={() => setActiveTab('canvas')}
          />
        )}

          {activeTab === 'archive' && (
            <ArchiveLibrary
              maps={maps}
              activeMapId={activeMapId}
              onSelectMap={handleSelectMap}
              onOpenWizardForMap={handleOpenWizardForMap}
              onCompareMap={handleCompareMap}
              onCloneToFuture={handleCloneToFuture}
              onDeleteMap={handleDeleteMap}
              onNewMap={() => setIsNewModalOpen(true)}
              onExportJson={handleExportArchiveJson}
              onImportJson={handleImportArchiveJson}
              onResetDefaults={handleResetDefaults}
            />
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Symbol Legend Modal */}
      <SymbolLegendModal isOpen={isLegendOpen} onClose={() => setIsLegendOpen(false)} />

      {/* New VSM Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Create New Value Stream Map
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Initialize a new stream and customize it directly on the interactive canvas or wizard.
            </p>

            <form onSubmit={handleCreateNewMap} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Value Stream Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., EV Battery Module Assembly Line"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Organization / Facility
                </label>
                <input
                  type="text"
                  placeholder="e.g., Gigafactory North"
                  value={newOrg}
                  onChange={(e) => setNewOrg(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Product Family
                </label>
                <input
                  type="text"
                  placeholder="e.g., 800V Lithium Pack Series"
                  value={newProductFamily}
                  onChange={(e) => setNewProductFamily(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">State Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewState('current')}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      newState === 'current'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Current State (As-Is)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewState('future')}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      newState === 'future'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Future State (Target)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
                >
                  Create &amp; Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
