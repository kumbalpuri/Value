import React, { useMemo, useState } from 'react';
import {
  Activity,
  Clock,
  Gauge,
  Hourglass,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Sliders,
  TrendingUp,
  Triangle,
  Users,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Play,
  RotateCcw,
  Target,
} from 'lucide-react';
import { ValueStreamMap } from '../types/vsm';
import {
  calculateVsmMetrics,
  getNormalizedSupplyChain,
  syncSupplierSummary,
} from '../utils/vsmMath';

interface PerformanceDashboardProps {
  map: ValueStreamMap;
  onUpdateMap?: (updated: ValueStreamMap) => void;
  baselineMap?: ValueStreamMap | null;
  isWhatIfMode?: boolean;
  onToggleWhatIfMode?: () => void;
  onResetWhatIfBaseline?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectNodeOnCanvas?: (
    nodeType: 'process' | 'buffer' | 'supplier' | 'customer' | 'control' | 'metrics' | 'bottlenecks',
    nodeId: string
  ) => void;
  onOpenWizard?: () => void;
  onCloneToFuture?: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  map,
  onUpdateMap,
  baselineMap,
  isWhatIfMode = false,
  onToggleWhatIfMode,
  onResetWhatIfBaseline,
  collapsed = false,
  onToggleCollapse,
  onSelectNodeOnCanvas,
  onOpenWizard,
  onCloneToFuture,
}) => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'sensitivity' | 'wait' | 'steps'
  >('overview');
  const [sensitivityBasisPct, setSensitivityBasisPct] = useState<25 | 50 | 100>(50);
  const [coupleProcessQueue, setCoupleProcessQueue] = useState<boolean>(true);

  const metrics = useMemo(() => calculateVsmMetrics(map), [map]);
  const supplyChain = useMemo(() => getNormalizedSupplyChain(map.supplier), [map.supplier]);

  const breakdown = useMemo(() => {
    const { demand, processes, buffers } = map;
    const dailyDemand = Math.max(1, demand.dailyDemandUnits);

    // Upstream Supply Chain Wait
    const procurementWaitDays = Number(
      (supplyChain.criticalVendor.procurementWaitingDays || 0).toFixed(2)
    );
    const transitDays = Number(
      (supplyChain.criticalVendor.deliveryLeadTimeDays || 0).toFixed(2)
    );
    const upstreamWaitDays = Number((procurementWaitDays + transitDays).toFixed(2));

    // Plant Floor Storage / Wait Time (Raw Material + WIP Triangle Buffers + Finished Goods)
    const rawMaterialDays = Number((supplyChain.totalRawMaterialUnits / dailyDemand).toFixed(2));

    const wipStages = buffers.map((buf, index) => {
      const upstreamProc = processes.find((p) => p.id === buf.afterProcessId);
      const upstreamIdx = processes.findIndex((p) => p.id === buf.afterProcessId);
      const downstreamProc = upstreamIdx >= 0 ? processes[upstreamIdx + 1] : undefined;
      const waitDays = Number(((buf.wipQuantity || 0) / dailyDemand).toFixed(2));
      const waitHours = Number((waitDays * demand.hoursPerShift * demand.shiftsPerDay).toFixed(1));

      return {
        id: buf.id,
        label:
          upstreamProc && downstreamProc
            ? `${upstreamProc.name} → ${downstreamProc.name}`
            : upstreamProc
            ? `After ${upstreamProc.name}`
            : `WIP Queue #${index + 1}`,
        wipUnits: buf.wipQuantity || 0,
        flowType: buf.flowType,
        waitDays,
        waitHours,
      };
    });

    const inProcessWipDays = Number(
      wipStages.reduce((acc, s) => acc + s.waitDays, 0).toFixed(2)
    );
    const finishedGoodsDays = Number((demand.shippingHoldingDays || 0).toFixed(2));
    const totalPlantWaitDays = Number(
      (rawMaterialDays + inProcessWipDays + finishedGoodsDays).toFixed(2)
    );

    const totalValueAddedSeconds = metrics.totalProcessTimeSeconds;
    const totalValueAddedMinutes = Number((totalValueAddedSeconds / 60).toFixed(2));
    const valueAddedDays =
      metrics.effectiveWorkingSeconds > 0
        ? totalValueAddedSeconds / metrics.effectiveWorkingSeconds
        : 0;
    const totalLeadTimeDays = Number(
      (upstreamWaitDays + totalPlantWaitDays + valueAddedDays).toFixed(2)
    );

    // PCE Calculations
    const calendarLeadTimeSeconds = totalLeadTimeDays * 86400;
    const calendarPcePercent =
      calendarLeadTimeSeconds > 0
        ? Number(((totalValueAddedSeconds / calendarLeadTimeSeconds) * 100).toFixed(3))
        : 0;

    const shiftLeadTimeSeconds =
      totalLeadTimeDays * Math.max(1, metrics.effectiveWorkingSeconds);
    const shiftPcePercent =
      shiftLeadTimeSeconds > 0
        ? Number(((totalValueAddedSeconds / shiftLeadTimeSeconds) * 100).toFixed(3))
        : 0;

    const plantFloorSeconds =
      totalPlantWaitDays * Math.max(1, metrics.effectiveWorkingSeconds);
    const plantFloorPcePercent =
      plantFloorSeconds > 0
        ? Number(((totalValueAddedSeconds / plantFloorSeconds) * 100).toFixed(3))
        : 0;

    // Non-Value-Added Wait Share (%)
    const nonValueAddedSharePercent =
      calendarPcePercent > 0
        ? Number(Math.max(0, 100 - calendarPcePercent).toFixed(3))
        : 100;

    // Lean Benchmark Classification
    let pceTier: {
      label: string;
      description: string;
      badgeClass: string;
    };
    if (shiftPcePercent >= 15) {
      pceTier = {
        label: 'World-Class Lean Flow',
        description: 'Continuous single-piece pull flow with minimal queue aging',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    } else if (shiftPcePercent >= 2) {
      pceTier = {
        label: 'Developing Lean Stream',
        description: 'Moderate supermarket buffering; opportunity to compress WIP',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
      };
    } else {
      pceTier = {
        label: 'Batch & Queue Dominant',
        description: 'High non-value-added storage & waiting relative to touch time',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }

    return {
      dailyDemand,
      procurementWaitDays,
      transitDays,
      upstreamWaitDays,
      rawMaterialDays,
      wipStages,
      inProcessWipDays,
      finishedGoodsDays,
      totalPlantWaitDays,
      totalLeadTimeDays,
      totalValueAddedSeconds,
      totalValueAddedMinutes,
      calendarPcePercent,
      shiftPcePercent,
      plantFloorPcePercent,
      nonValueAddedSharePercent,
      pceTier,
    };
  }, [map, metrics, supplyChain]);

  // Baseline comparison metrics for real-time What-If Simulation deltas
  const whatIfComparison = useMemo(() => {
    if (!baselineMap || baselineMap.id !== map.id) return null;
    const baseMetrics = calculateVsmMetrics(baselineMap);
    const baseSupply = getNormalizedSupplyChain(baselineMap.supplier);
    const baseDailyDemand = Math.max(1, baselineMap.demand.dailyDemandUnits);

    const baseUpstreamDays = Number(
      (
        (baseSupply.criticalVendor.procurementWaitingDays || 0) +
        (baseSupply.criticalVendor.deliveryLeadTimeDays || 0)
      ).toFixed(2)
    );
    const baseRmDays = Number((baseSupply.totalRawMaterialUnits / baseDailyDemand).toFixed(2));
    const baseWipDays = Number(
      baselineMap.buffers
        .reduce((acc, b) => acc + (b.wipQuantity || 0) / baseDailyDemand, 0)
        .toFixed(2)
    );
    const baseFgDays = Number((baselineMap.demand.shippingHoldingDays || 0).toFixed(2));
    const basePlantWaitDays = Number((baseRmDays + baseWipDays + baseFgDays).toFixed(2));
    const baseVaDays =
      baseMetrics.effectiveWorkingSeconds > 0
        ? baseMetrics.totalProcessTimeSeconds / baseMetrics.effectiveWorkingSeconds
        : 0;
    const baseLeadTimeDays = Number(
      (baseUpstreamDays + basePlantWaitDays + baseVaDays).toFixed(2)
    );

    const baseShiftSeconds =
      baseLeadTimeDays * Math.max(1, baseMetrics.effectiveWorkingSeconds);
    const baseShiftPcePercent =
      baseShiftSeconds > 0
        ? Number(((baseMetrics.totalProcessTimeSeconds / baseShiftSeconds) * 100).toFixed(3))
        : 0;

    const leadTimeDeltaDays = Number(
      (breakdown.totalLeadTimeDays - baseLeadTimeDays).toFixed(2)
    );
    const leadTimeDeltaPercent =
      baseLeadTimeDays > 0
        ? Number(((leadTimeDeltaDays / baseLeadTimeDays) * 100).toFixed(1))
        : 0;
    const plantWaitDeltaDays = Number(
      (breakdown.totalPlantWaitDays - basePlantWaitDays).toFixed(2)
    );
    const vaDeltaSeconds =
      breakdown.totalValueAddedSeconds - baseMetrics.totalProcessTimeSeconds;
    const shiftPceDeltaPercent = Number(
      (breakdown.shiftPcePercent - baseShiftPcePercent).toFixed(3)
    );
    const hasChanges =
      leadTimeDeltaDays !== 0 ||
      plantWaitDeltaDays !== 0 ||
      vaDeltaSeconds !== 0 ||
      shiftPceDeltaPercent !== 0;

    return {
      baseLeadTimeDays,
      basePlantWaitDays,
      baseVaSeconds: baseMetrics.totalProcessTimeSeconds,
      baseShiftPcePercent,
      leadTimeDeltaDays,
      leadTimeDeltaPercent,
      plantWaitDeltaDays,
      vaDeltaSeconds,
      shiftPceDeltaPercent,
      hasChanges,
    };
  }, [baselineMap, map.id, breakdown]);

  // Sensitivity Analysis Engine: ranks every node by % reduction in Total Lead Time if improved
  const sensitivityAnalysis = useMemo(() => {
    const totalLT = Math.max(0.001, breakdown.totalLeadTimeDays);
    const factor = sensitivityBasisPct / 100;
    const dailyDemand = Math.max(1, map.demand.dailyDemandUnits);
    const effSec = Math.max(1, metrics.effectiveWorkingSeconds);

    interface SensitivityRankItem {
      id: string;
      name: string;
      category: 'Supplier' | 'Raw Warehouse' | 'WIP Buffer' | 'FG Warehouse' | 'Process Step';
      canvasNodeType: 'supplier' | 'customer' | 'buffer' | 'process';
      canvasNodeId: string;
      currentDisplay: string;
      improvedDisplay: string;
      leadTimeSavedDays: number;
      pctLeadTimeReduction: number;
      projectedLeadTimeDays: number;
      detailNote: string;
      applyImprovement: () => void;
    }

    const items: SensitivityRankItem[] = [];

    // 1. Critical Vendor Procurement Waiting Time
    if (breakdown.procurementWaitDays > 0) {
      const savedDays = Number((breakdown.procurementWaitDays * factor).toFixed(2));
      const nextDays = Number(Math.max(0, breakdown.procurementWaitDays - savedDays).toFixed(2));
      const pctReduction = Number(((savedDays / totalLT) * 100).toFixed(2));
      items.push({
        id: 'sens-procurement',
        name: `Vendor Order Queue (${supplyChain.criticalVendor.vendorName})`,
        category: 'Supplier',
        canvasNodeType: 'supplier',
        canvasNodeId: 'supplier',
        currentDisplay: `${breakdown.procurementWaitDays}d wait`,
        improvedDisplay: `${nextDays}d wait`,
        leadTimeSavedDays: savedDays,
        pctLeadTimeReduction: pctReduction,
        projectedLeadTimeDays: Number(Math.max(0, totalLT - savedDays).toFixed(2)),
        detailNote: 'Reduce supplier order release & batching queue',
        applyImprovement: () => {
          if (!onUpdateMap) return;
          const critId = supplyChain.criticalVendor.id;
          const updatedVendors = supplyChain.vendors.map((v) =>
            v.id === critId ? { ...v, procurementWaitingDays: nextDays } : v
          );
          onUpdateMap({
            ...map,
            supplier: syncSupplierSummary({ ...map.supplier, vendors: updatedVendors }),
          });
        },
      });
    }

    // 2. Inbound Transit Logistics Lead Time
    if (breakdown.transitDays > 0) {
      const savedDays = Number((breakdown.transitDays * factor).toFixed(2));
      const nextDays = Number(Math.max(0, breakdown.transitDays - savedDays).toFixed(2));
      const pctReduction = Number(((savedDays / totalLT) * 100).toFixed(2));
      items.push({
        id: 'sens-transit',
        name: `Inbound Transit (${supplyChain.criticalVendor.transportMode.toUpperCase()})`,
        category: 'Supplier',
        canvasNodeType: 'supplier',
        canvasNodeId: 'supplier',
        currentDisplay: `${breakdown.transitDays}d transit`,
        improvedDisplay: `${nextDays}d transit`,
        leadTimeSavedDays: savedDays,
        pctLeadTimeReduction: pctReduction,
        projectedLeadTimeDays: Number(Math.max(0, totalLT - savedDays).toFixed(2)),
        detailNote: 'Milk-run / local sourcing transit compression',
        applyImprovement: () => {
          if (!onUpdateMap) return;
          const critId = supplyChain.criticalVendor.id;
          const updatedVendors = supplyChain.vendors.map((v) =>
            v.id === critId ? { ...v, deliveryLeadTimeDays: nextDays } : v
          );
          onUpdateMap({
            ...map,
            supplier: syncSupplierSummary({ ...map.supplier, vendors: updatedVendors }),
          });
        },
      });
    }

    // 3. Raw Material Warehouse Buffer
    if (breakdown.rawMaterialDays > 0) {
      const savedDays = Number((breakdown.rawMaterialDays * factor).toFixed(2));
      const nextDays = Number(Math.max(0, breakdown.rawMaterialDays - savedDays).toFixed(2));
      const targetUnits = Math.max(0, Math.round(nextDays * dailyDemand));
      const pctReduction = Number(((savedDays / totalLT) * 100).toFixed(2));
      items.push({
        id: 'sens-raw-warehouse',
        name: 'Raw Material Warehouse Stock',
        category: 'Raw Warehouse',
        canvasNodeType: 'supplier',
        canvasNodeId: 'supplier',
        currentDisplay: `${breakdown.rawMaterialDays}d (${supplyChain.totalRawMaterialUnits.toLocaleString()} pcs)`,
        improvedDisplay: `${nextDays}d (${targetUnits.toLocaleString()} pcs)`,
        leadTimeSavedDays: savedDays,
        pctLeadTimeReduction: pctReduction,
        projectedLeadTimeDays: Number(Math.max(0, totalLT - savedDays).toFixed(2)),
        detailNote: 'Right-size raw material safety stock & delivery cadence',
        applyImprovement: () => {
          if (!onUpdateMap) return;
          const currentTotal = Math.max(1, supplyChain.totalRawMaterialUnits);
          const updatedRawMaterials = supplyChain.rawMaterials.map((rm) => ({
            ...rm,
            stockUnits: Math.max(
              0,
              Math.round(((rm.stockUnits || 0) / currentTotal) * targetUnits)
            ),
          }));
          onUpdateMap({
            ...map,
            supplier: syncSupplierSummary({
              ...map.supplier,
              rawMaterials: updatedRawMaterials,
              rawMaterialStockUnits: targetUnits,
            }),
          });
        },
      });
    }

    // 4. Inter-Process WIP Inventory Triangle Buffers
    breakdown.wipStages.forEach((stage) => {
      if (stage.waitDays <= 0) return;
      const savedDays = Number((stage.waitDays * factor).toFixed(2));
      const nextDays = Number(Math.max(0, stage.waitDays - savedDays).toFixed(2));
      const nextUnits = Math.max(0, Math.round(nextDays * dailyDemand));
      const pctReduction = Number(((savedDays / totalLT) * 100).toFixed(2));
      items.push({
        id: `sens-buf-${stage.id}`,
        name: `WIP Triangle: ${stage.label}`,
        category: 'WIP Buffer',
        canvasNodeType: 'buffer',
        canvasNodeId: stage.id,
        currentDisplay: `${stage.waitDays}d (${stage.wipUnits.toLocaleString()} pcs)`,
        improvedDisplay: `${nextDays}d (${nextUnits.toLocaleString()} pcs)`,
        leadTimeSavedDays: savedDays,
        pctLeadTimeReduction: pctReduction,
        projectedLeadTimeDays: Number(Math.max(0, totalLT - savedDays).toFixed(2)),
        detailNote: 'Convert push queue to pull supermarket / FIFO lane',
        applyImprovement: () => {
          if (!onUpdateMap) return;
          const updatedBuffers = map.buffers.map((b) =>
            b.id === stage.id
              ? {
                  ...b,
                  wipQuantity: nextUnits,
                  calculatedDays: nextDays,
                }
              : b
          );
          onUpdateMap({ ...map, buffers: updatedBuffers });
        },
      });
    });

    // 5. Finished Goods Shipping Warehouse
    if (breakdown.finishedGoodsDays > 0) {
      const savedDays = Number((breakdown.finishedGoodsDays * factor).toFixed(2));
      const nextDays = Number(Math.max(0, breakdown.finishedGoodsDays - savedDays).toFixed(2));
      const pctReduction = Number(((savedDays / totalLT) * 100).toFixed(2));
      items.push({
        id: 'sens-fg-warehouse',
        name: 'Finished Goods Warehouse Hold',
        category: 'FG Warehouse',
        canvasNodeType: 'customer',
        canvasNodeId: 'customer',
        currentDisplay: `${breakdown.finishedGoodsDays}d hold`,
        improvedDisplay: `${nextDays}d hold`,
        leadTimeSavedDays: savedDays,
        pctLeadTimeReduction: pctReduction,
        projectedLeadTimeDays: Number(Math.max(0, totalLT - savedDays).toFixed(2)),
        detailNote: 'Increase outbound shipping frequency / cross-dock',
        applyImprovement: () => {
          if (!onUpdateMap) return;
          onUpdateMap({
            ...map,
            demand: {
              ...map.demand,
              shippingHoldingDays: nextDays,
            },
          });
        },
      });
    }

    // 6. Process Stations (Direct VA Time + Optional Coupled Queue Wait via Little's Law)
    map.processes.forEach((proc, idx) => {
      const currentCt = proc.cycleTimeSeconds || 0;
      if (currentCt <= 0) return;
      const bInfo = metrics.bottleneckAnalysis.find((b) => b.processId === proc.id);
      const effectiveFactor = Math.min(0.8, factor);
      const nextCt = Math.max(1, Math.round(currentCt * (1 - effectiveFactor)));
      const savedCtSec = Math.max(0, currentCt - nextCt);
      const directVaSavedDays = savedCtSec / effSec;

      let coupledQueueSavedDays = 0;
      const downstreamBuf = map.buffers.find((b) => b.afterProcessId === proc.id);
      const prevProc = idx > 0 ? map.processes[idx - 1] : undefined;
      const upstreamBuf = prevProc
        ? map.buffers.find((b) => b.afterProcessId === prevProc.id)
        : undefined;

      if (coupleProcessQueue) {
        if (downstreamBuf && downstreamBuf.wipQuantity > 0) {
          coupledQueueSavedDays +=
            ((downstreamBuf.wipQuantity || 0) / dailyDemand) * effectiveFactor;
        } else if (idx === map.processes.length - 1) {
          if (upstreamBuf && upstreamBuf.wipQuantity > 0) {
            coupledQueueSavedDays +=
              ((upstreamBuf.wipQuantity || 0) / dailyDemand) * effectiveFactor;
          }
          if (map.demand.shippingHoldingDays > 0) {
            coupledQueueSavedDays +=
              map.demand.shippingHoldingDays * (effectiveFactor * 0.5);
          }
        }
      }

      const totalNodeSavedDays = Number(
        (directVaSavedDays + coupledQueueSavedDays).toFixed(3)
      );
      const pctReduction = Number(((totalNodeSavedDays / totalLT) * 100).toFixed(2));

      items.push({
        id: `sens-proc-${proc.id}`,
        name: `${proc.name} (Step #${idx + 1})`,
        category: 'Process Step',
        canvasNodeType: 'process',
        canvasNodeId: proc.id,
        currentDisplay: `${currentCt}s C/T (${bInfo?.ctToTaktRatio ?? 0}x Takt)`,
        improvedDisplay: `${nextCt}s C/T (-${savedCtSec}s)`,
        leadTimeSavedDays: Number(totalNodeSavedDays.toFixed(2)),
        pctLeadTimeReduction: pctReduction,
        projectedLeadTimeDays: Number(Math.max(0, totalLT - totalNodeSavedDays).toFixed(2)),
        detailNote: coupleProcessQueue
          ? `Includes -${savedCtSec}s VA + coupled queue compression`
          : `Direct Value-Added cycle time reduction (-${savedCtSec}s)`,
        applyImprovement: () => {
          if (!onUpdateMap) return;
          const updatedProcesses = map.processes.map((p) =>
            p.id === proc.id ? { ...p, cycleTimeSeconds: nextCt } : p
          );
          let updatedBuffers = [...map.buffers];
          let updatedDemand = { ...map.demand };

          if (coupleProcessQueue) {
            const ratio = nextCt / Math.max(1, currentCt);
            if (downstreamBuf) {
              const nextWip = Math.max(0, Math.round((downstreamBuf.wipQuantity || 0) * ratio));
              updatedBuffers = updatedBuffers.map((b) =>
                b.id === downstreamBuf.id
                  ? {
                      ...b,
                      wipQuantity: nextWip,
                      calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
                    }
                  : b
              );
            } else if (idx === map.processes.length - 1) {
              if (upstreamBuf) {
                const nextWip = Math.max(0, Math.round((upstreamBuf.wipQuantity || 0) * ratio));
                updatedBuffers = updatedBuffers.map((b) =>
                  b.id === upstreamBuf.id
                    ? {
                        ...b,
                        wipQuantity: nextWip,
                        calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
                      }
                    : b
                );
              }
              if (map.demand.shippingHoldingDays > 0) {
                const dampedRatio = 0.5 + 0.5 * ratio;
                updatedDemand = {
                  ...map.demand,
                  shippingHoldingDays: Number(
                    (map.demand.shippingHoldingDays * dampedRatio).toFixed(2)
                  ),
                };
              }
            }
          }

          onUpdateMap({
            ...map,
            processes: updatedProcesses,
            buffers: updatedBuffers,
            demand: updatedDemand,
          });
        },
      });
    });

    const ranked = items
      .sort((a, b) => b.pctLeadTimeReduction - a.pctLeadTimeReduction)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    const maxPct = ranked.length > 0 ? Math.max(0.1, ranked[0].pctLeadTimeReduction) : 1;
    const topThreeCumulativeDays = Number(
      ranked
        .slice(0, 3)
        .reduce((sum, r) => sum + r.leadTimeSavedDays, 0)
        .toFixed(2)
    );
    const topThreeCumulativePct = Number(
      Math.min(99.9, (topThreeCumulativeDays / totalLT) * 100).toFixed(1)
    );

    return {
      ranked,
      maxPct,
      topThreeCumulativeDays,
      topThreeCumulativePct,
    };
  }, [
    breakdown,
    sensitivityBasisPct,
    coupleProcessQueue,
    map,
    metrics,
    supplyChain,
    onUpdateMap,
  ]);

  // Resource Utilization & Station Availability Engine: calculates availability and utilization from uptime, changeover, and cycle times
  const resourceUtilizationAnalysis = useMemo(() => {
    const netWorkingSeconds = Math.max(1, metrics.effectiveWorkingSeconds);
    const dailyDemand = Math.max(1, map.demand.dailyDemandUnits);
    const taktSeconds = Math.max(0.1, metrics.taktTimeSeconds);

    const stations = map.processes.map((proc, index) => {
      const cycleTimeSeconds = Math.max(0, proc.cycleTimeSeconds || 0);
      const changeoverSeconds = Math.max(0, proc.changeoverSeconds || 0);
      const uptimePercent = Math.min(100, Math.max(1, proc.uptimePercent ?? 100));
      const qualityPercent = Math.min(100, Math.max(1, proc.qualityPercent ?? 100));
      const operatorsCount = Math.max(1, proc.operatorsCount || 1);

      // Planned run time after daily setup/changeover deduction, scaled by machine uptime %
      const timeAfterChangeoverSeconds = Math.max(1, netWorkingSeconds - changeoverSeconds);
      const availableSeconds = Math.max(
        1,
        Math.round(timeAfterChangeoverSeconds * (uptimePercent / 100))
      );
      const unavailableSeconds = Math.max(0, netWorkingSeconds - availableSeconds);

      // Station Availability % = Available Uptime Seconds / Net Shift Working Seconds
      const availabilityPercent = Number(
        ((availableSeconds / netWorkingSeconds) * 100).toFixed(1)
      );

      // Required Daily Run Time (Nominal = Demand * C/T; Effective = adjusted for Quality Yield)
      const nominalRunSeconds = dailyDemand * cycleTimeSeconds;
      const effectiveRunSeconds = Math.round(nominalRunSeconds / (qualityPercent / 100));

      // Resource Utilization % = Required Run Time / Available Station Time
      const utilizationPercent = Number(
        ((nominalRunSeconds / availableSeconds) * 100).toFixed(1)
      );
      const effectiveUtilizationPercent = Number(
        ((effectiveRunSeconds / availableSeconds) * 100).toFixed(1)
      );

      // Effective cycle time factoring availability & quality vs Takt
      const availabilityRatio = availableSeconds / netWorkingSeconds;
      const effectiveCycleTimeSeconds = Number(
        (
          cycleTimeSeconds /
          Math.max(0.01, availabilityRatio * (qualityPercent / 100))
        ).toFixed(1)
      );
      const ctToTaktRatio = Number((cycleTimeSeconds / taktSeconds).toFixed(2));

      // Max daily output capacity based on station available time and cycle time
      const maxDailyCapacityUnits =
        cycleTimeSeconds > 0
          ? Math.floor(availableSeconds / cycleTimeSeconds)
          : dailyDemand;
      const headroomPercent = Number((100 - utilizationPercent).toFixed(1));

      let statusLabel: 'Overloaded' | 'High Load' | 'Balanced' | 'Underutilized';
      let statusBadgeClass: string;
      let barColorClass: string;

      if (utilizationPercent > 100) {
        statusLabel = 'Overloaded';
        statusBadgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
        barColorClass = 'bg-rose-600';
      } else if (utilizationPercent >= 85) {
        statusLabel = 'High Load';
        statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
        barColorClass = 'bg-amber-500';
      } else if (utilizationPercent >= 60) {
        statusLabel = 'Balanced';
        statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
        barColorClass = 'bg-emerald-500';
      } else {
        statusLabel = 'Underutilized';
        statusBadgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
        barColorClass = 'bg-blue-500';
      }

      return {
        processId: proc.id,
        processName: proc.name,
        stepOrder: index + 1,
        operatorsCount,
        cycleTimeSeconds,
        changeoverSeconds,
        uptimePercent,
        qualityPercent,
        netWorkingSeconds,
        availableSeconds,
        unavailableSeconds,
        availableMinutes: Number((availableSeconds / 60).toFixed(0)),
        requiredMinutes: Number((nominalRunSeconds / 60).toFixed(0)),
        availabilityPercent,
        utilizationPercent,
        effectiveUtilizationPercent,
        effectiveCycleTimeSeconds,
        ctToTaktRatio,
        maxDailyCapacityUnits,
        headroomPercent,
        statusLabel,
        statusBadgeClass,
        barColorClass,
      };
    });

    const avgUtilizationPercent =
      stations.length > 0
        ? Number(
            (
              stations.reduce((sum, s) => sum + s.utilizationPercent, 0) /
              stations.length
            ).toFixed(1)
          )
        : 0;

    const avgAvailabilityPercent =
      stations.length > 0
        ? Number(
            (
              stations.reduce((sum, s) => sum + s.availabilityPercent, 0) /
              stations.length
            ).toFixed(1)
          )
        : 100;

    const peakStation =
      stations.length > 0
        ? [...stations].sort((a, b) => b.utilizationPercent - a.utilizationPercent)[0]
        : null;

    const overloadedCount = stations.filter((s) => s.utilizationPercent > 100).length;
    const highLoadCount = stations.filter(
      (s) => s.utilizationPercent >= 85 && s.utilizationPercent <= 100
    ).length;

    return {
      stations,
      avgUtilizationPercent,
      avgAvailabilityPercent,
      peakStation,
      overloadedCount,
      highLoadCount,
      netWorkingHours: Number((netWorkingSeconds / 3600).toFixed(2)),
    };
  }, [map.processes, map.demand.dailyDemandUnits, metrics]);

  // Collapsed vertical rail alongside VSM Canvas
  if (collapsed) {
    return (
      <aside
        aria-label="Performance Dashboard Rail"
        className="no-print w-11 bg-white border-l border-slate-200 flex flex-col items-center py-2.5 gap-3 shrink-0 z-20 select-none"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-blue-600 text-white transition-colors"
          title="Expand Real-Time Performance Dashboard"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-slate-200" />

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
          title={`Total Lead Time: ${breakdown.totalLeadTimeDays} Days`}
        >
          <Clock className="w-4 h-4 text-blue-600" />
          <span className="text-[10px] font-mono font-bold tabular-nums tracking-tighter">
            {breakdown.totalLeadTimeDays}d
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
          title={`Process Cycle Efficiency (Shift): ${breakdown.shiftPcePercent}%`}
        >
          <Zap className="w-4 h-4 text-emerald-600" />
          <span className="text-[10px] font-mono font-bold tabular-nums tracking-tighter">
            {breakdown.shiftPcePercent}%
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
          title={`Plant Floor Wait Time: ${breakdown.totalPlantWaitDays} Days`}
        >
          <Hourglass className="w-4 h-4 text-amber-600" />
          <span className="text-[10px] font-mono font-bold tabular-nums tracking-tighter">
            {breakdown.totalPlantWaitDays}d
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
          title={`Avg Resource Utilization: ${resourceUtilizationAnalysis.avgUtilizationPercent}% (Avg Availability: ${resourceUtilizationAnalysis.avgAvailabilityPercent}%)`}
        >
          <Gauge
            className={`w-4 h-4 ${
              resourceUtilizationAnalysis.overloadedCount > 0 ? 'text-rose-600' : 'text-slate-600'
            }`}
          />
          <span className="text-[10px] font-mono font-bold tabular-nums tracking-tighter">
            {resourceUtilizationAnalysis.avgUtilizationPercent}%
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Real-Time Performance Dashboard"
      className="no-print w-80 xl:w-[348px] bg-white border-l border-slate-200 flex flex-col h-full shrink-0 z-20 select-none overflow-hidden"
    >
      {/* Dashboard Header */}
      <div className="px-3 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/40 flex items-center justify-center shrink-0">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-white truncate">
              Performance Dashboard
            </h2>
            <p className="text-[10px] text-slate-400 truncate">
              {isWhatIfMode
                ? 'Live What-If Simulation Impact'
                : 'Real-Time Lean Flow & Wait Analytics'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleWhatIfMode && (
            <button
              type="button"
              onClick={onToggleWhatIfMode}
              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors ${
                isWhatIfMode
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-emerald-700 text-emerald-300 hover:text-white border border-slate-700'
              }`}
              title="Toggle What-If Simulation Mode on VSM Canvas"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>{isWhatIfMode ? 'What-If: ON' : 'What-If'}</span>
            </button>
          )}
          {onOpenWizard && !isWhatIfMode && (
            <button
              type="button"
              onClick={onOpenWizard}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 transition-colors"
              title="Edit Parameters in Data Wizard"
            >
              <Sliders className="w-3 h-3 text-blue-400" />
              <span>Wizard</span>
            </button>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Collapse Performance Dashboard"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Live What-If Simulation Impact Banner */}
      {(isWhatIfMode || whatIfComparison?.hasChanges) && whatIfComparison && (
        <div
          className={`px-3 py-2 border-b text-xs shrink-0 ${
            whatIfComparison.leadTimeDeltaDays < 0
              ? 'bg-emerald-950 text-white border-emerald-800'
              : whatIfComparison.leadTimeDeltaDays > 0
              ? 'bg-rose-950 text-white border-rose-800'
              : 'bg-slate-800 text-white border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-[9px] font-black uppercase tracking-wider">
                What-If Impact
              </span>
              <span className="text-[11px] font-semibold text-slate-200">
                Overall Lead Time:
              </span>
            </div>
            {onResetWhatIfBaseline && whatIfComparison.hasChanges && (
              <button
                type="button"
                onClick={onResetWhatIfBaseline}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-bold text-amber-300 transition-colors"
                title="Reset What-If Simulation to Baseline"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="mt-1.5 flex items-baseline justify-between font-mono tabular-nums">
            <div className="text-[11px] text-slate-300">
              Base: <strong>{whatIfComparison.baseLeadTimeDays}d</strong> → Now:{' '}
              <strong className="text-white">{breakdown.totalLeadTimeDays}d</strong>
            </div>
            <div
              className={`text-xs font-black px-1.5 py-0.5 rounded ${
                whatIfComparison.leadTimeDeltaDays < 0
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : whatIfComparison.leadTimeDeltaDays > 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {whatIfComparison.leadTimeDeltaDays === 0
                ? '0.00d (No Change)'
                : `${
                    whatIfComparison.leadTimeDeltaDays > 0
                      ? `+${whatIfComparison.leadTimeDeltaDays}`
                      : whatIfComparison.leadTimeDeltaDays
                  }d (${
                    whatIfComparison.leadTimeDeltaPercent > 0
                      ? `+${whatIfComparison.leadTimeDeltaPercent}`
                      : whatIfComparison.leadTimeDeltaPercent
                  }%)`}
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Grid (2x2 High-Contrast Engineering Readout with Live What-If Deltas) */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-2 shrink-0">
        {/* Card 1: Total Lead Time */}
        <button
          type="button"
          onClick={() => onSelectNodeOnCanvas?.('metrics', 'metrics')}
          className={`text-left p-2.5 rounded-lg bg-white border transition-colors group ${
            whatIfComparison && whatIfComparison.leadTimeDeltaDays !== 0
              ? whatIfComparison.leadTimeDeltaDays < 0
                ? 'border-emerald-400 ring-1 ring-emerald-400/30'
                : 'border-rose-400 ring-1 ring-rose-400/30'
              : 'border-slate-200 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Total Lead Time</span>
            <Clock className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black font-mono tabular-nums text-slate-900">
                {breakdown.totalLeadTimeDays}
              </span>
              <span className="text-[11px] font-bold text-slate-600">days</span>
            </div>
            {whatIfComparison && whatIfComparison.leadTimeDeltaDays !== 0 && (
              <span
                className={`text-[10px] font-mono font-black tabular-nums px-1 py-0.2 rounded ${
                  whatIfComparison.leadTimeDeltaDays < 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {whatIfComparison.leadTimeDeltaDays > 0
                  ? `+${whatIfComparison.leadTimeDeltaDays}d`
                  : `${whatIfComparison.leadTimeDeltaDays}d`}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] font-mono tabular-nums text-slate-500 flex items-center justify-between">
            <span>
              {whatIfComparison && whatIfComparison.leadTimeDeltaDays !== 0
                ? `Base: ${whatIfComparison.baseLeadTimeDays}d`
                : 'Order → Ship'}
            </span>
            <span>{(breakdown.totalLeadTimeDays * 24).toFixed(0)}h cal</span>
          </div>
        </button>

        {/* Card 2: Process Cycle Efficiency (PCE) */}
        <button
          type="button"
          onClick={() => onSelectNodeOnCanvas?.('metrics', 'metrics')}
          className={`text-left p-2.5 rounded-lg bg-white border transition-colors group ${
            whatIfComparison && whatIfComparison.shiftPceDeltaPercent !== 0
              ? whatIfComparison.shiftPceDeltaPercent > 0
                ? 'border-emerald-400 ring-1 ring-emerald-400/30'
                : 'border-amber-400'
              : 'border-slate-200 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Process Efficiency</span>
            <Zap className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black font-mono tabular-nums text-emerald-700">
                {breakdown.shiftPcePercent}%
              </span>
              <span className="text-[10px] font-semibold text-slate-500">shift</span>
            </div>
            {whatIfComparison && whatIfComparison.shiftPceDeltaPercent !== 0 && (
              <span
                className={`text-[10px] font-mono font-black tabular-nums px-1 py-0.2 rounded ${
                  whatIfComparison.shiftPceDeltaPercent > 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {whatIfComparison.shiftPceDeltaPercent > 0
                  ? `+${whatIfComparison.shiftPceDeltaPercent}%`
                  : `${whatIfComparison.shiftPceDeltaPercent}%`}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] font-mono tabular-nums text-slate-500 flex items-center justify-between">
            <span>24h Cal PCE:</span>
            <strong className="text-slate-700">{breakdown.calendarPcePercent}%</strong>
          </div>
        </button>

        {/* Card 3: Total Wait / Storage Time (NVA) */}
        <button
          type="button"
          onClick={() => setActiveSection('wait')}
          className={`text-left p-2.5 rounded-lg bg-white border transition-colors group ${
            whatIfComparison && whatIfComparison.plantWaitDeltaDays !== 0
              ? whatIfComparison.plantWaitDeltaDays < 0
                ? 'border-emerald-400 ring-1 ring-emerald-400/30'
                : 'border-rose-400'
              : 'border-slate-200 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Wait Time (NVA)</span>
            <Hourglass className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black font-mono tabular-nums text-amber-700">
                {breakdown.totalPlantWaitDays}
              </span>
              <span className="text-[11px] font-bold text-slate-600">days</span>
            </div>
            {whatIfComparison && whatIfComparison.plantWaitDeltaDays !== 0 && (
              <span
                className={`text-[10px] font-mono font-black tabular-nums px-1 py-0.2 rounded ${
                  whatIfComparison.plantWaitDeltaDays < 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {whatIfComparison.plantWaitDeltaDays > 0
                  ? `+${whatIfComparison.plantWaitDeltaDays}d`
                  : `${whatIfComparison.plantWaitDeltaDays}d`}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] font-mono tabular-nums text-slate-500 flex items-center justify-between">
            <span>WIP + Stock:</span>
            <strong className="text-slate-700">
              {metrics.totalWipUnits.toLocaleString()} pcs
            </strong>
          </div>
        </button>

        {/* Card 4: Value-Added Time & Resource Utilization */}
        <button
          type="button"
          onClick={() => setActiveSection('steps')}
          className={`text-left p-2.5 rounded-lg bg-white border transition-colors group ${
            whatIfComparison && whatIfComparison.vaDeltaSeconds !== 0
              ? whatIfComparison.vaDeltaSeconds < 0
                ? 'border-emerald-400 ring-1 ring-emerald-400/30'
                : 'border-rose-400'
              : 'border-slate-200 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Value-Added (ΣCT)</span>
            <Gauge
              className={`w-3.5 h-3.5 ${
                metrics.overTaktCount > 0 ? 'text-rose-600' : 'text-blue-600'
              } group-hover:scale-110 transition-transform`}
            />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black font-mono tabular-nums text-slate-900">
                {breakdown.totalValueAddedSeconds}
              </span>
              <span className="text-[11px] font-bold text-slate-600">sec</span>
            </div>
            {whatIfComparison && whatIfComparison.vaDeltaSeconds !== 0 && (
              <span
                className={`text-[10px] font-mono font-black tabular-nums px-1 py-0.2 rounded ${
                  whatIfComparison.vaDeltaSeconds < 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {whatIfComparison.vaDeltaSeconds > 0
                  ? `+${whatIfComparison.vaDeltaSeconds}s`
                  : `${whatIfComparison.vaDeltaSeconds}s`}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] font-mono tabular-nums text-slate-500 flex items-center justify-between">
            <span>Util: {resourceUtilizationAnalysis.avgUtilizationPercent}%</span>
            <strong
              className={
                resourceUtilizationAnalysis.overloadedCount > 0
                  ? 'text-rose-600'
                  : 'text-emerald-700'
              }
            >
              Avail: {resourceUtilizationAnalysis.avgAvailabilityPercent}%
            </strong>
          </div>
        </button>
      </div>

      {/* Sub-navigation Tabs inside Dashboard */}
      <div className="px-2 pt-2 bg-white border-b border-slate-200 flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSection('overview')}
          className={`flex-1 py-1.5 text-[10.5px] font-bold border-b-2 transition-colors ${
            activeSection === 'overview'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('sensitivity')}
          className={`flex-1 py-1.5 text-[10.5px] font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${
            activeSection === 'sensitivity'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Target className="w-3 h-3" />
          <span>Sensitivity</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('wait')}
          className={`flex-1 py-1.5 text-[10.5px] font-bold border-b-2 transition-colors ${
            activeSection === 'wait'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Wait ({map.buffers.length + 2})
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('steps')}
          className={`flex-1 py-1.5 text-[10.5px] font-bold border-b-2 transition-colors ${
            activeSection === 'steps'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Util &amp; C/T ({map.processes.length})
        </button>
      </div>

      {/* Scrollable Analytical Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {/* ==================== TAB 1: PCE & LEAD TIME OVERVIEW ==================== */}
        {activeSection === 'overview' && (
          <>
            {/* Lean Efficiency Benchmark Card */}
            <div className={`p-3 rounded-lg border ${breakdown.pceTier.badgeClass}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider">
                  {breakdown.pceTier.label}
                </span>
                <span className="font-mono text-xs font-black tabular-nums">
                  PCE = {breakdown.shiftPcePercent}%
                </span>
              </div>
              <p className="text-[11px] mt-1 opacity-90 leading-snug">
                {breakdown.pceTier.description}
              </p>
              <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-between text-[10px] font-mono tabular-nums">
                <span>Formula: Σ VA Time / Lead Time</span>
                <span>
                  {breakdown.totalValueAddedSeconds}s / {breakdown.totalLeadTimeDays}d
                </span>
              </div>
            </div>

            {/* Lead Time Composition Proportion Bar */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Lead Time Composition
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums text-slate-900">
                  {breakdown.totalLeadTimeDays} Days Total
                </span>
              </div>

              {/* Stacked Bar */}
              {breakdown.totalLeadTimeDays > 0 && (
                <div className="h-3 w-full rounded-md overflow-hidden bg-slate-100 flex border border-slate-200">
                  <div
                    style={{
                      width: `${Math.max(
                        4,
                        (breakdown.upstreamWaitDays / breakdown.totalLeadTimeDays) * 100
                      )}%`,
                    }}
                    className="bg-slate-500 h-full"
                    title={`Upstream Procurement & Transit: ${breakdown.upstreamWaitDays}d`}
                  />
                  <div
                    style={{
                      width: `${Math.max(
                        4,
                        (breakdown.rawMaterialDays / breakdown.totalLeadTimeDays) * 100
                      )}%`,
                    }}
                    className="bg-amber-400 h-full"
                    title={`Raw Material Storage Wait: ${breakdown.rawMaterialDays}d`}
                  />
                  <div
                    style={{
                      width: `${Math.max(
                        4,
                        (breakdown.inProcessWipDays / breakdown.totalLeadTimeDays) * 100
                      )}%`,
                    }}
                    className="bg-orange-500 h-full"
                    title={`In-Process WIP Buffers: ${breakdown.inProcessWipDays}d`}
                  />
                  <div
                    style={{
                      width: `${Math.max(
                        4,
                        (breakdown.finishedGoodsDays / breakdown.totalLeadTimeDays) * 100
                      )}%`,
                    }}
                    className="bg-blue-500 h-full"
                    title={`Finished Goods Holding: ${breakdown.finishedGoodsDays}d`}
                  />
                </div>
              )}

              {/* Breakdown Rows */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-xs bg-slate-500 inline-block" />
                    <span>Upstream Order + Transit</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-slate-900">
                    {breakdown.upstreamWaitDays} d
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" />
                    <span>Raw Material Warehouse Wait</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-slate-900">
                    {breakdown.rawMaterialDays} d
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-xs bg-orange-500 inline-block" />
                    <span>Between-Step WIP Queue Wait</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-amber-700">
                    {breakdown.inProcessWipDays} d
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" />
                    <span>Finished Goods Holding</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-slate-900">
                    {breakdown.finishedGoodsDays} d
                  </span>
                </div>

                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-2 font-semibold text-emerald-800">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                    <span>Value-Added Processing (Σ C/T)</span>
                  </span>
                  <span className="font-mono font-bold tabular-nums text-emerald-700">
                    {breakdown.totalValueAddedSeconds}s ({breakdown.totalValueAddedMinutes}m)
                  </span>
                </div>
              </div>
            </div>

            {/* Takt Time vs. Line Capability Summary */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Demand &amp; Takt Capability
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    metrics.isDemandMet
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {metrics.isDemandMet ? 'Meets Takt' : 'Bottleneck Constrained'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Customer Takt Time</span>
                  <strong className="text-sm font-mono font-black tabular-nums text-slate-900">
                    {metrics.taktTimeSeconds} sec
                  </strong>
                  <span className="text-[10px] text-slate-400 block font-mono tabular-nums">
                    {map.demand.dailyDemandUnits.toLocaleString()} pcs/day
                  </span>
                </div>

                <div className="p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Constraint Station</span>
                  <strong
                    className={`text-sm font-mono font-black tabular-nums ${
                      metrics.overTaktCount > 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {metrics.maxCycleTimeSeconds} sec
                  </strong>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {metrics.bottleneckProcessName || 'N/A'} ({metrics.maxCtToTaktRatio}x)
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Total Line Operators</span>
                </span>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {metrics.totalOperators} ops ({metrics.cycleTimeSeconds}s/op avg)
                </span>
              </div>
            </div>

            {/* Station Resource Utilization & Availability Summary Card */}
            <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-blue-600" />
                  <span>Resource Utilization &amp; Availability</span>
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSection('steps')}
                  className="text-[10px] font-bold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                >
                  Station Breakdown →
                </button>
              </div>

              {/* 3-Column Line Summary Strip */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1.5 rounded bg-slate-50 border border-slate-200/80">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                    Avg Util
                  </span>
                  <span
                    className={`font-mono text-xs font-black tabular-nums ${
                      resourceUtilizationAnalysis.avgUtilizationPercent > 100
                        ? 'text-rose-600'
                        : resourceUtilizationAnalysis.avgUtilizationPercent >= 85
                        ? 'text-amber-700'
                        : 'text-slate-900'
                    }`}
                  >
                    {resourceUtilizationAnalysis.avgUtilizationPercent}%
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-50 border border-slate-200/80">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                    Peak Station
                  </span>
                  <span
                    className={`font-mono text-xs font-black tabular-nums ${
                      (resourceUtilizationAnalysis.peakStation?.utilizationPercent || 0) > 100
                        ? 'text-rose-600'
                        : 'text-amber-700'
                    }`}
                  >
                    {resourceUtilizationAnalysis.peakStation?.utilizationPercent || 0}%
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-50 border border-slate-200/80">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                    Avg Avail
                  </span>
                  <span className="font-mono text-xs font-black tabular-nums text-emerald-700">
                    {resourceUtilizationAnalysis.avgAvailabilityPercent}%
                  </span>
                </div>
              </div>

              {/* Per-Station Utilization Bars */}
              <div className="space-y-1.5 pt-0.5">
                {resourceUtilizationAnalysis.stations.map((st) => {
                  const barPct = Math.min(100, Math.round((st.utilizationPercent / 130) * 100));
                  const capMarkerPct = Math.round((100 / 130) * 100);
                  return (
                    <button
                      key={st.processId}
                      type="button"
                      onClick={() => onSelectNodeOnCanvas?.('process', st.processId)}
                      className="w-full text-left p-1.5 rounded border border-slate-100 hover:border-blue-300 bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-bold text-slate-800 truncate pr-2">
                          {st.stepOrder}. {st.processName}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                          <span className="text-[9.5px] text-slate-500">
                            Avail: {st.availabilityPercent}%
                          </span>
                          <span
                            className={`font-black ${
                              st.utilizationPercent > 100
                                ? 'text-rose-600'
                                : st.utilizationPercent >= 85
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {st.utilizationPercent}% Util
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 relative h-1.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
                        <div
                          style={{ width: `${barPct}%` }}
                          className={`h-full rounded-full ${st.barColorClass}`}
                        />
                        <div
                          style={{ left: `${capMarkerPct}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-900"
                          title="100% Station Available Capacity"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sensitivity Analysis Preview Card (Top Lead-Time Reduction Levers) */}
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-900">
                    Sensitivity Analysis (Top 3)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('sensitivity')}
                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                >
                  Full Ranking ({sensitivityAnalysis.ranked.length}) →
                </button>
              </div>

              <p className="text-[10.5px] text-slate-600 leading-snug">
                Nodes ranked by <strong>% reduction in Total Lead Time</strong> for a{' '}
                <strong>{sensitivityBasisPct}%</strong> node improvement:
              </p>

              <div className="space-y-1.5">
                {sensitivityAnalysis.ranked.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      onSelectNodeOnCanvas?.(item.canvasNodeType, item.canvasNodeId)
                    }
                    className="p-2 rounded-md bg-white border border-slate-200 hover:border-emerald-400 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-mono text-[9.5px] font-black tabular-nums shrink-0">
                          #{item.rank}
                        </span>
                        <span className="text-[11px] font-bold text-slate-900 truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-black tabular-nums text-emerald-700 shrink-0">
                        -{item.pctLeadTimeReduction}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500">
                      <span>Saves -{item.leadTimeSavedDays}d lead time</span>
                      {onUpdateMap && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            item.applyImprovement();
                          }}
                          className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-[9.5px]"
                        >
                          Apply -{sensitivityBasisPct}%
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ==================== TAB 2: SENSITIVITY ANALYSIS (LEAD TIME REDUCTION RANKING) ==================== */}
        {activeSection === 'sensitivity' && (
          <div className="space-y-2.5">
            {/* Sensitivity Configuration Header */}
            <div className="p-2.5 rounded-lg bg-slate-900 text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-300">
                    Lead Time Sensitivity Ranking
                  </span>
                </div>
                <span className="font-mono text-[10.5px] font-bold text-slate-300 tabular-nums">
                  {sensitivityAnalysis.ranked.length} Nodes
                </span>
              </div>

              <p className="text-[10.5px] text-slate-300 leading-snug">
                Ranks which VSM nodes, if improved by the target %, yield the highest{' '}
                <strong className="text-white">percentage reduction in Total Lead Time</strong>.
              </p>

              {/* Improvement Basis Selector (25% / 50% / 100%) */}
              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                <span className="text-[10px] font-semibold text-slate-400">
                  Node Improvement Basis:
                </span>
                <div className="flex items-center gap-1">
                  {([25, 50, 100] as const).map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setSensitivityBasisPct(pct)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                        sensitivityBasisPct === pct
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      -{pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Coupled Queue Toggle for Process Nodes */}
              <label className="pt-1 border-t border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-300 cursor-pointer">
                <span>Include Little&apos;s Law Coupled Queue Impact on Stations</span>
                <input
                  type="checkbox"
                  checked={coupleProcessQueue}
                  onChange={(e) => setCoupleProcessQueue(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
              </label>
            </div>

            {/* Top-3 Cumulative Leverage Callout */}
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900 block">
                  Top 3 Levers Combined Potential
                </span>
                <span className="text-[11px] text-emerald-800">
                  Improving #1–#3 by {sensitivityBasisPct}% saves{' '}
                  <strong className="font-mono">{sensitivityAnalysis.topThreeCumulativeDays}d</strong>
                </span>
              </div>
              <span className="font-mono text-sm font-black tabular-nums text-emerald-700">
                -{sensitivityAnalysis.topThreeCumulativePct}% LT
              </span>
            </div>

            {/* Ranked Nodes List */}
            <div className="space-y-2">
              {sensitivityAnalysis.ranked.map((item) => {
                const barWidthPct = Math.min(
                  100,
                  Math.max(5, (item.pctLeadTimeReduction / sensitivityAnalysis.maxPct) * 100)
                );
                const isTopThree = item.rank <= 3;

                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      onSelectNodeOnCanvas?.(item.canvasNodeType, item.canvasNodeId)
                    }
                    className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      item.rank === 1
                        ? 'border-emerald-400 bg-emerald-50/30 hover:border-emerald-500'
                        : isTopThree
                        ? 'border-blue-200 bg-blue-50/20 hover:border-blue-400'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded tabular-nums shrink-0 ${
                            item.rank === 1
                              ? 'bg-emerald-600 text-white'
                              : isTopThree
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          #{item.rank}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">
                            {item.name}
                          </span>
                          <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                            {item.category}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <span
                          className={`text-xs font-black block ${
                            item.rank === 1
                              ? 'text-emerald-700'
                              : isTopThree
                              ? 'text-blue-700'
                              : 'text-slate-800'
                          }`}
                        >
                          -{item.pctLeadTimeReduction}% LT
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700">
                          -{item.leadTimeSavedDays}d saved
                        </span>
                      </div>
                    </div>

                    {/* Relative Sensitivity Leverage Bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${barWidthPct}%` }}
                        className={`h-full rounded-full ${
                          item.rank === 1
                            ? 'bg-emerald-600'
                            : isTopThree
                            ? 'bg-blue-600'
                            : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    {/* Before -> After Readout + 1-Click Apply Button */}
                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-slate-600">
                      <span className="truncate">
                        {item.currentDisplay} →{' '}
                        <strong className="text-slate-900">{item.improvedDisplay}</strong>
                      </span>
                      {onUpdateMap && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            item.applyImprovement();
                          }}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-emerald-600 text-white font-sans font-bold text-[10px] shrink-0 transition-colors"
                          title={`Apply ${sensitivityBasisPct}% improvement to ${item.name}`}
                        >
                          Apply
                        </button>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[9.5px] text-slate-400">
                      <span className="truncate">{item.detailNote}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        New LT: {item.projectedLeadTimeDays}d
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: WAIT TIME & INVENTORY QUEUES ==================== */}
        {activeSection === 'wait' && (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                  Non-Value-Added Share
                </span>
                <span className="text-[11px] text-amber-800">
                  {breakdown.nonValueAddedSharePercent}% of total lead time is waiting
                </span>
              </div>
              <span className="font-mono text-sm font-black tabular-nums text-amber-900">
                {breakdown.totalPlantWaitDays}d floor
              </span>
            </div>

            {/* Raw Material Inventory Wait */}
            <button
              type="button"
              onClick={() => onSelectNodeOnCanvas?.('supplier', 'supplier')}
              className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 bg-white transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Raw Material Stock ({supplyChain.rawMaterials.length})</span>
                </span>
                <span className="font-mono font-black tabular-nums text-emerald-700">
                  {breakdown.rawMaterialDays} days
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                <span>{supplyChain.totalRawMaterialUnits.toLocaleString()} total units</span>
                <span>Upstream transit: {breakdown.upstreamWaitDays}d</span>
              </div>
            </button>

            {/* Inter-Process WIP Triangle Buffers */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Between-Process WIP Triangles ({breakdown.wipStages.length})
                </span>
                <span className="text-[10px] font-mono font-bold tabular-nums text-amber-700">
                  Σ {breakdown.inProcessWipDays} days
                </span>
              </div>

              {breakdown.wipStages.map((stage) => {
                const shareOfFloorWait =
                  breakdown.totalPlantWaitDays > 0
                    ? Math.min(100, (stage.waitDays / breakdown.totalPlantWaitDays) * 100)
                    : 0;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => onSelectNodeOnCanvas?.('buffer', stage.id)}
                    className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-amber-400 bg-white transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 truncate flex items-center gap-1.5">
                        <Triangle className="w-3 h-3 text-amber-600 fill-amber-100 shrink-0" />
                        <span className="truncate">{stage.label}</span>
                      </span>
                      <span className="font-mono font-black tabular-nums text-amber-700 shrink-0">
                        {stage.waitDays} d
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, shareOfFloorWait)}%` }}
                        className="h-full bg-amber-500"
                      />
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500">
                      <span>{stage.wipUnits.toLocaleString()} pcs in queue</span>
                      <span className="uppercase">{stage.flowType} flow</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Finished Goods Warehouse Wait */}
            <button
              type="button"
              onClick={() => onSelectNodeOnCanvas?.('customer', 'customer')}
              className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 bg-white transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Finished Goods Warehouse</span>
                <span className="font-mono font-black tabular-nums text-blue-700">
                  {breakdown.finishedGoodsDays} days
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                <span>
                  {Math.round(
                    breakdown.finishedGoodsDays * breakdown.dailyDemand
                  ).toLocaleString()}{' '}
                  finished pcs
                </span>
                <span> Shipping buffer</span>
              </div>
            </button>
          </div>
        )}

        {/* ==================== TAB 3: STATION RESOURCE UTILIZATION, AVAILABILITY & C/T ==================== */}
        {activeSection === 'steps' && (
          <div className="space-y-2.5">
            {/* Line-Wide Resource Utilization & Availability Summary Banner */}
            <div className="p-2.5 rounded-lg bg-slate-900 text-white border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300 block">
                    Station Resource Utilization &amp; Availability
                  </span>
                  <span className="text-[10.5px] text-slate-300">
                    Based on Uptime %, Changeover loss, and Cycle Time vs. Demand (
                    {map.demand.dailyDemandUnits} pcs/d)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-800 text-center font-mono tabular-nums">
                <div className="p-1.5 rounded bg-slate-800/90">
                  <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">
                    Avg Utilization
                  </span>
                  <span
                    className={`text-xs font-black ${
                      resourceUtilizationAnalysis.avgUtilizationPercent > 100
                        ? 'text-rose-400'
                        : resourceUtilizationAnalysis.avgUtilizationPercent >= 85
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {resourceUtilizationAnalysis.avgUtilizationPercent}%
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-800/90">
                  <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">
                    Avg Availability
                  </span>
                  <span className="text-xs font-black text-blue-300">
                    {resourceUtilizationAnalysis.avgAvailabilityPercent}%
                  </span>
                </div>
                <div className="p-1.5 rounded bg-slate-800/90">
                  <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">
                    Shift Net Time
                  </span>
                  <span className="text-xs font-black text-white">
                    {resourceUtilizationAnalysis.netWorkingHours}h/d
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              <span>Station Node ({map.processes.length}) · Takt: {metrics.taktTimeSeconds}s</span>
              <span>Resource Util %</span>
            </div>

            {resourceUtilizationAnalysis.stations.map((station) => {
              const barPercent = Math.min(
                100,
                Math.round((station.utilizationPercent / 135) * 100)
              );
              const target85MarkerPercent = Math.min(100, Math.round((85 / 135) * 100));
              const max100MarkerPercent = Math.min(100, Math.round((100 / 135) * 100));

              return (
                <div
                  key={station.processId}
                  onClick={() => onSelectNodeOnCanvas?.('process', station.processId)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    station.utilizationPercent > 100
                      ? 'border-rose-300 bg-rose-50/40 hover:border-rose-500'
                      : station.utilizationPercent >= 85
                      ? 'border-amber-300 bg-amber-50/40 hover:border-amber-500'
                      : 'border-slate-200 bg-white hover:border-blue-400'
                  }`}
                >
                  {/* Station Title + Status Badge + Resource Utilization % */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded tabular-nums shrink-0 ${
                          station.utilizationPercent > 100
                            ? 'bg-rose-600 text-white'
                            : station.utilizationPercent >= 85
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        S{station.stepOrder}
                      </span>
                      <span className="font-bold text-slate-900 truncate">
                        {station.processName}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border shrink-0 ${station.statusBadgeClass}`}
                      >
                        {station.statusLabel}
                      </span>
                    </div>

                    <span
                      className={`font-mono text-xs font-black tabular-nums shrink-0 ${
                        station.utilizationPercent > 100
                          ? 'text-rose-600'
                          : station.utilizationPercent >= 85
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {station.utilizationPercent}% Util
                    </span>
                  </div>

                  {/* Resource Utilization Gauge Bar with 85% and 100% Capacity Reference Ticks */}
                  <div className="mt-2 relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      style={{ width: `${barPercent}%` }}
                      className={`h-full rounded-full ${station.barColorClass}`}
                    />
                    <div
                      style={{ left: `${target85MarkerPercent}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-amber-600/60"
                      title="85% High Utilization Threshold"
                    />
                    <div
                      style={{ left: `${max100MarkerPercent}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-900"
                      title="100% Available Station Capacity"
                    />
                  </div>

                  {/* 3-Column Availability, Workload & Capacity Breakdown */}
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] font-mono tabular-nums">
                    <div className="p-1.5 rounded bg-white/90 border border-slate-200/80">
                      <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">
                        Availability
                      </span>
                      <span className="font-black text-slate-900 block">
                        {station.availabilityPercent}% ({station.availableMinutes}m)
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        UT {station.uptimePercent}% · C/O {station.changeoverSeconds}s
                      </span>
                    </div>

                    <div className="p-1.5 rounded bg-white/90 border border-slate-200/80">
                      <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">
                        Cycle &amp; Run
                      </span>
                      <span className="font-black text-slate-900 block">
                        C/T {station.cycleTimeSeconds}s ({station.ctToTaktRatio}x)
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        Run: {station.requiredMinutes}m / {station.availableMinutes}m
                      </span>
                    </div>

                    <div className="p-1.5 rounded bg-white/90 border border-slate-200/80">
                      <span className="text-[9px] font-sans font-bold uppercase text-slate-400 block">
                        Max Capacity
                      </span>
                      <span
                        className={`font-black block ${
                          station.maxDailyCapacityUnits < map.demand.dailyDemandUnits
                            ? 'text-rose-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {station.maxDailyCapacityUnits} pcs/d
                      </span>
                      <span className="text-[9px] text-slate-500 block">
                        {station.headroomPercent >= 0
                          ? `${station.headroomPercent}% spare`
                          : `${Math.abs(station.headroomPercent)}% overload`}
                      </span>
                    </div>
                  </div>

                  {/* Footer Row: Effective Utilization (with Quality) & Quick Uptime Simulation Controls */}
                  <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-slate-500">
                    <span>
                      Eff CT: <strong className="text-slate-700">{station.effectiveCycleTimeSeconds}s</strong> ·
                      Quality-Adj Util:{' '}
                      <strong className="text-slate-700">{station.effectiveUtilizationPercent}%</strong>
                    </span>

                    {onUpdateMap && station.uptimePercent < 100 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextUptime = Math.min(100, station.uptimePercent + 5);
                          onUpdateMap({
                            ...map,
                            processes: map.processes.map((p) =>
                              p.id === station.processId
                                ? { ...p, uptimePercent: nextUptime }
                                : p
                            ),
                          });
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-blue-600 text-white font-sans font-bold text-[9.5px] shrink-0 transition-colors"
                        title="Simulate +5% Machine Uptime (SMED / TPM)"
                      >
                        +5% Uptime
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dashboard Footer Action Bar */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 truncate">
          {metrics.isDemandMet ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Balanced below {metrics.taktTimeSeconds}s Takt</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="truncate">
                {metrics.overTaktCount} step(s) exceed Takt
              </span>
            </>
          )}
        </div>

        {map.stateType === 'current' && onCloneToFuture && (
          <button
            type="button"
            onClick={onCloneToFuture}
            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors"
          >
            <TrendingUp className="w-3 h-3" />
            <span>Optimize Future</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </aside>
  );
};
