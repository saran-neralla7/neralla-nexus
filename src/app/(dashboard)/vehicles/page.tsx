'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import {
  fetchVehicles,
  createVehicle,
  fetchVehicleLogs,
  createVehicleLog
} from './actions';
import NexusModal from '@/components/nexus/NexusModal';
import { formatDate } from '@/lib/utils';

export default function VehiclesPage() {
  const { user } = useUser();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddLogModal, setShowAddLogModal] = useState(false);

  // Form states: Vehicle
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  // Form states: Log
  const [logType, setLogType] = useState('service');
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Initial load
  useEffect(() => {
    if (user) {
      loadVehicles();
    }
  }, [user]);

  // Load logs when selected vehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      loadLogs(selectedVehicle.id);
    } else {
      setLogs([]);
    }
  }, [selectedVehicle]);

  const loadVehicles = async () => {
    try {
      setLoadingVehicles(true);
      const data = await fetchVehicles();
      setVehicles(data || []);
      if (data && data.length > 0) {
        setSelectedVehicle(data[0]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch vehicles');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const loadLogs = async (vehicleId: string) => {
    try {
      setLoadingLogs(true);
      const data = await fetchVehicleLogs(vehicleId);
      setLogs(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch vehicle logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!make.trim() || !model.trim() || !plateNumber.trim()) {
      toast.error('All vehicle fields are required');
      return;
    }

    startTransition(async () => {
      try {
        await createVehicle({ make, model, plate_number: plateNumber });
        toast.success(`Vehicle ${make} ${model} added!`);
        setShowAddVehicleModal(false);
        setMake('');
        setModel('');
        setPlateNumber('');
        loadVehicles();
      } catch (err: any) {
        toast.error(err.message || 'Failed to add vehicle');
      }
    });
  };

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCost = parseFloat(cost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      toast.error('Please enter a valid cost');
      return;
    }

    if (!selectedVehicle) return;

    startTransition(async () => {
      try {
        await createVehicleLog({
          vehicleId: selectedVehicle.id,
          type: logType,
          cost: parsedCost,
          odometer: odometer ? parseInt(odometer) : undefined,
          date: logDate,
          notes,
          expiry_date: expiryDate || undefined,
        });
        toast.success('Maintenance record logged!');
        setShowAddLogModal(false);
        resetLogForm();
        loadLogs(selectedVehicle.id);
      } catch (err: any) {
        toast.error(err.message || 'Failed to log maintenance record');
      }
    });
  };

  const resetLogForm = () => {
    setLogType('service');
    setCost('');
    setOdometer('');
    setLogDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setExpiryDate('');
  };

  const latestOdometer = logs.find((l) => l.odometer)?.odometer || 'None';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 text-[#dde4e1]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[28px]">directions_car</span>
          </div>
          <div>
            <h1 className="text-headline-md font-bold tracking-tight text-white">Vehicle Upkeep Logs</h1>
            <p className="text-body-sm text-[#859490]">Track family cars/bikes, odometer logs, and insurance renewals</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddVehicleModal(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[#4fdbc8] text-black hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Vehicle
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Vehicles list left-sidebar (1 column) */}
        <div className="space-y-4">
          <h3 className="text-label-md font-bold text-[#4fdbc8] uppercase tracking-wider">Family Garage</h3>
          
          {loadingVehicles ? (
            <div className="h-16 bg-white/[0.01] border border-white/5 rounded-xl animate-pulse" />
          ) : vehicles.length === 0 ? (
            <p className="text-body-sm text-[#859490] py-4">No vehicles logged.</p>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => {
                const isSelected = selectedVehicle?.id === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-white/[0.04] border-[#4fdbc8] shadow-lg shadow-[#4fdbc8]/5'
                        : 'bg-white/[0.01] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div>
                      <h4 className="text-body-sm font-semibold text-white">{v.make} {v.model}</h4>
                      <p className="text-label-sm text-[#859490] font-bold mt-1 tracking-wider">{v.plate_number}</p>
                    </div>
                    <span className="material-symbols-outlined text-white/20 select-none">arrow_forward_ios</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Vehicle details & history logs (3 columns) */}
        <div className="lg:col-span-3 space-y-6">
          {selectedVehicle ? (
            <>
              {/* Odometer & PUC widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-5 rounded-2xl border border-white/5 bg-white/[0.01] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#4fdbc8]/10 flex items-center justify-center text-[#4fdbc8]">
                    <span className="material-symbols-outlined text-[22px]">speed</span>
                  </div>
                  <div>
                    <span className="text-body-sm text-[#859490] block">Odometer Reading</span>
                    <span className="text-headline-sm font-bold text-white block mt-0.5">
                      {latestOdometer !== 'None' ? `${latestOdometer} km` : 'Not recorded'}
                    </span>
                  </div>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-white/5 bg-white/[0.01] flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                    <span className="material-symbols-outlined text-[22px]">verified_user</span>
                  </div>
                  <div>
                    <span className="text-body-sm text-[#859490] block">Policy / PUC Expiries</span>
                    <span className="text-body-sm font-medium text-white block mt-0.5">
                      Auto-synced to Unified Calendar
                    </span>
                  </div>
                </div>
              </div>

              {/* Logs List */}
              <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02] space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-headline-sm font-bold text-white">Maintenance History</h3>
                    <p className="text-body-sm text-[#859490] mt-0.5">Service logs, fuel ups, and repairs</p>
                  </div>
                  <button
                    onClick={() => setShowAddLogModal(true)}
                    className="px-4 py-2 border border-[#4fdbc8]/20 hover:bg-[#4fdbc8]/5 text-body-sm font-semibold text-[#4fdbc8] rounded-xl transition-all"
                  >
                    Log Upkeep
                  </button>
                </div>

                {loadingLogs ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-12 bg-white/[0.01] border border-white/5 rounded-xl" />
                    <div className="h-12 bg-white/[0.01] border border-white/5 rounded-xl" />
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-body-sm text-[#859490] text-center py-8">No service logs yet.</p>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex items-start justify-between gap-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-[#adc6ff] mt-0.5">
                            <span className="material-symbols-outlined text-[18px]">
                              {log.type === 'service' ? 'build' :
                               log.type === 'fuel' ? 'local_gas_station' :
                               log.type === 'insurance' ? 'policy' :
                               log.type === 'pollution' ? 'co2' : 'build_circle'}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-body-sm font-semibold text-white capitalize">{log.type} log</h4>
                            <p className="text-body-sm text-[#bbcac6] mt-0.5">{log.notes || 'No notes added.'}</p>
                            <div className="flex gap-3 text-label-sm text-[#859490] mt-1">
                              <span>Date: {formatDate(log.date)}</span>
                              {log.odometer && <span>• Odometer: {log.odometer} km</span>}
                              {log.expiry_date && <span className="text-orange-400 font-bold">• Renewal: {formatDate(log.expiry_date)}</span>}
                            </div>
                          </div>
                        </div>

                        <span className="text-body-sm font-bold text-white">₹{parseFloat(log.cost).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-24 text-[#859490]">
              <span className="material-symbols-outlined text-[48px] mb-3">garage</span>
              <p className="text-body-md font-semibold">No vehicle selected</p>
              <p className="text-body-sm mt-1">Add or select a vehicle to check logs.</p>
            </div>
          )}
        </div>

      </div>

      {/* Add Vehicle Modal */}
      <NexusModal
        isOpen={showAddVehicleModal}
        onClose={() => setShowAddVehicleModal(false)}
        title="Add Vehicle to Garage"
      >
        <form onSubmit={handleAddVehicle} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Make *</label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. Maruti, Honda"
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Model *</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Swift, City"
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Plate Number *</label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              placeholder="e.g. KA-03-MM-1234"
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              required
            />
          </div>

          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowAddVehicleModal(false)}
              className="flex-1 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-body-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[#4fdbc8] text-black font-semibold text-body-sm hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
            >
              {isPending ? 'Adding...' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Add Log Modal */}
      <NexusModal
        isOpen={showAddLogModal}
        onClose={() => setShowAddLogModal(false)}
        title={`Log Upkeep for ${selectedVehicle?.make} ${selectedVehicle?.model}`}
      >
        <form onSubmit={handleAddLog} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Entry Type</label>
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                <option value="service">Service & Repair</option>
                <option value="fuel">Fuel Fill-up</option>
                <option value="insurance">Insurance Policy</option>
                <option value="pollution">Pollution Check (PUC)</option>
                <option value="other">Other Upkeep</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Cost (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Odometer (km)</label>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="Current reading"
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Log Date</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Expiry / Renewal Date (Optional)</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
            />
            <p className="text-[10px] text-[#859490] mt-0.5">
              Ideal for insurance policy expirations and PUC pollution checks (auto-syncs to calendar).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Log Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Engine oil replaced, checked brakes, filled fuel..."
              rows={3}
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white resize-none"
            />
          </div>

          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => { setShowAddLogModal(false); resetLogForm(); }}
              className="flex-1 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-body-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[#4fdbc8] text-black font-semibold text-body-sm hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
            >
              {isPending ? 'Logging...' : 'Save Upkeep Entry'}
            </button>
          </div>
        </form>
      </NexusModal>

    </div>
  );
}
