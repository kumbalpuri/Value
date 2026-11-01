import React, { useState } from 'react';
import {
  FolderArchive,
  Search,
  Plus,
  Trash2,
  Download,
  Upload,
  ArrowRight,
  GitBranch,
  GitCompare,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Sliders,
  ArrowUpDown,
} from 'lucide-react';
import { ValueStreamMap } from '../types/vsm';
import { calculateVsmMetrics, getNormalizedSupplyChain } from '../utils/vsmMath';

interface ArchiveLibraryProps {
  maps: ValueStreamMap[];
  activeMapId: string;
  onSelectMap: (id: string) => void;
  onOpenWizardForMap?: (id: string) => void;
  onCompareMap?: (id: string) => void;
  onCloneToFuture: (sourceMap: ValueStreamMap) => void;
  onDeleteMap: (id: string) => void;
  onNewMap: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onResetDefaults: () => void;
}

type SortField = 'title' | 'leadTime' | 'taktTime' | 'cycleTime' | 'pce' | 'demand';

export const ArchiveLibrary: React.FC<ArchiveLibraryProps> = ({
  maps,
  activeMapId,
  onSelectMap,
  onOpenWizardForMap,
  onCompareMap,
  onCloneToFuture,
  onDeleteMap,
  onNewMap,
  onExportJson,
  onImportJson,
  onResetDefaults,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Default to 'current' so the landing page starts with all VSMs with their Current States
  const [stateFilter, setStateFilter] = useState<'current' | 'all' | 'future'>('current');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const currentMaps = maps.filter((m) => m.stateType === 'current');
  const futureMaps = maps.filter((m) => m.stateType === 'future');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredMaps = maps
    .filter((m) => {
      if (stateFilter !== 'all' && m.stateType !== stateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          m.organization.toLowerCase().includes(q) ||
          m.productFamily.toLowerCase().includes(q) ||
          (m.author && m.author.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const mA = calculateVsmMetrics(a);
      const mB = calculateVsmMetrics(b);
      let cmp = 0;
      if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'leadTime') cmp = mA.leadTimeDays - mB.leadTimeDays;
      else if (sortField === 'taktTime') cmp = mA.taktTimeSeconds - mB.taktTimeSeconds;
      else if (sortField === 'cycleTime') cmp = mA.cycleTimeSeconds - mB.cycleTimeSeconds;
      else if (sortField === 'pce') cmp = mA.flowEfficiencyPercent - mB.flowEfficiencyPercent;
      else if (sortField === 'demand')
        cmp = a.demand.dailyDemandUnits - b.demand.dailyDemandUnits;
      return sortAsc ? cmp : -cmp;
    });

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportJson(e.target.files[0]);
    }
  };

  const totalKaizenCount = maps.reduce((acc, m) => acc + m.kaizenBursts.length, 0);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-auto p-6 space-y-4">
      {/* Top Executive Directory Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <FolderArchive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              Enterprise Value Stream Register (Tabular View)
            </h1>
            <p className="text-xs text-slate-500">
              Showing {filteredMaps.length} of {maps.length} organizational Value Stream Maps ·{' '}
              <span className="font-mono font-semibold text-slate-700">
                {currentMaps.length} Current
              </span>{' '}
              ·{' '}
              <span className="font-mono font-semibold text-slate-700">
                {futureMaps.length} Future
              </span>{' '}
              ·{' '}
              <span className="font-mono font-semibold text-slate-700">
                {totalKaizenCount} Kaizen Events
              </span>
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import JSON</span>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </label>

          <button
            onClick={onExportJson}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Archive</span>
          </button>

          <button
            onClick={onNewMap}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Value Stream</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search register by value stream title, plant/facility, or product family..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-medium bg-transparent border-none focus:outline-none text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/70">
            <button
              onClick={() => setStateFilter('current')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                stateFilter === 'current'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Current States ({currentMaps.length})
            </button>
            <button
              onClick={() => setStateFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                stateFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All VSMs ({maps.length})
            </button>
            <button
              onClick={() => setStateFilter('future')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                stateFilter === 'future'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Future States ({futureMaps.length})
            </button>
          </div>

          <button
            onClick={onResetDefaults}
            className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-medium transition-colors"
            title="Restore default enterprise VSM models"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Models</span>
          </button>
        </div>
      </div>

      {/* Enterprise Tabular Register */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                <th className="py-3.5 px-4 w-10 text-center">#</th>
                <th className="py-3.5 px-4 min-w-[230px]">
                  <button
                    type="button"
                    onClick={() => handleSort('title')}
                    className="inline-flex items-center gap-1 hover:text-blue-300 transition-colors uppercase"
                  >
                    <span>Value Stream &amp; Facility</span>
                    <ArrowUpDown className="w-3 h-3 opacity-75" />
                  </button>
                </th>
                <th className="py-3.5 px-3 whitespace-nowrap">State</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Vendors &amp; Raw Mat</th>
                <th className="py-3.5 px-4 min-w-[270px]">Process Stages &amp; Flow Sequence</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('demand')}
                    className="inline-flex items-center justify-end gap-1 hover:text-blue-300 transition-colors uppercase ml-auto"
                  >
                    <span>Demand / Takt</span>
                    <ArrowUpDown className="w-3 h-3 opacity-75" />
                  </button>
                </th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('cycleTime')}
                    className="inline-flex items-center justify-end gap-1 hover:text-blue-300 transition-colors uppercase ml-auto"
                  >
                    <span>Max Cycle &amp; Status</span>
                    <ArrowUpDown className="w-3 h-3 opacity-75" />
                  </button>
                </th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('leadTime')}
                    className="inline-flex items-center justify-end gap-1 hover:text-blue-300 transition-colors uppercase ml-auto"
                  >
                    <span>Lead Time</span>
                    <ArrowUpDown className="w-3 h-3 opacity-75" />
                  </button>
                </th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('pce')}
                    className="inline-flex items-center justify-end gap-1 hover:text-blue-300 transition-colors uppercase ml-auto"
                  >
                    <span>VA / PCE %</span>
                    <ArrowUpDown className="w-3 h-3 opacity-75" />
                  </button>
                </th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Kaizen</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredMaps.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    No Value Stream Maps match your current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredMaps.map((m, idx) => {
                  const metrics = calculateVsmMetrics(m);
                  const supplyChain = getNormalizedSupplyChain(m.supplier);
                  const isActive = m.id === activeMapId;
                  const pairedFuture =
                    m.stateType === 'current'
                      ? maps.find(
                          (f) =>
                            f.stateType === 'future' &&
                            (f.parentMapId === m.id || f.productFamily === m.productFamily)
                        )
                      : null;

                  return (
                    <tr
                      key={m.id}
                      onClick={() => onSelectMap(m.id)}
                      className={`transition-colors cursor-pointer group ${
                        isActive
                          ? 'bg-blue-50/70 hover:bg-blue-50'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      {/* Row Index */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Value Stream Title, Organization & Product Family */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2">
                          <div>
                            <div className="font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors text-sm leading-snug flex items-center gap-1.5">
                              <span>{m.title}</span>
                              {isActive && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <span className="font-semibold text-slate-700">{m.organization}</span>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span>{m.productFamily}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* State Column (Clean Typography) */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-xs">
                          {m.stateType === 'future' ? (
                            <span className="text-emerald-700">Future State (To-Be)</span>
                          ) : (
                            <span className="text-blue-700">Current State (As-Is)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {pairedFuture ? (
                            <span className="text-emerald-600 font-semibold">
                              Linked to Future State
                            </span>
                          ) : (
                            <span>Updated {new Date(m.updatedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </td>

                      {/* Supply Chain: Vendors & Raw Materials */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">
                          {supplyChain.vendors.length} Vendor{supplyChain.vendors.length > 1 ? 's' : ''}{' '}
                          · {supplyChain.rawMaterials.length} Mat
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Stock: {supplyChain.totalRawMaterialUnits.toLocaleString()} u (
                          {(
                            supplyChain.totalRawMaterialUnits /
                            Math.max(1, m.demand.dailyDemandUnits)
                          ).toFixed(1)}
                          d)
                        </div>
                      </td>

                      {/* Process Stages & Inline Flow Sequence */}
                      <td className="py-3.5 px-4">
                        <div className="text-[11px] font-semibold text-slate-700 mb-1">
                          {m.processes.length} Stages · {metrics.totalOperators} Operators
                        </div>
                        <div className="flex items-center flex-wrap gap-1 text-[11px]">
                          {m.processes.map((proc, pIdx) => {
                            const isBottle =
                              proc.id === metrics.bottleneckProcessId && !metrics.isDemandMet;
                            return (
                              <React.Fragment key={proc.id}>
                                <span
                                  className={
                                    isBottle
                                      ? 'font-bold text-red-700 underline decoration-red-400 underline-offset-2'
                                      : 'text-slate-600 font-medium'
                                  }
                                >
                                  {proc.name}{' '}
                                  <span className="font-mono text-[10px]">
                                    ({proc.cycleTimeSeconds}s)
                                  </span>
                                </span>
                                {pIdx < m.processes.length - 1 && (
                                  <span className="text-slate-300">→</span>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </td>

                      {/* Demand & Takt Time */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-mono font-extrabold text-slate-900">
                          {m.demand.dailyDemandUnits.toLocaleString()}/day
                        </div>
                        <div className="text-[11px] font-mono font-bold text-amber-600 mt-0.5">
                          Takt: {metrics.taktTimeSeconds}s
                        </div>
                      </td>

                      {/* Max Cycle & Bottleneck Status */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div
                          className={`font-mono font-extrabold ${
                            metrics.cycleTimeSeconds > metrics.taktTimeSeconds
                              ? 'text-red-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {metrics.cycleTimeSeconds}s Max CT
                        </div>
                        <div className="text-[11px] mt-0.5 flex items-center justify-end gap-1">
                          {metrics.isDemandMet ? (
                            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Balanced
                            </span>
                          ) : (
                            <span className="text-red-700 font-semibold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              {metrics.bottleneckProcessName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Lead Time & Storage Time */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-mono font-extrabold text-slate-900 text-sm">
                          {metrics.leadTimeDays} days
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          WIP: {metrics.storageTimeDays}d
                        </div>
                      </td>

                      {/* Value Added & PCE % */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-mono font-extrabold text-blue-600">
                          {metrics.flowEfficiencyPercent}% PCE
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          VA: {metrics.totalProcessTimeSeconds}s
                        </div>
                      </td>

                      {/* Kaizen Count */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-700">
                          <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          {m.kaizenBursts.length}
                        </span>
                      </td>

                      {/* Row Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectMap(m.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
                            title="Open Interactive VSM Diagram Canvas"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {onOpenWizardForMap && (
                            <button
                              onClick={() => onOpenWizardForMap(m.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                              title="Edit Process & Vendor Data in Wizard"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Data</span>
                            </button>
                          )}

                          {m.stateType === 'current' && pairedFuture && onCompareMap ? (
                            <button
                              onClick={() => onCompareMap(m.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                              title="Compare Current vs. Future State"
                            >
                              <GitCompare className="w-3.5 h-3.5" />
                              <span>Compare</span>
                            </button>
                          ) : (
                            m.stateType === 'current' && (
                              <button
                                onClick={() => onCloneToFuture(m)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                title="Clone to Future State"
                              >
                                <GitBranch className="w-3.5 h-3.5" />
                                <span>+ Future</span>
                              </button>
                            )
                          )}

                          <button
                            onClick={() => onDeleteMap(m.id)}
                            disabled={maps.length <= 1}
                            className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Delete Map"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
