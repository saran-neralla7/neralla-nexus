'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import { formatDate } from '@/lib/utils';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import {
  fetchTrashItems,
  restoreTrashItem,
  permanentDeleteTrashItem,
  emptyTrash,
} from './actions';

export default function TrashHubPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [trashList, setTrashList] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation States
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await fetchTrashItems();
      setTrashList(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch trash bin entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Restore Handler
  const handleRestore = (item: any) => {
    startTransition(async () => {
      try {
        await restoreTrashItem(item.id, item.type);
        toast.success(`Restored "${item.name}" back to its original location.`);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to restore item');
      }
    });
  };

  // Permanent Delete Handler
  const handleDeleteClick = (item: any) => {
    setSelectedItem(item);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedItem) return;
    startTransition(async () => {
      try {
        await permanentDeleteTrashItem(selectedItem.id, selectedItem.type);
        toast.success(`"${selectedItem.name}" has been permanently purged.`);
        setShowDeleteConfirm(false);
        setSelectedItem(null);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to purge item');
      }
    });
  };

  // Empty Trash Handler
  const handleConfirmEmpty = () => {
    startTransition(async () => {
      try {
        await emptyTrash();
        toast.success('Trash has been completely emptied.');
        setShowEmptyConfirm(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to empty trash');
      }
    });
  };

  // Filters
  const filteredItems = trashList.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'documents':
        return 'description';
      case 'passwords':
        return 'password';
      case 'assets':
        return 'inventory_2';
      case 'memories':
        return 'photo_library';
      default:
        return 'delete';
    }
  };

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'documents', label: 'Documents' },
    { id: 'passwords', label: 'Passwords' },
    { id: 'assets', label: 'Assets' },
    { id: 'memories', label: 'Memories' },
  ];

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="material-symbols-outlined text-[30px]"
              style={{ color: '#ffb4ab', fontVariationSettings: "'FILL' 1" }}
            >
              delete_forever
            </span>
            <h1
              style={{
                fontFamily: 'Geist, sans-serif',
                fontSize: '32px',
                fontWeight: '700',
                color: '#dde4e1',
                letterSpacing: '-0.02em',
              }}
            >
              Trash & Archival Purge
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            Soft-deleted files and records. Purge permanently or restore back to their respective vaults.
          </p>
        </div>

        {trashList.length > 0 && (
          <button
            onClick={() => setShowEmptyConfirm(true)}
            className="py-3 px-5 border border-red-500/20 bg-[#93000a] hover:brightness-110 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md"
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            Empty Trash Bin
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl">
        <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === cat.id
                  ? 'bg-[#14b8a6] text-[#003731]'
                  : 'text-[#bbcac6] hover:bg-white/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 w-full md:w-80">
          <span className="material-symbols-outlined text-sm text-[#859490] mr-2">search</span>
          <input
            type="text"
            placeholder="Search deleted items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none focus:outline-none focus:ring-0 text-body-sm text-[#dde4e1] placeholder:text-[#859490]/50 w-full"
          />
        </div>
      </div>

      {/* Main content grid */}
      {loading ? (
        <div className="py-20 text-center text-[#859490]">
          <span className="material-symbols-outlined animate-spin text-[32px] text-[#4fdbc8] mb-2">
            progress_activity
          </span>
          <p className="text-body-md">Reading trash registry...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 text-center border border-white/5 rounded-2xl bg-white/[0.01] space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-[#859490]">
            <span className="material-symbols-outlined text-[30px]">delete_outline</span>
          </div>
          <h3
            className="text-lg font-semibold text-[#dde4e1]"
            style={{ fontFamily: 'Geist, sans-serif' }}
          >
            Trash Bin is Empty
          </h3>
          <p className="text-xs text-[#859490] max-w-sm mx-auto leading-relaxed">
            No items match your filter criteria, or there are no soft-deleted records currently stored in the system.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (hidden on md and up) */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => (
              <div key={`${item.type}-${item.id}`} className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-[#4fdbc8] text-[20px] flex-shrink-0">
                      {getSourceIcon(item.type)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#dde4e1] truncate">{item.name}</p>
                      <p className="text-[10px] text-[#859490] mt-0.5">
                        <span className="capitalize">{item.type}</span> • Deleted {formatDate(item.deleted_at)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={isPending}
                    className="flex-1 py-2 bg-[#14b8a6]/10 text-[#4fdbc8] border border-[#14b8a6]/20 rounded-lg text-xs font-bold hover:bg-[#14b8a6]/20 transition-all flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">restore</span>
                    Restore
                  </button>
                  <button
                    onClick={() => handleDeleteClick(item)}
                    disabled={isPending}
                    className="flex-1 py-2 bg-red-500/10 text-[#ffb4ab] border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    Purge
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (hidden on mobile) */}
          <div className="hidden md:block glass-card rounded-2xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-body-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-[#859490] bg-white/[0.01]">
                    <th className="px-6 py-4">Item Name</th>
                    <th className="px-6 py-4">Source Vault</th>
                    <th className="px-6 py-4">Deleted Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredItems.map((item) => (
                    <tr key={`${item.type}-${item.id}`} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-semibold text-[#dde4e1] flex items-center gap-3">
                        <span className="material-symbols-outlined text-[#4fdbc8] text-[20px]">
                          {getSourceIcon(item.type)}
                        </span>
                        {item.name}
                      </td>
                      <td className="px-6 py-4 text-[#bbcac6] capitalize">{item.type}</td>
                      <td className="px-6 py-4 text-[#859490]">{formatDate(item.deleted_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleRestore(item)}
                            disabled={isPending}
                            className="py-1.5 px-3 bg-[#14b8a6]/10 text-[#4fdbc8] border border-[#14b8a6]/20 rounded-lg text-xs font-bold hover:bg-[#14b8a6]/20 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">restore</span>
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeleteClick(item)}
                            disabled={isPending}
                            className="py-1.5 px-3 bg-red-500/10 text-[#ffb4ab] border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20 transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            Purge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* CONFIRM INDIVIDUAL DELETE */}
      <NexusConfirm
        isOpen={showDeleteConfirm}
        title="Permanently Delete Item?"
        description={`Are you absolutely sure you want to permanently delete "${selectedItem?.name}"? This action cannot be undone and your file/record will be gone forever.`}
        confirmText="Yes, Purge"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
        loading={isPending}
      />

      {/* CONFIRM EMPTY TRASH */}
      <NexusConfirm
        isOpen={showEmptyConfirm}
        title="Empty Family Trash Bin?"
        description="Are you absolutely sure you want to permanently delete all items in the trash bin? This will clear all documents, passwords, assets, and memories in the trash, and cannot be undone."
        confirmText="Yes, Empty All"
        cancelText="Cancel"
        onConfirm={handleConfirmEmpty}
        onCancel={() => setShowEmptyConfirm(false)}
        variant="danger"
        loading={isPending}
      />
    </div>
  );
}
