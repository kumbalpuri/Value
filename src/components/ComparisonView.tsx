import React, { useState } from 'react';
import {
  GitCompare,
  TrendingDown,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  BarChart2,
  ShieldCheck,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { ValueStreamMap, WasteCategory } from '../types/vsm';
import { compareVsmStates, calculateVsmMetrics } from '../utils/vsmMath';
import { VSMCanvas } from './VSMCanvas';

interface ComparisonViewProps {
  currentMap: ValueStreamMap;
  futureMap: ValueStreamMap;
  onUpdateCurrent: (updated: ValueStreamMap) => void;
  onUpdateFuture: (updated: ValueStreamMap) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  currentMap,
  futureMap,
  onUpdateCurrent,
  onUpdateFuture,
}) => {
  const [viewMode, setViewMode] = useState<'metrics' | 'split_canvas' | 'balance_chart'>('metrics');

  const { current, future, deltas } = compareVsmStates(currentMap, futureMap);

  // Maximum value for bar chart scaling
  const maxBarValue = Math.max(
    current.maxCycleTimeSeconds,
    future.maxCycleTimeSeconds,
    current.taktTimeSeconds,
    120
  );

  const wastes: {
    category: WasteCategory;
    title: string;
    description: string;
    identifiedCount: number;
    resolvedInFuture: boolean;
  }[] = [
    {
      category: 'Waiting',
      title: 'Waiting & Lead Time Queuing',
      description: 'Waiting for orders, supplier transit delays, and idle time between operations.',
      identifiedCount: currentMap.kaizenBursts.filter((k) => k.wasteCategory === 'Waiting').length,
      resolvedInFuture: current.leadTimeDays > future.leadTimeDays,
    },
    {
      category: 'Inventory',
      title: 'Excess WIP & Stagnant Buffers',
      description: 'Intermediate work-in-progress accumulating between stations due to push batching.',
      identifiedCount: currentMap.kaizenBursts.filter((k) => k.wasteCategory === 'Inventory').length,
      resolvedInFuture: current.storageTimeDays > future.storageTimeDays,
    },
    {
      category: 'Overproduction',
      title: 'Producing Ahead of Takt Demand',
      description: 'Running stations faster than customer demand rate, creating unwanted inventory.',
      identifiedCount: currentMap.kaizenBursts.filter((k) => k.wasteCategory === 'Overproduction').length,
      resolvedInFuture: future.isDemandMet,
    },
    {
      category: 'Overprocessing',
      title: 'Redundant Handling & Repeated Checks',
      description: 'Repeated weight checks, secondary labeling, and complex solutions for simple tasks.',
      identifiedCount: currentMap.kaizenBursts.filter((k) => k.wasteCategory === 'Overprocessing').length,
      resolvedInFuture: current.totalProcessTimeSeconds > future.totalProcessTimeSeconds,
    },
    {
      category: 'Transport',
      title: 'Non-Essential Material Transit',
      description: 'Long transit legs from distant suppliers without localized safety stock buffer.',
      identifiedCount: currentMap.kaizenBursts.filter((k) => k.wasteCategory === 'Transport').length,
      resolvedInFuture: currentMap.supplier.deliveryLeadTimeDays > futureMap.supplier.deliveryLeadTimeDays,
    },
    {
      category: 'Motion',
      title: 'Inefficient Ergonomics & Reach',
      description: 'Operator stretching, bending, and traveling away from workstation during cycle.',
      identifiedCount: currentMap.kaizenBursts.filter((k) => k.wasteCategory === 'Motion').length,
      resolvedInFuture: true,
    },
    {
      category: 'Defects',
      title: 'Rework & Scrapped Material',
      description: 'Quality defects requiring double-handling, correction, or line stoppage.',
      identifiedCount: currentMap.kaizenBursts.filter((k) => k.wasteCategory === 'Defects').length,
      resolvedInFuture: futureMap.processes.every((p) => p.qualityPercent >= 95),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-auto p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wide uppercase">
              Lean Transformation Impact
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            Before (Current State) vs. Future State Comparison
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Analyzing {currentMap.productFamily} · Verified against Masterclass Target Conditions.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setViewMode('metrics')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'metrics'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Metrics &amp; ROI Delta
          </button>
          <button
            onClick={() => setViewMode('balance_chart')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'balance_chart'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Cycle vs. Takt Balance Chart
          </button>
          <button
            onClick={() => setViewMode('split_canvas')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === 'split_canvas'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Side-by-Side Canvas
          </button>
        </div>
      </div>

      {/* METRICS & DELTAS VIEW */}
      {viewMode === 'metrics' && (
        <div className="space-y-6">
          {/* Executive Highlight Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                Total Lead Time Reduction
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  -{deltas.leadTimeReductionPercent}%
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({current.leadTimeDays}d → {future.leadTimeDays}d)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Shaved {deltas.leadTimeDaysReduction} days from customer order to shipment.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                WIP Inventory Elimination
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                  -{deltas.wipReductionPercent}%
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({current.totalWipUnits.toLocaleString()} → {future.totalWipUnits.toLocaleString()} units)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {deltas.wipUnitsReduction.toLocaleString()} fewer units tied up in buffers.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                Line Balancing &amp; Cycle Time
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                  {future.cycleTimeSeconds}s
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                  &lt; Takt ({future.taktTimeSeconds}s)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {current.isDemandMet
                  ? 'Maintained balanced pace.'
                  : 'Bottlenecks eliminated. Customer demand met.'}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block mb-1">
                Flow Efficiency Gain
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                  {future.flowEfficiencyPercent}%
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  (was {current.flowEfficiencyPercent}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Higher percentage of total lead time spent adding actual value.
              </p>
            </div>
          </div>

          {/* Detailed Side-by-Side Comparison Matrix */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Detailed Parameter &amp; Performance Matrix
              </h3>
            </div>

            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">VSM Metric / Factor</th>
                  <th className="px-6 py-3 font-semibold">Current State (Before)</th>
                  <th className="px-6 py-3 font-semibold">Future State (After)</th>
                  <th className="px-6 py-3 font-semibold">Net Improvement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    Total Lead Time
                  </td>
                  <td className="px-6 py-3.5 font-mono">{current.leadTimeDays} days</td>
                  <td className="px-6 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {future.leadTimeDays} days
                  </td>
                  <td className="px-6 py-3.5 font-mono font-bold text-emerald-600">
                    -{deltas.leadTimeDaysReduction} days (-{deltas.leadTimeReductionPercent}%)
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    Storage Time (Raw + WIP + FG)
                  </td>
                  <td className="px-6 py-3.5 font-mono">{current.storageTimeDays} days</td>
                  <td className="px-6 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {future.storageTimeDays} days
                  </td>
                  <td className="px-6 py-3.5 font-mono font-bold text-emerald-600">
                    -{deltas.storageTimeDaysReduction} days
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    Total Process Time (Value Added)
                  </td>
                  <td className="px-6 py-3.5 font-mono">{current.totalProcessTimeSeconds} seconds</td>
                  <td className="px-6 py-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {future.totalProcessTimeSeconds} seconds
                  </td>
                  <td className="px-6 py-3.5 font-mono text-emerald-600">
                    -{deltas.processTimeSecondsReduction} seconds
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    Line Cycle Time
                  </td>
                  <td className="px-6 py-3.5 font-mono text-red-600 font-bold">
                    {current.cycleTimeSeconds} seconds
                  </td>
                  <td className="px-6 py-3.5 font-mono text-emerald-600 font-bold">
                    {future.cycleTimeSeconds} seconds
                  </td>
                  <td className="px-6 py-3.5 font-mono text-emerald-600">
                    -{deltas.cycleTimeSecondsReduction}s (Smoothened)
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    Customer Takt Time (Requirement)
                  </td>
                  <td className="px-6 py-3.5 font-mono">{current.taktTimeSeconds} seconds</td>
                  <td className="px-6 py-3.5 font-mono">{future.taktTimeSeconds} seconds</td>
                  <td className="px-6 py-3.5 text-slate-500">Fixed by customer demand</td>
                </tr>

                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    Customer Demand Capability
                  </td>
                  <td className="px-6 py-3.5">
                    {current.isDemandMet ? (
                      <span className="text-emerald-600 font-semibold">Demand Met</span>
                    ) : (
                      <span className="text-red-600 font-semibold">Unable to Meet Demand</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-emerald-600 font-bold">Capable (Meets Demand)</span>
                  </td>
                  <td className="px-6 py-3.5 text-emerald-600 font-semibold">
                    100% on-time fulfillment
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    Flow Control Architecture
                  </td>
                  <td className="px-6 py-3.5">Push System (Accumulating Buffers)</td>
                  <td className="px-6 py-3.5 font-semibold text-blue-600 dark:text-blue-400">
                    Pull System (Continuous Flow &amp; Kanban)
                  </td>
                  <td className="px-6 py-3.5 text-blue-600">Eliminated Overproduction</td>
                </tr>

                <tr>
                  <td className="px-6 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                    Active Kaizen Bursts
                  </td>
                  <td className="px-6 py-3.5 font-mono">
                    {currentMap.kaizenBursts.length} Identified
                  </td>
                  <td className="px-6 py-3.5 font-mono">
                    {futureMap.kaizenBursts.filter((k) => k.status === 'implemented').length} Implemented
                  </td>
                  <td className="px-6 py-3.5 text-emerald-600">Target Conditions Achieved</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 7 Wastes of TPS Elimination Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Toyota Production System (TPS) 7-Waste (Muda) Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Targeting and eliminating the core forms of waste identified in the Masterclass.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {wastes.map((w) => (
                <div
                  key={w.category}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {w.title}
                    </span>
                    {w.resolvedInFuture ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Addressed</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Action Needed</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {w.description}
                  </p>
                  {w.identifiedCount > 0 && (
                    <span className="inline-block text-[10px] font-medium text-amber-700 dark:text-amber-300">
                      {w.identifiedCount} Kaizen burst{w.identifiedCount > 1 ? 's' : ''} targeting this
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BALANCE BAR CHART VIEW */}
      {viewMode === 'balance_chart' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Process Balance Chart: Cycle Time vs. Takt Time (Slide 209 &amp; 335 Standard)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Visualizing station cycle times against customer Takt Time. Stations above the orange Takt line create bottlenecks and unbalance the entire value stream.
              </p>
            </div>

            {/* Current State Chart */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  Current State Line Balance (Bottlenecks in Red)
                </span>
                <span className="text-slate-500">
                  Takt Time Target:{' '}
                  <span className="font-mono font-bold text-amber-600">{current.taktTimeSeconds}s</span>
                </span>
              </div>

              <div className="relative pt-6 pb-2 border-b border-slate-200 dark:border-slate-700">
                {/* Horizontal Takt Time Reference Line */}
                <div
                  className="absolute w-full border-t-2 border-dashed border-amber-500 z-10 flex items-center justify-end pr-2"
                  style={{
                    bottom: `${(current.taktTimeSeconds / maxBarValue) * 160 + 30}px`,
                  }}
                >
                  <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Takt Line: {current.taktTimeSeconds}s
                  </span>
                </div>

                <div className="flex items-end justify-around h-48 gap-4 px-8">
                  {currentMap.processes.map((p) => {
                    const isExceeding = p.cycleTimeSeconds > current.taktTimeSeconds;
                    const heightPercent = Math.min(100, (p.cycleTimeSeconds / maxBarValue) * 100);

                    return (
                      <div key={p.id} className="flex-1 max-w-[120px] flex flex-col items-center gap-1.5">
                        <span
                          className={`font-mono text-xs font-bold ${
                            isExceeding ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {p.cycleTimeSeconds}s
                        </span>
                        <div
                          style={{ height: `${heightPercent * 1.5}px` }}
                          className={`w-full rounded-t-lg transition-all ${
                            isExceeding
                              ? 'bg-red-500 dark:bg-red-600'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                        <span className="text-[11px] font-semibold text-center text-slate-600 dark:text-slate-300 line-clamp-1">
                          {p.name}
                        </span>
                        {isExceeding && (
                          <span className="text-[10px] font-bold text-red-600">
                            Bottleneck
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Future State Chart */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  Future State Line Balance (Continuous Balanced Flow)
                </span>
                <span className="text-slate-500">
                  Takt Time Target:{' '}
                  <span className="font-mono font-bold text-amber-600">{future.taktTimeSeconds}s</span>
                </span>
              </div>

              <div className="relative pt-6 pb-2 border-b border-slate-200 dark:border-slate-700">
                {/* Horizontal Takt Time Reference Line */}
                <div
                  className="absolute w-full border-t-2 border-dashed border-amber-500 z-10 flex items-center justify-end pr-2"
                  style={{
                    bottom: `${(future.taktTimeSeconds / maxBarValue) * 160 + 30}px`,
                  }}
                >
                  <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Takt Line: {future.taktTimeSeconds}s
                  </span>
                </div>

                <div className="flex items-end justify-around h-48 gap-4 px-8">
                  {futureMap.processes.map((p) => {
                    const isExceeding = p.cycleTimeSeconds > future.taktTimeSeconds;
                    const heightPercent = Math.min(100, (p.cycleTimeSeconds / maxBarValue) * 100);

                    return (
                      <div key={p.id} className="flex-1 max-w-[120px] flex flex-col items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {p.cycleTimeSeconds}s
                        </span>
                        <div
                          style={{ height: `${heightPercent * 1.5}px` }}
                          className="w-full rounded-t-lg bg-emerald-500 dark:bg-emerald-600 transition-all"
                        />
                        <span className="text-[11px] font-semibold text-center text-slate-600 dark:text-slate-300 line-clamp-1">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-600">
                          Balanced
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIDE-BY-SIDE SPLIT CANVAS VIEW */}
      {viewMode === 'split_canvas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[720px]">
            {/* Current State Canvas */}
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Current State (Lead Time: {current.leadTimeDays}d · CT: {current.cycleTimeSeconds}s)
                </span>
                <span className="text-[11px] text-red-600 font-semibold">
                  {current.isDemandMet ? 'Demand Met' : 'Bottleneck Present'}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <VSMCanvas
                  map={currentMap}
                  onUpdateMap={onUpdateCurrent}
                  onOpenWizard={() => {}}
                  readOnly
                />
              </div>
            </div>

            {/* Future State Canvas */}
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  Future State (Lead Time: {future.leadTimeDays}d · CT: {future.cycleTimeSeconds}s)
                </span>
                <span className="text-[11px] text-emerald-600 font-bold">
                  ✓ Lean Optimized (-{deltas.leadTimeReductionPercent}%)
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <VSMCanvas
                  map={futureMap}
                  onUpdateMap={onUpdateFuture}
                  onOpenWizard={() => {}}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
