import React, { useState } from 'react';
import { X, Layers, CheckCircle2 } from 'lucide-react';

interface SymbolLegendModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SymbolLegendModal: React.FC<SymbolLegendModalProps> = ({ isOpen, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'process' | 'material' | 'info' | 'general'>('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Official Lean VSM Symbol Guide (TPS Standard)
              </h3>
              <p className="text-xs text-slate-500">
                Visual symbology and definitions based on the Value Stream Mapping Masterclass.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Symbols
          </button>
          <button
            onClick={() => setActiveCategory('process')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeCategory === 'process'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Process Flow
          </button>
          <button
            onClick={() => setActiveCategory('material')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeCategory === 'material'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Material Flow
          </button>
          <button
            onClick={() => setActiveCategory('info')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeCategory === 'info'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Information Flow
          </button>
          <button
            onClick={() => setActiveCategory('general')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeCategory === 'general'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            General &amp; Timeline
          </button>
        </div>

        {/* Symbols Grid with Real SVG Graphics */}
        <div className="flex-1 overflow-auto p-6 space-y-8 text-xs">
          {/* 1. PROCESS FLOW SYMBOLS */}
          {(activeCategory === 'all' || activeCategory === 'process') && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-900 pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>1. Process Flow Symbols (Slides 35-36)</span>
                <span className="text-xs font-normal text-slate-500">Operation &amp; Physical Stations</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer / Supplier Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <path
                        d="M 5 15 L 5 40 L 65 40 L 65 15 L 50 23 L 50 15 L 35 23 L 35 15 L 20 23 L 20 15 Z"
                        fill="#F8FAFC"
                        stroke="#0F172A"
                        strokeWidth="1.5"
                      />
                      <text x="35" y="32" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#0F172A">
                        CUSTOMER / SUPPLIER
                      </text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Customer / Supplier Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Represents material origins (Supplier at upper left) and destinations (Customer at upper right).
                    </p>
                  </div>
                </div>

                {/* Dedicated Process Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <rect x="5" y="5" width="60" height="34" rx="2" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <line x1="5" y1="16" x2="65" y2="16" stroke="#0F172A" strokeWidth="1" />
                      <text x="35" y="13" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#0F172A">
                        PROCESS
                      </text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Dedicated Process Flow</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      A dedicated machine, workstation, or department through which material flows with set internal continuous flow.
                    </p>
                  </div>
                </div>

                {/* Shared Process Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <rect x="5" y="5" width="60" height="34" rx="2" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <rect x="9" y="9" width="52" height="26" fill="none" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 1" />
                      <text x="35" y="24" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#0F172A">
                        SHARED PROCESS
                      </text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Shared Process Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Represents a machine or work center shared across multiple product families (e.g. heat treat or CMM inspection).
                    </p>
                  </div>
                </div>

                {/* Data Box Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <rect x="5" y="3" width="60" height="38" rx="2" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.25" />
                      <line x1="5" y1="12" x2="65" y2="12" stroke="#CBD5E1" strokeWidth="1" />
                      <line x1="5" y1="21" x2="65" y2="21" stroke="#CBD5E1" strokeWidth="1" />
                      <line x1="5" y1="30" x2="65" y2="30" stroke="#CBD5E1" strokeWidth="1" />
                      <text x="8" y="10" fontSize="5.5" fill="#334155">CT: 87 seconds</text>
                      <text x="8" y="19" fontSize="5.5" fill="#334155">CO: 0 seconds</text>
                      <text x="8" y="28" fontSize="5.5" fill="#334155">UT: 100%</text>
                      <text x="8" y="37" fontSize="5.5" fill="#334155">Quality: 98%</text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Data Box Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Standard operational data box listing Cycle Time (CT), Changeover (CO), Uptime %, and Quality Rate.
                    </p>
                  </div>
                </div>

                {/* Warehouse Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <rect x="10" y="5" width="50" height="35" rx="1" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <line x1="10" y1="15" x2="60" y2="15" stroke="#0F172A" strokeWidth="1.25" />
                      <rect x="15" y="25" width="12" height="15" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1" />
                      <text x="35" y="12" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#0F172A">
                        WAREHOUSE
                      </text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Warehouse Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Facility where incoming supplier raw materials or finished products awaiting shipment are stored.
                    </p>
                  </div>
                </div>

                {/* Cross-Dock Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <rect x="10" y="5" width="50" height="35" rx="1" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <line x1="10" y1="5" x2="60" y2="40" stroke="#0F172A" strokeWidth="1.25" />
                      <line x1="60" y1="5" x2="10" y2="40" stroke="#0F172A" strokeWidth="1.25" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Cross-Dock Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Dock facility that transfers incoming goods directly to outbound shipping without long-term storage or inspection.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. MATERIAL FLOW SYMBOLS */}
          {(activeCategory === 'all' || activeCategory === 'material') && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-900 pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>2. Material Flow Symbols (Slides 39-40)</span>
                <span className="text-xs font-normal text-slate-500">Buffers, Shipments &amp; Inventory</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Inventory Triangle */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <polygon points="35,5 55,38 15,38" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <text x="35" y="30" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#0F172A">
                        I
                      </text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Inventory Icon (Triangle)</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Identifies stagnant Work-in-Progress (WIP) or buffer materials accumulated between two operational steps.
                    </p>
                  </div>
                </div>

                {/* Push Striped Arrow */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <defs>
                        <pattern id="legend-push-stripes" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                          <line x1="0" y1="0" x2="0" y2="6" stroke="#000000" strokeWidth="3" />
                        </pattern>
                      </defs>
                      <path
                        d="M 5 15 L 45 15 L 45 7 L 65 22.5 L 45 38 L 45 30 L 5 30 Z"
                        fill="url(#legend-push-stripes)"
                        stroke="#0F172A"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Push Arrow (Striped Arrow)</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Signifies batch movement where materials are pushed to the next workstation regardless of immediate downstream demand.
                    </p>
                  </div>
                </div>

                {/* Supermarket Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <path
                        d="M 15 10 L 55 10 L 55 35 L 15 35 M 55 18 L 25 18 M 55 26 L 25 26"
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Supermarket Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      A controlled Kanban stock point where parts are maintained in small quantities and replenished on customer pull.
                    </p>
                  </div>
                </div>

                {/* Material Pull Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <path
                        d="M 45 20 A 15 15 0 1 1 35 10"
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="2"
                      />
                      <polygon points="35,5 35,15 25,10" fill="#0F172A" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Material Pull Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Indicates physical withdrawal of parts from a supermarket by downstream processes when consumed.
                    </p>
                  </div>
                </div>

                {/* FIFO Lane Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <rect x="5" y="12" width="60" height="20" rx="3" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <text x="35" y="25" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0F172A">
                        ➡ FIFO ➡
                      </text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">FIFO Lane Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      First-In-First-Out lane that physically limits buffer queue size between operations to maintain sequential flow.
                    </p>
                  </div>
                </div>

                {/* External Shipment Truck */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <rect x="10" y="15" width="34" height="20" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" rx="1" />
                      <path d="M 44 22 L 54 22 L 58 27 L 58 35 L 44 35 Z" fill="#E2E8F0" stroke="#0F172A" strokeWidth="1.5" />
                      <circle cx="20" cy="35" r="4" fill="#0F172A" />
                      <circle cx="50" cy="35" r="4" fill="#0F172A" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">External Shipment (Truck)</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Movement of materials via external logistics transport, showing transit lead time and delivery frequency.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. INFORMATION FLOW SYMBOLS */}
          {(activeCategory === 'all' || activeCategory === 'info') && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-900 pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>3. Information Flow Symbols (Slides 43-45)</span>
                <span className="text-xs font-normal text-slate-500">Schedules, Kanbans &amp; Controls</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Electronic Info (Lightning Arrow) */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <path
                        d="M 5 22 L 25 22 L 20 32 L 45 12 L 40 22 L 60 22"
                        fill="none"
                        stroke="#0F172A"
                        strokeWidth="2"
                      />
                      <polygon points="60,18 67,22 60,26" fill="#0F172A" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Electronic Info (Lightning Arrow)</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Information flowing digitally via EDI, internet, ERP, or automated networks (e.g. daily digital orders).
                    </p>
                  </div>
                </div>

                {/* Manual Info (Straight Arrow) */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <line x1="10" y1="22" x2="55" y2="22" stroke="#0F172A" strokeWidth="2" />
                      <polygon points="55,17 65,22 55,27" fill="#0F172A" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Manual Info Flow</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Information transmitted through physical memos, verbal communication, paper reports, or meetings.
                    </p>
                  </div>
                </div>

                {/* Production Kanban Card */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <line x1="5" y1="22" x2="18" y2="22" stroke="#0F172A" strokeWidth="1.25" strokeDasharray="2 2" />
                      <path d="M 20 12 L 44 12 L 50 18 L 50 32 L 20 32 Z" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <line x1="50" y1="22" x2="65" y2="22" stroke="#0F172A" strokeWidth="1.25" strokeDasharray="2 2" />
                      <polygon points="62,19 67,22 62,25" fill="#0F172A" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Production Kanban</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Signals an upstream operation to manufacture a specified quantity of parts.
                    </p>
                  </div>
                </div>

                {/* Load Leveling (Heijunka Box) */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <rect x="10" y="12" width="50" height="22" rx="2" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <text x="35" y="27" textAnchor="middle" fontSize="10" fontWeight="extrabold" fill="#0F172A" letterSpacing="0.1em">
                        OXOX
                      </text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Load Leveling (Heijunka)</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Batches and distributes Kanbans to level production volume and mix smoothly over time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. GENERAL SYMBOLS & TIMELINE */}
          {(activeCategory === 'all' || activeCategory === 'general') && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-900 pb-1 border-b border-slate-200 flex items-center justify-between">
                <span>4. General Symbols &amp; Sawtooth Timeline (Slide 48)</span>
                <span className="text-xs font-normal text-slate-500">Continuous Improvement &amp; Lead Time</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kaizen Burst */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <path
                        d="M 35,5 L 39,15 L 49,9 L 45,19 L 55,17 L 47,24 L 53,33 L 43,30 L 41,39 L 35,32 L 29,39 L 27,30 L 17,33 L 23,24 L 15,17 L 25,19 L 21,9 L 31,15 Z"
                        fill="#F59E0B"
                        stroke="#B45309"
                        strokeWidth="1.5"
                      />
                      <text x="35" y="26" textAnchor="middle" fontSize="6.5" fontWeight="extrabold" fill="#FFFFFF">
                        KAIZEN
                      </text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Kaizen Lightening Burst</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Highlights a high-priority improvement workshop or SMED effort needed to unlock future state continuous flow.
                    </p>
                  </div>
                </div>

                {/* Operator Icon */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-24 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="70" height="45" viewBox="0 0 70 45">
                      <circle cx="35" cy="22" r="14" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1.5" />
                      <circle cx="35" cy="22" r="5" fill="#0F172A" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Operator Icon</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Concentric circle showing the number of full-time operators assigned to work at a specific workstation.
                    </p>
                  </div>
                </div>

                {/* Sawtooth Timeline */}
                <div className="flex items-center gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 md:col-span-2">
                  <div className="w-32 h-16 flex items-center justify-center shrink-0 bg-white rounded-lg border border-slate-200 shadow-xs">
                    <svg width="100" height="45" viewBox="0 0 100 45">
                      <line x1="5" y1="12" x2="30" y2="12" stroke="#0F172A" strokeWidth="2" />
                      <line x1="30" y1="12" x2="30" y2="32" stroke="#0F172A" strokeWidth="2" />
                      <line x1="30" y1="32" x2="65" y2="32" stroke="#10B981" strokeWidth="2.5" />
                      <line x1="65" y1="32" x2="65" y2="12" stroke="#0F172A" strokeWidth="2" />
                      <line x1="65" y1="12" x2="95" y2="12" stroke="#0F172A" strokeWidth="2" />
                      <text x="18" y="9" textAnchor="middle" fontSize="6.5" fill="#64748B">3 DAYS</text>
                      <text x="47" y="41" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#047857">87 SEC</text>
                      <text x="80" y="9" textAnchor="middle" fontSize="6.5" fill="#64748B">2 DAYS</text>
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">Sawtooth Stepped Timeline</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                      Visual waveform contrasting Non-Value-Added waiting time (upper line, in days) with Value-Added processing time (lower line, in seconds). Essential for total lead time calculation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
          >
            Close Symbol Reference
          </button>
        </div>
      </div>
    </div>
  );
};
