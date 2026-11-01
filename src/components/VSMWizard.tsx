import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  TrendingDown,
  Building2,
  Package,
  Truck,
} from 'lucide-react';
import {
  ValueStreamMap,
  ProcessStep,
  InventoryBuffer,
  FlowType,
  VendorItem,
  RawMaterialItem,
} from '../types/vsm';
import {
  calculateVsmMetrics,
  getNormalizedSupplyChain,
  syncSupplierSummary,
} from '../utils/vsmMath';

interface VSMWizardProps {
  map: ValueStreamMap;
  onSave: (updated: ValueStreamMap) => void;
  onAutoSave?: (updated: ValueStreamMap) => void;
  onCancel: () => void;
}

export const VSMWizard: React.FC<VSMWizardProps> = ({
  map,
  onSave,
  onAutoSave,
  onCancel,
}) => {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [formData, setFormData] = useState<ValueStreamMap>(() => {
    const cloned: ValueStreamMap = JSON.parse(JSON.stringify(map));
    cloned.supplier = syncSupplierSummary(cloned.supplier);
    return cloned;
  });

  const formDataRef = useRef<ValueStreamMap>(formData);
  const onAutoSaveRef = useRef<typeof onAutoSave>(onAutoSave);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    onAutoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

  // Auto-save in-progress wizard changes to localStorage every 30 seconds
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (onAutoSaveRef.current) {
        onAutoSaveRef.current(formDataRef.current);
      }
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  const metrics = calculateVsmMetrics(formData);
  const supplyChain = getNormalizedSupplyChain(formData.supplier);

  // Helper to update demand
  const handleDemandChange = (field: keyof typeof formData.demand, value: any) => {
    setFormData((prev) => ({
      ...prev,
      demand: {
        ...prev.demand,
        [field]: value,
      },
    }));
  };

  // Multi-Vendor helpers
  const handleVendorChange = (index: number, field: keyof VendorItem, value: any) => {
    const updatedVendors = [...supplyChain.vendors];
    updatedVendors[index] = { ...updatedVendors[index], [field]: value };
    setFormData((prev) => ({
      ...prev,
      supplier: syncSupplierSummary({
        ...prev.supplier,
        vendors: updatedVendors,
      }),
    }));
  };

  const addVendor = () => {
    const newVendor: VendorItem = {
      id: `v-${Date.now()}`,
      vendorName: `Vendor ${supplyChain.vendors.length + 1}`,
      materialSupplied: 'Component / Raw Material',
      procurementWaitingDays: 3,
      deliveryLeadTimeDays: 7,
      transportMode: 'truck',
    };
    setFormData((prev) => ({
      ...prev,
      supplier: syncSupplierSummary({
        ...prev.supplier,
        vendors: [...supplyChain.vendors, newVendor],
      }),
    }));
  };

  const removeVendor = (index: number) => {
    if (supplyChain.vendors.length <= 1) return;
    const updatedVendors = supplyChain.vendors.filter((_, idx) => idx !== index);
    setFormData((prev) => ({
      ...prev,
      supplier: syncSupplierSummary({
        ...prev.supplier,
        vendors: updatedVendors,
      }),
    }));
  };

  // Multi-Raw-Material helpers
  const handleRawMaterialChange = (index: number, field: keyof RawMaterialItem, value: any) => {
    const updatedRM = [...supplyChain.rawMaterials];
    updatedRM[index] = { ...updatedRM[index], [field]: value };
    if (field === 'vendorId') {
      const matchedVendor = supplyChain.vendors.find((v) => v.id === value);
      if (matchedVendor) {
        updatedRM[index].vendorName = matchedVendor.vendorName;
      }
    }
    setFormData((prev) => ({
      ...prev,
      supplier: syncSupplierSummary({
        ...prev.supplier,
        rawMaterials: updatedRM,
      }),
    }));
  };

  const addRawMaterial = () => {
    const defaultVendor = supplyChain.vendors[0];
    const newRM: RawMaterialItem = {
      id: `rm-${Date.now()}`,
      materialName: `Raw Material ${supplyChain.rawMaterials.length + 1}`,
      vendorId: defaultVendor?.id,
      vendorName: defaultVendor?.vendorName || 'Primary Supplier',
      stockUnits: 300,
      unitOfMeasure: 'pcs',
    };
    setFormData((prev) => ({
      ...prev,
      supplier: syncSupplierSummary({
        ...prev.supplier,
        rawMaterials: [...supplyChain.rawMaterials, newRM],
      }),
    }));
  };

  const removeRawMaterial = (index: number) => {
    if (supplyChain.rawMaterials.length <= 1) return;
    const updatedRM = supplyChain.rawMaterials.filter((_, idx) => idx !== index);
    setFormData((prev) => ({
      ...prev,
      supplier: syncSupplierSummary({
        ...prev.supplier,
        rawMaterials: updatedRM,
      }),
    }));
  };

  // Helper to update information flow
  const handleInfoChange = (field: keyof typeof formData.informationFlow, value: any) => {
    setFormData((prev) => ({
      ...prev,
      informationFlow: {
        ...prev.informationFlow,
        [field]: value,
      },
    }));
  };

  // Process Steps helpers
  const handleProcessChange = (index: number, field: keyof ProcessStep, value: any) => {
    const updated = [...formData.processes];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, processes: updated }));
  };

  const addProcessStep = () => {
    const newId = `proc-${Date.now()}`;
    const newStep: ProcessStep = {
      id: newId,
      order: formData.processes.length + 1,
      name: `Operation ${formData.processes.length + 1}`,
      type: 'dedicated',
      cycleTimeSeconds: 60,
      changeoverSeconds: 0,
      uptimePercent: 100,
      qualityPercent: 98,
      operatorsCount: 1,
    };

    // Also add buffer before this new process if there is a previous process
    let updatedBuffers = [...formData.buffers];
    if (formData.processes.length > 0) {
      const prevProc = formData.processes[formData.processes.length - 1];
      const newBuffer: InventoryBuffer = {
        id: `buf-${Date.now()}`,
        afterProcessId: prevProc.id,
        wipQuantity: 100,
        calculatedDays: Number((100 / Math.max(1, formData.demand.dailyDemandUnits)).toFixed(2)),
        flowType: 'push',
      };
      updatedBuffers.push(newBuffer);
    }

    setFormData((prev) => ({
      ...prev,
      processes: [...prev.processes, newStep],
      buffers: updatedBuffers,
    }));
  };

  const removeProcessStep = (index: number) => {
    if (formData.processes.length <= 1) return;
    const procToRemove = formData.processes[index];
    const updatedProcesses = formData.processes.filter((_, i) => i !== index);
    const updatedBuffers = formData.buffers.filter(
      (b) => b.afterProcessId !== procToRemove.id
    );

    setFormData((prev) => ({
      ...prev,
      processes: updatedProcesses.map((p, i) => ({ ...p, order: i + 1 })),
      buffers: updatedBuffers,
    }));
  };

  // Buffer change helper
  const handleBufferChange = (bufferIndex: number, field: keyof InventoryBuffer, value: any) => {
    const updated = [...formData.buffers];
    const nextWip = field === 'wipQuantity' ? Number(value) : updated[bufferIndex].wipQuantity;
    updated[bufferIndex] = {
      ...updated[bufferIndex],
      [field]: value,
      calculatedDays: Number((nextWip / Math.max(1, formData.demand.dailyDemandUnits)).toFixed(2)),
    };
    setFormData((prev) => ({ ...prev, buffers: updated }));
  };

  // Get or synthesize the inventory buffer after a specific process step
  const getBufferForProcess = (afterProcessId: string, index: number): InventoryBuffer => {
    const existing = formData.buffers.find((b) => b.afterProcessId === afterProcessId);
    if (existing) {
      return {
        ...existing,
        calculatedDays: Number(
          (existing.wipQuantity / Math.max(1, formData.demand.dailyDemandUnits)).toFixed(2)
        ),
      };
    }
    return {
      id: `buf-${afterProcessId}-${index}`,
      afterProcessId,
      wipQuantity: 0,
      calculatedDays: 0,
      flowType: 'push',
    };
  };

  // Update or create an inventory buffer between process[i] and process[i+1]
  const handleBufferByProcessId = (
    afterProcessId: string,
    field: keyof InventoryBuffer,
    value: any
  ) => {
    setFormData((prev) => {
      const dailyDemand = Math.max(1, prev.demand.dailyDemandUnits);
      const existingIdx = prev.buffers.findIndex((b) => b.afterProcessId === afterProcessId);
      if (existingIdx >= 0) {
        const updated = [...prev.buffers];
        const current = updated[existingIdx];
        const nextWip = field === 'wipQuantity' ? Number(value) : current.wipQuantity;
        updated[existingIdx] = {
          ...current,
          [field]: value,
          calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
        };
        return { ...prev, buffers: updated };
      } else {
        const nextWip = field === 'wipQuantity' ? Number(value) : 0;
        const newBuf: InventoryBuffer = {
          id: `buf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          afterProcessId,
          wipQuantity: nextWip,
          calculatedDays: Number((nextWip / dailyDemand).toFixed(2)),
          flowType: field === 'flowType' ? (value as FlowType) : 'push',
        };
        return { ...prev, buffers: [...prev.buffers, newBuf] };
      }
    });
  };

  const handleFinish = () => {
    const dailyDemand = Math.max(1, formData.demand.dailyDemandUnits);
    const normalizedBuffers: InventoryBuffer[] = formData.processes
      .slice(0, -1)
      .map((proc, idx) => {
        const existing = formData.buffers.find((b) => b.afterProcessId === proc.id);
        if (existing) {
          return {
            ...existing,
            calculatedDays: Number((existing.wipQuantity / dailyDemand).toFixed(2)),
          };
        }
        return {
          id: `buf-${proc.id}-${idx}`,
          afterProcessId: proc.id,
          wipQuantity: 0,
          calculatedDays: 0,
          flowType: 'push',
        };
      });

    onSave({
      ...formData,
      buffers: normalizedBuffers,
      supplier: syncSupplierSummary(formData.supplier),
    });
  };

  const stepsList = [
    { num: 1, label: 'Customer Demand' },
    { num: 2, label: 'Process Steps' },
    { num: 3, label: 'Vendors, Raw Materials & WIP' },
    { num: 4, label: 'Information Flow' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
      {/* Wizard Progress Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-blue-600 tracking-wide uppercase">
            Step-by-Step VSM Generator
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            {formData.title}
          </h2>
        </div>

        {/* Wizard Steps Navigation */}
        <div className="flex items-center gap-1 sm:gap-2">
          {stepsList.map((s) => (
            <button
              key={s.num}
              onClick={() => setActiveStep(s.num)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeStep === s.num
                  ? 'bg-blue-600 text-white shadow-sm'
                  : activeStep > s.num
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span
                className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold ${
                  activeStep === s.num
                    ? 'bg-white text-blue-600'
                    : activeStep > s.num
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {s.num}
              </span>
              <span className="hidden md:inline whitespace-nowrap">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form Content with Sticky Live Scorecard */}
      <div className="flex-1 overflow-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Left 2 Columns: Step Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 1: Demand & Parameters */}
          {activeStep === 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Step 1: Figure Out Customer Demand &amp; Net Working Time
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Customer demand sets the heartbeat (Takt Time = Available Operating Seconds / Daily Demand).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Value Stream Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Family / Line
                  </label>
                  <input
                    type="text"
                    value={formData.productFamily}
                    onChange={(e) => setFormData({ ...formData, productFamily: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer / Market Name
                  </label>
                  <input
                    type="text"
                    value={formData.demand.customerName}
                    onChange={(e) => handleDemandChange('customerName', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Daily Customer Demand (Units/Day)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.demand.dailyDemandUnits}
                    onChange={(e) => handleDemandChange('dailyDemandUnits', Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Shifts per Day
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    value={formData.demand.shiftsPerDay}
                    onChange={(e) => handleDemandChange('shiftsPerDay', Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hours per Shift
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    step="0.5"
                    value={formData.demand.hoursPerShift}
                    onChange={(e) => handleDemandChange('hoursPerShift', Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Number of Breaks per Shift
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={formData.demand.breaksCount}
                    onChange={(e) => handleDemandChange('breaksCount', Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Duration per Break (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={formData.demand.breakMinutesEach}
                    onChange={(e) => handleDemandChange('breakMinutesEach', Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Takt Calculation Breakdown Callout */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-blue-900">
                      Takt Time Calculation: {metrics.taktTimeSeconds} seconds per unit
                    </p>
                    <p className="text-blue-700 font-mono">
                      Net Available Time (Ta) = {metrics.effectiveWorkingSeconds.toLocaleString()}s ÷ Demand (Td) = {formData.demand.dailyDemandUnits} units
                    </p>
                    <p className="text-slate-500">
                      To meet customer demand without overtime or backlogs, no process cycle time should exceed {metrics.taktTimeSeconds} seconds.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Process Steps & Data Boxes */}
          {activeStep === 2 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Step 2: Map and Design the Process Flow (Stations &amp; Data Boxes)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Enter Cycle Time (CT), Changeover (CO), Uptime (UT%), Quality Yield, and Operator counts.
                  </p>
                </div>
                <button
                  onClick={addProcessStep}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Station</span>
                </button>
              </div>

              <div className="space-y-4">
                {formData.processes.map((proc, index) => {
                  const isBottleneck = proc.cycleTimeSeconds > metrics.taktTimeSeconds;

                  return (
                    <div
                      key={proc.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        isBottleneck
                          ? 'border-red-300 bg-red-50/40'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={proc.name}
                            onChange={(e) => handleProcessChange(index, 'name', e.target.value)}
                            className="font-bold text-sm bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 text-slate-900"
                            placeholder="Operation Name"
                          />
                          {isBottleneck && (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-red-700 bg-red-100 rounded">
                              Exceeds Takt ({proc.cycleTimeSeconds}s &gt; {metrics.taktTimeSeconds}s)
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => removeProcessStep(index)}
                          disabled={formData.processes.length <= 1}
                          className="text-slate-400 hover:text-red-600 disabled:opacity-40 p-1"
                          title="Remove Operation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-500 mb-1 font-medium">
                            Cycle Time (CT)
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={proc.cycleTimeSeconds}
                              onChange={(e) =>
                                handleProcessChange(index, 'cycleTimeSeconds', Math.max(1, Number(e.target.value)))
                              }
                              className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 bg-white text-slate-900"
                            />
                            <span className="text-slate-400">sec</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1 font-medium">
                            Changeover (CO)
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={proc.changeoverSeconds}
                              onChange={(e) =>
                                handleProcessChange(index, 'changeoverSeconds', Math.max(0, Number(e.target.value)))
                              }
                              className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 bg-white text-slate-900"
                            />
                            <span className="text-slate-400">sec</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1 font-medium">
                            Uptime (UT %)
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={proc.uptimePercent}
                              onChange={(e) =>
                                handleProcessChange(index, 'uptimePercent', Math.min(100, Math.max(1, Number(e.target.value))))
                              }
                              className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 bg-white text-slate-900"
                            />
                            <span className="text-slate-400">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1 font-medium">
                            Quality Rate
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={proc.qualityPercent}
                              onChange={(e) =>
                                handleProcessChange(index, 'qualityPercent', Math.min(100, Math.max(1, Number(e.target.value))))
                              }
                              className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 bg-white text-slate-900"
                            />
                            <span className="text-slate-400">%</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1 font-medium">
                            Operators
                          </label>
                          <input
                            type="number"
                            min="0.25"
                            step="0.25"
                            value={proc.operatorsCount}
                            onChange={(e) =>
                              handleProcessChange(index, 'operatorsCount', Math.max(0.1, Number(e.target.value)))
                            }
                            className="w-full px-2 py-1.5 font-mono rounded border border-slate-200 bg-white text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Inline Inter-Process Inventory Triangle Level (between Process i and Process i+1) */}
                      {index < formData.processes.length - 1 && (() => {
                        const nextProc = formData.processes[index + 1];
                        const interBuf = getBufferForProcess(proc.id, index);
                        return (
                          <div className="mt-2 pt-3 border-t border-dashed border-slate-300 flex flex-wrap items-center justify-between gap-3 bg-amber-50/60 px-3 py-2.5 rounded-lg">
                            <div className="flex items-center gap-2.5">
                              {/* SVG Lean Inventory Triangle Symbol */}
                              <svg width="28" height="24" viewBox="0 0 32 28" className="shrink-0">
                                <polygon
                                  points="16,2 30,26 2,26"
                                  fill="#FFFFFF"
                                  stroke="#0F172A"
                                  strokeWidth="2.2"
                                />
                                <text
                                  x="16"
                                  y="22"
                                  textAnchor="middle"
                                  fontSize="11"
                                  fontWeight="900"
                                  fill="#0F172A"
                                >
                                  I
                                </text>
                              </svg>
                              <div>
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>Inventory Triangle between</span>
                                  <span className="text-blue-700">{proc.name}</span>
                                  <span className="text-slate-400">→</span>
                                  <span className="text-blue-700">{nextProc.name}</span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Visualized as an Inventory Triangle (▲) on the VSM Canvas · Adds{' '}
                                  <strong className="font-mono text-slate-800">
                                    {interBuf.calculatedDays}d
                                  </strong>{' '}
                                  to Total Lead Time
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <div className="flex items-center gap-1.5">
                                <label className="text-slate-600 font-semibold whitespace-nowrap">
                                  WIP Inventory (Units):
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="10"
                                  value={interBuf.wipQuantity}
                                  onChange={(e) =>
                                    handleBufferByProcessId(
                                      proc.id,
                                      'wipQuantity',
                                      Math.max(0, Number(e.target.value))
                                    )
                                  }
                                  className="w-24 px-2.5 py-1 font-mono font-bold rounded border border-slate-300 bg-white text-slate-900"
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <label className="text-slate-600 font-semibold whitespace-nowrap">
                                  Flow Mode:
                                </label>
                                <select
                                  value={interBuf.flowType}
                                  onChange={(e) =>
                                    handleBufferByProcessId(
                                      proc.id,
                                      'flowType',
                                      e.target.value as FlowType
                                    )
                                  }
                                  className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-800 font-medium"
                                >
                                  <option value="push">Push (Inventory Triangle)</option>
                                  <option value="pull_kanban">Pull (Kanban + Triangle)</option>
                                  <option value="fifo">FIFO Lane (+ Triangle)</option>
                                  <option value="pull_conwip">CONWIP (+ Triangle)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Multiple Vendors, Multiple Raw Materials & WIP Buffers */}
          {activeStep === 3 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-semibold text-slate-900">
                  Step 3: Multiple Vendors, Multiple Raw Materials &amp; WIP Buffers
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Configure all external vendors/suppliers, individual raw material stocks in the warehouse, and inter-station WIP queues.
                </p>
              </div>

              {/* SECTION A: MULTIPLE VENDORS / SUPPLIERS */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        External Vendors / Suppliers ({supplyChain.vendors.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Add all vendors supplying raw materials. The longest vendor lead time governs the critical path.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addVendor}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Vendor</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {supplyChain.vendors.map((vendor, vIdx) => {
                    const isCritical = vendor.id === supplyChain.criticalVendor.id && supplyChain.vendors.length > 1;
                    return (
                      <div
                        key={vendor.id}
                        className={`p-3.5 rounded-xl bg-white border transition-all space-y-3 ${
                          isCritical ? 'border-blue-400 ring-1 ring-blue-500/20' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                              Vendor #{vIdx + 1}
                            </span>
                            {isCritical && (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                                Critical Path Lead Time ({vendor.procurementWaitingDays + vendor.deliveryLeadTimeDays}d total)
                              </span>
                            )}
                          </div>
                          {supplyChain.vendors.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeVendor(vIdx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                              title="Remove Vendor"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                          <div className="sm:col-span-2">
                            <label className="block text-slate-500 mb-1 font-medium">
                              Vendor / Company Name
                            </label>
                            <input
                              type="text"
                              value={vendor.vendorName}
                              onChange={(e) => handleVendorChange(vIdx, 'vendorName', e.target.value)}
                              placeholder="e.g., ChemResin Polymers"
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1 font-medium">
                              Order Wait (Days)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={vendor.procurementWaitingDays}
                              onChange={(e) =>
                                handleVendorChange(vIdx, 'procurementWaitingDays', Math.max(0, Number(e.target.value)))
                              }
                              className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-slate-200 text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1 font-medium">
                              Transit Time (Days)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={vendor.deliveryLeadTimeDays}
                              onChange={(e) =>
                                handleVendorChange(vIdx, 'deliveryLeadTimeDays', Math.max(0, Number(e.target.value)))
                              }
                              className="w-full px-2.5 py-1.5 font-mono rounded-lg border border-slate-200 text-slate-900"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 mb-1 font-medium">
                              Transport Mode
                            </label>
                            <select
                              value={vendor.transportMode}
                              onChange={(e) =>
                                handleVendorChange(vIdx, 'transportMode', e.target.value as VendorItem['transportMode'])
                              }
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                            >
                              <option value="truck">Truck Freight</option>
                              <option value="train">Rail Freight</option>
                              <option value="ship">Ocean Vessel</option>
                              <option value="air">Air Cargo</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: MULTIPLE RAW MATERIALS IN WAREHOUSE */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Raw Materials in Warehouse ({supplyChain.rawMaterials.length} Items · Total: {supplyChain.totalRawMaterialUnits.toLocaleString()} Units)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        List each raw material stored in the warehouse, its supplying vendor, and current inventory level.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addRawMaterial}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Raw Material</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {supplyChain.rawMaterials.map((rm, rmIdx) => {
                    const rmAgingDays = (
                      (rm.stockUnits || 0) / Math.max(1, formData.demand.dailyDemandUnits)
                    ).toFixed(2);

                    return (
                      <div
                        key={rm.id}
                        className="p-3 rounded-xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs"
                      >
                        <div className="sm:col-span-4">
                          <label className="block text-slate-500 mb-1 font-medium">
                            Raw Material Name / SKU
                          </label>
                          <input
                            type="text"
                            value={rm.materialName}
                            onChange={(e) => handleRawMaterialChange(rmIdx, 'materialName', e.target.value)}
                            placeholder="e.g., Alkyd Base Resin"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-900"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-slate-500 mb-1 font-medium">
                            Supplied By Vendor
                          </label>
                          <select
                            value={rm.vendorId || ''}
                            onChange={(e) => handleRawMaterialChange(rmIdx, 'vendorId', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800"
                          >
                            {supplyChain.vendors.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.vendorName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-slate-500 mb-1 font-medium">
                            Warehouse Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={rm.stockUnits}
                            onChange={(e) =>
                              handleRawMaterialChange(rmIdx, 'stockUnits', Math.max(0, Number(e.target.value)))
                            }
                            className="w-full px-2.5 py-1.5 font-mono font-bold rounded-lg border border-slate-200 text-slate-900"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-slate-500 mb-1 font-medium">
                            Unit &amp; Aging
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={rm.unitOfMeasure || 'pcs'}
                              onChange={(e) => handleRawMaterialChange(rmIdx, 'unitOfMeasure', e.target.value)}
                              className="w-14 px-2 py-1.5 rounded-lg border border-slate-200 text-slate-700 font-mono text-center"
                            />
                            <span className="font-mono text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                              {rmAgingDays}d
                            </span>
                          </div>
                        </div>

                        <div className="sm:col-span-1 flex justify-end pb-1">
                          {supplyChain.rawMaterials.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRawMaterial(rmIdx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                              title="Remove Raw Material"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Finished Goods Holding Time */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>Outbound Finished Goods Warehouse Holding Time:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.demand.shippingHoldingDays}
                      onChange={(e) => handleDemandChange('shippingHoldingDays', Math.max(0, Number(e.target.value)))}
                      className="w-24 px-3 py-1.5 font-mono font-bold rounded-lg border border-slate-200 bg-white text-slate-900"
                    />
                    <span className="text-slate-500 font-medium">days before customer shipment</span>
                  </div>
                </div>
              </div>

              {/* SECTION C: INTER-PROCESS INVENTORY TRIANGLES (WIP LEVELS BETWEEN STEPS) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <svg width="26" height="22" viewBox="0 0 32 28" className="shrink-0">
                      <polygon
                        points="16,2 30,26 2,26"
                        fill="#FFFFFF"
                        stroke="#0F172A"
                        strokeWidth="2.4"
                      />
                      <text
                        x="16"
                        y="22"
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="900"
                        fill="#0F172A"
                      >
                        I
                      </text>
                    </svg>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Inter-Process Inventory Triangles &amp; Flow Control ({Math.max(0, formData.processes.length - 1)} Triangles)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Track work-in-process (WIP) inventory levels between each pair of process steps. Rendered as Lean Inventory Triangles (▲) on the VSM Canvas.
                      </p>
                    </div>
                  </div>
                </div>

                {formData.processes.length <= 1 ? (
                  <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 text-center">
                    Add at least 2 process steps in Step 2 to track inter-process inventory triangles between stations.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {formData.processes.slice(0, -1).map((proc, idx) => {
                      const nextProc = formData.processes[idx + 1];
                      const buf = getBufferForProcess(proc.id, idx);
                      const days = (
                        buf.wipQuantity / Math.max(1, formData.demand.dailyDemandUnits)
                      ).toFixed(2);

                      return (
                        <div
                          key={proc.id}
                          className="p-3.5 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                              <svg width="24" height="20" viewBox="0 0 32 28">
                                <polygon
                                  points="16,2 30,26 2,26"
                                  fill="#FFFFFF"
                                  stroke="#0F172A"
                                  strokeWidth="2.4"
                                />
                                <text
                                  x="16"
                                  y="22"
                                  textAnchor="middle"
                                  fontSize="11"
                                  fontWeight="900"
                                  fill="#0F172A"
                                >
                                  I
                                </text>
                              </svg>
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                                  Triangle #{idx + 1}
                                </span>
                                <span>{proc.name}</span>
                                <span className="text-slate-400">→</span>
                                <span>{nextProc.name}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Storage Waiting Delay:{' '}
                                <strong className="font-mono text-amber-700">{days} days</strong> (
                                {buf.wipQuantity.toLocaleString()} units ÷{' '}
                                {formData.demand.dailyDemandUnits}/day)
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <div>
                              <label className="block text-[11px] text-slate-500 font-medium mb-1">
                                Inventory Level (WIP Units)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={buf.wipQuantity}
                                onChange={(e) =>
                                  handleBufferByProcessId(
                                    proc.id,
                                    'wipQuantity',
                                    Math.max(0, Number(e.target.value))
                                  )
                                }
                                className="w-28 px-2.5 py-1.5 font-mono font-bold rounded-lg border border-slate-200 bg-white text-slate-900"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-500 font-medium mb-1">
                                Material Flow Mode
                              </label>
                              <select
                                value={buf.flowType}
                                onChange={(e) =>
                                  handleBufferByProcessId(
                                    proc.id,
                                    'flowType',
                                    e.target.value as FlowType
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 font-medium"
                              >
                                <option value="push">Push (Inventory Triangle + Striped Arrow)</option>
                                <option value="pull_kanban">Pull (Inventory Triangle + Kanban Loop)</option>
                                <option value="fifo">FIFO Lane (Inventory Triangle + FIFO)</option>
                                <option value="pull_conwip">CONWIP (Inventory Triangle + Cap)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Information Flow */}
          {activeStep === 4 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Step 4: Map the Information Flow &amp; Production Scheduling
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Connect customer ordering, centralized control, MRP/ERP systems, and floor scheduling.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">
                    Control Department / Center Name
                  </label>
                  <input
                    type="text"
                    value={formData.informationFlow.controlDepartment}
                    onChange={(e) => handleInfoChange('controlDepartment', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-medium">
                    Customer Order Input Channel
                  </label>
                  <select
                    value={formData.informationFlow.orderReceptionChannel}
                    onChange={(e) => handleInfoChange('orderReceptionChannel', e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Electronic EDI/Web">Electronic EDI / Web Portal</option>
                    <option value="Phone & Manual Memos">Phone &amp; Manual Memos</option>
                    <option value="Email & Spreadsheets">Email &amp; Spreadsheets</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-medium">
                    Floor Distribution Method
                  </label>
                  <select
                    value={formData.informationFlow.scheduleDistribution}
                    onChange={(e) => handleInfoChange('scheduleDistribution', e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Floor Supervisors">Floor Supervisors</option>
                    <option value="Electronic Kanban">Electronic Kanban Broadcast</option>
                    <option value="Physical Kanban Post">Physical Kanban Post</option>
                    <option value="Heijunka Box">Heijunka Load-Leveling Box</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1 font-medium">
                    Schedule Dispatch Cadence
                  </label>
                  <select
                    value={formData.informationFlow.scheduleFrequency}
                    onChange={(e) => handleInfoChange('scheduleFrequency', e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Daily">Daily Dispatch</option>
                    <option value="Weekly">Weekly Batch</option>
                    <option value="Bi-Weekly">Bi-Weekly Batch</option>
                    <option value="Heijunka Leveling">Heijunka Leveling (by Volume)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Bottom Navigation Buttons */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {activeStep > 1 && (
                <button
                  onClick={() => setActiveStep(activeStep - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
              )}

              {activeStep < 4 ? (
                <button
                  onClick={() => setActiveStep(activeStep + 1)}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  className="flex items-center gap-1.5 px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save &amp; Generate Map</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Real-Time Calculation & Diagnostic Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live VSM Calculations
            </h3>

            {/* Capability Flag */}
            <div
              className={`p-3 rounded-lg border text-xs ${
                metrics.isDemandMet
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 mb-1">
                {metrics.isDemandMet ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Demand Can Be Met</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span>Demand Cannot Be Met</span>
                  </>
                )}
              </div>
              <p className="text-[11px] opacity-90">
                {metrics.isDemandMet
                  ? 'All station cycle times and total line pace are lower than customer Takt Time.'
                  : `Bottleneck at ${metrics.bottleneckProcessName} (${metrics.maxCycleTimeSeconds}s vs Takt ${metrics.taktTimeSeconds}s).`}
              </p>
            </div>

            {/* Key Metrics */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Takt Time (T):</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {metrics.taktTimeSeconds}s
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Total Process Time:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {metrics.totalProcessTimeSeconds}s
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Total Operators:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {metrics.totalOperators}
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Line Cycle Time:</span>
                <span
                  className={`font-mono font-bold ${
                    metrics.cycleTimeSeconds > metrics.taktTimeSeconds ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {metrics.cycleTimeSeconds}s
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Storage Time:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {metrics.storageTimeDays} days
                </span>
              </div>

              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Total Lead Time:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {metrics.leadTimeDays} days
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Flow Efficiency:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {metrics.flowEfficiencyPercent}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
