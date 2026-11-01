import { ValueStreamMap } from '../types/vsm';
import { INITIAL_MAPS } from '../utils/defaultData';

const STORAGE_KEY = 'vsm_studio_maps_v1';
const ACTIVE_MAP_ID_KEY = 'vsm_studio_active_id_v1';

export function getStoredMaps(): ValueStreamMap[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MAPS));
      return INITIAL_MAPS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MAPS));
      return INITIAL_MAPS;
    }
    // Backfill vendors and rawMaterials on existing stored default maps if missing
    const migrated = parsed.map((m: ValueStreamMap) => {
      const matchingInitial = INITIAL_MAPS.find((init) => init.id === m.id);
      if (
        matchingInitial &&
        (!m.supplier.vendors || m.supplier.vendors.length === 0) &&
        matchingInitial.supplier.vendors
      ) {
        return {
          ...m,
          supplier: {
            ...m.supplier,
            vendors: matchingInitial.supplier.vendors,
            rawMaterials: matchingInitial.supplier.rawMaterials,
          },
        };
      }
      return m;
    });
    return migrated;
  } catch (err) {
    console.error('Failed to read maps from localStorage:', err);
    return INITIAL_MAPS;
  }
}

export function saveStoredMaps(maps: ValueStreamMap[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
  } catch (err) {
    console.error('Failed to save maps to localStorage:', err);
  }
}

export function getActiveMapId(): string {
  try {
    const active = localStorage.getItem(ACTIVE_MAP_ID_KEY);
    if (active) return active;
  } catch {
    // fallback
  }
  return INITIAL_MAPS[0].id;
}

export function setActiveMapId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_MAP_ID_KEY, id);
  } catch {
    // ignore
  }
}

export function saveSingleMap(map: ValueStreamMap): ValueStreamMap[] {
  const maps = getStoredMaps();
  const index = maps.findIndex((m) => m.id === map.id);
  const updatedMap: ValueStreamMap = {
    ...map,
    updatedAt: new Date().toISOString(),
    version: (map.version || 1) + 1,
  };

  let newMaps: ValueStreamMap[];
  if (index >= 0) {
    newMaps = [...maps];
    newMaps[index] = updatedMap;
  } else {
    newMaps = [updatedMap, ...maps];
  }

  saveStoredMaps(newMaps);
  return newMaps;
}

export function createNewMap(params: {
  title: string;
  organization: string;
  productFamily: string;
  author: string;
  stateType: 'current' | 'future';
}): ValueStreamMap {
  const id = `vsm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newMap: ValueStreamMap = {
    id,
    title: params.title || 'Untitled Value Stream',
    organization: params.organization || 'My Enterprise',
    productFamily: params.productFamily || 'Standard Product Line',
    author: params.author || 'Industrial Engineer',
    version: 1,
    stateType: params.stateType,
    createdAt: now,
    updatedAt: now,
    demand: {
      customerName: 'Customer / Market Demand',
      dailyDemandUnits: 100,
      shiftsPerDay: 1,
      hoursPerShift: 8,
      breaksCount: 2,
      breakMinutesEach: 15,
      shippingFrequency: 'Daily',
      shippingHoldingDays: 2.0,
      isCustomOrder: false,
    },
    supplier: {
      supplierName: 'Primary Material Vendor',
      procurementWaitingDays: 3.0,
      deliveryLeadTimeDays: 7.0,
      transportMode: 'truck',
      rawMaterialStockUnits: 500, // 5 days
      vendors: [
        {
          id: `v-${Date.now()}-1`,
          vendorName: 'Primary Material Vendor',
          materialSupplied: 'Core Raw Material A',
          procurementWaitingDays: 3.0,
          deliveryLeadTimeDays: 7.0,
          transportMode: 'truck',
        },
      ],
      rawMaterials: [
        {
          id: `rm-${Date.now()}-1`,
          materialName: 'Core Raw Material A',
          vendorName: 'Primary Material Vendor',
          stockUnits: 500,
          unitOfMeasure: 'pcs',
        },
      ],
    },
    informationFlow: {
      controlDepartment: 'Production Control',
      orderReceptionChannel: 'Electronic EDI/Web',
      hasDatabaseStorage: true,
      createBuyingList: true,
      preliminaryScheduleDays: 3,
      weeklySchedule: true,
      scheduleDistribution: 'Floor Supervisors',
      scheduleFrequency: 'Weekly',
    },
    processes: [
      {
        id: `proc-${Date.now()}-1`,
        order: 1,
        name: 'Initial Processing',
        type: 'dedicated',
        cycleTimeSeconds: 120,
        changeoverSeconds: 60,
        uptimePercent: 95,
        qualityPercent: 98,
        operatorsCount: 1,
      },
      {
        id: `proc-${Date.now()}-2`,
        order: 2,
        name: 'Secondary Finishing',
        type: 'dedicated',
        cycleTimeSeconds: 150,
        changeoverSeconds: 45,
        uptimePercent: 98,
        qualityPercent: 99,
        operatorsCount: 1,
      },
      {
        id: `proc-${Date.now()}-3`,
        order: 3,
        name: 'Inspection & Packaging',
        type: 'dedicated',
        cycleTimeSeconds: 90,
        changeoverSeconds: 15,
        uptimePercent: 99,
        qualityPercent: 100,
        operatorsCount: 1,
      },
    ],
    buffers: [
      {
        id: `buf-${Date.now()}-1`,
        afterProcessId: `proc-${Date.now()}-1`,
        wipQuantity: 200,
        calculatedDays: 2.0,
        flowType: 'push',
      },
      {
        id: `buf-${Date.now()}-2`,
        afterProcessId: `proc-${Date.now()}-2`,
        wipQuantity: 150,
        calculatedDays: 1.5,
        flowType: 'push',
      },
    ],
    kaizenBursts: [],
    notes: 'Custom Value Stream Map initialized.',
  };

  const maps = [newMap, ...getStoredMaps()];
  saveStoredMaps(maps);
  setActiveMapId(id);
  return newMap;
}

export function cloneToFutureState(sourceMap: ValueStreamMap): ValueStreamMap {
  const id = `vsm-future-${Date.now()}`;
  const now = new Date().toISOString();

  const scaledVendors = sourceMap.supplier.vendors?.map((v) => ({
    ...v,
    procurementWaitingDays: 0,
    deliveryLeadTimeDays: Math.max(0, Math.round(v.deliveryLeadTimeDays * 0.2)),
  }));

  const scaledRawMaterials = sourceMap.supplier.rawMaterials?.map((rm) => ({
    ...rm,
    stockUnits: Math.max(10, Math.round(rm.stockUnits * 0.5)),
  }));

  const futureMap: ValueStreamMap = {
    ...JSON.parse(JSON.stringify(sourceMap)),
    id,
    title: `${sourceMap.title} - Future State (Lean)`,
    stateType: 'future',
    parentMapId: sourceMap.id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    supplier: {
      ...sourceMap.supplier,
      procurementWaitingDays: 0,
      deliveryLeadTimeDays: Math.max(0, Math.round(sourceMap.supplier.deliveryLeadTimeDays * 0.2)),
      rawMaterialStockUnits: Math.max(10, Math.round(sourceMap.supplier.rawMaterialStockUnits * 0.5)),
      vendors: scaledVendors,
      rawMaterials: scaledRawMaterials,
    },
    demand: {
      ...sourceMap.demand,
      shippingHoldingDays: Math.max(1, Math.round(sourceMap.demand.shippingHoldingDays * 0.5)),
    },
    buffers: sourceMap.buffers.map((b) => ({
      ...b,
      id: `buf-fut-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      flowType: 'pull_kanban',
      wipQuantity: Math.max(2, Math.round((b.wipQuantity || 10) * 0.1)),
      kanbanCardsCount: 4,
    })),
    kaizenBursts: sourceMap.kaizenBursts.map((k) => ({
      ...k,
      status: 'in-progress',
    })),
    notes: `Derived Future State based on "${sourceMap.title}". Continuous flow, pull loops, and SMED optimizations applied.`,
  };

  const maps = [futureMap, ...getStoredMaps()];
  saveStoredMaps(maps);
  setActiveMapId(id);
  return futureMap;
}

export function deleteMap(id: string): ValueStreamMap[] {
  const maps = getStoredMaps().filter((m) => m.id !== id);
  saveStoredMaps(maps);
  if (getActiveMapId() === id && maps.length > 0) {
    setActiveMapId(maps[0].id);
  }
  return maps;
}

export function exportMapsToJson(): string {
  return JSON.stringify(getStoredMaps(), null, 2);
}

export function importMapsFromJson(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { success: false, count: 0, error: 'JSON does not contain a valid array of Value Stream Maps.' };
    }
    // Simple schema validation
    const valid = parsed.filter((m) => m.id && m.title && m.processes && m.demand);
    if (valid.length === 0) {
      return { success: false, count: 0, error: 'No maps met the expected VSM schema structure.' };
    }
    const currentMaps = getStoredMaps();
    const existingIds = new Set(currentMaps.map((m) => m.id));
    const merged = [...currentMaps];

    valid.forEach((m) => {
      if (existingIds.has(m.id)) {
        const idx = merged.findIndex((x) => x.id === m.id);
        merged[idx] = m;
      } else {
        merged.push(m);
      }
    });

    saveStoredMaps(merged);
    return { success: true, count: valid.length };
  } catch (err: unknown) {
    return { success: false, count: 0, error: (err as Error).message };
  }
}

export function resetToInitialDatasets(): ValueStreamMap[] {
  saveStoredMaps(INITIAL_MAPS);
  setActiveMapId(INITIAL_MAPS[0].id);
  return INITIAL_MAPS;
}
