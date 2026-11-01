import React, { useState } from 'react';
import {
  Flame,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Filter,
  TrendingUp,
  Tag,
  Search,
  Sparkles,
} from 'lucide-react';
import { ValueStreamMap, KaizenBurst, WasteCategory } from '../types/vsm';

interface KaizenTrackerProps {
  map: ValueStreamMap;
  onUpdateMap: (updated: ValueStreamMap) => void;
  onSelectBurstOnMap?: (burst: KaizenBurst) => void;
}

export const KaizenTracker: React.FC<KaizenTrackerProps> = ({
  map,
  onUpdateMap,
  onSelectBurstOnMap,
}) => {
  const [filterWaste, setFilterWaste] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [editingBurst, setEditingBurst] = useState<KaizenBurst | null>(null);

  // Form state for creating/editing
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    nodeName: string;
    wasteCategory: WasteCategory;
    priority: 'high' | 'medium' | 'low';
    owner: string;
    targetDate: string;
    expectedGain: string;
    actionPlan: string;
  }>({
    title: '',
    description: '',
    nodeName: map.processes[0]?.name || 'Assembly',
    wasteCategory: 'Waiting',
    priority: 'high',
    owner: '',
    targetDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    expectedGain: '',
    actionPlan: '',
  });

  const kaizens = map.kaizenBursts;

  const filteredKaizens = kaizens.filter((k) => {
    if (filterWaste !== 'all' && k.wasteCategory !== filterWaste) return false;
    if (filterStatus !== 'all' && k.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        k.title.toLowerCase().includes(q) ||
        k.description.toLowerCase().includes(q) ||
        k.owner.toLowerCase().includes(q) ||
        k.nodeName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSaveBurst = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    if (editingBurst) {
      const updated = kaizens.map((k) =>
        k.id === editingBurst.id
          ? {
              ...k,
              ...formData,
              nodeId: map.processes.find((p) => p.name === formData.nodeName)?.id || k.nodeId,
            }
          : k
      );
      onUpdateMap({ ...map, kaizenBursts: updated });
      setEditingBurst(null);
    } else {
      const newBurst: KaizenBurst = {
        id: `kz-${Date.now()}`,
        nodeId: map.processes.find((p) => p.name === formData.nodeName)?.id || 'general',
        nodeName: formData.nodeName,
        title: formData.title,
        description: formData.description,
        wasteCategory: formData.wasteCategory,
        priority: formData.priority,
        status: 'identified',
        owner: formData.owner || 'Unassigned',
        targetDate: formData.targetDate,
        expectedGain: formData.expectedGain,
        actionPlan: formData.actionPlan,
        createdAt: new Date().toISOString(),
      };
      onUpdateMap({ ...map, kaizenBursts: [newBurst, ...kaizens] });
      setIsAdding(false);
    }

    // Reset form
    setFormData({
      title: '',
      description: '',
      nodeName: map.processes[0]?.name || 'Assembly',
      wasteCategory: 'Waiting',
      priority: 'high',
      owner: '',
      targetDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      expectedGain: '',
      actionPlan: '',
    });
  };

  const handleDelete = (id: string) => {
    const updated = kaizens.filter((k) => k.id !== id);
    onUpdateMap({ ...map, kaizenBursts: updated });
  };

  const handleStatusChange = (id: string, newStatus: KaizenBurst['status']) => {
    const updated = kaizens.map((k) => (k.id === id ? { ...k, status: newStatus } : k));
    onUpdateMap({ ...map, kaizenBursts: updated });
  };

  const implementedCount = kaizens.filter((k) => k.status === 'implemented').length;
  const inProgressCount = kaizens.filter((k) => k.status === 'in-progress').length;
  const identifiedCount = kaizens.filter((k) => k.status === 'identified').length;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-auto p-6 space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Kaizen Burst Action Tracker
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Targeted continuous improvement workshops for {map.title}.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAdding(true);
            setEditingBurst(null);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Kaizen Workshop</span>
        </button>
      </div>

      {/* Progress Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Identified Opportunities</span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
              {identifiedCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">In-Progress Workshops</span>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {inProgressCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">Implemented Improvements</span>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {implementedCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Kaizens by title, owner, or process..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Waste:</span>
            <select
              value={filterWaste}
              onChange={(e) => setFilterWaste(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All 7 Wastes</option>
              <option value="Waiting">Waiting</option>
              <option value="Inventory">Inventory</option>
              <option value="Overproduction">Overproduction</option>
              <option value="Overprocessing">Overprocessing</option>
              <option value="Transport">Transport</option>
              <option value="Motion">Motion</option>
              <option value="Defects">Defects</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="identified">Identified</option>
              <option value="in-progress">In Progress</option>
              <option value="implemented">Implemented</option>
            </select>
          </div>
        </div>
      </div>

      {/* Kaizen List / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredKaizens.map((k) => (
          <div
            key={k.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {k.wasteCategory} Muda
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                    k.status === 'implemented'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : k.status === 'in-progress'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {k.status.replace('-', ' ')}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {k.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {k.description}
              </p>

              {k.expectedGain && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-100 dark:border-emerald-900 text-[11px] text-emerald-800 dark:text-emerald-200">
                  <span className="font-semibold block">Expected Gain:</span>
                  <span>{k.expectedGain}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
              <div className="flex items-center justify-between text-slate-500">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{k.owner}</span>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{k.targetDate}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <select
                    value={k.status}
                    onChange={(e) => handleStatusChange(k.id, e.target.value as any)}
                    className="text-[11px] font-medium py-1 px-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="identified">Identified</option>
                    <option value="in-progress">In Progress</option>
                    <option value="implemented">Implemented</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingBurst(k);
                      setFormData({
                        title: k.title,
                        description: k.description,
                        nodeName: k.nodeName,
                        wasteCategory: k.wasteCategory,
                        priority: k.priority,
                        owner: k.owner,
                        targetDate: k.targetDate,
                        expectedGain: k.expectedGain,
                        actionPlan: k.actionPlan || '',
                      });
                      setIsAdding(true);
                    }}
                    className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(k.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                    title="Delete Kaizen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredKaizens.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <Flame className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No Kaizen Bursts Found
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || filterWaste !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your search criteria or waste filters.'
              : 'Add Kaizen lightening bursts to pinpoint process bottlenecks and waste elimination actions.'}
          </p>
        </div>
      )}

      {/* Kaizen Add / Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">
              {editingBurst ? 'Edit Kaizen Burst' : 'Add New Kaizen Burst (Lightening Star)'}
            </h3>

            <form onSubmit={handleSaveBurst} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Kaizen Initiative Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rebalance Bottleneck Tasks to Station 1"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Target Station or Buffer
                </label>
                <select
                  value={formData.nodeName}
                  onChange={(e) => setFormData({ ...formData, nodeName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {map.processes.map((p) => (
                    <option key={p.id} value={p.name}>
                      Process: {p.name}
                    </option>
                  ))}
                  <option value="Raw Materials / Supplier">Raw Materials / Supplier</option>
                  <option value="Finished Goods Warehouse">Finished Goods Warehouse</option>
                  <option value="Production Control & Scheduling">Production Control &amp; Scheduling</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    TPS Waste (Muda)
                  </label>
                  <select
                    value={formData.wasteCategory}
                    onChange={(e) => setFormData({ ...formData, wasteCategory: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Waiting">Waiting</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Overproduction">Overproduction</option>
                    <option value="Overprocessing">Overprocessing</option>
                    <option value="Transport">Transport</option>
                    <option value="Motion">Motion</option>
                    <option value="Defects">Defects</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="high">High Impact</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Description of Issue &amp; Countermeasure
                </label>
                <textarea
                  rows={2}
                  placeholder="Detail the waste observed and the proposed lean improvement..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Owner / Workshop Lead
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., J. Smith"
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Expected Gain / Target Metric
                </label>
                <input
                  type="text"
                  placeholder="e.g., Save 40s cycle time, eliminate 500 WIP units"
                  value={formData.expectedGain}
                  onChange={(e) => setFormData({ ...formData, expectedGain: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
                >
                  {editingBurst ? 'Save Changes' : 'Create Kaizen Burst'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
