import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Flame,
  Plus,
  Trash2,
  Move,
  MousePointer,
  Play,
  RotateCcw,
  Download,
  ArrowLeft,
  ArrowRight,
  StickyNote,
  Box,
  Repeat,
  Grid3X3,
  Building2,
  Package,
  Scan,
  Calculator,
  Printer,
  AlertTriangle,
  Gauge,
  Eye,
} from 'lucide-react';
import {
  ValueStreamMap,
  ProcessStep,
  InventoryBuffer,
  KaizenBurst,
  CustomCanvasNode,
  FlowType,
  VendorItem,
  RawMaterialItem,
  ProcessBottleneckAnalysis,
} from '../types/vsm';
import {
  calculateVsmMetrics,
  getNormalizedSupplyChain,
  syncSupplierSummary,
} from '../utils/vsmMath';

import { CanvasCommand } from './LeftSidebar';

interface VSMCanvasProps {
  map: ValueStreamMap;
  onUpdateMap: (updated: ValueStreamMap) => void;
  onOpenWizard: () => void;
  onOpenKaizenModal?: (burst?: KaizenBurst) => void;
  onOpenLegend?: () => void;
  readOnly?: boolean;
  baselineMap?: ValueStreamMap | null;
  onResetWhatIfBaseline?: () => void;
  onCommitWhatIfBaseline?: () => void;
  onCanvasStateChange?: (state: {
    mode: 'edit' | 'simulate' | 'view';
    showGrid: boolean;
    highlightBottlenecks: boolean;
    activeInspector: string | null;
  }) => void;
}

export const VSMCanvas: React.FC<VSMCanvasProps> = ({
  map,
  onUpdateMap,
  onOpenWizard,
  readOnly = false,
  baselineMap,
  onResetWhatIfBaseline,
  onCommitWhatIfBaseline,
  onCanvasStateChange,
}) => {
  const [transform, setTransform] = useState({ k: 0.9, x: 10, y: 10 });
  const [isScreenFit, setIsScreenFit] = useState<boolean>(true);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 680,
  });
  const [canvasMode, setCanvasMode] = useState<'edit' | 'view' | 'simulate'>(
    readOnly ? 'view' : 'edit'
  );
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [highlightBottlenecks, setHighlightBottlenecks] = useState<boolean>(true);
  const [whatIfCoupleQueue, setWhatIfCoupleQueue] = useState<boolean>(true);
  const [localBaselineMap, setLocalBaselineMap] = useState<ValueStreamMap | null>(null);

  // Selected Element for Live Property Editing
  const [selection, setSelection] = useState<{
    type:
      | 'process'
      | 'buffer'
      | 'supplier'
      | 'customer'
      | 'control'
      | 'kaizen'
      | 'custom'
      | 'metrics'
      | 'bottlenecks';
    id: string;
  } | null>(null);

  // Dragging state for freeform node movement on canvas
  const [draggingNode, setDraggingNode] = useState<{
    type:
      | 'process'
      | 'buffer'
      | 'kaizen'
      | 'custom'
      | 'supplier'
      | 'customer'
      | 'control'
      | 'rawWarehouse'
      | 'finishedWarehouse';
    id: string;
    startX: number;
    startY: number;
    initialNodeX: number;
    initialNodeY: number;
  } | null>(null);

  // Zoom Window (Marquee / Rubber-band Box Zoom) state
  const [isWindowZoomMode, setIsWindowZoomMode] = useState<boolean>(false);
  const [isWindowZoomed, setIsWindowZoomed] = useState<boolean>(false);
  const [windowZoomRect, setWindowZoomRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Print to PDF (A3 / A4 Landscape Report) state
  const [printPaperSize, setPrintPaperSize] = useState<'A3' | 'A4'>('A3');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const isWindowZoomModeRef = useRef<boolean>(false);
  const savedTransformRef = useRef<{ k: number; x: number; y: number } | null>(null);

  // Capture local baseline snapshot when switching into What-If Simulation mode
  useEffect(() => {
    if (canvasMode === 'simulate') {
      setLocalBaselineMap((prev) => {
        if (!prev || prev.id !== map.id) {
          return JSON.parse(JSON.stringify(map));
        }
        return prev;
      });
    }
  }, [canvasMode, map]);

  const effectiveBaseline = useMemo(() => {
    if (baselineMap && baselineMap.id === map.id) return baselineMap;
    if (localBaselineMap && localBaselineMap.id === map.id) return localBaselineMap;
    return null;
  }, [baselineMap, localBaselineMap, map.id]);

  const baselineMetrics = useMemo(() => {
    return effectiveBaseline ? calculateVsmMetrics(effectiveBaseline) : null;
  }, [effectiveBaseline]);

  const metrics = calculateVsmMetrics(map);
  const { demand, supplier, processes, buffers, kaizenBursts, customNodes = [] } = map;
  const supplyChain = getNormalizedSupplyChain(supplier);

  // Lookup map and ranked list for Automated Bottleneck Identification (C/T vs. Takt Ratio)
  const bottleneckByProcessId = useMemo(() => {
    const mapById = new Map<string, ProcessBottleneckAnalysis>();
    metrics.bottleneckAnalysis.forEach((b) => {
      mapById.set(b.processId, b);
    });
    return mapById;
  }, [metrics.bottleneckAnalysis]);

  const rankedBottlenecks = useMemo(() => {
    return [...metrics.bottleneckAnalysis].sort((a, b) => a.rank - b.rank);
  }, [metrics.bottleneckAnalysis]);

  // Detailed Lead Time & Process Cycle Efficiency (PCE) derivation from all mapping data points
  const leadTimeBreakdown = useMemo(() => {
    const dailyDemand = Math.max(1, demand.dailyDemandUnits);
    const procurementWaitDays = Number(
      (supplyChain.criticalVendor.procurementWaitingDays || 0).toFixed(2)
    );
    const transitDays = Number((supplyChain.criticalVendor.deliveryLeadTimeDays || 0).toFixed(2));
    const rawMaterialDays = Number((supplyChain.totalRawMaterialUnits / dailyDemand).toFixed(2));

    const wipBuffersBreakdown = buffers.map((buf, idx) => {
      const proc = processes.find((p) => p.id === buf.afterProcessId);
      const nextProcIdx = processes.findIndex((p) => p.id === buf.afterProcessId) + 1;
      const nextProc = processes[nextProcIdx];
      const agingDays = Number(((buf.wipQuantity || 0) / dailyDemand).toFixed(2));
      return {
        id: buf.id,
        label:
          proc && nextProc
            ? `WIP: ${proc.name} → ${nextProc.name}`
            : proc
            ? `WIP after ${proc.name}`
            : `WIP Buffer #${idx + 1}`,
        wipQuantity: buf.wipQuantity || 0,
        agingDays,
      };
    });

    const totalWipDays = Number(
      wipBuffersBreakdown.reduce((sum, b) => sum + b.agingDays, 0).toFixed(2)
    );
    const finishedGoodsDays = Number((demand.shippingHoldingDays || 0).toFixed(2));
    const totalStorageDays = Number(
      (rawMaterialDays + totalWipDays + finishedGoodsDays).toFixed(2)
    );
    const totalValueAddedSeconds = processes.reduce(
      (sum, p) => sum + (p.cycleTimeSeconds || 0),
      0
    );
    const valueAddedDays =
      metrics.effectiveWorkingSeconds > 0
        ? totalValueAddedSeconds / metrics.effectiveWorkingSeconds
        : 0;
    const totalLeadTimeDays = Number(
      (procurementWaitDays + transitDays + totalStorageDays + valueAddedDays).toFixed(2)
    );

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

    const floorStorageSeconds =
      totalStorageDays * Math.max(1, metrics.effectiveWorkingSeconds);
    const floorPcePercent =
      floorStorageSeconds > 0
        ? Number(((totalValueAddedSeconds / floorStorageSeconds) * 100).toFixed(3))
        : 0;

    return {
      dailyDemand,
      procurementWaitDays,
      transitDays,
      rawMaterialDays,
      wipBuffersBreakdown,
      totalWipDays,
      finishedGoodsDays,
      totalStorageDays,
      totalLeadTimeDays,
      totalValueAddedSeconds,
      calendarPcePercent,
      shiftPcePercent,
      floorPcePercent,
    };
  }, [demand, supplyChain, buffers, processes, metrics.effectiveWorkingSeconds]);

  // Balanced horizontal spacing & larger station cards for high-visibility typography + C/T vs. Takt ratio bar
  const stationWidth = 240;
  const stationHeight = 204;
  const interBufferWidth = 148;
  const startX = 275;
  const defaultStationY = 232;

  const totalStations = Math.max(1, processes.length);
  const defaultLastStationRightX =
    startX + totalStations * stationWidth + (totalStations - 1) * interBufferWidth;
  const maxCustomStationRightX = processes.reduce((maxRight, p, idx) => {
    const px = p.x ?? startX + idx * (stationWidth + interBufferWidth);
    return Math.max(maxRight, px + stationWidth);
  }, defaultLastStationRightX);
  const lastStationRightX = Math.max(defaultLastStationRightX, maxCustomStationRightX);
  const materialFlowEndX = lastStationRightX + 95;

  // Default & Custom Positions for Landmarks (including movable Raw Material & Finished Goods Warehouses)
  const supplierPos = {
    x: supplier.x ?? 38,
    y: supplier.y ?? 26,
  };
  const rawWarehousePos = {
    x: supplier.rawWarehouseX ?? 38,
    y: supplier.rawWarehouseY ?? defaultStationY,
  };
  const finishedWarehousePos = {
    x: demand.finishedWarehouseX ?? materialFlowEndX,
    y: demand.finishedWarehouseY ?? defaultStationY,
  };
  const rightmostFlowX = Math.max(lastStationRightX, finishedWarehousePos.x + 124);
  const canvasWidth = Math.max(1760, rightmostFlowX + 415);
  const canvasHeight = 764;

  const customerPos = {
    x: demand.x ?? canvasWidth - 235,
    y: demand.y ?? 26,
  };
  const controlPos = {
    x: map.informationFlow.x ?? canvasWidth / 2 - 170,
    y: map.informationFlow.y ?? 24,
    width: 340,
    height: 98,
  };

  // Calculate station coordinates
  const stationCoords = useMemo(() => {
    return processes.map((proc, index) => {
      const defaultX = startX + index * (stationWidth + interBufferWidth);
      const x = proc.x ?? defaultX;
      const y = proc.y ?? defaultStationY;
      return {
        ...proc,
        x,
        y,
        centerX: x + stationWidth / 2,
        centerY: y + stationHeight / 2,
      };
    });
  }, [processes, startX, stationWidth, interBufferWidth, defaultStationY, stationHeight]);

  // Calculate buffer coordinates — guarantee an Inventory Triangle between every pair of consecutive process steps
  const bufferCoords = useMemo(() => {
    const dailyDemand = Math.max(1, demand.dailyDemandUnits);
    const interProcessBuffers: InventoryBuffer[] = stationCoords
      .slice(0, -1)
      .map((proc, index) => {
        const existing = buffers.find((b) => b.afterProcessId === proc.id);
        if (existing) {
          return {
            ...existing,
            calculatedDays: Number((existing.wipQuantity / dailyDemand).toFixed(2)),
          };
        }
        return {
          id: `buf-${proc.id}-${index}`,
          afterProcessId: proc.id,
          wipQuantity: 0,
          calculatedDays: 0,
          flowType: 'push',
        };
      });

    // Also include any explicit buffers attached to the last process if present
    const lastProc = stationCoords[stationCoords.length - 1];
    const trailingBuffers = lastProc
      ? buffers
          .filter((b) => b.afterProcessId === lastProc.id)
          .map((b) => ({
            ...b,
            calculatedDays: Number((b.wipQuantity / dailyDemand).toFixed(2)),
          }))
      : [];

    const allBuffers = [...interProcessBuffers, ...trailingBuffers];

    return allBuffers.map((buf) => {
      const procIndex = stationCoords.findIndex((p) => p.id === buf.afterProcessId);
      const proc = stationCoords[procIndex];
      const nextProc = stationCoords[procIndex + 1];

      let defaultX = startX + stationWidth + 32;
      let defaultY = defaultStationY + stationHeight / 2 - 28;

      if (proc && nextProc) {
        defaultX = (proc.x + stationWidth + nextProc.x) / 2 - 32;
        defaultY = (proc.centerY + nextProc.centerY) / 2 - 28;
      } else if (proc) {
        defaultX = (proc.x + stationWidth + finishedWarehousePos.x) / 2 - 32;
        defaultY = proc.centerY - 28;
      }

      const x = buf.x ?? defaultX;
      const y = buf.y ?? defaultY;
      return {
        ...buf,
        x,
        y,
        centerX: x + 32,
        centerY: y + 24,
      };
    });
  }, [
    buffers,
    demand.dailyDemandUnits,
    stationCoords,
    startX,
    stationWidth,
    defaultStationY,
    stationHeight,
    finishedWarehousePos.x,
  ]);

  // Helper to update or insert an inter-process InventoryBuffer into map.buffers
  const upsertBufferInMap = useCallback(
    (targetBuf: InventoryBuffer, patch: Partial<InventoryBuffer>) => {
      const dailyDemand = Math.max(1, demand.dailyDemandUnits);
      const nextWip =
        patch.wipQuantity !== undefined ? patch.wipQuantity : targetBuf.wipQuantity;
      const updatedItem: InventoryBuffer = {
        id: targetBuf.id,
        afterProcessId: targetBuf.afterProcessId,
        wipQuantity: nextWip,
        calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
        flowType: patch.flowType ?? targetBuf.flowType,
        x: patch.x !== undefined ? patch.x : targetBuf.x,
        y: patch.y !== undefined ? patch.y : targetBuf.y,
      };

      const exists = buffers.some(
        (b) => b.id === targetBuf.id || b.afterProcessId === targetBuf.afterProcessId
      );
      const nextBuffers = exists
        ? buffers.map((b) =>
            b.id === targetBuf.id || b.afterProcessId === targetBuf.afterProcessId
              ? updatedItem
              : b
          )
        : [...buffers, updatedItem];

      onUpdateMap({ ...map, buffers: nextBuffers });
    },
    [buffers, demand.dailyDemandUnits, map, onUpdateMap]
  );

  // ==================== WHAT-IF SIMULATION DIRECT NODE ADJUSTMENT HANDLERS ====================
  // 1. Adjust Process Cycle Time directly on a process node (with optional Little's Law queue wait coupling)
  const handleWhatIfAdjustCycleTime = useCallback(
    (procId: string, nextCtRaw: number) => {
      const nextCt = Math.max(1, Math.round(nextCtRaw));
      const procIdx = processes.findIndex((p) => p.id === procId);
      if (procIdx === -1) return;

      const targetProc = processes[procIdx];
      const oldCt = Math.max(1, targetProc.cycleTimeSeconds || 1);
      if (nextCt === oldCt) return;

      const updatedProcesses = processes.map((p) =>
        p.id === procId ? { ...p, cycleTimeSeconds: nextCt } : p
      );

      let updatedBuffers = [...buffers];
      let updatedDemand = { ...demand };
      const dailyDemand = Math.max(1, demand.dailyDemandUnits);

      if (whatIfCoupleQueue) {
        const ratio = nextCt / oldCt;
        if (procIdx < processes.length - 1) {
          // Scale the WIP buffer immediately following this process step
          const existingBuf = updatedBuffers.find((b) => b.afterProcessId === procId);
          if (existingBuf) {
            const baseWip = existingBuf.wipQuantity || 0;
            const nextWip =
              baseWip > 0
                ? Math.max(0, Math.round(baseWip * ratio))
                : nextCt > metrics.taktTimeSeconds
                ? Math.round(
                    ((nextCt - metrics.taktTimeSeconds) / Math.max(1, metrics.taktTimeSeconds)) *
                      dailyDemand *
                      0.5
                  )
                : 0;
            updatedBuffers = updatedBuffers.map((b) =>
              b.id === existingBuf.id
                ? {
                    ...b,
                    wipQuantity: nextWip,
                    calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
                  }
                : b
            );
          } else {
            const fallbackBuf = bufferCoords.find((b) => b.afterProcessId === procId);
            const baseWip = fallbackBuf?.wipQuantity || 0;
            const nextWip =
              baseWip > 0
                ? Math.max(0, Math.round(baseWip * ratio))
                : nextCt > metrics.taktTimeSeconds
                ? Math.round(
                    ((nextCt - metrics.taktTimeSeconds) / Math.max(1, metrics.taktTimeSeconds)) *
                      dailyDemand *
                      0.5
                  )
                : 0;
            updatedBuffers.push({
              id: fallbackBuf?.id || `buf-${procId}`,
              afterProcessId: procId,
              wipQuantity: nextWip,
              calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
              flowType: fallbackBuf?.flowType || 'push',
            });
          }
        } else {
          // Final process station (e.g., Paint Canning): scale the upstream queue feeding it + finished goods buffer
          const prevProc = processes[procIdx - 1];
          if (prevProc) {
            const upstreamBuf = updatedBuffers.find((b) => b.afterProcessId === prevProc.id);
            if (upstreamBuf && upstreamBuf.wipQuantity > 0) {
              const nextWip = Math.max(0, Math.round(upstreamBuf.wipQuantity * ratio));
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
          }
          if (demand.shippingHoldingDays > 0) {
            const dampedRatio = 0.5 + 0.5 * ratio;
            updatedDemand = {
              ...demand,
              shippingHoldingDays: Math.max(
                0,
                Number((demand.shippingHoldingDays * dampedRatio).toFixed(2))
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
    [
      processes,
      buffers,
      bufferCoords,
      demand,
      whatIfCoupleQueue,
      metrics.taktTimeSeconds,
      map,
      onUpdateMap,
    ]
  );

  // 2. Adjust Inter-Process WIP Buffer Wait Time (in Days) directly on a triangle node
  const handleWhatIfAdjustBufferDays = useCallback(
    (targetBuf: InventoryBuffer, nextDaysRaw: number) => {
      const nextDays = Math.max(0, Number(nextDaysRaw.toFixed(2)));
      const dailyDemand = Math.max(1, demand.dailyDemandUnits);
      const nextWip = Math.max(0, Math.round(nextDays * dailyDemand));
      upsertBufferInMap(targetBuf, { wipQuantity: nextWip });
    },
    [demand.dailyDemandUnits, upsertBufferInMap]
  );

  // 3. Adjust Raw Material Warehouse Wait Time (in Days) directly on the Raw Material node
  const handleWhatIfAdjustRawMaterialDays = useCallback(
    (nextDaysRaw: number) => {
      const nextDays = Math.max(0, Number(nextDaysRaw.toFixed(2)));
      const dailyDemand = Math.max(1, demand.dailyDemandUnits);
      const targetUnits = Math.max(0, Math.round(nextDays * dailyDemand));
      const currentTotal = supplyChain.totalRawMaterialUnits;

      const updatedRawMaterials = supplyChain.rawMaterials.map((rm, idx) => {
        if (currentTotal > 0) {
          const share = (rm.stockUnits || 0) / currentTotal;
          return { ...rm, stockUnits: Math.max(0, Math.round(targetUnits * share)) };
        }
        return idx === 0 ? { ...rm, stockUnits: targetUnits } : rm;
      });

      const updatedSupplier = syncSupplierSummary({
        ...supplier,
        rawMaterials: updatedRawMaterials,
        rawMaterialStockUnits: targetUnits,
      });

      onUpdateMap({ ...map, supplier: updatedSupplier });
    },
    [demand.dailyDemandUnits, supplyChain, supplier, map, onUpdateMap]
  );

  // 4. Adjust Supplier Procurement / Transit Wait Time (in Days) directly on Supplier / Truck node
  const handleWhatIfAdjustSupplierWaitDays = useCallback(
    (deltaDays: number) => {
      const critId = supplyChain.criticalVendor.id;
      const updatedVendors = supplyChain.vendors.map((v) => {
        if (v.id !== critId) return v;
        const currentTransit = v.deliveryLeadTimeDays || 0;
        const currentProcure = v.procurementWaitingDays || 0;
        if (deltaDays >= 0 || currentTransit + deltaDays >= 0) {
          return {
            ...v,
            deliveryLeadTimeDays: Math.max(0, Number((currentTransit + deltaDays).toFixed(1))),
          };
        }
        const remainder = deltaDays + currentTransit;
        return {
          ...v,
          deliveryLeadTimeDays: 0,
          procurementWaitingDays: Math.max(0, Number((currentProcure + remainder).toFixed(1))),
        };
      });

      const updatedSupplier = syncSupplierSummary({
        ...supplier,
        vendors: updatedVendors,
      });
      onUpdateMap({ ...map, supplier: updatedSupplier });
    },
    [supplyChain, supplier, map, onUpdateMap]
  );

  // 5. Adjust Finished Goods Holding Wait Time (in Days) directly on the Finished Goods Warehouse node
  const handleWhatIfAdjustFinishedGoodsDays = useCallback(
    (nextDaysRaw: number) => {
      const nextDays = Math.max(0, Number(nextDaysRaw.toFixed(2)));
      onUpdateMap({
        ...map,
        demand: {
          ...demand,
          shippingHoldingDays: nextDays,
        },
      });
    },
    [demand, map, onUpdateMap]
  );

  // 6. Quick What-If Presets for 1-click simulation scenarios
  const handleWhatIfBalanceToTakt = useCallback(() => {
    if (metrics.taktTimeSeconds <= 0) return;
    const targetCap = Math.max(1, Math.floor(metrics.taktTimeSeconds));
    const dailyDemand = Math.max(1, demand.dailyDemandUnits);

    const updatedProcesses = processes.map((p) =>
      p.cycleTimeSeconds > targetCap ? { ...p, cycleTimeSeconds: targetCap } : p
    );

    const updatedBuffers = buffers.map((b) => {
      const nextWip = Math.round((b.wipQuantity || 0) * 0.75);
      return {
        ...b,
        wipQuantity: nextWip,
        calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
      };
    });

    onUpdateMap({
      ...map,
      processes: updatedProcesses,
      buffers: updatedBuffers,
    });
  }, [metrics.taktTimeSeconds, demand.dailyDemandUnits, processes, buffers, map, onUpdateMap]);

  const handleWhatIfScaleAllCycleTimes = useCallback(
    (factor: number) => {
      const dailyDemand = Math.max(1, demand.dailyDemandUnits);
      const updatedProcesses = processes.map((p) => ({
        ...p,
        cycleTimeSeconds: Math.max(1, Math.round((p.cycleTimeSeconds || 1) * factor)),
      }));
      const updatedBuffers = whatIfCoupleQueue
        ? buffers.map((b) => {
            const nextWip = Math.max(0, Math.round((b.wipQuantity || 0) * factor));
            return {
              ...b,
              wipQuantity: nextWip,
              calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
            };
          })
        : buffers;

      onUpdateMap({
        ...map,
        processes: updatedProcesses,
        buffers: updatedBuffers,
      });
    },
    [demand.dailyDemandUnits, processes, whatIfCoupleQueue, buffers, map, onUpdateMap]
  );

  const handleWhatIfScaleAllWaitTimes = useCallback(
    (factor: number) => {
      const dailyDemand = Math.max(1, demand.dailyDemandUnits);
      const updatedBuffers = buffers.map((b) => {
        const nextWip = Math.max(0, Math.round((b.wipQuantity || 0) * factor));
        return {
          ...b,
          wipQuantity: nextWip,
          calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
        };
      });
      const updatedRawMaterials = supplyChain.rawMaterials.map((rm) => ({
        ...rm,
        stockUnits: Math.max(0, Math.round((rm.stockUnits || 0) * factor)),
      }));
      const updatedSupplier = syncSupplierSummary({
        ...supplier,
        rawMaterials: updatedRawMaterials,
      });
      const nextFgDays = Math.max(
        0,
        Number(((demand.shippingHoldingDays || 0) * factor).toFixed(2))
      );

      onUpdateMap({
        ...map,
        buffers: updatedBuffers,
        supplier: updatedSupplier,
        demand: {
          ...demand,
          shippingHoldingDays: nextFgDays,
        },
      });
    },
    [demand, buffers, supplyChain.rawMaterials, supplier, map, onUpdateMap]
  );

  const handleResetToBaseline = useCallback(() => {
    if (onResetWhatIfBaseline) {
      onResetWhatIfBaseline();
    } else if (effectiveBaseline) {
      onUpdateMap(JSON.parse(JSON.stringify(effectiveBaseline)));
    }
  }, [onResetWhatIfBaseline, effectiveBaseline, onUpdateMap]);

  // Sync canvas state back to parent LeftSidebar
  useEffect(() => {
    onCanvasStateChange?.({
      mode: canvasMode,
      showGrid,
      highlightBottlenecks,
      activeInspector: selection?.type ?? null,
    });
  }, [canvasMode, showGrid, highlightBottlenecks, selection, onCanvasStateChange]);

  // Exact Screen-Fit scales so the diagram fills 100% of available viewport width and height
  const fitPadding = 10;
  const fitScaleX = Math.max(0.25, (viewportSize.width - fitPadding * 2) / canvasWidth);
  const fitScaleY = Math.max(0.25, (viewportSize.height - fitPadding * 2) / canvasHeight);
  const effectiveScaleX = isScreenFit ? fitScaleX : transform.k;
  const effectiveScaleY = isScreenFit ? fitScaleY : transform.k;
  const effectiveTx = isScreenFit ? fitPadding : transform.x;
  const effectiveTy = isScreenFit ? fitPadding : transform.y;

  // Compute Zoom-to-Fit transform across the entire diagram and activate full Screen Fit
  const handleZoomToFit = useCallback(() => {
    if (!viewportRef.current || !svgRef.current || !zoomBehaviorRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    setViewportSize({ width: rect.width, height: rect.height });
    setIsScreenFit(true);
    setIsWindowZoomed(false);
    setIsWindowZoomMode(false);
    isWindowZoomModeRef.current = false;
    savedTransformRef.current = null;

    const padding = 10;
    const scaleX = (rect.width - padding * 2) / canvasWidth;
    const scaleY = (rect.height - padding * 2) / canvasHeight;
    const k = Math.min(1.65, Math.max(0.3, Math.min(scaleX, scaleY)));

    const tx = (rect.width - canvasWidth * k) / 2;
    const ty = Math.max(8, (rect.height - canvasHeight * k) / 2);

    const svgSelection = select(svgRef.current);
    svgSelection.call(
      zoomBehaviorRef.current.transform,
      zoomIdentity.translate(tx, ty).scale(k)
    );
  }, [canvasWidth, canvasHeight]);

  // Track viewport size continuously with ResizeObserver so resizing window/sidebars keeps Screen Fit locked
  useEffect(() => {
    if (!viewportRef.current) return;
    const el = viewportRef.current;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialize d3-zoom on the SVG element for smooth drag-to-pan and wheel/pinch zoom
  useEffect(() => {
    if (!svgRef.current) return;

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4.0])
      .filter((event) => {
        // Disable d3 drag-panning while drawing a Zoom Window box
        if (isWindowZoomModeRef.current && event.type !== 'wheel') {
          return false;
        }
        // Prevent canvas pan when user clicks/drags a draggable node or What-If control
        const target = event.target as Element | null;
        if (
          target &&
          (target.closest('.draggable-vsm-node') || target.closest('.what-if-node-control'))
        ) {
          return event.type === 'wheel';
        }
        return !event.ctrlKey && !event.button;
      })
      .on('zoom', (event) => {
        const { x, y, k } = event.transform;
        if (event.sourceEvent) {
          setIsScreenFit(false);
        }
        setTransform({ x, y, k });
      });

    zoomBehaviorRef.current = zoomBehavior;
    const svgSelection = select(svgRef.current);
    svgSelection.call(zoomBehavior);

    // Initial screen-fit on mount or map change
    const timer = setTimeout(() => {
      handleZoomToFit();
    }, 30);

    return () => {
      clearTimeout(timer);
      svgSelection.on('.zoom', null);
    };
  }, [map.id, handleZoomToFit]);

  // Restore original zoom value / Screen Fit (triggered by pressing Escape or clicking Screen Fit)
  const handleRestoreOriginalZoom = useCallback(() => {
    setWindowZoomRect(null);
    setIsWindowZoomMode(false);
    isWindowZoomModeRef.current = false;
    setIsWindowZoomed(false);
    savedTransformRef.current = null;
    handleZoomToFit();
  }, [handleZoomToFit]);

  // Listen for Escape key to exit Zoom Window mode and restore Screen Fit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleRestoreOriginalZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRestoreOriginalZoom]);

  // Toggle Zoom Window (rubber-band selection zoom) mode
  const handleToggleWindowZoom = useCallback(() => {
    if (isWindowZoomMode) {
      setIsWindowZoomMode(false);
      isWindowZoomModeRef.current = false;
      setWindowZoomRect(null);
    } else {
      if (!savedTransformRef.current) {
        savedTransformRef.current = { ...transform };
      }
      setSelection(null);
      setIsWindowZoomMode(true);
      isWindowZoomModeRef.current = true;
    }
  }, [isWindowZoomMode, transform]);

  // Programmatic Zoom In / Out via d3-zoom
  const handleStepZoom = useCallback((factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    setIsScreenFit(false);
    select(svgRef.current).call(zoomBehaviorRef.current.scaleBy, factor);
  }, []);

  // Reset all custom node positions and fit to screen
  const handleAutoAlignLayout = useCallback(() => {
    const cleanedProcesses = processes.map(({ x, y, ...rest }) => rest);
    const cleanedBuffers = buffers.map(({ x, y, ...rest }) => rest);
    const cleanedBursts = kaizenBursts.map(({ x, y, ...rest }) => rest);
    onUpdateMap({
      ...map,
      processes: cleanedProcesses,
      buffers: cleanedBuffers,
      kaizenBursts: cleanedBursts,
      supplier: {
        ...supplier,
        x: undefined,
        y: undefined,
        rawWarehouseX: undefined,
        rawWarehouseY: undefined,
      },
      demand: {
        ...demand,
        x: undefined,
        y: undefined,
        finishedWarehouseX: undefined,
        finishedWarehouseY: undefined,
      },
      informationFlow: { ...map.informationFlow, x: undefined, y: undefined },
    });
    setTimeout(() => handleZoomToFit(), 40);
  }, [processes, buffers, kaizenBursts, onUpdateMap, map, supplier, demand, handleZoomToFit]);

  // Start dragging a node on the canvas in Edit Mode
  const startNodeDrag = (
    e: React.MouseEvent,
    type:
      | 'process'
      | 'buffer'
      | 'kaizen'
      | 'custom'
      | 'supplier'
      | 'customer'
      | 'control'
      | 'rawWarehouse'
      | 'finishedWarehouse',
    id: string,
    currentX: number,
    currentY: number
  ) => {
    // Allow Zoom Window marquee drag even when starting over a node
    if (isWindowZoomModeRef.current) return;
    e.stopPropagation();
    if (type === 'rawWarehouse') {
      setSelection({ type: 'supplier', id: 'supplier' });
    } else if (type === 'finishedWarehouse') {
      setSelection({ type: 'customer', id: 'customer' });
    } else {
      setSelection({ type, id });
    }
    if (canvasMode !== 'edit' || readOnly) return;

    setDraggingNode({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialNodeX: currentX,
      initialNodeY: currentY,
    });
  };

  const handleViewportMouseDown = (e: React.MouseEvent) => {
    if (!isWindowZoomMode || !viewportRef.current) return;
    e.stopPropagation();
    const rect = viewportRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setWindowZoomRect({
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (windowZoomRect && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      setWindowZoomRect((prev) => (prev ? { ...prev, currentX, currentY } : null));
      return;
    }

    if (!draggingNode) return;
    const dx = (e.clientX - draggingNode.startX) / effectiveScaleX;
    const dy = (e.clientY - draggingNode.startY) / effectiveScaleY;
    const newX = Math.round(draggingNode.initialNodeX + dx);
    const newY = Math.round(draggingNode.initialNodeY + dy);

    if (draggingNode.type === 'process') {
      const updated = processes.map((p) =>
        p.id === draggingNode.id ? { ...p, x: newX, y: newY } : p
      );
      onUpdateMap({ ...map, processes: updated });
    } else if (draggingNode.type === 'buffer') {
      const targetBuf = bufferCoords.find((b) => b.id === draggingNode.id);
      if (targetBuf) {
        upsertBufferInMap(targetBuf, { x: newX, y: newY });
      }
    } else if (draggingNode.type === 'kaizen') {
      const updated = kaizenBursts.map((k) =>
        k.id === draggingNode.id ? { ...k, x: newX, y: newY } : k
      );
      onUpdateMap({ ...map, kaizenBursts: updated });
    } else if (draggingNode.type === 'custom') {
      const updated = customNodes.map((c) =>
        c.id === draggingNode.id ? { ...c, x: newX, y: newY } : c
      );
      onUpdateMap({ ...map, customNodes: updated });
    } else if (draggingNode.type === 'supplier') {
      onUpdateMap({ ...map, supplier: { ...supplier, x: newX, y: newY } });
    } else if (draggingNode.type === 'rawWarehouse') {
      onUpdateMap({
        ...map,
        supplier: { ...supplier, rawWarehouseX: newX, rawWarehouseY: newY },
      });
    } else if (draggingNode.type === 'customer') {
      onUpdateMap({ ...map, demand: { ...demand, x: newX, y: newY } });
    } else if (draggingNode.type === 'finishedWarehouse') {
      onUpdateMap({
        ...map,
        demand: { ...demand, finishedWarehouseX: newX, finishedWarehouseY: newY },
      });
    } else if (draggingNode.type === 'control') {
      onUpdateMap({
        ...map,
        informationFlow: { ...map.informationFlow, x: newX, y: newY },
      });
    }
  };

  const handleMouseUp = () => {
    if (windowZoomRect && viewportRef.current && svgRef.current && zoomBehaviorRef.current) {
      const boxLeft = Math.min(windowZoomRect.startX, windowZoomRect.currentX);
      const boxTop = Math.min(windowZoomRect.startY, windowZoomRect.currentY);
      const boxWidth = Math.abs(windowZoomRect.currentX - windowZoomRect.startX);
      const boxHeight = Math.abs(windowZoomRect.currentY - windowZoomRect.startY);

      setWindowZoomRect(null);

      if (boxWidth > 16 && boxHeight > 16) {
        if (!savedTransformRef.current) {
          savedTransformRef.current = { ...transform };
        }
        const rect = viewportRef.current.getBoundingClientRect();
        const svgX0 = (boxLeft - effectiveTx) / effectiveScaleX;
        const svgY0 = (boxTop - effectiveTy) / effectiveScaleY;
        const svgW = boxWidth / effectiveScaleX;
        const svgH = boxHeight / effectiveScaleY;

        const pad = 24;
        const scaleX = (rect.width - pad * 2) / Math.max(1, svgW);
        const scaleY = (rect.height - pad * 2) / Math.max(1, svgH);
        const newK = Math.min(4.0, Math.max(0.35, Math.min(scaleX, scaleY)));

        const svgCenterX = svgX0 + svgW / 2;
        const svgCenterY = svgY0 + svgH / 2;
        const newTx = rect.width / 2 - svgCenterX * newK;
        const newTy = rect.height / 2 - svgCenterY * newK;

        setIsScreenFit(false);
        select(svgRef.current).call(
          zoomBehaviorRef.current.transform,
          zoomIdentity.translate(newTx, newTy).scale(newK)
        );
        setIsWindowZoomed(true);
        setIsWindowZoomMode(false);
        isWindowZoomModeRef.current = false;
      }
      return;
    }

    setDraggingNode(null);
  };

  // Interactive Sandbox Actions
  const handleQuickAddStation = () => {
    const newId = `proc-${Date.now()}`;
    const newOrder = processes.length + 1;
    const newStep: ProcessStep = {
      id: newId,
      order: newOrder,
      name: `Process Step ${newOrder}`,
      type: 'dedicated',
      cycleTimeSeconds: 65,
      changeoverSeconds: 15,
      uptimePercent: 98,
      qualityPercent: 99,
      operatorsCount: 1,
      notes: 'Added via Interactive Studio.',
    };

    const updatedBuffers = [...buffers];
    if (processes.length > 0) {
      const lastProc = processes[processes.length - 1];
      const hasBuffer = buffers.some((b) => b.afterProcessId === lastProc.id);
      if (!hasBuffer) {
        updatedBuffers.push({
          id: `buf-${Date.now()}`,
          afterProcessId: lastProc.id,
          wipQuantity: 150,
          calculatedDays: Number((150 / Math.max(1, demand.dailyDemandUnits)).toFixed(2)),
          flowType: 'push',
        });
      }
    }

    onUpdateMap({
      ...map,
      processes: [...processes, newStep],
      buffers: updatedBuffers,
    });
    setSelection({ type: 'process', id: newId });
  };

  const handleQuickAddKaizen = (targetProcessId?: string) => {
    const targetProc =
      processes.find((p) => p.id === targetProcessId) ||
      processes.find((p) => p.id === metrics.bottleneckProcessId) ||
      processes[0];

    const newBurst: KaizenBurst = {
      id: `kz-${Date.now()}`,
      nodeId: targetProc?.id || 'general',
      nodeName: targetProc?.name || 'Process Line',
      title: 'SMED & Cycle Optimization',
      description: 'Reduce non-value-added handling and balance operator workload below Takt.',
      wasteCategory: 'Waiting',
      priority: 'high',
      status: 'identified',
      owner: 'Lean Engineer',
      targetDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      expectedGain: '25% cycle time reduction',
      createdAt: new Date().toISOString(),
    };

    onUpdateMap({
      ...map,
      kaizenBursts: [...kaizenBursts, newBurst],
    });
    setSelection({ type: 'kaizen', id: newBurst.id });
  };

  const handleAddCustomSymbol = (
    symbolType: CustomCanvasNode['symbolType'],
    defaultLabel: string
  ) => {
    const newNode: CustomCanvasNode = {
      id: `cust-${Date.now()}`,
      symbolType,
      label: defaultLabel,
      subLabel: 'Drag anywhere',
      x: 380 + (customNodes.length * 65) % 480,
      y: 120,
    };
    onUpdateMap({
      ...map,
      customNodes: [...customNodes, newNode],
    });
    setSelection({ type: 'custom', id: newNode.id });
  };

  const handleDeleteSelected = () => {
    if (!selection) return;
    if (selection.type === 'process') {
      if (processes.length <= 1) return;
      const filteredProcs = processes
        .filter((p) => p.id !== selection.id)
        .map((p, i) => ({ ...p, order: i + 1 }));
      const filteredBufs = buffers.filter((b) => b.afterProcessId !== selection.id);
      onUpdateMap({ ...map, processes: filteredProcs, buffers: filteredBufs });
    } else if (selection.type === 'kaizen') {
      onUpdateMap({
        ...map,
        kaizenBursts: kaizenBursts.filter((k) => k.id !== selection.id),
      });
    } else if (selection.type === 'custom') {
      onUpdateMap({
        ...map,
        customNodes: customNodes.filter((c) => c.id !== selection.id),
      });
    }
    setSelection(null);
  };

  const handleReorderProcess = (procId: string, direction: 'left' | 'right') => {
    const idx = processes.findIndex((p) => p.id === procId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= processes.length) return;

    const copy = [...processes];
    const temp = copy[idx];
    copy[idx] = { ...copy[targetIdx], x: undefined, y: undefined };
    copy[targetIdx] = { ...temp, x: undefined, y: undefined };

    onUpdateMap({
      ...map,
      processes: copy.map((p, i) => ({ ...p, order: i + 1 })),
    });
  };

  // Export High-Res PNG
  const handleExportPNG = () => {
    if (!svgRef.current) return;
    const svgElement = svgRef.current;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * 2;
      canvas.height = canvasHeight * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(image, 0, 0);
        const pngURL = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngURL;
        downloadLink.download = `${map.title.replace(/\s+/g, '_')}_VSM.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    image.src = blobURL;
  };

  // Print to PDF (A3 / A4 Landscape Report) Handler
  const handlePrintToPDF = useCallback(() => {
    setSelection(null);
    setWindowZoomRect(null);
    setIsWindowZoomMode(false);
    isWindowZoomModeRef.current = false;
    setIsPrinting(true);

    // Allow React to flush the full-sheet viewBox and report title block before opening print dialog
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrinting(false);
      }, 250);
    }, 80);
  }, []);

  // Listen for browser Ctrl+P / Cmd+P print events, Navbar Print PDF button, and LeftSidebar commands
  useEffect(() => {
    const onBeforePrint = () => {
      setSelection(null);
      setWindowZoomRect(null);
      setIsWindowZoomMode(false);
      isWindowZoomModeRef.current = false;
      setIsPrinting(true);
    };
    const onAfterPrint = () => {
      setIsPrinting(false);
    };
    const onTriggerPrint = () => {
      handlePrintToPDF();
    };
    const onCanvasCommand = (e: Event) => {
      const cmd = (e as CustomEvent<CanvasCommand>).detail;
      if (!cmd) return;
      switch (cmd.action) {
        case 'screen-fit':
          handleZoomToFit();
          break;
        case 'zoom-window':
          handleToggleWindowZoom();
          break;
        case 'zoom-in':
          handleStepZoom(1.18);
          break;
        case 'zoom-out':
          handleStepZoom(0.85);
          break;
        case 'toggle-grid':
          setShowGrid((prev) => !prev);
          break;
        case 'set-mode':
          setCanvasMode(cmd.mode);
          break;
        case 'auto-align':
          handleAutoAlignLayout();
          break;
        case 'add-step':
          setCanvasMode('edit');
          handleQuickAddStation();
          break;
        case 'add-kaizen':
          setCanvasMode('edit');
          handleQuickAddKaizen();
          break;
        case 'select-node': {
          const targetId = cmd.nodeId || cmd.nodeType;
          setSelection((prev) =>
            prev?.type === cmd.nodeType && prev?.id === targetId
              ? null
              : { type: cmd.nodeType, id: targetId }
          );
          break;
        }
        case 'add-symbol':
          setCanvasMode('edit');
          handleAddCustomSymbol(cmd.symbolType, cmd.label);
          break;
        case 'toggle-bottlenecks':
          setHighlightBottlenecks((prev) => !prev);
          break;
        case 'export-png':
          handleExportPNG();
          break;
        case 'print-pdf':
          if (cmd.paperSize) setPrintPaperSize(cmd.paperSize);
          handlePrintToPDF();
          break;
      }
    };

    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    window.addEventListener('vsm-trigger-print', onTriggerPrint);
    window.addEventListener('vsm-canvas-command', onCanvasCommand);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      window.removeEventListener('vsm-trigger-print', onTriggerPrint);
      window.removeEventListener('vsm-canvas-command', onCanvasCommand);
    };
  }, [
    handlePrintToPDF,
    handleZoomToFit,
    handleToggleWindowZoom,
    handleStepZoom,
    handleAutoAlignLayout,
  ]);

  // Selected items for Live Inspector
  const selectedProcess =
    selection?.type === 'process' ? processes.find((p) => p.id === selection.id) : null;
  const selectedBuffer =
    selection?.type === 'buffer' ? bufferCoords.find((b) => b.id === selection.id) : null;
  const selectedKaizen =
    selection?.type === 'kaizen' ? kaizenBursts.find((k) => k.id === selection.id) : null;
  const selectedCustom =
    selection?.type === 'custom' ? customNodes.find((c) => c.id === selection.id) : null;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="vsm-print-container w-full h-full flex flex-col bg-slate-100 print:bg-white select-none overflow-hidden"
    >
      {/* Dynamic CSS Keyframes & Print Page Orientation Rules (A3 / A4 Landscape) */}
      <style>{`
        @keyframes vsmFlowPulse {
          to {
            stroke-dashoffset: -28;
          }
        }
        .animate-vsm-flow {
          animation: vsmFlowPulse 0.9s linear infinite;
        }
        @media print {
          @page {
            size: ${printPaperSize} landscape;
            margin: 8mm;
          }
          .vsm-canvas-transform-group {
            transform: none !important;
          }
        }
      `}</style>

      {/* ==================== PRINT-ONLY A3/A4 LANDSCAPE ENGINEERING REPORT HEADER ==================== */}
      <div
        className={`${
          isPrinting ? 'flex' : 'hidden print:flex'
        } items-center justify-between border-2 border-slate-900 bg-white px-4 py-2.5 mb-2 shrink-0`}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border border-slate-900 text-slate-900">
              {map.stateType === 'future' ? 'FUTURE STATE VSM (TO-BE)' : 'CURRENT STATE VSM (AS-IS)'}
            </span>
            <span className="text-xs font-bold text-slate-600">
              {map.organization} · {map.productFamily}
            </span>
          </div>
          <h1 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
            {map.title}
          </h1>
        </div>

        <div className="flex items-center gap-5 text-xs font-mono">
          <div className="text-right">
            <span className="text-[9px] font-sans font-bold uppercase text-slate-500 block">
              Total Lead Time
            </span>
            <strong className="text-sm font-black text-slate-900">
              {leadTimeBreakdown.totalLeadTimeDays} Days
            </strong>
          </div>
          <div className="h-7 w-px bg-slate-300" />
          <div className="text-right">
            <span className="text-[9px] font-sans font-bold uppercase text-slate-500 block">
              Storage (NVA)
            </span>
            <strong className="text-sm font-black text-slate-900">
              {leadTimeBreakdown.totalStorageDays} Days
            </strong>
          </div>
          <div className="h-7 w-px bg-slate-300" />
          <div className="text-right">
            <span className="text-[9px] font-sans font-bold uppercase text-slate-500 block">
              Value-Added (Σ CT)
            </span>
            <strong className="text-sm font-black text-emerald-700">
              {leadTimeBreakdown.totalValueAddedSeconds} Sec
            </strong>
          </div>
          <div className="h-7 w-px bg-slate-300" />
          <div className="text-right">
            <span className="text-[9px] font-sans font-bold uppercase text-slate-500 block">
              Process Cycle Efficiency
            </span>
            <strong className="text-sm font-black text-blue-700">
              {leadTimeBreakdown.calendarPcePercent}% (Shift: {leadTimeBreakdown.shiftPcePercent}%)
            </strong>
          </div>
          <div className="h-7 w-px bg-slate-300" />
          <div className="text-right">
            <span className="text-[9px] font-sans font-bold uppercase text-slate-500 block">
              Customer Takt / Max CT
            </span>
            <strong className="text-sm font-black text-slate-900">
              {metrics.taktTimeSeconds}s / {metrics.maxCycleTimeSeconds}s
            </strong>
          </div>
        </div>
      </div>

      {/* ==================== COMPACT ZERO-SCROLLBAR TOP STATUS & QUICK BAR ==================== */}
      {!readOnly && (
        <div className="px-3 py-1 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 no-print">
          {/* Left: Mode Switcher + What-If Simulation Toggle + Quick Add */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg">
              <button
                onClick={() => setCanvasMode('edit')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-all whitespace-nowrap ${
                  canvasMode === 'edit'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>

              <button
                onClick={() =>
                  setCanvasMode((prev) => (prev === 'simulate' ? 'edit' : 'simulate'))
                }
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold transition-all whitespace-nowrap ${
                  canvasMode === 'simulate'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100'
                }`}
                title="Toggle What-If Simulation Mode: Adjust cycle times or wait times directly on canvas nodes"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>What-If Sim</span>
                <span
                  className={`text-[9px] font-mono font-black px-1 py-0.2 rounded uppercase ${
                    canvasMode === 'simulate'
                      ? 'bg-emerald-800 text-emerald-100'
                      : 'bg-emerald-200/80 text-emerald-900'
                  }`}
                >
                  {canvasMode === 'simulate' ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                onClick={() => setCanvasMode('view')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition-all whitespace-nowrap ${
                  canvasMode === 'view'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
            </div>

            {canvasMode === 'edit' && (
              <>
                <button
                  onClick={handleQuickAddStation}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Step</span>
                </button>

                <button
                  onClick={() => handleQuickAddKaizen()}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold transition-colors whitespace-nowrap"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>+ Kaizen</span>
                </button>

                <button
                  onClick={() => setSelection({ type: 'supplier', id: 'supplier' })}
                  className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold transition-colors whitespace-nowrap border ${
                    selection?.type === 'supplier'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>
                    Vendors ({supplyChain.vendors.length}V/{supplyChain.rawMaterials.length}M)
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Right: Bottleneck Badge + PCE Summary + Screen Fit & Zoom Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Bottleneck Radar Pill */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() =>
                  setSelection(
                    selection?.type === 'bottlenecks'
                      ? null
                      : { type: 'bottlenecks', id: 'bottlenecks' }
                  )
                }
                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-semibold transition-colors whitespace-nowrap ${
                  selection?.type === 'bottlenecks'
                    ? 'bg-rose-600 text-white'
                    : metrics.overTaktCount > 0
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-800'
                    : 'bg-amber-50/70 hover:bg-amber-100/80 text-slate-800'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>
                  Bottleneck:{' '}
                  <strong className="font-mono">
                    {metrics.bottleneckProcessName} ({metrics.maxCtToTaktRatio}x)
                  </strong>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setHighlightBottlenecks((prev) => !prev)}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ml-0.5 transition-colors ${
                  highlightBottlenecks
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="Toggle Bottleneck Highlight"
              >
                {highlightBottlenecks ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Lead Time & PCE Inspector Pill */}
            <button
              type="button"
              onClick={() =>
                setSelection(
                  selection?.type === 'metrics' ? null : { type: 'metrics', id: 'metrics' }
                )
              }
              className={`hidden xl:flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-lg border transition-colors whitespace-nowrap ${
                selection?.type === 'metrics'
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white hover:bg-blue-50/60 text-slate-700 border-slate-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Lead: <strong className="font-mono">{leadTimeBreakdown.totalLeadTimeDays}d</strong>
              </span>
              <span>·</span>
              <span>
                PCE: <strong className="font-mono">{leadTimeBreakdown.calendarPcePercent}%</strong>
              </span>
            </button>

            {/* Screen Fit + Zoom Controls */}
            <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5">
              <button
                onClick={handleZoomToFit}
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold transition-colors mr-0.5 ${
                  isScreenFit
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
                title="Screen Fit: Automatically scale diagram to fill the entire viewport"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Screen Fit</span>
              </button>

              <button
                onClick={handleToggleWindowZoom}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold transition-colors border-l border-slate-200 ${
                  isWindowZoomMode
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-100 text-slate-700'
                }`}
                title="Zoom Window: Drag a box to zoom in, press Esc to reset"
              >
                <Scan className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Box Zoom</span>
              </button>

              <button
                onClick={() => handleStepZoom(0.85)}
                className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[10px] font-bold text-slate-700 px-1 text-center">
                {isScreenFit ? 'FIT' : `${Math.round(transform.k * 100)}%`}
              </span>
              <button
                onClick={() => handleStepZoom(1.18)}
                className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== WHAT-IF SIMULATION LIVE CONTROL BAR ==================== */}
      {!readOnly && canvasMode === 'simulate' && (
        <div className="px-3 py-1.5 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0 no-print">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-extrabold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>What-If Mode</span>
            </span>
            <span className="text-slate-300 font-medium hidden md:inline">
              Adjust <strong className="text-white">Cycle Times (s)</strong> or{' '}
              <strong className="text-amber-300">Wait Times (d)</strong> directly on canvas nodes:
            </span>

            {/* Little's Law Queue Coupling Toggle */}
            <button
              type="button"
              onClick={() => setWhatIfCoupleQueue((prev) => !prev)}
              className={`px-2 py-0.5 rounded border text-[10px] font-bold transition-colors ${
                whatIfCoupleQueue
                  ? 'bg-blue-600/30 border-blue-400 text-blue-200 hover:bg-blue-600/40'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="When ON, adjusting a station's Cycle Time proportionally scales its adjacent WIP queue wait time (Little's Law throughput coupling)"
            >
              Queue Coupling (Little&apos;s Law): {whatIfCoupleQueue ? 'ON' : 'OFF'}
            </button>

            {/* Quick What-If Presets */}
            <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
              <button
                type="button"
                onClick={handleWhatIfBalanceToTakt}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white border border-slate-700 font-semibold transition-colors"
                title="Cap all bottleneck station Cycle Times to Customer Takt Time"
              >
                Cap C/T ≤ {metrics.taktTimeSeconds}s Takt
              </button>
              <button
                type="button"
                onClick={() => handleWhatIfScaleAllCycleTimes(0.85)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-blue-700 text-slate-200 hover:text-white border border-slate-700 font-semibold transition-colors"
                title="Simulate a 15% reduction in all process step Cycle Times"
              >
                -15% All C/T
              </button>
              <button
                type="button"
                onClick={() => handleWhatIfScaleAllWaitTimes(0.75)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-700 text-slate-200 hover:text-white border border-slate-700 font-semibold transition-colors"
                title="Simulate a 25% reduction in all WIP & warehouse wait times"
              >
                -25% All Wait
              </button>
            </div>
          </div>

          {/* Live Impact Delta Readout & Reset / Commit Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {baselineMetrics && (
              <div className="flex items-center gap-2.5 bg-slate-800/90 border border-slate-700 rounded-md px-2.5 py-0.5 font-mono tabular-nums">
                {(() => {
                  const ltDelta = Number(
                    (metrics.leadTimeDays - baselineMetrics.leadTimeDays).toFixed(2)
                  );
                  const ctDelta =
                    metrics.totalProcessTimeSeconds - baselineMetrics.totalProcessTimeSeconds;
                  return (
                    <>
                      <span>
                        Lead Time:{' '}
                        <strong className="text-white">{metrics.leadTimeDays}d</strong>{' '}
                        {ltDelta !== 0 && (
                          <span
                            className={`font-black ${
                              ltDelta < 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            ({ltDelta > 0 ? `+${ltDelta}d` : `${ltDelta}d`})
                          </span>
                        )}
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>
                        ΣC/T:{' '}
                        <strong className="text-white">{metrics.totalProcessTimeSeconds}s</strong>{' '}
                        {ctDelta !== 0 && (
                          <span
                            className={`font-black ${
                              ctDelta < 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            ({ctDelta > 0 ? `+${ctDelta}s` : `${ctDelta}s`})
                          </span>
                        )}
                      </span>
                    </>
                  );
                })()}
              </div>
            )}

            <button
              type="button"
              onClick={handleResetToBaseline}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold transition-colors"
              title="Reset all What-If node adjustments back to the original baseline"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Reset Baseline</span>
            </button>

            {onCommitWhatIfBaseline && (
              <button
                type="button"
                onClick={onCommitWhatIfBaseline}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                title="Keep current simulated numbers as the new baseline"
              >
                Set as Baseline
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== MAIN CANVAS + SIDEBAR CONTAINER ==================== */}
      <div className="vsm-print-viewport flex-1 flex overflow-hidden relative">
        {/* D3-Zoom Interactive SVG Viewport */}
        <div
          ref={viewportRef}
          onMouseDown={handleViewportMouseDown}
          onClick={() => {
            if (!isWindowZoomMode) setSelection(null);
          }}
          className={`flex-1 h-full overflow-hidden print:overflow-visible relative ${
            isWindowZoomMode
              ? 'cursor-crosshair'
              : draggingNode
              ? 'cursor-grabbing'
              : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          {/* Active Zoom Window Helper Banner */}
          {(isWindowZoomMode || isWindowZoomed) && (
            <div className="no-print absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-slate-900/90 text-white text-xs font-medium shadow-md">
              <Scan className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>
                {isWindowZoomMode
                  ? 'Drag a window over any section of the diagram to zoom in · Press Esc to cancel'
                  : 'Window Zoom active · Press Esc at any time to restore original zoom'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRestoreOriginalZoom();
                }}
                className="ml-1 px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[11px] font-bold transition-colors"
              >
                Esc / Reset
              </button>
            </div>
          )}

          {/* Rubber-band Selection Box Overlay during Zoom Window drag */}
          {windowZoomRect && (
            <div
              className="no-print absolute z-20 pointer-events-none border-2 border-blue-600 bg-blue-500/15 rounded-xs shadow-xs"
              style={{
                left: Math.min(windowZoomRect.startX, windowZoomRect.currentX),
                top: Math.min(windowZoomRect.startY, windowZoomRect.currentY),
                width: Math.abs(windowZoomRect.currentX - windowZoomRect.startX),
                height: Math.abs(windowZoomRect.currentY - windowZoomRect.startY),
              }}
            />
          )}
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={isPrinting ? `0 0 ${canvasWidth} ${canvasHeight}` : undefined}
            preserveAspectRatio={isPrinting ? 'xMidYMid meet' : undefined}
            className="vsm-print-svg w-full h-full block bg-white"
          >
            <defs>
              {/* Crisp Engineering Grid Pattern (Minor 24px + Major 96px) */}
              <pattern id="minor-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="0.75"
                />
              </pattern>
              <pattern id="engineering-grid" width="96" height="96" patternUnits="userSpaceOnUse">
                <rect width="96" height="96" fill="url(#minor-grid)" />
                <path
                  d="M 96 0 L 0 0 0 96"
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="1.25"
                />
              </pattern>

              {/* Arrowhead Markers */}
              <marker
                id="arrow-dark"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0F172A" />
              </marker>

              <marker
                id="arrow-blue"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#2563EB" />
              </marker>

              {/* Elevated Card Shadow */}
              <filter id="cardElevation" x="-8%" y="-8%" width="116%" height="120%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.07" />
              </filter>
            </defs>

            {/* D3-Zoom & Screen-Fit Transformed Group (Fills 100% of viewport in Screen Fit mode) */}
            <g
              className="vsm-canvas-transform-group"
              transform={
                isPrinting
                  ? 'translate(0, 0) scale(1)'
                  : isScreenFit
                  ? `translate(${fitPadding}, ${fitPadding}) scale(${fitScaleX}, ${fitScaleY})`
                  : `translate(${transform.x}, ${transform.y}) scale(${transform.k})`
              }
            >
              {/* Canvas Sheet Background */}
              <rect
                x="0"
                y="0"
                width={canvasWidth}
                height={canvasHeight}
                rx="12"
                fill="#FFFFFF"
                stroke="#CBD5E1"
                strokeWidth="1.5"
              />

              {/* Swimlane Backdrops */}
              <rect
                x="16"
                y="12"
                width={canvasWidth - 32}
                height="180"
                rx="12"
                fill={showGrid ? 'rgba(248, 250, 252, 0.7)' : '#F8FAFC'}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <rect
                x="16"
                y="200"
                width={canvasWidth - 32}
                height="280"
                rx="12"
                fill={showGrid ? 'rgba(255, 255, 255, 0.7)' : '#FFFFFF'}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <rect
                x="16"
                y="488"
                width={canvasWidth - 32}
                height="268"
                rx="12"
                fill={showGrid ? 'rgba(248, 250, 252, 0.7)' : '#F8FAFC'}
                stroke="#E2E8F0"
                strokeWidth="1"
              />

              {/* Toggleable Engineering Grid Overlay */}
              {showGrid && (
                <rect
                  x="0"
                  y="0"
                  width={canvasWidth}
                  height={canvasHeight}
                  rx="12"
                  fill="url(#engineering-grid)"
                  pointerEvents="none"
                />
              )}

              {/* Swimlane Section Titles (Larger Font) */}
              <text
                x="32"
                y="32"
                fontSize="12"
                fontWeight="extrabold"
                fill="#64748B"
                letterSpacing="0.08em"
              >
                01 · INFORMATION FLOW &amp; PRODUCTION CONTROL
              </text>

              <text
                x="32"
                y="220"
                fontSize="12"
                fontWeight="extrabold"
                fill="#64748B"
                letterSpacing="0.08em"
              >
                02 · PHYSICAL MATERIAL FLOW &amp; WORKSTATIONS
              </text>

              <text
                x="32"
                y="508"
                fontSize="12"
                fontWeight="extrabold"
                fill="#64748B"
                letterSpacing="0.08em"
              >
                03 · VALUE-ADDED VS. NON-VALUE-ADDED SAWTOOTH TIMELINE
              </text>

              {/* ---------------- 1. DYNAMIC INFORMATION FLOW CONNECTORS ---------------- */}
              {/* Electronic Info: Customer -> Production Control */}
              <path
                d={`M ${customerPos.x} ${customerPos.y + 48} L ${
                  (customerPos.x + controlPos.x + controlPos.width) / 2 + 16
                } ${customerPos.y + 48} L ${
                  (customerPos.x + controlPos.x + controlPos.width) / 2 - 16
                } ${controlPos.y + 30} L ${controlPos.x + controlPos.width} ${controlPos.y + 48}`}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.25"
                className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                strokeDasharray={canvasMode === 'simulate' ? '8 6' : undefined}
                markerEnd="url(#arrow-blue)"
              />
              <g
                transform={`translate(${
                  (customerPos.x + controlPos.x + controlPos.width) / 2 - 64
                }, ${controlPos.y + 6})`}
              >
                <rect
                  x="0"
                  y="0"
                  width="128"
                  height="26"
                  rx="6"
                  fill="#EFF6FF"
                  stroke="#93C5FD"
                  strokeWidth="1.25"
                />
                <text x="64" y="17" textAnchor="middle" fontSize="11.5" fontWeight="extrabold" fill="#1D4ED8">
                  ⚡ EDI Orders
                </text>
              </g>

              {/* Demand List: Production Control -> Supplier */}
              <path
                d={`M ${controlPos.x} ${controlPos.y + 48} L ${
                  (controlPos.x + supplierPos.x + 224) / 2 + 16
                } ${controlPos.y + 30} L ${
                  (controlPos.x + supplierPos.x + 224) / 2 - 16
                } ${supplierPos.y + 48} L ${supplierPos.x + 224} ${supplierPos.y + 48}`}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.25"
                className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                strokeDasharray={canvasMode === 'simulate' ? '8 6' : undefined}
                markerEnd="url(#arrow-blue)"
              />
              <g
                transform={`translate(${
                  (controlPos.x + supplierPos.x + 224) / 2 - 86
                }, ${controlPos.y + 6})`}
              >
                <rect
                  x="0"
                  y="0"
                  width="172"
                  height="26"
                  rx="6"
                  fill="#EFF6FF"
                  stroke="#93C5FD"
                  strokeWidth="1.25"
                />
                <text x="86" y="17" textAnchor="middle" fontSize="11" fontWeight="extrabold" fill="#1D4ED8">
                  Forecast ({supplyChain.criticalVendor.procurementWaitingDays}d max wait)
                </text>
              </g>

              {/* Production Schedule Bus Line to all Stations */}
              {stationCoords.length > 0 && (
                <>
                  <line
                    x1={controlPos.x + controlPos.width / 2}
                    y1={controlPos.y + controlPos.height}
                    x2={controlPos.x + controlPos.width / 2}
                    y2="160"
                    stroke="#0F172A"
                    strokeWidth="2"
                  />
                  <line
                    x1={Math.min(stationCoords[0].centerX, controlPos.x + controlPos.width / 2)}
                    y1="160"
                    x2={Math.max(
                      stationCoords[stationCoords.length - 1].centerX,
                      controlPos.x + controlPos.width / 2
                    )}
                    y2="160"
                    stroke="#0F172A"
                    strokeWidth="2"
                  />
                  {stationCoords.map((coord) => (
                    <g key={`sched-${coord.id}`}>
                      <line
                        x1={coord.centerX}
                        y1="160"
                        x2={coord.centerX}
                        y2={coord.y - 4}
                        stroke="#475569"
                        strokeWidth="1.75"
                        strokeDasharray="6 4"
                        className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                        markerEnd="url(#arrow-dark)"
                      />
                      <circle cx={coord.centerX} cy="160" r="4" fill="#2563EB" />
                    </g>
                  ))}
                </>
              )}

              {/* ---------------- 2. TOP NODES: SUPPLIER (MULTI-VENDOR), PRODUCTION CONTROL, CUSTOMER ---------------- */}
              {/* Multi-Vendor Supplier Sawtooth Card */}
              {(() => {
                const visibleVendors = supplyChain.vendors.slice(0, 3);
                const extraVendorsCount = Math.max(0, supplyChain.vendors.length - 3);
                const supplierCardHeight = Math.max(
                  98,
                  54 + visibleVendors.length * 18 + (extraVendorsCount > 0 ? 14 : 6)
                );
                return (
                  <g
                    transform={`translate(${supplierPos.x}, ${supplierPos.y})`}
                    onMouseDown={(e) =>
                      startNodeDrag(e, 'supplier', 'supplier', supplierPos.x, supplierPos.y)
                    }
                    className="draggable-vsm-node cursor-pointer"
                    filter="url(#cardElevation)"
                  >
                    <path
                      d={`M 0 24 L 0 ${supplierCardHeight} L 224 ${supplierCardHeight} L 224 24 L 168 38 L 168 24 L 112 38 L 112 24 L 56 38 L 56 24 Z`}
                      fill="#FFFFFF"
                      stroke={selection?.type === 'supplier' ? '#2563EB' : '#0F172A'}
                      strokeWidth={selection?.type === 'supplier' ? '3' : '2.25'}
                    />
                    <text x="112" y="51" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0F172A">
                      {supplyChain.vendors.length > 1
                        ? `VENDORS (${supplyChain.vendors.length})`
                        : 'SUPPLIER / VENDOR'}
                    </text>
                    {visibleVendors.map((v, vIdx) => {
                      const isCritical =
                        supplyChain.vendors.length > 1 && v.id === supplyChain.criticalVendor.id;
                      const rowY = 68 + vIdx * 18;
                      return (
                        <g key={v.id}>
                          <text
                            x="10"
                            y={rowY}
                            fontSize="10.5"
                            fontWeight={isCritical ? '800' : '700'}
                            fill={isCritical ? '#1D4ED8' : '#334155'}
                          >
                            {vIdx + 1}.{' '}
                            {v.vendorName.length > 18
                              ? v.vendorName.substring(0, 16) + '…'
                              : v.vendorName}
                          </text>
                          <text
                            x="214"
                            y={rowY}
                            textAnchor="end"
                            fontSize="10"
                            fontWeight="800"
                            fill={isCritical ? '#1D4ED8' : '#64748B'}
                            className="font-mono"
                          >
                            {v.procurementWaitingDays}d+{v.deliveryLeadTimeDays}d
                          </text>
                        </g>
                      );
                    })}
                    {extraVendorsCount > 0 && (
                      <text
                        x="112"
                        y={68 + visibleVendors.length * 18}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="800"
                        fill="#2563EB"
                      >
                        +{extraVendorsCount} more vendor{extraVendorsCount > 1 ? 's' : ''} (click to edit)
                      </text>
                    )}
                  </g>
                );
              })()}

              {/* Production Control Card (Wider + Larger Font) */}
              <g
                transform={`translate(${controlPos.x}, ${controlPos.y})`}
                onMouseDown={(e) =>
                  startNodeDrag(e, 'control', 'control', controlPos.x, controlPos.y)
                }
                className="draggable-vsm-node cursor-pointer"
                filter="url(#cardElevation)"
              >
                <rect
                  x="0"
                  y="0"
                  width={controlPos.width}
                  height={controlPos.height}
                  rx="8"
                  fill="#FFFFFF"
                  stroke={selection?.type === 'control' ? '#2563EB' : '#0F172A'}
                  strokeWidth={selection?.type === 'control' ? '3' : '2.25'}
                />
                <path
                  d={`M 0 8 C 0 4 4 0 8 0 L ${controlPos.width - 8} 0 C ${
                    controlPos.width - 4
                  } 0 ${controlPos.width} 4 ${controlPos.width} 8 L ${controlPos.width} 30 L 0 30 Z`}
                  fill="#0F172A"
                />
                <text
                  x={controlPos.width / 2}
                  y="20"
                  textAnchor="middle"
                  fontSize="12.5"
                  fontWeight="900"
                  fill="#FFFFFF"
                  letterSpacing="0.05em"
                >
                  {map.informationFlow.controlDepartment.toUpperCase()}
                </text>

                <g transform="translate(16, 50)">
                  <text x="0" y="0" fontSize="11.5" fontWeight="600" fill="#64748B">
                    Schedule Cadence:
                  </text>
                  <text
                    x={controlPos.width - 32}
                    y="0"
                    textAnchor="end"
                    fontSize="12"
                    fontWeight="extrabold"
                    fill="#0F172A"
                  >
                    {map.informationFlow.scheduleFrequency} Dispatch
                  </text>

                  <text x="0" y="20" fontSize="11.5" fontWeight="600" fill="#64748B">
                    Floor Control:
                  </text>
                  <text
                    x={controlPos.width - 32}
                    y="20"
                    textAnchor="end"
                    fontSize="12"
                    fontWeight="extrabold"
                    fill="#2563EB"
                  >
                    {map.informationFlow.scheduleDistribution}
                  </text>

                  <text x="0" y="38" fontSize="10.5" fontWeight="600" fill="#64748B">
                    Input: {map.informationFlow.orderReceptionChannel}
                  </text>
                </g>
              </g>

              {/* Customer Sawtooth Card + Demand Box (Larger Font) */}
              <g
                transform={`translate(${customerPos.x}, ${customerPos.y})`}
                onMouseDown={(e) =>
                  startNodeDrag(e, 'customer', 'customer', customerPos.x, customerPos.y)
                }
                className="draggable-vsm-node cursor-pointer"
                filter="url(#cardElevation)"
              >
                <path
                  d="M 0 26 L 0 92 L 148 92 L 148 26 L 111 40 L 111 26 L 74 40 L 74 26 L 37 40 L 37 26 Z"
                  fill="#FFFFFF"
                  stroke={selection?.type === 'customer' ? '#2563EB' : '#0F172A'}
                  strokeWidth={selection?.type === 'customer' ? '3' : '2.25'}
                />
                <text x="74" y="56" textAnchor="middle" fontSize="13.5" fontWeight="900" fill="#0F172A">
                  CUSTOMER
                </text>
                <text x="74" y="75" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#334155">
                  {demand.customerName.length > 16
                    ? demand.customerName.substring(0, 14) + '…'
                    : demand.customerName}
                </text>

                {/* Attached Customer Demand Card */}
                <g transform="translate(156, 16)">
                  <rect
                    x="0"
                    y="0"
                    width="112"
                    height="68"
                    rx="7"
                    fill="#FFFFFF"
                    stroke="#0F172A"
                    strokeWidth="2"
                  />
                  <rect x="0" y="0" width="112" height="22" rx="6" fill="#EFF6FF" />
                  <line x1="0" y1="22" x2="112" y2="22" stroke="#0F172A" strokeWidth="1.5" />
                  <text x="56" y="15" textAnchor="middle" fontSize="10.5" fontWeight="extrabold" fill="#1E3A8A">
                    Demand Rate
                  </text>
                  <text
                    x="56"
                    y="42"
                    textAnchor="middle"
                    fontSize="13.5"
                    fontWeight="900"
                    fill="#2563EB"
                    className="font-mono"
                  >
                    {demand.dailyDemandUnits}/Day
                  </text>
                  <text x="56" y="59" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#475569">
                    {demand.shiftsPerDay} Shift ({demand.hoursPerShift}h)
                  </text>
                </g>
              </g>

              {/* ---------------- 3. WAREHOUSES & EXTERNAL LOGISTICS ---------------- */}
              {/* Supplier to Raw Warehouse Transit Line & Truck */}
              {(() => {
                const visibleVendors = supplyChain.vendors.slice(0, 3);
                const extraVendorsCount = Math.max(0, supplyChain.vendors.length - 3);
                const supplierCardHeight = Math.max(
                  98,
                  54 + visibleVendors.length * 18 + (extraVendorsCount > 0 ? 14 : 6)
                );
                const inTruckX = Math.round((supplierPos.x + 112 + rawWarehousePos.x + 82) / 2 - 48);
                const inTruckY = Math.round(
                  (supplierPos.y + supplierCardHeight + rawWarehousePos.y - 8) / 2 - 15
                );
                return (
                  <>
                    <path
                      d={`M ${supplierPos.x + 112} ${supplierPos.y + supplierCardHeight} L ${
                        rawWarehousePos.x + 82
                      } ${rawWarehousePos.y - 8}`}
                      stroke="#0F172A"
                      strokeWidth="2.25"
                      className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                      strokeDasharray={canvasMode === 'simulate' ? '8 6' : undefined}
                      markerEnd="url(#arrow-dark)"
                    />
                    <g transform={`translate(${inTruckX}, ${inTruckY})`} filter="url(#cardElevation)">
                      <rect
                        x="0"
                        y="0"
                        width="96"
                        height="30"
                        rx="6"
                        fill="#FFFFFF"
                        stroke={canvasMode === 'simulate' ? '#059669' : '#0F172A'}
                        strokeWidth={canvasMode === 'simulate' ? '2.25' : '1.75'}
                      />
                      <rect
                        x="68"
                        y="7"
                        width="20"
                        height="16"
                        rx="2"
                        fill="#DBEAFE"
                        stroke="#0F172A"
                        strokeWidth="1.25"
                      />
                      <circle cx="22" cy="30" r="4.5" fill="#0F172A" />
                      <circle cx="74" cy="30" r="4.5" fill="#0F172A" />
                      <text
                        x="34"
                        y="19"
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="900"
                        fill="#0F172A"
                        className="font-mono"
                      >
                        {supplyChain.criticalVendor.deliveryLeadTimeDays}d TRANSIT
                      </text>

                      {/* On-Node What-If Control for Supplier Transit Wait */}
                      {canvasMode === 'simulate' && !readOnly && (
                        <foreignObject
                          x="100"
                          y="-4"
                          width="132"
                          height="38"
                          className="what-if-node-control no-print overflow-visible"
                        >
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-900 text-white rounded-md border border-emerald-500/80 px-1.5 py-1 shadow-md flex items-center justify-between gap-1 text-[9px] font-mono tabular-nums"
                          >
                            <span className="font-sans font-bold text-emerald-300 uppercase">
                              Transit
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleWhatIfAdjustSupplierWaitDays(-1)}
                                className="px-1 py-0.5 rounded bg-slate-800 hover:bg-rose-600 text-white font-bold"
                                title="Reduce Supplier Transit Wait by 1 day"
                              >
                                -1d
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWhatIfAdjustSupplierWaitDays(-0.5)}
                                className="px-1 py-0.5 rounded bg-slate-800 hover:bg-rose-600 text-white font-bold"
                                title="Reduce Supplier Transit Wait by 0.5 days"
                              >
                                -.5
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWhatIfAdjustSupplierWaitDays(0.5)}
                                className="px-1 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                                title="Increase Supplier Transit Wait by 0.5 days"
                              >
                                +.5
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWhatIfAdjustSupplierWaitDays(1)}
                                className="px-1 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                                title="Increase Supplier Transit Wait by 1 day"
                              >
                                +1d
                              </button>
                            </div>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  </>
                );
              })()}

              {/* Multi-Raw-Material Warehouse Card (Draggable) */}
              <g
                transform={`translate(${rawWarehousePos.x}, ${rawWarehousePos.y})`}
                onMouseDown={(e) =>
                  startNodeDrag(
                    e,
                    'rawWarehouse',
                    'rawWarehouse',
                    rawWarehousePos.x,
                    rawWarehousePos.y
                  )
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setSelection({ type: 'supplier', id: 'supplier' });
                }}
                className="draggable-vsm-node cursor-move group"
                filter="url(#cardElevation)"
              >
                <rect
                  x="0"
                  y="0"
                  width="164"
                  height={stationHeight}
                  rx="9"
                  fill="#FFFFFF"
                  stroke={
                    canvasMode === 'simulate'
                      ? '#059669'
                      : selection?.type === 'supplier'
                      ? '#2563EB'
                      : '#0F172A'
                  }
                  strokeWidth={
                    canvasMode === 'simulate' || selection?.type === 'supplier' ? '3' : '2.25'
                  }
                />
                <line x1="0" y1="32" x2="164" y2="32" stroke="#0F172A" strokeWidth="1.75" />
                <text x="82" y="21" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0F172A">
                  RAW MATERIALS ({supplyChain.rawMaterials.length})
                </text>

                {/* Total Stock & Aging Header inside Warehouse */}
                <rect x="8" y="38" width="148" height="36" rx="5" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
                <text x="14" y="53" fontSize="10" fontWeight="700" fill="#475569">
                  Total Raw:
                </text>
                <text
                  x="150"
                  y="53"
                  textAnchor="end"
                  fontSize="12"
                  fontWeight="900"
                  fill="#0F172A"
                  className="font-mono"
                >
                  {supplyChain.totalRawMaterialUnits.toLocaleString()}
                </text>
                <text x="14" y="68" fontSize="9.5" fontWeight="700" fill="#64748B">
                  Aging Buffer:
                </text>
                <text
                  x="150"
                  y="68"
                  textAnchor="end"
                  fontSize="10.5"
                  fontWeight="800"
                  fill="#059669"
                  className="font-mono"
                >
                  {(supplyChain.totalRawMaterialUnits / Math.max(1, demand.dailyDemandUnits)).toFixed(1)}d
                </text>

                {/* Itemized Raw Materials List */}
                {supplyChain.rawMaterials.slice(0, 4).map((rm, rIdx) => {
                  const rowY = 92 + rIdx * 20;
                  return (
                    <g key={rm.id}>
                      <text x="10" y={rowY} fontSize="10" fontWeight="700" fill="#1E293B">
                        •{' '}
                        {rm.materialName.length > 14
                          ? rm.materialName.substring(0, 12) + '…'
                          : rm.materialName}
                      </text>
                      <text
                        x="154"
                        y={rowY}
                        textAnchor="end"
                        fontSize="10"
                        fontWeight="800"
                        fill="#334155"
                        className="font-mono"
                      >
                        {rm.stockUnits.toLocaleString()}
                      </text>
                    </g>
                  );
                })}
                {supplyChain.rawMaterials.length > 4 && (
                  <text x="82" y="168" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#2563EB">
                    +{supplyChain.rawMaterials.length - 4} more materials
                  </text>
                )}

                {/* On-Node What-If Control for Raw Material Wait Time */}
                {canvasMode === 'simulate' && !readOnly && (
                  <foreignObject
                    x="0"
                    y={stationHeight + 3}
                    width="164"
                    height="52"
                    className="what-if-node-control no-print overflow-visible"
                  >
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-900 text-white rounded-lg border border-emerald-500 p-1.5 shadow-lg text-[9.5px] font-mono tabular-nums space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-extrabold uppercase text-emerald-400">
                          RM Wait:
                        </span>
                        <span className="font-black text-white">
                          {leadTimeBreakdown.rawMaterialDays}d
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleWhatIfAdjustRawMaterialDays(
                              leadTimeBreakdown.rawMaterialDays - 1
                            )
                          }
                          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                        >
                          -1d
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleWhatIfAdjustRawMaterialDays(
                              leadTimeBreakdown.rawMaterialDays - 0.5
                            )
                          }
                          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                        >
                          -.5d
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="16"
                          step="0.25"
                          value={Math.min(16, leadTimeBreakdown.rawMaterialDays)}
                          onChange={(e) =>
                            handleWhatIfAdjustRawMaterialDays(parseFloat(e.target.value))
                          }
                          className="w-12 accent-emerald-400 cursor-pointer h-1.5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleWhatIfAdjustRawMaterialDays(
                              leadTimeBreakdown.rawMaterialDays + 0.5
                            )
                          }
                          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-white font-bold"
                        >
                          +.5d
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleWhatIfAdjustRawMaterialDays(
                              leadTimeBreakdown.rawMaterialDays + 1
                            )
                          }
                          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-white font-bold"
                        >
                          +1d
                        </button>
                      </div>
                    </div>
                  </foreignObject>
                )}
              </g>

              {/* Raw Inventory Triangle before Process 1 */}
              {stationCoords.length > 0 && (
                <g>
                  <line
                    x1={rawWarehousePos.x + 164}
                    y1={rawWarehousePos.y + stationHeight / 2}
                    x2={stationCoords[0].x}
                    y2={stationCoords[0].centerY}
                    stroke="#0F172A"
                    strokeWidth="2.5"
                    className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                    strokeDasharray={canvasMode === 'simulate' ? '10 6' : undefined}
                    markerEnd="url(#arrow-dark)"
                  />
                  <g
                    transform={`translate(${
                      (rawWarehousePos.x + 164 + stationCoords[0].x) / 2 - 28
                    }, ${(rawWarehousePos.y + stationHeight / 2 + stationCoords[0].centerY) / 2 - 26})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelection({ type: 'supplier', id: 'supplier' });
                    }}
                    className="cursor-pointer"
                    filter="url(#cardElevation)"
                  >
                    <polygon points="28,0 56,44 0,44" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.5" />
                    <text x="28" y="35" textAnchor="middle" fontSize="16" fontWeight="900" fill="#0F172A">
                      I
                    </text>
                    <text
                      x="28"
                      y="59"
                      textAnchor="middle"
                      fontSize="11.5"
                      fontWeight="900"
                      fill="#0F172A"
                      className="font-mono"
                    >
                      {supplyChain.totalRawMaterialUnits.toLocaleString()}
                    </text>
                    <text x="28" y="72" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748B">
                      {leadTimeBreakdown.rawMaterialDays}d RM
                    </text>
                  </g>
                </g>
              )}

              {/* ---------------- 4. PROCESS STATIONS & INTER-STATION BUFFERS ---------------- */}
              {stationCoords.map((proc, index) => {
                const bAnalysis = bottleneckByProcessId.get(proc.id);
                const ctToTaktRatio = bAnalysis?.ctToTaktRatio ?? 0;
                const ctToTaktPercent = bAnalysis?.ctToTaktPercent ?? 0;
                const rank = bAnalysis?.rank ?? index + 1;
                const isOverTakt = bAnalysis?.isOverTakt ?? false;
                const isNearTakt = bAnalysis?.isNearTakt ?? false;
                const isPrimaryBottleneck = bAnalysis?.isPrimaryBottleneck ?? false;

                // Highlight stations when automated bottleneck radar is enabled
                const isCriticalHighlight = highlightBottlenecks && isOverTakt;
                const isWarningHighlight =
                  highlightBottlenecks && !isOverTakt && (isNearTakt || isPrimaryBottleneck);
                const isBottleneck = isOverTakt || isPrimaryBottleneck;

                const isSelected = selection?.type === 'process' && selection.id === proc.id;
                const buffer = bufferCoords.find((b) => b.afterProcessId === proc.id);
                const nextStation = stationCoords[index + 1];
                const bursts = kaizenBursts.filter((k) => k.nodeId === proc.id);

                const baselineProc = effectiveBaseline?.processes.find((p) => p.id === proc.id);
                const procCtDelta = baselineProc
                  ? proc.cycleTimeSeconds - baselineProc.cycleTimeSeconds
                  : 0;

                const baselineBuf =
                  effectiveBaseline && buffer
                    ? effectiveBaseline.buffers.find(
                        (b) => b.id === buffer.id || b.afterProcessId === buffer.afterProcessId
                      )
                    : null;
                const baselineBufDays = baselineBuf
                  ? Number(
                      (
                        (baselineBuf.wipQuantity || 0) /
                        Math.max(1, effectiveBaseline?.demand.dailyDemandUnits || 1)
                      ).toFixed(2)
                    )
                  : null;
                const bufDaysDelta =
                  buffer && baselineBufDays !== null
                    ? Number((buffer.calculatedDays - baselineBufDays).toFixed(2))
                    : 0;

                // Bar meter width calculation (0 to 1.25x Takt mapped across 216px inner bar)
                const barMaxWidth = stationWidth - 24;
                const taktThresholdX = Math.round(barMaxWidth * 0.8); // 1.0x Takt sits at 80% of bar width so >1.0x overflow is clearly visible
                const barFillWidth = Math.min(
                  barMaxWidth,
                  Math.max(6, Math.round(ctToTaktRatio * taktThresholdX))
                );
                const barColor = isOverTakt
                  ? '#DC2626'
                  : isNearTakt
                  ? '#D97706'
                  : isPrimaryBottleneck
                  ? '#2563EB'
                  : '#10B981';

                return (
                  <g key={proc.id}>
                    {/* Continuous Material Flow Connectors & Inter-Process Inventory Triangle */}
                    {buffer ? (
                      <>
                        {/* Station to Inventory Triangle */}
                        <line
                          x1={proc.x + stationWidth}
                          y1={proc.centerY}
                          x2={buffer.centerX - 30}
                          y2={buffer.centerY}
                          stroke="#0F172A"
                          strokeWidth="2.5"
                          className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                          strokeDasharray={canvasMode === 'simulate' ? '10 6' : undefined}
                          markerEnd="url(#arrow-dark)"
                        />

                        {/* Inventory Triangle to Next Station */}
                        {buffer.flowType === 'pull_kanban' ? (
                          <path
                            d={`M ${buffer.centerX + 30} ${buffer.centerY} L ${
                              nextStation ? nextStation.x : finishedWarehousePos.x
                            } ${nextStation ? nextStation.centerY : finishedWarehousePos.y + stationHeight / 2}`}
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth="2.75"
                            className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                            strokeDasharray="8 5"
                            markerEnd="url(#arrow-blue)"
                          />
                        ) : (
                          <line
                            x1={buffer.centerX + 30}
                            y1={buffer.centerY}
                            x2={nextStation ? nextStation.x : finishedWarehousePos.x}
                            y2={
                              nextStation
                                ? nextStation.centerY
                                : finishedWarehousePos.y + stationHeight / 2
                            }
                            stroke="#0F172A"
                            strokeWidth="5.5"
                            strokeDasharray="8 4"
                            className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                            markerEnd="url(#arrow-dark)"
                          />
                        )}

                        {/* Draggable Inter-Process Inventory Triangle Node (Standard Lean 'I' Triangle) */}
                        <g
                          transform={`translate(${buffer.x}, ${buffer.y})`}
                          onMouseDown={(e) =>
                            startNodeDrag(e, 'buffer', buffer.id, buffer.x, buffer.y)
                          }
                          className="draggable-vsm-node cursor-pointer group"
                          filter="url(#cardElevation)"
                        >
                          <g>
                            {/* Industry-Standard Lean Inventory Triangle (▲) */}
                            <polygon
                              points="32,0 62,48 2,48"
                              fill={
                                canvasMode === 'simulate'
                                  ? '#FEF3C7'
                                  : buffer.flowType === 'pull_kanban'
                                  ? '#EFF6FF'
                                  : '#FFFFFF'
                              }
                              stroke={
                                canvasMode === 'simulate'
                                  ? '#D97706'
                                  : selection?.type === 'buffer' && selection.id === buffer.id
                                  ? '#2563EB'
                                  : buffer.flowType === 'pull_kanban'
                                  ? '#1D4ED8'
                                  : '#0F172A'
                              }
                              strokeWidth={
                                canvasMode === 'simulate' ||
                                (selection?.type === 'buffer' && selection.id === buffer.id)
                                  ? '3.25'
                                  : '2.5'
                              }
                            />
                            <text
                              x="32"
                              y="38"
                              textAnchor="middle"
                              fontSize="17"
                              fontWeight="900"
                              fill={
                                buffer.flowType === 'pull_kanban' ? '#1D4ED8' : '#0F172A'
                              }
                            >
                              I
                            </text>

                            {/* WIP Inventory Quantity below Triangle */}
                            <text
                              x="32"
                              y="64"
                              textAnchor="middle"
                              fontSize="12.5"
                              fontWeight="900"
                              fill={
                                buffer.flowType === 'pull_kanban' ? '#1D4ED8' : '#0F172A'
                              }
                              className="font-mono"
                            >
                              {buffer.wipQuantity.toLocaleString()} pcs
                            </text>

                            {/* Waiting Delay (Days) & Flow Mode Badge */}
                            <text
                              x="32"
                              y="78"
                              textAnchor="middle"
                              fontSize="10.5"
                              fontWeight="bold"
                              fill="#475569"
                            >
                              {buffer.calculatedDays}d
                              {buffer.flowType === 'pull_kanban'
                                ? ' · Kanban'
                                : buffer.flowType === 'fifo'
                                ? ' · FIFO'
                                : buffer.flowType === 'pull_conwip'
                                ? ' · CONWIP'
                                : ' delay'}
                            </text>

                            {/* On-Node What-If Wait Time Controller directly on WIP Buffer Triangle */}
                            {canvasMode === 'simulate' && !readOnly && (
                              <foreignObject
                                x="-36"
                                y="83"
                                width="136"
                                height="56"
                                className="what-if-node-control no-print overflow-visible"
                              >
                                <div
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-slate-900 text-white rounded-lg border border-amber-400 p-1.5 shadow-lg text-[9.5px] font-mono tabular-nums space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-sans font-extrabold uppercase text-amber-300">
                                      Wait: {buffer.calculatedDays}d
                                    </span>
                                    {bufDaysDelta !== 0 && (
                                      <span
                                        className={`font-black ${
                                          bufDaysDelta < 0 ? 'text-emerald-400' : 'text-rose-400'
                                        }`}
                                      >
                                        {bufDaysDelta > 0 ? `+${bufDaysDelta}d` : `${bufDaysDelta}d`}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleWhatIfAdjustBufferDays(
                                          buffer,
                                          buffer.calculatedDays - 0.5
                                        )
                                      }
                                      className="px-1 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                                      title="Reduce WIP Wait Time by 0.5 days"
                                    >
                                      -.5d
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleWhatIfAdjustBufferDays(
                                          buffer,
                                          buffer.calculatedDays - 0.1
                                        )
                                      }
                                      className="px-1 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                                      title="Reduce WIP Wait Time by 0.1 days"
                                    >
                                      -.1
                                    </button>
                                    <input
                                      type="range"
                                      min="0"
                                      max="6"
                                      step="0.1"
                                      value={Math.min(6, buffer.calculatedDays)}
                                      onChange={(e) =>
                                        handleWhatIfAdjustBufferDays(
                                          buffer,
                                          parseFloat(e.target.value)
                                        )
                                      }
                                      className="w-10 accent-amber-400 cursor-pointer h-1.5"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleWhatIfAdjustBufferDays(
                                          buffer,
                                          buffer.calculatedDays + 0.1
                                        )
                                      }
                                      className="px-1 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-white font-bold"
                                      title="Increase WIP Wait Time by 0.1 days"
                                    >
                                      +.1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleWhatIfAdjustBufferDays(
                                          buffer,
                                          buffer.calculatedDays + 0.5
                                        )
                                      }
                                      className="px-1 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-white font-bold"
                                      title="Increase WIP Wait Time by 0.5 days"
                                    >
                                      +.5d
                                    </button>
                                  </div>
                                </div>
                              </foreignObject>
                            )}
                          </g>
                        </g>
                      </>
                    ) : (
                      <line
                        x1={proc.x + stationWidth}
                        y1={proc.centerY}
                        x2={nextStation ? nextStation.x : finishedWarehousePos.x}
                        y2={
                          nextStation
                            ? nextStation.centerY
                            : finishedWarehousePos.y + stationHeight / 2
                        }
                        stroke="#0F172A"
                        strokeWidth="2.5"
                        className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                        strokeDasharray={canvasMode === 'simulate' ? '10 6' : undefined}
                        markerEnd="url(#arrow-dark)"
                      />
                    )}

                    {/* Draggable Process Station Card (240x204 with Automated Bottleneck Highlighting & C/T:Takt Meter) */}
                    <g
                      transform={`translate(${proc.x}, ${proc.y})`}
                      onMouseDown={(e) => startNodeDrag(e, 'process', proc.id, proc.x, proc.y)}
                      className="draggable-vsm-node cursor-pointer group"
                      filter="url(#cardElevation)"
                    >
                      {/* Outer Bottleneck Halo Ring when Highlighting is Active */}
                      {isCriticalHighlight && (
                        <rect
                          x="-5"
                          y="-5"
                          width={stationWidth + 10}
                          height={stationHeight + 10}
                          rx="14"
                          fill="none"
                          stroke="#EF4444"
                          strokeWidth="2.5"
                          strokeDasharray="6 3"
                          opacity="0.85"
                        />
                      )}
                      {isWarningHighlight && (
                        <rect
                          x="-4"
                          y="-4"
                          width={stationWidth + 8}
                          height={stationHeight + 8}
                          rx="13"
                          fill="none"
                          stroke={isNearTakt ? '#F59E0B' : '#3B82F6'}
                          strokeWidth="2"
                          strokeDasharray="5 3"
                          opacity="0.75"
                        />
                      )}

                      {/* Floating Top Bottleneck Callout Pill for Highest C/T vs. Takt Ratio Steps */}
                      {highlightBottlenecks && (isOverTakt || isPrimaryBottleneck || isNearTakt) && (
                        <g transform="translate(12, -23)">
                          <rect
                            x="0"
                            y="0"
                            width={stationWidth - 24}
                            height="19"
                            rx="5"
                            fill={
                              isOverTakt
                                ? '#DC2626'
                                : isNearTakt
                                ? '#D97706'
                                : '#1D4ED8'
                            }
                          />
                          <text
                            x={(stationWidth - 24) / 2}
                            y="13"
                            textAnchor="middle"
                            fontSize="9.5"
                            fontWeight="900"
                            fill="#FFFFFF"
                            letterSpacing="0.03em"
                          >
                            {isOverTakt && isPrimaryBottleneck
                              ? `⚠ #1 BOTTLENECK · ${ctToTaktRatio}x TAKT (${ctToTaktPercent}%)`
                              : isOverTakt
                              ? `⚠ OVER TAKT (#${rank}) · ${ctToTaktRatio}x TAKT (${ctToTaktPercent}%)`
                              : isPrimaryBottleneck
                              ? `★ #1 HIGHEST C/T:TAKT · ${ctToTaktRatio}x (${ctToTaktPercent}%)`
                              : `⚡ NEAR TAKT (#${rank}) · ${ctToTaktRatio}x (${ctToTaktPercent}%)`}
                          </text>
                        </g>
                      )}

                      <rect
                        x="0"
                        y="0"
                        width={stationWidth}
                        height={stationHeight}
                        rx="10"
                        fill="#FFFFFF"
                        stroke={
                          isSelected
                            ? '#2563EB'
                            : isCriticalHighlight
                            ? '#DC2626'
                            : isWarningHighlight
                            ? isNearTakt
                              ? '#D97706'
                              : '#2563EB'
                            : '#0F172A'
                        }
                        strokeWidth={
                          isSelected
                            ? '3.5'
                            : isCriticalHighlight
                            ? '3'
                            : isWarningHighlight
                            ? '2.75'
                            : '2.25'
                        }
                      />

                      {/* Process Header */}
                      <path
                        d={`M 0 10 C 0 4 4 0 10 0 L ${stationWidth - 10} 0 C ${
                          stationWidth - 4
                        } 0 ${stationWidth} 4 ${stationWidth} 10 L ${stationWidth} 44 L 0 44 Z`}
                        fill={
                          isCriticalHighlight
                            ? '#FEF2F2'
                            : isWarningHighlight
                            ? isNearTakt
                              ? '#FFFBEB'
                              : '#EFF6FF'
                            : '#F8FAFC'
                        }
                      />
                      <line
                        x1="0"
                        y1="44"
                        x2={stationWidth}
                        y2="44"
                        stroke={
                          isCriticalHighlight
                            ? '#FCA5A5'
                            : isWarningHighlight
                            ? isNearTakt
                              ? '#FCD34D'
                              : '#93C5FD'
                            : '#0F172A'
                        }
                        strokeWidth="1.75"
                      />

                      <text
                        x={stationWidth / 2}
                        y="19"
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="900"
                        fill={
                          isCriticalHighlight
                            ? '#991B1B'
                            : isWarningHighlight
                            ? isNearTakt
                              ? '#92400E'
                              : '#1E3A8A'
                            : '#0F172A'
                        }
                        letterSpacing="0.03em"
                      >
                        {proc.name.toUpperCase()}
                      </text>

                      {/* Operator Concentric Symbol */}
                      <g transform="translate(12, 24)">
                        <circle cx="6.5" cy="6.5" r="6.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.75" />
                        <circle cx="6.5" cy="6.5" r="2.5" fill="#0F172A" />
                        <text x="18" y="10.5" fontSize="11" fontWeight="extrabold" fill="#334155">
                          {proc.operatorsCount} Op
                        </text>
                      </g>

                      {/* Header Bottleneck Rank & Status Pill */}
                      {isOverTakt ? (
                        <g transform={`translate(${stationWidth - 104}, 24)`}>
                          <rect x="0" y="0" width="92" height="15" rx="4" fill="#DC2626" />
                          <text x="46" y="10.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#FFFFFF">
                            {isPrimaryBottleneck ? '#1 BOTTLENECK' : `BOTTLENECK #${rank}`}
                          </text>
                        </g>
                      ) : isNearTakt ? (
                        <g transform={`translate(${stationWidth - 98}, 24)`}>
                          <rect x="0" y="0" width="86" height="15" rx="4" fill="#FEF3C7" stroke="#D97706" strokeWidth="1.25" />
                          <text x="43" y="10.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#92400E">
                            {isPrimaryBottleneck ? '#1 NEAR TAKT' : `NEAR TAKT #${rank}`}
                          </text>
                        </g>
                      ) : isPrimaryBottleneck ? (
                        <g transform={`translate(${stationWidth - 98}, 24)`}>
                          <rect x="0" y="0" width="86" height="15" rx="4" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.25" />
                          <text x="43" y="10.5" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#1D4ED8">
                            #1 PACEMAKER
                          </text>
                        </g>
                      ) : (
                        <g transform={`translate(${stationWidth - 84}, 24)`}>
                          <rect x="0" y="0" width="72" height="15" rx="4" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.25" />
                          <text x="36" y="10.5" textAnchor="middle" fontSize="8.5" fontWeight="extrabold" fill="#047857">
                            RANK #{rank} OK
                          </text>
                        </g>
                      )}

                      {/* Standard 4-Row Data Box Table + 5th Row C/T vs. Takt Ratio Meter */}
                      <g transform="translate(0, 44)">
                        <line x1="0" y1="31" x2={stationWidth} y2="31" stroke="#E2E8F0" strokeWidth="1.25" />
                        <line x1="0" y1="62" x2={stationWidth} y2="62" stroke="#E2E8F0" strokeWidth="1.25" />
                        <line x1="0" y1="93" x2={stationWidth} y2="93" stroke="#E2E8F0" strokeWidth="1.25" />
                        <line x1="0" y1="124" x2={stationWidth} y2="124" stroke="#CBD5E1" strokeWidth="1.5" />

                        <text x="12" y="20" fontSize="11.5" fontWeight="600" fill="#475569">
                          Cycle Time (CT)
                        </text>
                        <text
                          x={stationWidth - 12}
                          y="20"
                          textAnchor="end"
                          fontSize="13.5"
                          fontWeight="900"
                          fill={
                            isOverTakt ? '#DC2626' : isNearTakt ? '#B45309' : '#0F172A'
                          }
                          className="font-mono"
                        >
                          {proc.cycleTimeSeconds}s ({ctToTaktRatio}x)
                        </text>

                        <text x="12" y="51" fontSize="11.5" fontWeight="600" fill="#475569">
                          Changeover (CO)
                        </text>
                        <text
                          x={stationWidth - 12}
                          y="51"
                          textAnchor="end"
                          fontSize="12.5"
                          fontWeight="extrabold"
                          fill="#1E293B"
                          className="font-mono"
                        >
                          {proc.changeoverSeconds ? `${proc.changeoverSeconds}s` : '0s'}
                        </text>

                        <text x="12" y="82" fontSize="11.5" fontWeight="600" fill="#475569">
                          Uptime (UT)
                        </text>
                        <text
                          x={stationWidth - 12}
                          y="82"
                          textAnchor="end"
                          fontSize="12.5"
                          fontWeight="extrabold"
                          fill="#1E293B"
                          className="font-mono"
                        >
                          {proc.uptimePercent}%
                        </text>

                        <text x="12" y="113" fontSize="11.5" fontWeight="600" fill="#475569">
                          Quality Rate
                        </text>
                        <text
                          x={stationWidth - 12}
                          y="113"
                          textAnchor="end"
                          fontSize="12.5"
                          fontWeight="extrabold"
                          fill="#059669"
                          className="font-mono"
                        >
                          {proc.qualityPercent}%
                        </text>

                        {/* 5th Row: Automated C/T vs. Takt Ratio Utilization Bar */}
                        <g transform="translate(12, 129)">
                          <text x="0" y="11" fontSize="9.5" fontWeight="800" fill="#475569">
                            C/T : TAKT RATIO
                          </text>
                          <text
                            x={barMaxWidth}
                            y="11"
                            textAnchor="end"
                            fontSize="10"
                            fontWeight="900"
                            fill={barColor}
                            className="font-mono"
                          >
                            {ctToTaktPercent}% (
                            {(bAnalysis?.deltaFromTaktSeconds ?? 0) > 0
                              ? `+${bAnalysis?.deltaFromTaktSeconds}s`
                              : `${bAnalysis?.deltaFromTaktSeconds ?? 0}s`}
                            )
                          </text>

                          {/* Bar Track */}
                          <rect
                            x="0"
                            y="16"
                            width={barMaxWidth}
                            height="8"
                            rx="4"
                            fill="#F1F5F9"
                            stroke="#CBD5E1"
                            strokeWidth="0.75"
                          />
                          {/* Bar Fill */}
                          <rect
                            x="0"
                            y="16"
                            width={barFillWidth}
                            height="8"
                            rx="4"
                            fill={barColor}
                          />
                          {/* 1.0x Takt Reference Threshold Tick */}
                          <line
                            x1={taktThresholdX}
                            y1="14"
                            x2={taktThresholdX}
                            y2="26"
                            stroke="#0F172A"
                            strokeWidth="1.75"
                          />
                        </g>
                      </g>

                      {/* On-Node What-If Cycle Time Controller Docked on Process Card */}
                      {canvasMode === 'simulate' && !readOnly && (
                        <foreignObject
                          x="0"
                          y={stationHeight + 3}
                          width={stationWidth}
                          height="56"
                          className="what-if-node-control no-print overflow-visible"
                        >
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-900 text-white rounded-lg border border-emerald-500 p-1.5 shadow-lg text-[10px] font-mono tabular-nums space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-sans font-extrabold uppercase text-emerald-400">
                                What-If C/T: {proc.cycleTimeSeconds}s
                              </span>
                              <div className="flex items-center gap-1">
                                {procCtDelta !== 0 && (
                                  <span
                                    className={`font-black px-1 rounded ${
                                      procCtDelta < 0
                                        ? 'bg-emerald-950 text-emerald-300'
                                        : 'bg-rose-950 text-rose-300'
                                    }`}
                                  >
                                    {procCtDelta > 0 ? `+${procCtDelta}s` : `${procCtDelta}s`}
                                  </span>
                                )}
                                {isOverTakt && metrics.taktTimeSeconds > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleWhatIfAdjustCycleTime(
                                        proc.id,
                                        Math.floor(metrics.taktTimeSeconds)
                                      )
                                    }
                                    className="px-1 py-0.2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-[9px]"
                                    title={`Set Cycle Time to Takt (${Math.floor(
                                      metrics.taktTimeSeconds
                                    )}s)`}
                                  >
                                    =Takt
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleWhatIfAdjustCycleTime(proc.id, proc.cycleTimeSeconds - 5)
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                                title="Reduce Cycle Time by 5 seconds"
                              >
                                -5s
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleWhatIfAdjustCycleTime(proc.id, proc.cycleTimeSeconds - 1)
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                                title="Reduce Cycle Time by 1 second"
                              >
                                -1s
                              </button>
                              <input
                                type="range"
                                min="5"
                                max={Math.max(160, Math.round((metrics.taktTimeSeconds || 90) * 1.6))}
                                step="1"
                                value={proc.cycleTimeSeconds}
                                onChange={(e) =>
                                  handleWhatIfAdjustCycleTime(
                                    proc.id,
                                    parseInt(e.target.value, 10)
                                  )
                                }
                                className="w-20 accent-emerald-400 cursor-pointer h-1.5"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleWhatIfAdjustCycleTime(proc.id, proc.cycleTimeSeconds + 1)
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-600 text-white font-bold"
                                title="Increase Cycle Time by 1 second"
                              >
                                +1s
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleWhatIfAdjustCycleTime(proc.id, proc.cycleTimeSeconds + 5)
                                }
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-600 text-white font-bold"
                                title="Increase Cycle Time by 5 seconds"
                              >
                                +5s
                              </button>
                            </div>
                          </div>
                        </foreignObject>
                      )}
                    </g>

                    {/* Draggable Kaizen Bursts attached to station */}
                    {bursts.map((k, bIdx) => {
                      const kx = k.x ?? proc.centerX - 20 + bIdx * 42;
                      const ky = k.y ?? proc.y - 54;
                      return (
                        <g
                          key={k.id}
                          transform={`translate(${kx}, ${ky})`}
                          onMouseDown={(e) => startNodeDrag(e, 'kaizen', k.id, kx, ky)}
                          className="draggable-vsm-node cursor-pointer group"
                          filter="url(#cardElevation)"
                        >
                          <path
                            d="M 0,-23 L 5,-10 L 18,-18 L 13,-5 L 26,-3 L 15,6 L 23,18 L 10,14 L 8,24 L 0,15 L -8,24 L -10,14 L -23,18 L -15,6 L -26,-3 L -13,-5 L -18,-18 L -5,-10 Z"
                            fill={k.status === 'implemented' ? '#10B981' : '#FBBF24'}
                            stroke={
                              selection?.type === 'kaizen' && selection.id === k.id
                                ? '#2563EB'
                                : '#B45309'
                            }
                            strokeWidth="2"
                            className="group-hover:scale-110 transition-transform"
                          />
                          <text
                            x="0"
                            y="3.5"
                            textAnchor="middle"
                            fontSize="8.5"
                            fontWeight="900"
                            fill="#0F172A"
                          >
                            KAIZEN
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Finished Goods Warehouse (Draggable + Wider + Larger Font) */}
              <g
                transform={`translate(${finishedWarehousePos.x}, ${finishedWarehousePos.y})`}
                onMouseDown={(e) =>
                  startNodeDrag(
                    e,
                    'finishedWarehouse',
                    'finishedWarehouse',
                    finishedWarehousePos.x,
                    finishedWarehousePos.y
                  )
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setSelection({ type: 'customer', id: 'customer' });
                }}
                className="draggable-vsm-node cursor-move group"
                filter="url(#cardElevation)"
              >
                <rect
                  x="0"
                  y="0"
                  width="124"
                  height={stationHeight}
                  rx="9"
                  fill="#FFFFFF"
                  stroke={
                    canvasMode === 'simulate'
                      ? '#2563EB'
                      : selection?.type === 'customer'
                      ? '#2563EB'
                      : '#0F172A'
                  }
                  strokeWidth={
                    canvasMode === 'simulate' || selection?.type === 'customer' ? '3' : '2.25'
                  }
                />
                <line x1="0" y1="34" x2="124" y2="34" stroke="#0F172A" strokeWidth="1.75" />
                <rect x="12" y="120" width="26" height="44" fill="#F1F5F9" stroke="#0F172A" strokeWidth="1.5" />
                <text x="62" y="22" textAnchor="middle" fontSize="11.5" fontWeight="900" fill="#0F172A">
                  WAREHOUSE
                </text>
                <text x="62" y="58" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#475569">
                  Finished Goods
                </text>
                <text
                  x="62"
                  y="84"
                  textAnchor="middle"
                  fontSize="16.5"
                  fontWeight="900"
                  fill="#059669"
                  className="font-mono"
                >
                  {Math.round(demand.dailyDemandUnits * demand.shippingHoldingDays).toLocaleString()}
                </text>
                <text x="62" y="104" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#64748B">
                  {demand.shippingHoldingDays}d hold
                </text>

                {/* On-Node What-If Controller for Finished Goods Holding Wait Time */}
                {canvasMode === 'simulate' && !readOnly && (
                  <foreignObject
                    x="-12"
                    y={stationHeight + 3}
                    width="148"
                    height="52"
                    className="what-if-node-control no-print overflow-visible"
                  >
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-900 text-white rounded-lg border border-blue-400 p-1.5 shadow-lg text-[9.5px] font-mono tabular-nums space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-extrabold uppercase text-blue-300">
                          FG Hold:
                        </span>
                        <span className="font-black text-white">
                          {demand.shippingHoldingDays}d
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleWhatIfAdjustFinishedGoodsDays(demand.shippingHoldingDays - 1)
                          }
                          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                        >
                          -1d
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleWhatIfAdjustFinishedGoodsDays(
                              demand.shippingHoldingDays - 0.5
                            )
                          }
                          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold"
                        >
                          -.5
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="12"
                          step="0.25"
                          value={Math.min(12, demand.shippingHoldingDays)}
                          onChange={(e) =>
                            handleWhatIfAdjustFinishedGoodsDays(parseFloat(e.target.value))
                          }
                          className="w-10 accent-blue-400 cursor-pointer h-1.5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleWhatIfAdjustFinishedGoodsDays(
                              demand.shippingHoldingDays + 0.5
                            )
                          }
                          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-white font-bold"
                        >
                          +.5
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleWhatIfAdjustFinishedGoodsDays(demand.shippingHoldingDays + 1)
                          }
                          className="px-1 py-0.5 rounded bg-slate-800 hover:bg-amber-600 text-white font-bold"
                        >
                          +1d
                        </button>
                      </div>
                    </div>
                  </foreignObject>
                )}
              </g>

              {/* Outbound Customer Shipment Line & Truck */}
              {(() => {
                const outTruckX = Math.round(
                  (finishedWarehousePos.x + 62 + customerPos.x + 74) / 2 - 44
                );
                const outTruckY = Math.round(
                  (finishedWarehousePos.y + customerPos.y + 92) / 2 - 15
                );
                return (
                  <>
                    <path
                      d={`M ${finishedWarehousePos.x + 62} ${finishedWarehousePos.y} L ${
                        customerPos.x + 74
                      } ${customerPos.y + 92}`}
                      stroke="#0F172A"
                      strokeWidth="2.25"
                      className={canvasMode === 'simulate' ? 'animate-vsm-flow' : ''}
                      strokeDasharray={canvasMode === 'simulate' ? '8 6' : undefined}
                      markerEnd="url(#arrow-dark)"
                    />
                    <g transform={`translate(${outTruckX}, ${outTruckY})`} filter="url(#cardElevation)">
                      <rect x="0" y="0" width="88" height="30" rx="6" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.75" />
                      <rect x="62" y="7" width="19" height="16" rx="2" fill="#D1FAE5" stroke="#0F172A" strokeWidth="1.25" />
                      <circle cx="20" cy="30" r="4.5" fill="#0F172A" />
                      <circle cx="68" cy="30" r="4.5" fill="#0F172A" />
                      <text x="31" y="19" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0F172A" className="font-mono">
                        {demand.shippingHoldingDays} DAYS
                      </text>
                    </g>
                  </>
                );
              })()}

              {/* ---------------- 4B. USER-PLACED CUSTOM LEAN SYMBOLS ---------------- */}
              {customNodes.map((node) => {
                const isSelected = selection?.type === 'custom' && selection.id === node.id;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseDown={(e) => startNodeDrag(e, 'custom', node.id, node.x, node.y)}
                    className="draggable-vsm-node cursor-pointer group"
                    filter="url(#cardElevation)"
                  >
                    <rect
                      x="0"
                      y="0"
                      width="138"
                      height="52"
                      rx="8"
                      fill={node.symbolType === 'note_box' ? '#FEF3C7' : '#FFFFFF'}
                      stroke={isSelected ? '#2563EB' : '#0F172A'}
                      strokeWidth={isSelected ? '2.75' : '2'}
                    />
                    <text x="69" y="22" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0F172A">
                      {node.symbolType === 'heijunka_box' && 'OXOX · '}
                      {node.symbolType === 'go_see' && '👓 '}
                      {node.label}
                    </text>
                    <text x="69" y="38" textAnchor="middle" fontSize="10" fontWeight="600" fill="#64748B">
                      {node.subLabel || 'Custom Lean Node'}
                    </text>
                  </g>
                );
              })}

              {/* ---------------- 5. SYNCHRONIZED SAWTOOTH TIMELINE (DYNAMIC POSITION & AMPLITUDE) ---------------- */}
              {(() => {
                const midY = 562;
                const taktDepth = 34;
                const taktRefY = midY + taktDepth;
                const sortedStations = [...stationCoords].sort((a, b) => a.x - b.x);
                const firstStation = sortedStations[0];
                const lastStation = sortedStations[sortedStations.length - 1];

                // Raw Material NVA Peak Geometry (aligned with Raw Material Warehouse & Raw Inventory Triangle)
                const rawDays = Number(
                  (supplyChain.totalRawMaterialUnits / Math.max(1, demand.dailyDemandUnits)).toFixed(2)
                );
                const rawPeakHeight = Math.min(44, Math.max(14, Math.round(12 + rawDays * 3.2)));
                const rawPeakY = midY - rawPeakHeight;
                const rawStartX = Math.max(204, Math.min(rawWarehousePos.x + 164, (firstStation?.x ?? startX) - 28));
                const rawEndX = firstStation ? Math.max(rawStartX + 24, firstStation.x) : startX;
                const rawTriangleX = (rawWarehousePos.x + 164 + (firstStation?.x ?? startX)) / 2;

                // Finished Goods NVA Peak Geometry (aligned with Last Station & Finished Goods Warehouse)
                const fgDays = Number((demand.shippingHoldingDays || 0).toFixed(2));
                const fgPeakHeight = Math.min(44, Math.max(14, Math.round(12 + fgDays * 3.2)));
                const fgPeakY = midY - fgPeakHeight;
                const fgStartX = lastStation ? lastStation.x + stationWidth : startX + stationWidth;
                const fgEndX = Math.max(fgStartX + 54, finishedWarehousePos.x + 62);

                return (
                  <g>
                    {/* Legend Block (Left) */}
                    <g transform="translate(36, 526)">
                      <rect x="0" y="0" width="160" height="40" rx="6" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.75" />
                      <text x="80" y="17" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0F172A">
                        NON-VALUE ADDED
                      </text>
                      <text x="80" y="31" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#64748B">
                        Inventory &amp; Wait (Days)
                      </text>

                      <rect x="0" y="46" width="160" height="40" rx="6" fill="#ECFDF5" stroke="#059669" strokeWidth="1.75" />
                      <text x="80" y="63" textAnchor="middle" fontSize="11" fontWeight="900" fill="#047857">
                        VALUE ADDED
                      </text>
                      <text x="80" y="77" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="#059669">
                        Process Time (Seconds)
                      </text>
                    </g>

                    {/* Continuous Baseline & Customer Takt Reference Line across Timeline */}
                    <line
                      x1={rawStartX}
                      y1={midY}
                      x2={fgEndX}
                      y2={midY}
                      stroke="#CBD5E1"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={rawStartX}
                      y1={taktRefY}
                      x2={fgEndX}
                      y2={taktRefY}
                      stroke="#F59E0B"
                      strokeWidth="1.25"
                      strokeDasharray="5 4"
                      opacity="0.7"
                    />
                    <text
                      x={rawStartX + 4}
                      y={taktRefY - 3}
                      fontSize="8.5"
                      fontWeight="800"
                      fill="#B45309"
                      className="font-mono"
                    >
                      TAKT LINE ({metrics.taktTimeSeconds}s)
                    </text>

                    {/* 1. Raw Material Wait Peak (Synchronized with Raw Material Warehouse & Triangle) */}
                    <line
                      x1={rawTriangleX}
                      y1={(rawWarehousePos.y + stationHeight / 2 + (firstStation?.centerY ?? defaultStationY + stationHeight / 2)) / 2 + 28}
                      x2={(rawStartX + rawEndX) / 2}
                      y2={rawPeakY}
                      stroke="#CBD5E1"
                      strokeWidth="1.25"
                      strokeDasharray="4 4"
                    />
                    <rect
                      x={rawStartX}
                      y={rawPeakY}
                      width={Math.max(12, rawEndX - rawStartX)}
                      height={rawPeakHeight}
                      fill="#FEF3C7"
                      opacity="0.45"
                    />
                    <path
                      d={`M ${rawStartX} ${midY} L ${rawStartX} ${rawPeakY} L ${rawEndX} ${rawPeakY} L ${rawEndX} ${midY}`}
                      stroke="#0F172A"
                      strokeWidth="2.75"
                      fill="none"
                    />
                    <text
                      x={(rawStartX + rawEndX) / 2}
                      y={rawPeakY - 6}
                      textAnchor="middle"
                      fontSize="12.5"
                      fontWeight="900"
                      fill="#0F172A"
                      className="font-mono"
                    >
                      {rawDays}d
                    </text>

                    {/* 2. Process Station VA Troughs & Inter-Process Buffer NVA Peaks */}
                    {sortedStations.map((coord, idx) => {
                      const nextCoord = sortedStations[idx + 1];
                      const buffer =
                        bufferCoords.find((b) => b.afterProcessId === coord.id) ||
                        bufferCoords[idx];
                      const bInfo = bottleneckByProcessId.get(coord.id);
                      const isOver = highlightBottlenecks && (bInfo?.isOverTakt ?? false);
                      const isPrimary = highlightBottlenecks && (bInfo?.isPrimaryBottleneck ?? false);

                      // Dynamic VA Trough Depth: scales directly with station Cycle Time vs. Takt Time
                      const ctRatio = coord.cycleTimeSeconds / Math.max(1, metrics.taktTimeSeconds);
                      const vaDepth = Math.min(
                        64,
                        Math.max(14, Math.round(ctRatio * taktDepth))
                      );
                      const troughY = midY + vaDepth;

                      // Dynamic Proportional Fill Width inside the Station Trough
                      const fillRatio = Math.min(1, Math.max(0.08, ctRatio / 1.25));
                      const fillWidth = Math.round(stationWidth * fillRatio);
                      const strokeColor = isOver
                        ? '#DC2626'
                        : isPrimary
                        ? '#D97706'
                        : '#059669';
                      const areaFillColor = isOver
                        ? '#FEE2E2'
                        : isPrimary
                        ? '#FEF3C7'
                        : '#D1FAE5';

                      // Inter-Process NVA Peak Geometry
                      const nvaStartX = coord.x + stationWidth;
                      const nvaEndX = nextCoord
                        ? Math.max(nvaStartX + 24, nextCoord.x)
                        : fgEndX;
                      const bufDays = buffer ? buffer.calculatedDays : 0;
                      const bufPeakHeight = Math.min(
                        46,
                        Math.max(12, Math.round(12 + bufDays * 4.2))
                      );
                      const bufPeakY = midY - bufPeakHeight;

                      return (
                        <g key={`saw-${coord.id}`}>
                          {/* Vertical Synchronization Projection Guides from Station Edges to Sawtooth Trough */}
                          <line
                            x1={coord.x}
                            y1={coord.y + stationHeight}
                            x2={coord.x}
                            y2={troughY}
                            stroke="#CBD5E1"
                            strokeWidth="1.25"
                            strokeDasharray="4 4"
                          />
                          <line
                            x1={coord.x + stationWidth}
                            y1={coord.y + stationHeight}
                            x2={coord.x + stationWidth}
                            y2={troughY}
                            stroke="#CBD5E1"
                            strokeWidth="1.25"
                            strokeDasharray="4 4"
                          />

                          {/* Dynamic Shaded Value-Added Trough Block */}
                          <rect
                            x={coord.x}
                            y={midY}
                            width={stationWidth}
                            height={vaDepth}
                            fill={areaFillColor}
                            opacity="0.55"
                          />
                          {/* Dynamic Proportional Cycle-Time Fill Bar along Bottom of Trough */}
                          <rect
                            x={coord.x}
                            y={troughY - 5}
                            width={fillWidth}
                            height={5}
                            fill={strokeColor}
                            opacity="0.35"
                          />

                          {/* Sawtooth VA Trough Path (Drops from midY to troughY, spans stationWidth, rises back to midY) */}
                          <path
                            d={`M ${coord.x} ${midY} L ${coord.x} ${troughY} L ${
                              coord.x + stationWidth
                            } ${troughY} L ${coord.x + stationWidth} ${midY}`}
                            stroke={strokeColor}
                            strokeWidth={isOver || isPrimary ? '4.5' : '3.5'}
                            fill="none"
                          />

                          {/* Station Cycle Time & Takt Ratio Readout */}
                          <text
                            x={coord.x + stationWidth / 2}
                            y={troughY + 17}
                            textAnchor="middle"
                            fontSize="13"
                            fontWeight="900"
                            fill={isOver ? '#DC2626' : isPrimary ? '#B45309' : '#047857'}
                            className="font-mono"
                          >
                            {coord.cycleTimeSeconds} sec
                          </text>
                          {highlightBottlenecks && bInfo && (
                            <text
                              x={coord.x + stationWidth / 2}
                              y={troughY + 30}
                              textAnchor="middle"
                              fontSize="10"
                              fontWeight="800"
                              fill={isOver ? '#DC2626' : isPrimary ? '#B45309' : '#64748B'}
                              className="font-mono"
                            >
                              {bInfo.ctToTaktRatio}x Takt (#{bInfo.rank})
                            </text>
                          )}

                          {/* Inter-Station NVA Peak (or Final FG Peak after Last Station) */}
                          {nextCoord ? (
                            <>
                              {buffer && (
                                <line
                                  x1={buffer.centerX}
                                  y1={buffer.y + 52}
                                  x2={(nvaStartX + nvaEndX) / 2}
                                  y2={bufPeakY}
                                  stroke="#CBD5E1"
                                  strokeWidth="1.25"
                                  strokeDasharray="4 4"
                                />
                              )}
                              <rect
                                x={nvaStartX}
                                y={bufPeakY}
                                width={Math.max(12, nvaEndX - nvaStartX)}
                                height={bufPeakHeight}
                                fill="#FEF3C7"
                                opacity="0.5"
                              />
                              <path
                                d={`M ${nvaStartX} ${midY} L ${nvaStartX} ${bufPeakY} L ${nvaEndX} ${bufPeakY} L ${nvaEndX} ${midY}`}
                                stroke="#0F172A"
                                strokeWidth="2.75"
                                fill="none"
                              />
                              <text
                                x={(nvaStartX + nvaEndX) / 2}
                                y={bufPeakY - 6}
                                textAnchor="middle"
                                fontSize="12.5"
                                fontWeight="900"
                                fill="#0F172A"
                                className="font-mono"
                              >
                                {bufDays}d
                              </text>
                            </>
                          ) : (
                            <>
                              {/* Synchronization Projection Guide from Finished Goods Warehouse to Final NVA Peak */}
                              <line
                                x1={finishedWarehousePos.x + 62}
                                y1={finishedWarehousePos.y + stationHeight}
                                x2={fgEndX}
                                y2={fgPeakY}
                                stroke="#CBD5E1"
                                strokeWidth="1.25"
                                strokeDasharray="4 4"
                              />
                              <rect
                                x={fgStartX}
                                y={fgPeakY}
                                width={Math.max(16, fgEndX - fgStartX)}
                                height={fgPeakHeight}
                                fill="#DBEAFE"
                                opacity="0.5"
                              />
                              <path
                                d={`M ${fgStartX} ${midY} L ${fgStartX} ${fgPeakY} L ${fgEndX} ${fgPeakY} L ${fgEndX} ${midY}`}
                                stroke="#0F172A"
                                strokeWidth="2.75"
                                fill="none"
                              />
                              <text
                                x={(fgStartX + fgEndX) / 2}
                                y={fgPeakY - 6}
                                textAnchor="middle"
                                fontSize="12.5"
                                fontWeight="900"
                                fill="#0F172A"
                                className="font-mono"
                              >
                                {fgDays}d
                              </text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })()}

              {/* ---------------- 6. MODERN EXECUTIVE SCORECARD (BOTTOM RIGHT) ---------------- */}
              <g
                transform={`translate(${canvasWidth - 395}, 498)`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelection({ type: 'metrics', id: 'metrics' });
                }}
                className="cursor-pointer"
                filter="url(#cardElevation)"
              >
                <rect
                  x="0"
                  y="0"
                  width="375"
                  height="248"
                  rx="10"
                  fill="#FFFFFF"
                  stroke={selection?.type === 'metrics' ? '#2563EB' : '#0F172A'}
                  strokeWidth={selection?.type === 'metrics' ? '3' : '2.25'}
                />
                <path
                  d="M 0 10 C 0 4 4 0 10 0 L 365 0 C 371 0 375 4 375 10 L 375 34 L 0 34 Z"
                  fill="#0F172A"
                />
                <text
                  x="187"
                  y="22"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="900"
                  fill="#FFFFFF"
                  letterSpacing="0.06em"
                >
                  VALUE STREAM PERFORMANCE SUMMARY
                </text>

                <g transform="translate(18, 54)">
                  <text x="0" y="0" fontSize="11.5" fontWeight="600" fill="#475569">
                    Total Lead Time (Order → Ship):
                  </text>
                  <text
                    x="338"
                    y="0"
                    textAnchor="end"
                    fontSize="13.5"
                    fontWeight="900"
                    fill="#0F172A"
                    className="font-mono"
                  >
                    {leadTimeBreakdown.totalLeadTimeDays} days
                  </text>

                  <text x="0" y="23" fontSize="11.5" fontWeight="600" fill="#475569">
                    Total Storage Time (Raw + WIP + FG):
                  </text>
                  <text
                    x="338"
                    y="23"
                    textAnchor="end"
                    fontSize="13"
                    fontWeight="extrabold"
                    fill="#0F172A"
                    className="font-mono"
                  >
                    {leadTimeBreakdown.totalStorageDays} days
                  </text>

                  <text x="0" y="46" fontSize="11.5" fontWeight="600" fill="#475569">
                    Customer Takt Time (Ta ÷ Td):
                  </text>
                  <text
                    x="338"
                    y="46"
                    textAnchor="end"
                    fontSize="13.5"
                    fontWeight="900"
                    fill="#D97706"
                    className="font-mono"
                  >
                    {metrics.taktTimeSeconds} seconds
                  </text>

                  <text x="0" y="69" fontSize="11.5" fontWeight="600" fill="#475569">
                    Total Process Time (Value Added):
                  </text>
                  <text
                    x="338"
                    y="69"
                    textAnchor="end"
                    fontSize="13"
                    fontWeight="extrabold"
                    fill="#059669"
                    className="font-mono"
                  >
                    {leadTimeBreakdown.totalValueAddedSeconds} seconds
                  </text>

                  <text x="0" y="92" fontSize="11.5" fontWeight="600" fill="#475569">
                    Line Cycle Time ({metrics.totalOperators} Operators):
                  </text>
                  <text
                    x="338"
                    y="92"
                    textAnchor="end"
                    fontSize="13.5"
                    fontWeight="900"
                    fill={metrics.cycleTimeSeconds > metrics.taktTimeSeconds ? '#DC2626' : '#059669'}
                    className="font-mono"
                  >
                    {metrics.cycleTimeSeconds} seconds
                  </text>

                  <text x="0" y="115" fontSize="11.5" fontWeight="600" fill="#475569">
                    Process Cycle Efficiency (PCE):
                  </text>
                  <text
                    x="338"
                    y="115"
                    textAnchor="end"
                    fontSize="13"
                    fontWeight="extrabold"
                    fill="#2563EB"
                    className="font-mono"
                  >
                    {leadTimeBreakdown.calendarPcePercent}% (Shift: {leadTimeBreakdown.shiftPcePercent}%)
                  </text>

                  {/* Status Callout */}
                  <g transform="translate(0, 130)">
                    <rect
                      x="0"
                      y="0"
                      width="338"
                      height="48"
                      rx="6"
                      fill={metrics.isDemandMet ? '#ECFDF5' : '#FEF2F2'}
                      stroke={metrics.isDemandMet ? '#10B981' : '#DC2626'}
                      strokeWidth="1.75"
                    />
                    <text
                      x="169"
                      y="20"
                      textAnchor="middle"
                      fontSize="11.5"
                      fontWeight="900"
                      fill={metrics.isDemandMet ? '#047857' : '#991B1B'}
                    >
                      {metrics.isDemandMet
                        ? '✓ DEMAND MET: Line Balanced Below Takt'
                        : '⚠ BOTTLENECK: Line Exceeds Customer Takt'}
                    </text>
                    <text
                      x="169"
                      y="36"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill={metrics.isDemandMet ? '#065F46' : '#B91C1C'}
                    >
                      {metrics.isDemandMet
                        ? 'Continuous flow target condition achieved'
                        : `Constraint: ${metrics.bottleneckProcessName} (${metrics.maxCycleTimeSeconds}s > ${metrics.taktTimeSeconds}s)`}
                    </text>
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </div>

        {/* ==================== RIGHT INTERACTIVE PROPERTY INSPECTOR DRAWER ==================== */}
        {selection &&
          (!readOnly || selection.type === 'metrics' || selection.type === 'bottlenecks') &&
          !isPrinting && (
          <div className="no-print w-92 bg-white border-l border-slate-200 shadow-xl p-4 flex flex-col justify-between overflow-y-auto z-30 animate-in slide-in-from-right-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                    {selection.type === 'metrics'
                      ? 'Live Lean Formula Engine'
                      : selection.type === 'bottlenecks'
                      ? 'Automated Bottleneck Detection'
                      : 'Live Canvas Editor'}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 capitalize">
                    {selection.type === 'supplier'
                      ? 'Vendors & Raw Materials'
                      : selection.type === 'metrics'
                      ? 'Lead Time & PCE Calculation'
                      : selection.type === 'bottlenecks'
                      ? 'Cycle Time vs. Takt Time Ratios'
                      : `Edit ${selection.type} Node`}
                  </h3>
                </div>
                <button
                  onClick={() => setSelection(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              {/* 1. EDIT PROCESS STATION */}
              {selectedProcess && (
                <div className="space-y-3.5 text-xs">
                  {/* Automated Bottleneck Status Card for Selected Process */}
                  {(() => {
                    const bInfo = bottleneckByProcessId.get(selectedProcess.id);
                    if (!bInfo) return null;
                    return (
                      <div
                        className={`p-2.5 rounded-xl border ${
                          bInfo.isOverTakt
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : bInfo.isNearTakt
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : bInfo.isPrimaryBottleneck
                            ? 'bg-blue-50 border-blue-200 text-blue-900'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>
                            Rank #{bInfo.rank} of {processes.length} ·{' '}
                            {bInfo.isOverTakt
                              ? 'Critical Bottleneck'
                              : bInfo.isNearTakt
                              ? 'Near-Takt Constraint'
                              : bInfo.isPrimaryBottleneck
                              ? 'Primary Pacemaker'
                              : 'Balanced Step'}
                          </span>
                          <span className="font-mono text-xs font-black">
                            {bInfo.ctToTaktRatio}x Takt ({bInfo.ctToTaktPercent}%)
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] opacity-85 font-mono">
                          <span>Effective CT (UT×Q): {bInfo.effectiveCycleTimeSeconds}s</span>
                          <span>
                            Delta:{' '}
                            {bInfo.deltaFromTaktSeconds > 0
                              ? `+${bInfo.deltaFromTaktSeconds}s over Takt`
                              : `${bInfo.deltaFromTaktSeconds}s vs Takt`}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Station Name</label>
                    <input
                      type="text"
                      value={selectedProcess.name}
                      onChange={(e) => {
                        const updated = processes.map((p) =>
                          p.id === selectedProcess.id ? { ...p, name: e.target.value } : p
                        );
                        onUpdateMap({ ...map, processes: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Cycle Time Slider (Synchronized with Sawtooth Timeline & Coupled Queue Option) */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Cycle Time (CT)</span>
                      <span
                        className={`font-mono font-bold text-sm ${
                          selectedProcess.cycleTimeSeconds > metrics.taktTimeSeconds
                            ? 'text-red-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {selectedProcess.cycleTimeSeconds}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max={Math.max(200, metrics.taktTimeSeconds * 2)}
                      value={selectedProcess.cycleTimeSeconds}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleWhatIfAdjustCycleTime(selectedProcess.id, val);
                      }}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>5s</span>
                      <span>Takt: {metrics.taktTimeSeconds}s</span>
                      <span>{Math.max(200, metrics.taktTimeSeconds * 2)}s</span>
                    </div>
                    <label className="pt-1 flex items-center justify-between gap-2 text-[10px] text-slate-600 cursor-pointer">
                      <span>Couple WIP Queue Wait on CT Change</span>
                      <input
                        type="checkbox"
                        checked={whatIfCoupleQueue}
                        onChange={(e) => setWhatIfCoupleQueue(e.target.checked)}
                        className="rounded accent-blue-600"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Changeover (s)</label>
                      <input
                        type="number"
                        min="0"
                        value={selectedProcess.changeoverSeconds}
                        onChange={(e) => {
                          const updated = processes.map((p) =>
                            p.id === selectedProcess.id
                              ? { ...p, changeoverSeconds: Math.max(0, Number(e.target.value)) }
                              : p
                          );
                          onUpdateMap({ ...map, processes: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Operators</label>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={selectedProcess.operatorsCount}
                        onChange={(e) => {
                          const updated = processes.map((p) =>
                            p.id === selectedProcess.id
                              ? { ...p, operatorsCount: Math.max(0.5, Number(e.target.value)) }
                              : p
                          );
                          onUpdateMap({ ...map, processes: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Uptime (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={selectedProcess.uptimePercent}
                        onChange={(e) => {
                          const updated = processes.map((p) =>
                            p.id === selectedProcess.id
                              ? {
                                  ...p,
                                  uptimePercent: Math.min(100, Math.max(1, Number(e.target.value))),
                                }
                              : p
                          );
                          onUpdateMap({ ...map, processes: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Quality (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={selectedProcess.qualityPercent}
                        onChange={(e) => {
                          const updated = processes.map((p) =>
                            p.id === selectedProcess.id
                              ? {
                                  ...p,
                                  qualityPercent: Math.min(100, Math.max(1, Number(e.target.value))),
                                }
                              : p
                          );
                          onUpdateMap({ ...map, processes: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  {/* Sequence Reorder Controls */}
                  <div className="pt-1">
                    <label className="block text-slate-500 font-medium mb-1">Sequence Order</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReorderProcess(selectedProcess.id, 'left')}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Upstream</span>
                      </button>
                      <button
                        onClick={() => handleReorderProcess(selectedProcess.id, 'right')}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-700"
                      >
                        <span>Downstream</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleQuickAddKaizen(selectedProcess.id)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>Pin Kaizen Burst Here</span>
                  </button>
                </div>
              )}

              {/* 2. EDIT INVENTORY TRIANGLE BUFFER */}
              {selectedBuffer && (
                <div className="space-y-3.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">
                        WIP Inventory Level (Units)
                      </span>
                      <span className="font-mono font-bold text-blue-600 text-sm">
                        {selectedBuffer.wipQuantity.toLocaleString()} pcs
                      </span>
                    </div>

                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={selectedBuffer.wipQuantity}
                      onChange={(e) => {
                        const qty = Math.max(0, Number(e.target.value));
                        upsertBufferInMap(selectedBuffer, { wipQuantity: qty });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-slate-900"
                    />

                    <input
                      type="range"
                      min="0"
                      max="2500"
                      step="5"
                      value={selectedBuffer.wipQuantity}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        upsertBufferInMap(selectedBuffer, { wipQuantity: qty });
                      }}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-500">
                      Storage Waiting Delay:{' '}
                      <strong className="text-slate-800 font-mono">
                        {(
                          selectedBuffer.wipQuantity / Math.max(1, demand.dailyDemandUnits)
                        ).toFixed(2)}{' '}
                        days
                      </strong>
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Material Flow Mechanism
                    </label>
                    <select
                      value={selectedBuffer.flowType}
                      onChange={(e) => {
                        upsertBufferInMap(selectedBuffer, {
                          flowType: e.target.value as FlowType,
                        });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-800 bg-white"
                    >
                      <option value="push">Push System (Inventory Triangle)</option>
                      <option value="pull_kanban">Pull System (Inventory Triangle + Kanban)</option>
                      <option value="fifo">FIFO Lane (Inventory Triangle + FIFO)</option>
                      <option value="pull_conwip">CONWIP (Inventory Triangle + Cap)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 3. EDIT KAIZEN BURST */}
              {selectedKaizen && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kaizen Title</label>
                    <input
                      type="text"
                      value={selectedKaizen.title}
                      onChange={(e) => {
                        const updated = kaizenBursts.map((k) =>
                          k.id === selectedKaizen.id ? { ...k, title: e.target.value } : k
                        );
                        onUpdateMap({ ...map, kaizenBursts: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status</label>
                    <select
                      value={selectedKaizen.status}
                      onChange={(e) => {
                        const updated = kaizenBursts.map((k) =>
                          k.id === selectedKaizen.id
                            ? { ...k, status: e.target.value as KaizenBurst['status'] }
                            : k
                        );
                        onUpdateMap({ ...map, kaizenBursts: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-semibold bg-white"
                    >
                      <option value="identified">Identified Opportunity</option>
                      <option value="in-progress">In-Progress Workshop</option>
                      <option value="implemented">Implemented (Green Star)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Expected Gain</label>
                    <input
                      type="text"
                      value={selectedKaizen.expectedGain}
                      onChange={(e) => {
                        const updated = kaizenBursts.map((k) =>
                          k.id === selectedKaizen.id ? { ...k, expectedGain: e.target.value } : k
                        );
                        onUpdateMap({ ...map, kaizenBursts: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* 4. EDIT CUSTOM SYMBOL */}
              {selectedCustom && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Symbol Label</label>
                    <input
                      type="text"
                      value={selectedCustom.label}
                      onChange={(e) => {
                        const updated = customNodes.map((c) =>
                          c.id === selectedCustom.id ? { ...c, label: e.target.value } : c
                        );
                        onUpdateMap({ ...map, customNodes: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Subtitle / Note
                    </label>
                    <input
                      type="text"
                      value={selectedCustom.subLabel || ''}
                      onChange={(e) => {
                        const updated = customNodes.map((c) =>
                          c.id === selectedCustom.id ? { ...c, subLabel: e.target.value } : c
                        );
                        onUpdateMap({ ...map, customNodes: updated });
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* 5. EDIT SUPPLIER OR CUSTOMER */}
              {selection.type === 'supplier' && (
                <div className="space-y-4 text-xs">
                  {/* SECTION A: MULTIPLE VENDORS */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        Vendors ({supplyChain.vendors.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const newVendor: VendorItem = {
                            id: `v-${Date.now()}`,
                            vendorName: `Vendor ${supplyChain.vendors.length + 1}`,
                            materialSupplied: 'Component / Raw Material',
                            procurementWaitingDays: 1,
                            deliveryLeadTimeDays: 1,
                            transportMode: 'truck',
                          };
                          const nextSupplier = syncSupplierSummary({
                            ...supplier,
                            vendors: [...supplyChain.vendors, newVendor],
                            rawMaterials: supplyChain.rawMaterials,
                          });
                          onUpdateMap({ ...map, supplier: nextSupplier });
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Vendor
                      </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {supplyChain.vendors.map((v, vIdx) => {
                        const isCritical =
                          supplyChain.vendors.length > 1 && v.id === supplyChain.criticalVendor.id;
                        return (
                          <div
                            key={v.id}
                            className={`p-2.5 rounded-lg border space-y-2 ${
                              isCritical
                                ? 'bg-blue-50/50 border-blue-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Vendor #{vIdx + 1}{' '}
                                {isCritical && (
                                  <span className="text-blue-700 font-extrabold">· Critical Path</span>
                                )}
                              </span>
                              {supplyChain.vendors.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const filtered = supplyChain.vendors.filter(
                                      (item) => item.id !== v.id
                                    );
                                    const nextSupplier = syncSupplierSummary({
                                      ...supplier,
                                      vendors: filtered,
                                      rawMaterials: supplyChain.rawMaterials,
                                    });
                                    onUpdateMap({ ...map, supplier: nextSupplier });
                                  }}
                                  className="text-slate-400 hover:text-rose-600 p-0.5"
                                  title="Remove Vendor"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <input
                              type="text"
                              value={v.vendorName}
                              placeholder="Vendor Name"
                              onChange={(e) => {
                                const updated = supplyChain.vendors.map((item) =>
                                  item.id === v.id ? { ...item, vendorName: e.target.value } : item
                                );
                                const nextSupplier = syncSupplierSummary({
                                  ...supplier,
                                  vendors: updated,
                                  rawMaterials: supplyChain.rawMaterials,
                                });
                                onUpdateMap({ ...map, supplier: nextSupplier });
                              }}
                              className="w-full px-2.5 py-1 rounded-md bg-white border border-slate-200 font-semibold text-slate-900"
                            />

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  Order Wait (d)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={v.procurementWaitingDays}
                                  onChange={(e) => {
                                    const updated = supplyChain.vendors.map((item) =>
                                      item.id === v.id
                                        ? {
                                            ...item,
                                            procurementWaitingDays: Math.max(0, Number(e.target.value)),
                                          }
                                        : item
                                    );
                                    const nextSupplier = syncSupplierSummary({
                                      ...supplier,
                                      vendors: updated,
                                      rawMaterials: supplyChain.rawMaterials,
                                    });
                                    onUpdateMap({ ...map, supplier: nextSupplier });
                                  }}
                                  className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">
                                  Transit (d)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={v.deliveryLeadTimeDays}
                                  onChange={(e) => {
                                    const updated = supplyChain.vendors.map((item) =>
                                      item.id === v.id
                                        ? {
                                            ...item,
                                            deliveryLeadTimeDays: Math.max(0, Number(e.target.value)),
                                          }
                                        : item
                                    );
                                    const nextSupplier = syncSupplierSummary({
                                      ...supplier,
                                      vendors: updated,
                                      rawMaterials: supplyChain.rawMaterials,
                                    });
                                    onUpdateMap({ ...map, supplier: nextSupplier });
                                  }}
                                  className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 space-y-2.5">
                    {/* SECTION B: MULTIPLE RAW MATERIALS */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-emerald-600" />
                        Raw Materials ({supplyChain.rawMaterials.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const defaultVendor = supplyChain.vendors[0];
                          const newRm: RawMaterialItem = {
                            id: `rm-${Date.now()}`,
                            materialName: `Raw Material ${supplyChain.rawMaterials.length + 1}`,
                            vendorId: defaultVendor?.id,
                            vendorName: defaultVendor?.vendorName,
                            stockUnits: 1000,
                            unitOfMeasure: 'Units',
                          };
                          const nextSupplier = syncSupplierSummary({
                            ...supplier,
                            vendors: supplyChain.vendors,
                            rawMaterials: [...supplyChain.rawMaterials, newRm],
                          });
                          onUpdateMap({ ...map, supplier: nextSupplier });
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Material
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {supplyChain.rawMaterials.map((rm, rIdx) => (
                        <div
                          key={rm.id}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Material #{rIdx + 1} ·{' '}
                              <span className="text-emerald-700 font-mono">
                                {(rm.stockUnits / Math.max(1, demand.dailyDemandUnits)).toFixed(1)}d
                              </span>
                            </span>
                            {supplyChain.rawMaterials.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const filtered = supplyChain.rawMaterials.filter(
                                    (item) => item.id !== rm.id
                                  );
                                  const nextSupplier = syncSupplierSummary({
                                    ...supplier,
                                    vendors: supplyChain.vendors,
                                    rawMaterials: filtered,
                                  });
                                  onUpdateMap({ ...map, supplier: nextSupplier });
                                }}
                                className="text-slate-400 hover:text-rose-600 p-0.5"
                                title="Remove Raw Material"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <input
                            type="text"
                            value={rm.materialName}
                            placeholder="Raw Material Name"
                            onChange={(e) => {
                              const updated = supplyChain.rawMaterials.map((item) =>
                                item.id === rm.id ? { ...item, materialName: e.target.value } : item
                              );
                              const nextSupplier = syncSupplierSummary({
                                ...supplier,
                                vendors: supplyChain.vendors,
                                rawMaterials: updated,
                              });
                              onUpdateMap({ ...map, supplier: nextSupplier });
                            }}
                            className="w-full px-2.5 py-1 rounded-md bg-white border border-slate-200 font-semibold text-slate-900"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">
                                Stock Qty
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={rm.stockUnits}
                                onChange={(e) => {
                                  const updated = supplyChain.rawMaterials.map((item) =>
                                    item.id === rm.id
                                      ? { ...item, stockUnits: Math.max(0, Number(e.target.value)) }
                                      : item
                                  );
                                  const nextSupplier = syncSupplierSummary({
                                    ...supplier,
                                    vendors: supplyChain.vendors,
                                    rawMaterials: updated,
                                  });
                                  onUpdateMap({ ...map, supplier: nextSupplier });
                                }}
                                className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 font-mono font-bold text-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">
                                Supplied By
                              </label>
                              <select
                                value={rm.vendorId || supplyChain.vendors[0]?.id || ''}
                                onChange={(e) => {
                                  const chosen = supplyChain.vendors.find(
                                    (v) => v.id === e.target.value
                                  );
                                  const updated = supplyChain.rawMaterials.map((item) =>
                                    item.id === rm.id
                                      ? {
                                          ...item,
                                          vendorId: chosen?.id,
                                          vendorName: chosen?.vendorName,
                                        }
                                      : item
                                  );
                                  const nextSupplier = syncSupplierSummary({
                                    ...supplier,
                                    vendors: supplyChain.vendors,
                                    rawMaterials: updated,
                                  });
                                  onUpdateMap({ ...map, supplier: nextSupplier });
                                }}
                                className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[11px]"
                              >
                                {supplyChain.vendors.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.vendorName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selection.type === 'customer' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Daily Customer Demand (Units/Day)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={demand.dailyDemandUnits}
                      onChange={(e) =>
                        onUpdateMap({
                          ...map,
                          demand: {
                            ...demand,
                            dailyDemandUnits: Math.max(1, Number(e.target.value)),
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono font-bold text-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Finished Goods Hold (Days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={demand.shippingHoldingDays}
                      onChange={(e) =>
                        onUpdateMap({
                          ...map,
                          demand: {
                            ...demand,
                            shippingHoldingDays: Math.max(0, Number(e.target.value)),
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* 6. LEAD TIME & PROCESS CYCLE EFFICIENCY (PCE) LIVE CALCULATION INSPECTOR */}
              {selection.type === 'metrics' && (
                <div className="space-y-4 text-xs">
                  {/* Top KPI Summary Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-900 text-white">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Total Lead Time
                      </span>
                      <span className="font-mono text-base font-black text-white">
                        {leadTimeBreakdown.totalLeadTimeDays} days
                      </span>
                      <span className="text-[10px] text-slate-300 block mt-0.5">
                        Storage NVA: {leadTimeBreakdown.totalStorageDays}d
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        Value-Added (Σ CT)
                      </span>
                      <span className="font-mono text-base font-black text-emerald-800">
                        {leadTimeBreakdown.totalValueAddedSeconds} sec
                      </span>
                      <span className="text-[10px] text-emerald-700 block mt-0.5">
                        {(leadTimeBreakdown.totalValueAddedSeconds / 60).toFixed(1)} mins across{' '}
                        {processes.length} steps
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                        Calendar PCE (24h)
                      </span>
                      <span className="font-mono text-base font-black text-blue-800">
                        {leadTimeBreakdown.calendarPcePercent}%
                      </span>
                      <span className="text-[10px] text-blue-600 block mt-0.5">
                        VA ÷ (PLT × 86,400s)
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                        Shift-Adjusted PCE
                      </span>
                      <span className="font-mono text-base font-black text-indigo-800">
                        {leadTimeBreakdown.shiftPcePercent}%
                      </span>
                      <span className="text-[10px] text-indigo-600 block mt-0.5">
                        VA ÷ (PLT × {metrics.effectiveWorkingSeconds.toLocaleString()}s)
                      </span>
                    </div>
                  </div>

                  {/* Section 1: Total Lead Time Step-by-Step Breakdown */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="font-extrabold text-slate-900 uppercase tracking-wide text-[11px]">
                        1. Total Lead Time Derivation
                      </span>
                      <span className="font-mono font-bold text-slate-600 text-[11px]">
                        Demand: {leadTimeBreakdown.dailyDemand}/d
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-slate-700">
                        <span>
                          Critical Vendor Order Wait ({supplyChain.criticalVendor.vendorName})
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {leadTimeBreakdown.procurementWaitDays}d
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span>Inbound Logistics Transit</span>
                        <span className="font-mono font-bold text-slate-900">
                          {leadTimeBreakdown.transitDays}d
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span>
                          Raw Material Stock ({supplyChain.totalRawMaterialUnits.toLocaleString()} ÷{' '}
                          {leadTimeBreakdown.dailyDemand})
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {leadTimeBreakdown.rawMaterialDays}d
                        </span>
                      </div>

                      {leadTimeBreakdown.wipBuffersBreakdown.map((wb) => (
                        <div
                          key={wb.id}
                          className="flex items-center justify-between text-slate-700"
                        >
                          <span className="truncate pr-2">
                            {wb.label} ({wb.wipQuantity} ÷ {leadTimeBreakdown.dailyDemand})
                          </span>
                          <span className="font-mono font-bold text-slate-900 shrink-0">
                            {wb.agingDays}d
                          </span>
                        </div>
                      ))}

                      <div className="flex items-center justify-between text-slate-700">
                        <span>Finished Goods Shipping Hold</span>
                        <span className="font-mono font-bold text-slate-900">
                          {leadTimeBreakdown.finishedGoodsDays}d
                        </span>
                      </div>

                      <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-extrabold text-slate-900">
                        <span>Total Production Lead Time</span>
                        <span className="font-mono text-blue-700">
                          = {leadTimeBreakdown.totalLeadTimeDays} Days
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Value-Added Process Time Breakdown */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <span className="font-extrabold text-slate-900 uppercase tracking-wide text-[11px]">
                        2. Value-Added Time (Σ Cycle Time)
                      </span>
                      <span className="font-mono font-bold text-emerald-700 text-[11px]">
                        {leadTimeBreakdown.totalValueAddedSeconds}s
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      {processes.map((proc, idx) => {
                        const share =
                          leadTimeBreakdown.totalValueAddedSeconds > 0
                            ? Math.round(
                                (proc.cycleTimeSeconds /
                                  leadTimeBreakdown.totalValueAddedSeconds) *
                                  100
                              )
                            : 0;
                        return (
                          <div
                            key={proc.id}
                            className="flex items-center justify-between text-slate-700"
                          >
                            <span>
                              {idx + 1}. {proc.name}
                            </span>
                            <span className="font-mono font-bold text-emerald-700">
                              {proc.cycleTimeSeconds}s{' '}
                              <span className="text-slate-400 font-normal">({share}%)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: Process Cycle Efficiency (PCE) Equation */}
                  <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 space-y-1.5">
                    <span className="font-extrabold text-blue-900 uppercase tracking-wide text-[11px] block">
                      3. Process Cycle Efficiency Formula
                    </span>
                    <div className="font-mono text-[11px] text-blue-950 bg-white p-2 rounded border border-blue-200">
                      <div>PCE = (Value-Added Time ÷ Total Lead Time) × 100</div>
                      <div className="mt-1 text-blue-700 font-bold">
                        = ({leadTimeBreakdown.totalValueAddedSeconds}s ÷{' '}
                        {(leadTimeBreakdown.totalLeadTimeDays * 86400).toLocaleString()}s) × 100 ={' '}
                        {leadTimeBreakdown.calendarPcePercent}%
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed pt-0.5">
                      Floor Storage PCE (excluding vendor order/transit):{' '}
                      <strong className="font-mono text-slate-900">
                        {leadTimeBreakdown.floorPcePercent}%
                      </strong>
                    </p>
                  </div>
                </div>
              )}

              {/* 7. AUTOMATED BOTTLENECK IDENTIFICATION & C/T VS. TAKT RATIO RANKING INSPECTOR */}
              {selection.type === 'bottlenecks' && (
                <div className="space-y-3.5 text-xs">
                  {/* Top Summary Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-900 text-white">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Customer Takt Time
                      </span>
                      <span className="font-mono text-base font-black text-amber-400">
                        {metrics.taktTimeSeconds}s / unit
                      </span>
                      <span className="text-[10px] text-slate-300 block mt-0.5">
                        Net: {metrics.effectiveWorkingSeconds.toLocaleString()}s ÷{' '}
                        {demand.dailyDemandUnits}u
                      </span>
                    </div>

                    <div
                      className={`p-2.5 rounded-lg border ${
                        metrics.overTaktCount > 0
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider block ${
                          metrics.overTaktCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        #1 Highest C/T : Takt
                      </span>
                      <span
                        className={`font-mono text-base font-black ${
                          metrics.overTaktCount > 0 ? 'text-rose-800' : 'text-emerald-800'
                        }`}
                      >
                        {metrics.maxCtToTaktRatio}x ({Math.round(metrics.maxCtToTaktRatio * 100)}%)
                      </span>
                      <span
                        className={`text-[10px] font-semibold block mt-0.5 truncate ${
                          metrics.overTaktCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {metrics.bottleneckProcessName || 'N/A'} ({metrics.maxCycleTimeSeconds}s)
                      </span>
                    </div>
                  </div>

                  {/* Highlight Toggle Banner */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">
                        Canvas Bottleneck Highlighting
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Highlights C/T : Takt ratios, halos &amp; rank pills on diagram
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHighlightBottlenecks((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        highlightBottlenecks
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {highlightBottlenecks ? 'Active' : 'Muted'}
                    </button>
                  </div>

                  {/* Ranked Process Steps by Cycle Time vs. Takt Time Ratio */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                        Ranked Process Steps (C/T ÷ Takt)
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {metrics.overTaktCount} Over · {metrics.nearTaktCount} Near Takt
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {rankedBottlenecks.map((item) => {
                        const procObj = processes.find((p) => p.id === item.processId);
                        const barPct = Math.min(100, Math.round((item.ctToTaktRatio / 1.25) * 100));
                        const taktMarkerPct = 80; // 1.0x / 1.25x = 80%

                        return (
                          <div
                            key={item.processId}
                            className={`p-2.5 rounded-xl border transition-all ${
                              item.isOverTakt
                                ? 'bg-rose-50/70 border-rose-200'
                                : item.isNearTakt
                                ? 'bg-amber-50/70 border-amber-200'
                                : item.isPrimaryBottleneck
                                ? 'bg-blue-50/70 border-blue-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono shrink-0 ${
                                    item.isOverTakt
                                      ? 'bg-rose-600 text-white'
                                      : item.isNearTakt
                                      ? 'bg-amber-500 text-white'
                                      : item.isPrimaryBottleneck
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  #{item.rank}
                                </span>
                                <span className="font-bold text-slate-900 truncate">
                                  {item.processName}
                                </span>
                              </div>

                              <span
                                className={`font-mono font-black text-xs shrink-0 ${
                                  item.isOverTakt
                                    ? 'text-rose-700'
                                    : item.isNearTakt
                                    ? 'text-amber-700'
                                    : item.isPrimaryBottleneck
                                    ? 'text-blue-700'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {item.ctToTaktRatio}x Takt ({item.ctToTaktPercent}%)
                              </span>
                            </div>

                            {/* Visual C/T vs. Takt Ratio Bar */}
                            <div className="relative h-2.5 w-full bg-slate-200/80 rounded-full overflow-hidden my-2">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.isOverTakt
                                    ? 'bg-rose-600'
                                    : item.isNearTakt
                                    ? 'bg-amber-500'
                                    : item.isPrimaryBottleneck
                                    ? 'bg-blue-600'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${barPct}%` }}
                              />
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-slate-900"
                                style={{ left: `${taktMarkerPct}%` }}
                                title={`Customer Takt Threshold (1.0x = ${metrics.taktTimeSeconds}s)`}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono">
                              <span>
                                CT: <strong>{item.cycleTimeSeconds}s</strong> / Takt:{' '}
                                {metrics.taktTimeSeconds}s
                              </span>
                              <span>
                                Eff. CT: <strong>{item.effectiveCycleTimeSeconds}s</strong> (
                                {item.effectiveToTaktRatio}x)
                              </span>
                            </div>

                            {/* Live Cycle Time Balancing Slider */}
                            {!readOnly && procObj && (
                              <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center gap-2">
                                <input
                                  type="range"
                                  min="5"
                                  max={Math.max(180, Math.round(metrics.taktTimeSeconds * 1.8))}
                                  value={procObj.cycleTimeSeconds}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const updated = processes.map((p) =>
                                      p.id === procObj.id ? { ...p, cycleTimeSeconds: val } : p
                                    );
                                    onUpdateMap({ ...map, processes: updated });
                                  }}
                                  className="flex-1 accent-rose-600 cursor-pointer h-1.5"
                                  title="Adjust Cycle Time to simulate line balancing"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelection({ type: 'process', id: item.processId })
                                  }
                                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-semibold shrink-0"
                                >
                                  Inspect
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Delete Node Footer Button */}
            {(selection.type === 'process' ||
              selection.type === 'kaizen' ||
              selection.type === 'custom') && (
              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={handleDeleteSelected}
                  className="w-full py-1.5 px-3 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Element</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== PRINT-ONLY A3/A4 LANDSCAPE ENGINEERING FOOTER TITLE BLOCK ==================== */}
      <div
        className={`${
          isPrinting ? 'flex' : 'hidden print:flex'
        } items-center justify-between border-t-2 border-slate-900 bg-white px-4 py-1.5 mt-1 text-[10px] font-semibold text-slate-700 shrink-0`}
      >
        <div className="flex items-center gap-4">
          <span>
            <strong>Document Ref:</strong> {map.id.toUpperCase()} (Rev {map.version}.0)
          </span>
          <span>·</span>
          <span>
            <strong>Prepared By:</strong> {map.author || 'Lean Engineering Team'}
          </span>
          <span>·</span>
          <span>
            <strong>Vendors / Materials:</strong> {supplyChain.vendors.length} Vendors /{' '}
            {supplyChain.rawMaterials.length} Raw Materials ({supplyChain.totalRawMaterialUnits.toLocaleString()}{' '}
            units)
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            <strong>Line Balance:</strong>{' '}
            {metrics.isDemandMet
              ? 'Balanced Below Takt'
              : `Bottleneck at ${metrics.bottleneckProcessName} (${metrics.maxCycleTimeSeconds}s > ${metrics.taktTimeSeconds}s)`}
          </span>
          <span>·</span>
          <span>
            <strong>Sheet Format:</strong> ISO {printPaperSize} Landscape ·{' '}
            {new Date(map.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};
