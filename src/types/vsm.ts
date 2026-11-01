/**
 * Value Stream Mapping (VSM) Core Type Definitions
 * Modern Interactive Lean Manufacturing & Value Stream Architecture
 */

export type WasteCategory =
  | 'Overproduction'
  | 'Waiting'
  | 'Transport'
  | 'Overprocessing'
  | 'Inventory'
  | 'Motion'
  | 'Defects';

export type FlowType = 'push' | 'pull_conwip' | 'pull_kanban' | 'fifo' | 'supermarket';

export interface ProcessStep {
  id: string;
  order: number;
  name: string;
  type: 'dedicated' | 'shared';
  cycleTimeSeconds: number;
  changeoverSeconds: number;
  uptimePercent: number;
  qualityPercent: number;
  operatorsCount: number;
  batchSize?: number;
  notes?: string;
  x?: number; // Custom draggable X offset on canvas
  y?: number; // Custom draggable Y offset on canvas
}

export interface InventoryBuffer {
  id: string;
  afterProcessId: string; // 'raw_materials' or process ID
  wipQuantity: number;
  calculatedDays: number;
  flowType: FlowType;
  kanbanCardsCount?: number;
  safetyStockDays?: number;
  x?: number; // Custom draggable X offset on canvas
  y?: number; // Custom draggable Y offset on canvas
}

export interface KaizenBurst {
  id: string;
  nodeId: string; // process ID, buffer ID, or info step
  nodeName: string;
  title: string;
  description: string;
  wasteCategory: WasteCategory;
  priority: 'high' | 'medium' | 'low';
  status: 'identified' | 'in-progress' | 'implemented';
  owner: string;
  targetDate: string;
  expectedGain: string;
  actionPlan?: string;
  createdAt: string;
  x?: number; // Custom draggable X offset on canvas
  y?: number; // Custom draggable Y offset on canvas
}

export interface CustomCanvasNode {
  id: string;
  symbolType: 'cross_dock' | 'safety_stock' | 'heijunka_box' | 'go_see' | 'verbal_info' | 'kanban_post' | 'note_box';
  label: string;
  subLabel?: string;
  x: number;
  y: number;
}

export interface CustomerDemand {
  customerName: string;
  dailyDemandUnits: number;
  shiftsPerDay: number;
  hoursPerShift: number;
  breaksCount: number;
  breakMinutesEach: number;
  shippingFrequency: string;
  shippingHoldingDays: number;
  isCustomOrder: boolean;
  x?: number;
  y?: number;
  finishedWarehouseX?: number;
  finishedWarehouseY?: number;
}

export interface VendorItem {
  id: string;
  vendorName: string;
  materialSupplied?: string;
  procurementWaitingDays: number;
  deliveryLeadTimeDays: number;
  transportMode: 'truck' | 'train' | 'ship' | 'air';
}

export interface RawMaterialItem {
  id: string;
  materialName: string;
  vendorId?: string;
  vendorName?: string;
  stockUnits: number;
  unitOfMeasure?: string;
}

export interface SupplierInfo {
  supplierName: string;
  procurementWaitingDays: number;
  deliveryLeadTimeDays: number;
  transportMode: 'truck' | 'train' | 'ship' | 'air';
  rawMaterialStockUnits: number;
  vendors?: VendorItem[];
  rawMaterials?: RawMaterialItem[];
  x?: number;
  y?: number;
  rawWarehouseX?: number;
  rawWarehouseY?: number;
}

export interface InformationFlow {
  controlDepartment: string;
  orderReceptionChannel: 'Electronic EDI/Web' | 'Phone & Manual Memos' | 'Email & Spreadsheets';
  hasDatabaseStorage: boolean;
  createBuyingList: boolean;
  preliminaryScheduleDays: number;
  weeklySchedule: boolean;
  scheduleDistribution: 'Floor Supervisors' | 'Electronic Kanban' | 'Physical Kanban Post' | 'Heijunka Box';
  scheduleFrequency: 'Daily' | 'Weekly' | 'Bi-Weekly' | 'Heijunka Leveling';
  x?: number;
  y?: number;
}

export type BottleneckSeverity = 'critical' | 'warning' | 'pacemaker' | 'optimal';

export interface ProcessBottleneckAnalysis {
  processId: string;
  processName: string;
  order: number;
  cycleTimeSeconds: number;
  effectiveCycleTimeSeconds: number;
  taktTimeSeconds: number;
  ctToTaktRatio: number;
  ctToTaktPercent: number;
  effectiveToTaktRatio: number;
  deltaFromTaktSeconds: number;
  rank: number;
  isPrimaryBottleneck: boolean;
  isOverTakt: boolean;
  isNearTakt: boolean;
  severity: BottleneckSeverity;
}

export interface CalculatedMetrics {
  effectiveWorkingSeconds: number;
  taktTimeSeconds: number;
  totalProcessTimeSeconds: number;
  cycleTimeSeconds: number;
  storageTimeDays: number;
  leadTimeDays: number;
  flowEfficiencyPercent: number;
  isDemandMet: boolean;
  bottleneckProcessId: string | null;
  bottleneckProcessName: string | null;
  maxCycleTimeSeconds: number;
  maxCtToTaktRatio: number;
  overTaktCount: number;
  nearTaktCount: number;
  bottleneckAnalysis: ProcessBottleneckAnalysis[];
  totalOperators: number;
  totalWipUnits: number;
}

export interface ValueStreamMap {
  id: string;
  title: string;
  organization: string;
  productFamily: string;
  author: string;
  version: number;
  stateType: 'current' | 'future';
  parentMapId?: string;
  createdAt: string;
  updatedAt: string;
  demand: CustomerDemand;
  supplier: SupplierInfo;
  informationFlow: InformationFlow;
  processes: ProcessStep[];
  buffers: InventoryBuffer[];
  kaizenBursts: KaizenBurst[];
  customNodes?: CustomCanvasNode[];
  notes?: string;
}

export interface StateComparisonMetrics {
  current: CalculatedMetrics;
  future: CalculatedMetrics;
  deltas: {
    leadTimeDaysReduction: number;
    leadTimeReductionPercent: number;
    storageTimeDaysReduction: number;
    processTimeSecondsReduction: number;
    cycleTimeSecondsReduction: number;
    flowEfficiencyGainPercent: number;
    wipUnitsReduction: number;
    wipReductionPercent: number;
    isDemandMetCurrent: boolean;
    isDemandMetFuture: boolean;
  };
}
