import {
  CalculatedMetrics,
  SupplierInfo,
  ValueStreamMap,
  VendorItem,
  RawMaterialItem,
  ProcessStep,
  ProcessBottleneckAnalysis,
  BottleneckSeverity,
} from '../types/vsm';

/**
 * Automated Bottleneck Identification Algorithm:
 * Evaluates every process step's Cycle Time (and Effective Cycle Time accounting for Uptime & Quality)
 * against Customer Takt Time, computes exact C/T : Takt ratios, ranks all steps descending by ratio,
 * and classifies severity ('critical' when C/T > Takt, 'warning' when 85%–100% of Takt,
 * 'pacemaker' for #1 highest ratio when <85% of Takt, and 'optimal' otherwise).
 */
export function identifyBottlenecks(
  processes: ProcessStep[],
  taktTimeSeconds: number
): ProcessBottleneckAnalysis[] {
  if (!processes || processes.length === 0) return [];

  const maxCt = processes.reduce((max, p) => Math.max(max, p.cycleTimeSeconds || 0), 0);

  // Build initial metrics per process step
  const preliminary = processes.map((p, idx) => {
    const ct = p.cycleTimeSeconds || 0;
    const uptimeRatio = Math.min(1, Math.max(0.01, (p.uptimePercent ?? 100) / 100));
    const qualityRatio = Math.min(1, Math.max(0.01, (p.qualityPercent ?? 100) / 100));
    const availabilityFactor = uptimeRatio * qualityRatio;
    const effectiveCycleTimeSeconds = Number((ct / availabilityFactor).toFixed(1));

    const ctToTaktRatio =
      taktTimeSeconds > 0 ? Number((ct / taktTimeSeconds).toFixed(2)) : 0;
    const ctToTaktPercent =
      taktTimeSeconds > 0 ? Number(((ct / taktTimeSeconds) * 100).toFixed(1)) : 0;
    const effectiveToTaktRatio =
      taktTimeSeconds > 0
        ? Number((effectiveCycleTimeSeconds / taktTimeSeconds).toFixed(2))
        : 0;
    const deltaFromTaktSeconds =
      taktTimeSeconds > 0 ? Number((ct - taktTimeSeconds).toFixed(1)) : 0;

    const isPrimaryBottleneck = maxCt > 0 && ct === maxCt;
    const isOverTakt = taktTimeSeconds > 0 && ct > taktTimeSeconds;
    const isNearTakt =
      taktTimeSeconds > 0 && !isOverTakt && ct / taktTimeSeconds >= 0.85;

    let severity: BottleneckSeverity = 'optimal';
    if (isOverTakt) {
      severity = 'critical';
    } else if (isNearTakt) {
      severity = 'warning';
    } else if (isPrimaryBottleneck) {
      severity = 'pacemaker';
    }

    return {
      processId: p.id,
      processName: p.name,
      order: p.order ?? idx + 1,
      cycleTimeSeconds: ct,
      effectiveCycleTimeSeconds,
      taktTimeSeconds,
      ctToTaktRatio,
      ctToTaktPercent,
      effectiveToTaktRatio,
      deltaFromTaktSeconds,
      rank: 1,
      isPrimaryBottleneck,
      isOverTakt,
      isNearTakt,
      severity,
    };
  });

  // Sort copy descending by C/T : Takt ratio (tie-break by effective C/T, then station order)
  const sortedByRatio = [...preliminary].sort((a, b) => {
    if (b.ctToTaktRatio !== a.ctToTaktRatio) return b.ctToTaktRatio - a.ctToTaktRatio;
    if (b.cycleTimeSeconds !== a.cycleTimeSeconds) return b.cycleTimeSeconds - a.cycleTimeSeconds;
    if (b.effectiveCycleTimeSeconds !== a.effectiveCycleTimeSeconds) {
      return b.effectiveCycleTimeSeconds - a.effectiveCycleTimeSeconds;
    }
    return a.order - b.order;
  });

  const rankById = new Map<string, number>();
  sortedByRatio.forEach((item, index) => {
    rankById.set(item.processId, index + 1);
  });

  return preliminary.map((item) => ({
    ...item,
    rank: rankById.get(item.processId) ?? 1,
  }));
}

/**
 * Normalizes supplier data so every VSM has a valid array of vendors and raw materials
 * even if created before multi-vendor / multi-raw-material support.
 */
export function getNormalizedSupplyChain(supplier: SupplierInfo): {
  vendors: VendorItem[];
  rawMaterials: RawMaterialItem[];
  criticalVendor: VendorItem;
  totalRawMaterialUnits: number;
} {
  const vendors: VendorItem[] =
    supplier.vendors && supplier.vendors.length > 0
      ? supplier.vendors
      : [
          {
            id: 'vendor-1',
            vendorName: supplier.supplierName || 'Primary Supplier',
            materialSupplied: 'Primary Raw Materials',
            procurementWaitingDays: supplier.procurementWaitingDays ?? 0,
            deliveryLeadTimeDays: supplier.deliveryLeadTimeDays ?? 0,
            transportMode: supplier.transportMode || 'truck',
          },
        ];

  const rawMaterials: RawMaterialItem[] =
    supplier.rawMaterials && supplier.rawMaterials.length > 0
      ? supplier.rawMaterials
      : [
          {
            id: 'rm-1',
            materialName: 'Primary Raw Stock',
            vendorId: vendors[0].id,
            vendorName: vendors[0].vendorName,
            stockUnits: supplier.rawMaterialStockUnits ?? 0,
            unitOfMeasure: 'units',
          },
        ];

  // Critical path vendor is the one with the longest combined procurement wait + delivery transit
  const criticalVendor = vendors.reduce((maxV, v) => {
    const currentTotal = (v.procurementWaitingDays || 0) + (v.deliveryLeadTimeDays || 0);
    const maxTotal = (maxV.procurementWaitingDays || 0) + (maxV.deliveryLeadTimeDays || 0);
    return currentTotal > maxTotal ? v : maxV;
  }, vendors[0]);

  const totalRawMaterialUnits =
    supplier.rawMaterials && supplier.rawMaterials.length > 0
      ? rawMaterials.reduce((sum, rm) => sum + (rm.stockUnits || 0), 0)
      : supplier.rawMaterialStockUnits ?? 0;

  return {
    vendors,
    rawMaterials,
    criticalVendor,
    totalRawMaterialUnits,
  };
}

/**
 * Synchronizes top-level SupplierInfo summary fields from its vendors[] and rawMaterials[] arrays.
 */
export function syncSupplierSummary(supplier: SupplierInfo): SupplierInfo {
  const { vendors, rawMaterials, criticalVendor, totalRawMaterialUnits } =
    getNormalizedSupplyChain(supplier);

  return {
    ...supplier,
    vendors,
    rawMaterials,
    supplierName:
      vendors.length > 1
        ? `${vendors[0].vendorName} (+${vendors.length - 1} more)`
        : criticalVendor.vendorName,
    procurementWaitingDays: criticalVendor.procurementWaitingDays,
    deliveryLeadTimeDays: criticalVendor.deliveryLeadTimeDays,
    transportMode: criticalVendor.transportMode,
    rawMaterialStockUnits: totalRawMaterialUnits,
  };
}

/**
 * Calculates all Lean Value Stream Mapping metrics according to the TPS & AIGPE masterclass standards.
 */
export function calculateVsmMetrics(map: ValueStreamMap): CalculatedMetrics {
  const { demand, supplier, processes, buffers } = map;
  const { criticalVendor, totalRawMaterialUnits } = getNormalizedSupplyChain(supplier);

  // 1. Calculate Net Available Time (Ta) in seconds
  const grossSeconds = demand.hoursPerShift * 3600 * demand.shiftsPerDay;
  const breakSeconds = demand.breaksCount * demand.breakMinutesEach * 60 * demand.shiftsPerDay;
  const effectiveWorkingSeconds = Math.max(0, grossSeconds - breakSeconds);

  // 2. Calculate Takt Time (T = Ta / Td)
  const taktTimeSeconds = demand.dailyDemandUnits > 0
    ? Number((effectiveWorkingSeconds / demand.dailyDemandUnits).toFixed(1))
    : 0;

  // 3. Process Time (Sum of all station Cycle Times)
  const totalProcessTimeSeconds = processes.reduce((acc, p) => acc + (p.cycleTimeSeconds || 0), 0);

  // 4. Total Operators
  const totalOperators = Math.max(1, processes.reduce((acc, p) => acc + (p.operatorsCount || 0), 0));

  // 5. Apparent Line Cycle Time (Process Time / Total Operators)
  const cycleTimeSeconds = Number((totalProcessTimeSeconds / totalOperators).toFixed(2));

  // 6. Calculate inventory aging days for raw materials, buffers, and finished goods
  const dailyDemand = Math.max(1, demand.dailyDemandUnits);

  // Raw materials aging across all raw materials
  const rawMaterialDays = Number((totalRawMaterialUnits / dailyDemand).toFixed(2));

  // In-process buffers aging
  let inProcessBufferDays = 0;
  let totalWipUnits = totalRawMaterialUnits;

  buffers.forEach((b) => {
    totalWipUnits += b.wipQuantity || 0;
    const days = Number(((b.wipQuantity || 0) / dailyDemand).toFixed(2));
    b.calculatedDays = days;
    inProcessBufferDays += days;
  });

  // Finished goods holding days
  const finishedGoodsDays = demand.shippingHoldingDays || 0;

  // 7. Storage Time (Raw aging + WIP buffer aging + FG holding days)
  const storageTimeDays = Number(
    (rawMaterialDays + inProcessBufferDays + finishedGoodsDays).toFixed(2)
  );

  // 8. Total Lead Time (Critical Vendor Order wait + Critical Vendor Transit + Storage Time + Value-Added Processing Days)
  const procurementWait = criticalVendor.procurementWaitingDays || 0;
  const supplierDelivery = criticalVendor.deliveryLeadTimeDays || 0;
  const valueAddedDays =
    effectiveWorkingSeconds > 0 ? totalProcessTimeSeconds / effectiveWorkingSeconds : 0;
  const leadTimeDays = Number(
    (procurementWait + supplierDelivery + storageTimeDays + valueAddedDays).toFixed(2)
  );

  // 9. Flow Efficiency (%): (Value Added seconds / Total Lead Time seconds) * 100
  // Note: 1 working day = effectiveWorkingSeconds (or 24 hours standard 86,400s)
  const totalLeadTimeSeconds = leadTimeDays * 86400;
  const flowEfficiencyPercent = totalLeadTimeSeconds > 0
    ? Number(((totalProcessTimeSeconds / totalLeadTimeSeconds) * 100).toFixed(3))
    : 0;

  // 10. Automated Bottleneck Identification (Cycle Time vs. Takt Time Ratios & Ranking)
  const bottleneckAnalysis = identifyBottlenecks(processes, taktTimeSeconds);
  const topBottleneck = [...bottleneckAnalysis].sort((a, b) => a.rank - b.rank)[0] || null;

  const bottleneckProcessId = topBottleneck ? topBottleneck.processId : null;
  const bottleneckProcessName = topBottleneck ? topBottleneck.processName : null;
  const maxCycleTimeSeconds = topBottleneck ? topBottleneck.cycleTimeSeconds : 0;
  const maxCtToTaktRatio = topBottleneck ? topBottleneck.ctToTaktRatio : 0;
  const overTaktCount = bottleneckAnalysis.filter((b) => b.isOverTakt).length;
  const nearTaktCount = bottleneckAnalysis.filter((b) => b.isNearTakt).length;

  // Demand is met if Cycle Time is <= Takt Time AND individual station CTs <= Takt Time
  const isDemandMet = taktTimeSeconds > 0 && cycleTimeSeconds <= taktTimeSeconds && maxCycleTimeSeconds <= taktTimeSeconds;

  return {
    effectiveWorkingSeconds,
    taktTimeSeconds,
    totalProcessTimeSeconds,
    cycleTimeSeconds,
    storageTimeDays,
    leadTimeDays,
    flowEfficiencyPercent,
    isDemandMet,
    bottleneckProcessId,
    bottleneckProcessName,
    maxCycleTimeSeconds,
    maxCtToTaktRatio,
    overTaktCount,
    nearTaktCount,
    bottleneckAnalysis,
    totalOperators,
    totalWipUnits,
  };
}

/**
 * Compares Current State and Future State VSMs and generates deltas.
 */
export function compareVsmStates(currentMap: ValueStreamMap, futureMap: ValueStreamMap) {
  const current = calculateVsmMetrics(currentMap);
  const future = calculateVsmMetrics(futureMap);

  const leadTimeDaysReduction = Number((current.leadTimeDays - future.leadTimeDays).toFixed(2));
  const leadTimeReductionPercent = current.leadTimeDays > 0
    ? Number(((leadTimeDaysReduction / current.leadTimeDays) * 100).toFixed(1))
    : 0;

  const storageTimeDaysReduction = Number((current.storageTimeDays - future.storageTimeDays).toFixed(2));
  const processTimeSecondsReduction = current.totalProcessTimeSeconds - future.totalProcessTimeSeconds;
  const cycleTimeSecondsReduction = Number((current.cycleTimeSeconds - future.cycleTimeSeconds).toFixed(2));
  const flowEfficiencyGainPercent = Number((future.flowEfficiencyPercent - current.flowEfficiencyPercent).toFixed(3));
  const wipUnitsReduction = current.totalWipUnits - future.totalWipUnits;
  const wipReductionPercent = current.totalWipUnits > 0
    ? Number(((wipUnitsReduction / current.totalWipUnits) * 100).toFixed(1))
    : 0;

  return {
    current,
    future,
    deltas: {
      leadTimeDaysReduction,
      leadTimeReductionPercent,
      storageTimeDaysReduction,
      processTimeSecondsReduction,
      cycleTimeSecondsReduction,
      flowEfficiencyGainPercent,
      wipUnitsReduction,
      wipReductionPercent,
      isDemandMetCurrent: current.isDemandMet,
      isDemandMetFuture: future.isDemandMet,
    },
  };
}
