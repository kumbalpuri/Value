# Value Stream Map (VSM) Studio & Lean Optimizer

A comprehensive enterprise Value Stream Mapping web application designed to automatically generate authentic Lean VSMs (information flow, material flow, data boxes, and timeline sawteeth), perform automated calculations (Lead Time, Storage Time, Takt Time, Cycle Time, Flow Efficiency), track Kaizen bursts, compare Current vs. Future states side-by-side, and archive organizational maps.

## User Review & Critical Decisions

> [!IMPORTANT]
> Based on your responses during the clarification phase, the core direction has been established:
> - **Builder Mode**: Universal custom builder with user-defined process stages, while including pre-populated industrial reference data (e.g., the complete 4-stage paint manufacturing case study from the Masterclass guide) so users can explore immediately.
> - **Input Experience**: Step-by-step guided data wizard (Customer Demand & Shifts → Process Steps & Operators → Inventory Buffers & Lead Times → Information Scheduling) with instant live interactive SVG canvas preview.
> - **Lean Analysis & Comparison Suite**: High-impact side-by-side Current vs. Future state comparison with metrics delta (Lead Time % reduction, Flow Efficiency gain), an interactive Kaizen Burst action tracker (with owners, difficulty, status, and target dates), and a Cycle Time vs. Takt Time balance bar chart with 7-Waste (Muda) detection.
> - **Persistence & Archive**: LocalStorage with auto-save, JSON import/export, and ready-made export options (high-res SVG & PNG diagram snapshot, summary PDF-ready print layout) to archive and share VSMs across the organization.

---

## 1. Overview & Core Concept

Value Stream Mapping is the cornerstone of Lean manufacturing and operational excellence. This application turns complex, multi-day manual mapping into an intuitive, automated software experience:
- **Automated VSM Generation**: Users input customer demand (daily orders, working hours, break schedules), process steps (Cycle Time, Changeover time, Uptime, Quality yield, Operators), inventory buffers (WIP count, aging in days), and information flow (electronic/manual, ERP/MRP, weekly schedule distribution). The app automatically constructs standard Lean VSM diagrams adhering strictly to the symbols outlined in the masterclass.
- **Accurate Mathematical Engine**:
  - $Takt\ Time = \frac{Net\ Available\ Operating\ Time\ (T_a)}{Total\ Customer\ Demand\ (T_d)}$
  - $Lead\ Time = \text{Sum of all inventory buffer aging} + \text{Supplier arrival delay} + \text{Customer shipping hold}$
  - $Process\ Time = \sum \text{Processing Time of all steps}$
  - $Cycle\ Time = \frac{Process\ Time}{\text{Total Operators}}$
  - $Flow\ Efficiency\ (\%) = \frac{Process\ Time}{Lead\ Time} \times 100$
- **Kaizen Burst Integration**: Pin visual Kaizen lightening bursts onto specific bottlenecks, inventory buffers, or information loops with actionable problem statements, expected gains, owners, and target dates.
- **Before & Future State Engine**: Clone a Current State map directly into a Future State sandbox. Apply Lean foundation tactics (Continuous Flow, CONWIP/Kanban card loops, SMED changeover reduction, 5S/Quality error-proofing, inventory buffer trimming) and evaluate dramatic reductions in Lead Time and WIP.
- **Organizational Archive**: Searchable, taggable repository of all organizational maps with versioning, audit metadata, and quick cloning.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Explore & Archive View**:
   - The user lands on the VSM Archive dashboard displaying active value streams with key metrics (Lead Time, Takt Time, Flow Efficiency, Bottleneck status).
   - Filter by business unit, product family, or state (Current vs. Future). Quick-actions to "New VSM", "Clone to Future State", or "Export".
2. **VSM Guided Wizard (4-Phase Builder)**:
   - *Phase 1: Demand & Parameters*: Product family name, daily customer demand, shift duration, break minutes, net available time, and ideal Takt Time calculation.
   - *Phase 2: Process Steps & Data Boxes*: Add/reorder stations (e.g., Paste Making, Pigment Diffusion, Paste Thinning, Canning). Define Cycle Time (CT), Changeover (CO), Uptime %, Quality %, and number of operators.
   - *Phase 3: Material & Inventory Flow*: Set incoming supplier lead time, warehouse raw inventory, inter-process buffer WIP counts, finished goods hold time, and transport icons.
   - *Phase 4: Information Flow & Scheduling*: Define customer service order entry, ERP/database storage, production control MRP, and schedule dispatch arrows (manual/electronic).
3. **Interactive VSM Canvas View**:
   - High-fidelity zoomable and pannable SVG canvas rendering official Lean symbols:
     - Factory icons (Supplier & Customer)
     - Truck icons with transit days
     - Data boxes (CT, CO, UT, Quality, Operators)
     - Inventory triangles with WIP counts and calculated buffer delay
     - Information flow lines (electronic lightning arrows, manual straight arrows, schedule boxes)
     - Sawtooth timeline at the bottom showing non-value-added days vs. value-added seconds
   - Clickable nodes to edit properties in a slide-out drawer or add Kaizen bursts.
4. **Current vs. Future State Comparison**:
   - Visual split-view or toggle with delta badges (e.g., Lead Time: $39.9\text{ days} \rightarrow 8.0\text{ days}$, $-80\%$).
   - Interactive Bar Chart showing Process Cycle Times vs. Takt Time threshold line, highlighting bottlenecks in crimson and balanced flow in green.
5. **Kaizen Action Tracker**:
   - Kanban board / tabular view of all Kaizen bursts across the value stream with priority, owner, target completion date, and associated waste type (Overproduction, Waiting, Transport, Overprocessing, Inventory, Motion, Defects).

### Visual Identity & Theme
- **Aesthetic Direction**: High-precision engineering dashboard inspired by industrial operational cockpits and clean modern design systems. Crisp vector typography, hairline borders, and zero-pill discipline.
- **Color Palette**:
  - Background Canvas: Slate 50 (`#F8FAFC`) / Dark Mode Slate 950 (`#020617`)
  - Structural Surfaces: Pure White (`#FFFFFF`) / Dark Mode Slate 900 (`#0F172A`)
  - Hairline Borders: Neutral slate 200 (`#E2E8F0`) / Dark Mode Slate 800 (`#1E293B`)
  - Accent / Primary CTA: Deep Industrial Navy (`#1E3A8A`) and Precision Blue (`#2563EB`)
  - Lean Semantic Accents:
    - Kaizen Burst Gold: `#D97706` / `#F59E0B`
    - Value-Added Green: `#16A34A`
    - Non-Value-Added / Waste / Bottleneck Red: `#DC2626`
    - Takt Time Reference Line: `#EA580C`
- **Typography**:
  - Display / Headings: `Plus Jakarta Sans` (weights 600, 700)
  - Body & Form Controls: `Plus Jakarta Sans` / `Inter` (weights 400, 500)
  - Data Boxes & Timelines: `font-mono tabular-nums` (JetBrains Mono / Space Mono) for perfect vertical alignment of times, percentages, and days.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Vector SVG Engine for VSM Canvas vs. Canvas/Image Rasterization**:
  - *Chosen Approach*: Pure React-driven SVG canvas with vector primitives for symbols (Customer/Supplier, Process Data Box, Inventory Triangle, Sawtooth Timeline, Kaizen Burst polygon).
  - *Why*: Sharp at any zoom level, native DOM click handling for each station, easily exportable to vector SVG or high-resolution PNG, and perfectly responsive.
- **Decision 2: Two-Way Synchronization (Wizard + Interactive Canvas)**:
  - *Chosen Approach*: Step-by-step wizard updates the reactive map state in real time; clicking any element on the canvas instantly highlights its corresponding field in the sidebar inspector.
  - *Why*: Gives beginners an easy guided path while power users can jump straight to editing nodes on the map.
- **Decision 3: Built-in Benchmark Template**:
  - *Chosen Approach*: Pre-seed the system with the exact Dynamic Ltd. Paint Manufacturing case study from the masterclass (Current state with 39.93 days lead time, bottleneck canning at 110s, and Future state with 8 days lead time, balanced ~60s cycle times, and Kanban loops).
  - *Why*: Lets users immediately experiment with working data, see how calculations work, and duplicate/modify it for their own organization's workflows.
- **Decision 4: Client-Side Resilience & Organizational Archive**:
  - *Chosen Approach*: Robust browser storage (LocalStorage) with full JSON export/import and snapshot sharing.
  - *Why*: Zero setup barrier, offline-ready, avoids database quota traps, while enabling users to export `.vsm.json` files or share maps with teammates.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VSM Studio Application                          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌────────────────────┐   ┌───────────────────────────────────────┐   │
│   │   Archive & Nav    │   │           Top Navigation              │   │
│   │  • Map List & Tags │   │  • Active Map Title  • Switch State   │   │
│   │  • New Map Modal   │   │  • Export PNG/SVG    • Add Kaizen     │   │
│   └─────────┬──────────┘   └───────────────────┬───────────────────┘   │
│             │                                  │                       │
│             ▼                                  ▼                       │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      Core Workspace Router                     │   │
│   │   [ Interactive Canvas ]   [ Step Wizard ]   [ Compare View ]  │   │
│   └───────┬──────────────────────────┬───────────────────┬─────────┘   │
│           │                          │                   │             │
│           ▼                          ▼                   ▼             │
│   ┌────────────────┐         ┌────────────────┐ ┌────────────────┐     │
│   │   VSM Canvas   │         │ Step-by-Step   │ │ Balance Chart  │     │
│   │ • Info Flow    │         │ Wizard         │ │ & Kaizen Board │     │
│   │ • Material Flow│◄───────►│ • 4 Phases     │ │ • Takt vs CT   │     │
│   │ • Data Boxes   │         │ • Live Preview │ │ • 7-Waste Tool │     │
│   │ • Sawtooth Time│         │ • Validation   │ │ • Delta Matrix │     │
│   └────────────────┘         └────────────────┘ └────────────────┘     │
│                                                                        │
│                                      │                                 │
│                                      ▼                                 │
│                      ┌──────────────────────────────┐                  │
│                      │      VSM Math Engine         │                  │
│                      │  • Takt, Lead, Storage Times │                  │
│                      │  • Flow Time Efficiency      │                  │
│                      │  • Bottleneck Identification │                  │
│                      └──────────────┬───────────────┘                  │
│                                     │                                  │
│                                     ▼                                  │
│                      ┌──────────────────────────────┐                  │
│                      │   Archive & Storage Store    │                  │
│                      │  • LocalStorage Auto-Sync    │                  │
│                      │  • JSON Import / Export      │                  │
│                      └──────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model Schema
```typescript
interface ValueStreamMap {
  id: string;
  title: string;
  organization: string;
  productFamily: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  stateType: 'current' | 'future';
  parentMapId?: string; // links future state to current state

  // Customer Demand & Operating Schedule
  demand: {
    customerName: string;
    dailyDemandUnits: number;
    shiftsPerDay: number;
    hoursPerShift: number;
    breakMinutesPerShift: number;
    effectiveSecondsPerDay: number; // calculated
    taktTimeSeconds: number; // calculated: effectiveSeconds / dailyDemand
    shippingFrequencyDays: number;
  };

  // Supplier & Raw Material
  supplier: {
    supplierName: string;
    deliveryLeadTimeDays: number;
    orderFrequencyDays: number;
    transportMode: 'truck' | 'rail' | 'air' | 'sea';
  };

  // Information Flow
  informationFlow: {
    controlDepartment: string; // e.g. "Production Control"
    forecastMethod: 'MRP/ERP' | 'Manual' | 'Kanban';
    scheduleFrequency: 'Daily' | 'Weekly' | 'Bi-Weekly';
    customerOrderInput: 'Electronic' | 'Manual';
    supplierOrderDispatch: 'Electronic' | 'Manual';
    floorDistributionMethod: 'Weekly Schedule' | 'Daily Kanban' | 'Heijunka Box';
  };

  // Process Steps (Dedicated or Shared)
  processes: Array<{
    id: string;
    name: string;
    type: 'dedicated' | 'shared';
    cycleTimeSeconds: number;
    changeoverTimeSeconds: number;
    uptimePercentage: number;
    qualityPercentage: number;
    operatorsCount: number;
    batchSize: number;
    isBottleneck?: boolean;
  }>;

  // Inventory & Buffers
  buffers: Array<{
    id: string;
    afterProcessId: string; // or 'raw_material' | 'finished_goods'
    wipQuantity: number;
    bufferType: 'buffer' | 'supermarket' | 'fifo' | 'safety_stock';
    calculatedDays: number; // wipQuantity / dailyDemand
    hasPullLoop?: boolean;
    pullLoopType?: 'conwip' | 'kanban';
  }>;

  // Kaizen Bursts
  kaizenBursts: Array<{
    id: string;
    targetId: string; // process or buffer ID
    targetName: string;
    title: string;
    description: string;
    wasteCategory: 'Overproduction' | 'Waiting' | 'Transport' | 'Overprocessing' | 'Inventory' | 'Motion' | 'Defects';
    status: 'identified' | 'in-progress' | 'implemented';
    owner: string;
    targetDate: string;
    expectedGain: string;
  }>;

  // Summary Metrics (Auto-calculated)
  metrics: {
    totalLeadTimeDays: number;
    storageTimeDays: number;
    totalProcessTimeSeconds: number;
    totalCycleTimeSeconds: number;
    flowEfficiencyPercent: number;
    isDemandMet: boolean;
  };
}
```

---

## 5. Verification Plan

1. **Calculations Verification**:
   - Verify with Masterclass sample numbers:
     - Shift: 8 hours with $3 \times 15$ min breaks = $26,100\text{s}$ available.
     - Customer demand: $300\text{ cans/day} \Rightarrow Takt = \frac{26100}{300} = 87\text{s}$.
     - Process times: $33 + 87 + 90 + 110 = 320\text{s}$.
     - 3 operators $\Rightarrow$ Cycle Time = $106.7\text{s} > 87\text{s}$ (Demand not met, Bottleneck: Canning).
     - Storage time: $8.25 + 2.6 + 1.1 + 1.98 + 5 = 18.93\text{ days}$.
     - Lead time: $7\text{ (procurement)} + 14\text{ (supplier)} + 18.93 = 39.93\text{ days}$.
     - Future state: 4 operators or rebalanced tasks $\rightarrow$ Lead time shaves to $8\text{ days}$, cycle time $< 87\text{s}$.
2. **Interactive UI Verification**:
   - Verify step-by-step wizard successfully updates live SVG preview.
   - Verify Kaizen burst creation, modal editing, and status movement.
   - Verify Before vs. Future state comparison shows side-by-side diagrams and delta statistics.
   - Verify map archive saving, filtering, cloning, JSON export/import, and SVG print download.
3. **Build & Typecheck**:
   - Run `compile_applet` and `lint_applet` to confirm 0 TypeScript or Vite build errors.
