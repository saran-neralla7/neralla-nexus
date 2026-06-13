'use client';

import { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { Asset, Document } from '@/types';
import {
  fetchAssets,
  createAsset,
  updateAsset,
  deleteAsset,
} from './actions';

const ASSET_TYPES = [
  { id: 'all', label: 'All Assets', icon: 'account_balance_wallet', color: '#4fdbc8' },
  { id: 'property', label: 'Properties', icon: 'home', color: '#22c55e' },
  { id: 'vehicle', label: 'Vehicles', icon: 'directions_car', color: '#adc6ff' },
  { id: 'investment', label: 'Investments', icon: 'show_chart', color: '#a78bfa' },
  { id: 'gold', label: 'Gold / Silver', icon: 'monetization_on', color: '#eab308' },
  { id: 'valuable', label: 'Valuables', icon: 'workspace_premium', color: '#ffb59e' },
  { id: 'other', label: 'Others', icon: 'more_horiz', color: '#859490' },
];

export default function AssetsPage() {
  const { user } = useUser();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vaultDocs, setVaultDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('other');
  const [formDescription, setFormDescription] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formPurchaseDate, setFormPurchaseDate] = useState('');
  const [formLinkedDocs, setFormLinkedDocs] = useState<string[]>([]);
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [photoInput, setPhotoInput] = useState('');

  // Detail Modal State
  const [viewedAsset, setViewedAsset] = useState<Asset | null>(null);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const data = await fetchAssets();
      setAssets(data as Asset[]);

      // Fetch Document Vault records for linking
      const supabase = createClient();
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('family_id', user.family_id)
        .is('deleted_at', null)
        .order('name');
      setVaultDocs(docs || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Currency formatter
  const formatINR = (val?: number) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormName('');
    setFormType('other');
    setFormDescription('');
    setFormValue('');
    setFormPurchaseDate('');
    setFormLinkedDocs([]);
    setFormPhotos([]);
    setPhotoInput('');
    setShowFormModal(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingId(asset.id);
    setFormName(asset.name);
    setFormType(asset.type);
    setFormDescription(asset.description || '');
    setFormValue(asset.current_value?.toString() || '');
    setFormPurchaseDate(asset.purchase_date || '');
    setFormLinkedDocs(asset.documents || []);
    setFormPhotos(asset.photos || []);
    setPhotoInput('');
    setShowFormModal(true);
    setViewedAsset(null); // Close detail modal if editing from it
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Asset name is required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: formName,
          type: formType,
          description: formDescription || undefined,
          current_value: formValue ? Number(formValue) : undefined,
          purchase_date: formPurchaseDate || undefined,
          photos: formPhotos,
          documents: formLinkedDocs,
        };

        if (editingId) {
          await updateAsset(editingId, payload);
          toast.success('Asset updated successfully');
        } else {
          await createAsset(payload);
          toast.success('Asset recorded successfully');
        }

        setShowFormModal(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save asset');
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteAsset(deleteId);
      toast.success('Asset deleted successfully');
      setDeleteId(null);
      setViewedAsset(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete asset');
    }
  };

  const addPhotoUrl = () => {
    if (!photoInput.trim()) return;
    setFormPhotos((prev) => [...prev, photoInput.trim()]);
    setPhotoInput('');
  };

  const removePhotoUrl = (idx: number) => {
    setFormPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleDocLink = (docUrl: string) => {
    setFormLinkedDocs((prev) =>
      prev.includes(docUrl) ? prev.filter((url) => url !== docUrl) : [...prev, docUrl]
    );
  };

  // Calculations
  const totalNetWorth = assets.reduce((acc, curr) => acc + (curr.current_value || 0), 0);

  const valueByType = assets.reduce((acc, curr) => {
    const t = curr.type;
    acc[t] = (acc[t] || 0) + (curr.current_value || 0);
    return acc;
  }, {} as Record<string, number>);

  // Filter & Search
  const filteredAssets = assets.filter((asset) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      asset.name.toLowerCase().includes(searchLower) ||
      (asset.description && asset.description.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;
    if (selectedType === 'all') return true;
    return asset.type === selectedType;
  });

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="material-symbols-outlined"
              style={{ color: '#4fdbc8', fontSize: '32px', fontVariationSettings: "'FILL' 1" }}
            >
              inventory_2
            </span>
            <h1
              className="text-headline-lg"
              style={{
                fontFamily: 'Geist, sans-serif',
                color: '#dde4e1',
                letterSpacing: '-0.02em',
              }}
            >
              Assets &amp; Wealth
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            Complete wealth and portfolio tracking for property, investments, gold, and valuables.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
            color: '#ffffff',
            boxShadow: '0 4px 20px rgba(20, 184, 166, 0.25)',
          }}
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Asset
        </button>
      </div>

      {/* Net Worth Dashboard Banner */}
      <div
        className="glass-card rounded-[28px] p-6 md:p-8 flex flex-col lg:flex-row gap-8 justify-between relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(79, 219, 200, 0.06) 0%, rgba(5, 102, 217, 0.03) 100%)',
          border: '1px solid rgba(79, 219, 200, 0.12)',
        }}
      >
        {/* Glow */}
        <div
          className="absolute w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(79,219,200,0.15) 0%, transparent 70%)',
            top: '-20%',
            left: '-10%',
            filter: 'blur(40px)',
          }}
        />

        <div className="space-y-4 relative z-10">
          <div>
            <p className="text-label-sm uppercase tracking-widest" style={{ color: '#859490' }}>
              Family Net Worth
            </p>
            <h2
              className="text-display-lg mt-2 font-bold leading-tight"
              style={{
                fontFamily: 'Geist, sans-serif',
                fontSize: 'clamp(32px, 5vw, 48px)',
                color: '#dde4e1',
                letterSpacing: '-0.03em',
              }}
            >
              {formatINR(totalNetWorth)}
            </h2>
          </div>
          <div className="flex flex-wrap gap-4 text-body-sm text-[#bbcac6]">
            <div className="flex items-center gap-1.5 bg-white/3 px-3.5 py-1.5 rounded-lg border border-white/5">
              <span className="material-symbols-outlined text-[#4fdbc8] text-[18px]">equalizer</span>
              <span>{assets.length} Active Holdings</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/3 px-3.5 py-1.5 rounded-lg border border-white/5">
              <span className="material-symbols-outlined text-[#adc6ff] text-[18px]">query_stats</span>
              <span>Portfolio Tracking Active</span>
            </div>
          </div>
        </div>

        {/* Portfolio Breakdown Charts/Numbers */}
        <div className="flex flex-col justify-center gap-3 w-full lg:max-w-md bg-white/[0.02] p-5 rounded-2xl border border-white/5">
          <h3 className="text-label-sm text-[#859490] uppercase tracking-wider mb-1">Asset Allocation</h3>
          <div className="space-y-2.5">
            {ASSET_TYPES.filter((t) => t.id !== 'all').map((type) => {
              const val = valueByType[type.id] || 0;
              const pct = totalNetWorth > 0 ? (val / totalNetWorth) * 100 : 0;
              if (val === 0) return null;

              return (
                <div key={type.id} className="space-y-1">
                  <div className="flex items-center justify-between text-body-sm">
                    <span className="flex items-center gap-1.5 text-[#bbcac6]">
                      <span className="material-symbols-outlined text-[15px]" style={{ color: type.color }}>{type.icon}</span>
                      {type.label}
                    </span>
                    <span className="font-mono text-[#dde4e1]" style={{ fontSize: '13px' }}>
                      {formatINR(val)} <span className="text-[#859490]" style={{ fontSize: '11px' }}>({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: type.color,
                        boxShadow: `0 0 8px ${type.color}40`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {assets.length === 0 && (
              <p className="text-body-sm text-[#859490] text-center py-4 italic">No allocation data. Add assets to see breakdown.</p>
            )}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Type tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none mask-image-right">
          {ASSET_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: selectedType === type.id ? 'rgba(79, 219, 200, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${selectedType === type.id ? 'rgba(79, 219, 200, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                color: selectedType === type.id ? '#4fdbc8' : '#bbcac6',
              }}
            >
              <span className="material-symbols-outlined text-[16px]">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span
            className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px]"
            style={{ color: '#859490' }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#859490] hover:text-[#dde4e1]"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of Assets */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <span className="material-symbols-outlined animate-spin text-[40px] text-[#4fdbc8]">
            progress_activity
          </span>
          <p className="text-body-md" style={{ color: '#859490' }}>Loading assets database...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="glass-card rounded-[32px] p-12 text-center max-w-xl mx-auto space-y-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
          >
            <span className="material-symbols-outlined text-[32px] text-[#859490]">
              account_balance_wallet
            </span>
          </div>
          <div>
            <h3 className="text-headline-sm font-semibold text-[#dde4e1] mb-2">No Assets Found</h3>
            <p className="text-body-sm text-[#859490]">
              {searchQuery || selectedType !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by creating your first family asset record.'}
            </p>
          </div>
          {searchQuery || selectedType !== 'all' ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedType('all');
              }}
              className="px-5 py-2.5 rounded-xl font-medium text-body-sm transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#bbcac6',
              }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={openAddModal}
              className="px-5 py-2.5 rounded-xl font-medium text-body-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
                color: 'white',
              }}
            >
              Add Asset
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => {
            const typeInfo = ASSET_TYPES.find((t) => t.id === asset.type) || ASSET_TYPES[6];
            return (
              <div
                key={asset.id}
                onClick={() => setViewedAsset(asset)}
                className="glass-card rounded-[28px] p-6 border border-white/5 hover:border-[#4fdbc8]/20 hover:shadow-[0_20px_50px_rgba(79,219,200,0.02)] transition-all duration-300 flex flex-col justify-between gap-5 cursor-pointer relative group"
              >
                {/* Image background hint if photo exists */}
                {asset.photos && asset.photos.length > 0 && (
                  <div
                    className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity rounded-[28px] overflow-hidden"
                    style={{
                      backgroundImage: `url(${asset.photos[0]})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                )}

                <div className="space-y-4 relative z-10">
                  {/* Top Header: Icon Tag + Date */}
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-label-sm font-semibold"
                      style={{
                        background: `${typeInfo.color}12`,
                        border: `1px solid ${typeInfo.color}20`,
                        color: typeInfo.color,
                        fontSize: '11px',
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]">{typeInfo.icon}</span>
                      {typeInfo.label}
                    </span>

                    {asset.purchase_date && (
                      <span className="text-label-sm text-[#859490]" style={{ fontSize: '11px' }}>
                        Acquired {formatDate(asset.purchase_date)}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-heading font-semibold text-[#dde4e1] text-[18px] group-hover:text-[#4fdbc8] transition-colors truncate">
                      {asset.name}
                    </h3>
                    {asset.description && (
                      <p className="text-body-sm text-[#859490] line-clamp-2 mt-1">{asset.description}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="h-px bg-white/5" />

                  {/* Valuation and Attachment Quick Icons */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-[#859490] uppercase tracking-wider">Current Value</p>
                      <p className="text-body-lg font-bold text-[#dde4e1] font-mono mt-0.5">
                        {formatINR(asset.current_value)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {asset.documents && asset.documents.length > 0 && (
                        <span
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/3 border border-white/5 text-[#bbcac6] hover:text-[#4fdbc8] transition-colors"
                          title={`${asset.documents.length} linked documents`}
                        >
                          <span className="material-symbols-outlined text-[18px]">link</span>
                        </span>
                      )}
                      {asset.photos && asset.photos.length > 0 && (
                        <span
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/3 border border-white/5 text-[#bbcac6] hover:text-[#adc6ff] transition-colors"
                          title={`${asset.photos.length} photos`}
                        >
                          <span className="material-symbols-outlined text-[18px]">photo_library</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Asset Detail Overlay Modal */}
      <NexusModal
        isOpen={viewedAsset !== null}
        onClose={() => setViewedAsset(null)}
        title={viewedAsset?.name || 'Asset Details'}
        description="Detailed valuation and records breakdown."
        size="md"
      >
        {viewedAsset && (
          <div className="space-y-6 py-1 text-body-sm">
            {/* Split Info grid */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/3 border border-white/5 text-[#bbcac6]">
              <div>
                <span className="text-[10px] text-[#859490] block mb-0.5">Asset Type</span>
                <span className="font-semibold text-white capitalize">{viewedAsset.type}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#859490] block mb-0.5">Current Value</span>
                <span className="font-semibold text-[#4fdbc8] font-mono">{formatINR(viewedAsset.current_value)}</span>
              </div>
              {viewedAsset.purchase_date && (
                <div>
                  <span className="text-[10px] text-[#859490] block mb-0.5">Acquisition Date</span>
                  <span className="font-semibold text-white">{formatDate(viewedAsset.purchase_date)}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {viewedAsset.description && (
              <div className="space-y-1.5">
                <h4 className="text-label-sm text-[#859490] uppercase tracking-wider">Description</h4>
                <p className="text-[#bbcac6] leading-relaxed bg-white/[0.01] p-3 rounded-xl border border-white/[0.03]">
                  {viewedAsset.description}
                </p>
              </div>
            )}

            {/* Photos */}
            {viewedAsset.photos && viewedAsset.photos.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-label-sm text-[#859490] uppercase tracking-wider">Asset Photos</h4>
                <div className="grid grid-cols-2 gap-3">
                  {viewedAsset.photos.map((photo, i) => (
                    <a
                      key={i}
                      href={photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative rounded-xl overflow-hidden aspect-video border border-white/8 hover:border-[#4fdbc8]/30 transition-all block group"
                    >
                      <img src={photo} alt={`${viewedAsset.name} ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="material-symbols-outlined text-white">open_in_new</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Linked Documents */}
            {viewedAsset.documents && viewedAsset.documents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-label-sm text-[#859490] uppercase tracking-wider">Linked Vault Documents</h4>
                <div className="space-y-2">
                  {viewedAsset.documents.map((docUrl, i) => {
                    const docMatch = vaultDocs.find((d) => d.file_url === docUrl);
                    return (
                      <a
                        key={i}
                        href={docUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5 text-[#bbcac6] hover:text-[#4fdbc8] hover:border-[#4fdbc8]/25 transition-all group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="material-symbols-outlined text-[#859490] group-hover:text-[#4fdbc8]">
                            description
                          </span>
                          <span className="truncate text-body-sm font-medium">{docMatch?.name || `Document Attachment ${i + 1}`}</span>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-[#859490] group-hover:text-[#4fdbc8]">
                          open_in_new
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 pt-5 border-t border-white/5">
              <button
                type="button"
                onClick={() => setDeleteId(viewedAsset.id)}
                className="flex-1 py-3 rounded-xl font-semibold bg-white/5 border border-white/10 text-[#ffb4ab] hover:bg-[#93000a]/10 hover:border-red-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Delete Asset
              </button>
              <button
                type="button"
                onClick={() => openEditModal(viewedAsset)}
                className="flex-1 py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-1.5"
                style={{
                  background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
                }}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit details
              </button>
            </div>
          </div>
        )}
      </NexusModal>

      {/* Add / Edit Form Modal */}
      <NexusModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingId ? 'Edit Asset Record' : 'Record New Asset'}
        description={editingId ? 'Modify valuation, description, and photo/document links.' : 'Log an asset or holding in the family wealth portfolio.'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Asset Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Neralla Ancestral Home"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
              />
            </div>

            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Asset Category</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] bg-[#1a211f]"
              >
                {ASSET_TYPES.filter((t) => t.id !== 'all').map((type) => (
                  <option key={type.id} value={type.id} className="bg-[#1a211f] text-[#dde4e1]">
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Current Value (INR) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 7500000"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] font-mono"
              />
            </div>

            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Acquisition Date</label>
              <input
                type="date"
                value={formPurchaseDate}
                onChange={(e) => setFormPurchaseDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-label-sm text-[#bbcac6] mb-1.5">Description / Details</label>
            <textarea
              placeholder="Provide specifications, registration details, or notes."
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] resize-none"
            />
          </div>

          {/* Photo URL Adder */}
          <div>
            <label className="block text-label-sm text-[#bbcac6] mb-1.5">Photo Links</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="Paste photo URL..."
                value={photoInput}
                onChange={(e) => setPhotoInput(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
              />
              <button
                type="button"
                onClick={addPhotoUrl}
                className="px-4 rounded-xl text-white font-semibold flex items-center justify-center"
                style={{ background: 'rgba(79, 219, 200, 0.15)', border: '1px solid rgba(79, 219, 200, 0.3)', color: '#4fdbc8' }}
              >
                Add
              </button>
            </div>
            {formPhotos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {formPhotos.map((url, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-lg bg-white/3 border border-white/5 text-[11px] text-[#bbcac6]"
                  >
                    <span className="truncate max-w-[150px]">{url}</span>
                    <button
                      type="button"
                      onClick={() => removePhotoUrl(i)}
                      className="p-0.5 text-red-400 hover:text-red-300 rounded"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked Vault Documents Selection */}
          {vaultDocs.length > 0 && (
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Link Documents from Vault</label>
              <div className="max-h-[140px] overflow-y-auto border border-white/8 rounded-xl p-2 bg-white/2 space-y-1.5">
                {vaultDocs.map((doc) => {
                  const isChecked = formLinkedDocs.includes(doc.file_url);
                  return (
                    <label
                      key={doc.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/3 cursor-pointer text-body-sm text-[#bbcac6] select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDocLink(doc.file_url)}
                        className="rounded border-white/10 text-[#4fdbc8] focus:ring-[#4fdbc8]/30 bg-transparent"
                      />
                      <span className="truncate">{doc.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowFormModal(false)}
              className="flex-1 py-3 rounded-xl text-[#bbcac6] bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl text-white font-semibold transition-all hover:brightness-110 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
                boxShadow: '0 4px 20px rgba(20, 184, 166, 0.2)',
              }}
            >
              {isPending ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Saving...
                </>
              ) : (
                'Save Asset'
              )}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Delete Confirm */}
      <NexusConfirm
        isOpen={deleteId !== null}
        title="Delete Asset Record"
        description="Are you sure you want to remove this asset? This will permanently delete the record."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />
    </div>
  );
}
