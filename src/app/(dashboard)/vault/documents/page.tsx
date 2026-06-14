'use client';

import { useEffect, useState, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import { formatDate, formatFileSize, daysUntil, isExpiringSoon, isExpired, getAvatarStyle, getInitials } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { Document, FamilyMember } from '@/types';
import { DocumentScanner } from '@/components/nexus/DocumentScanner';

const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: 'folder' },
  { id: 'aadhaar', label: 'Aadhaar Card', icon: 'fingerprint' },
  { id: 'pan', label: 'PAN Card', icon: 'badge' },
  { id: 'passport', label: 'Passport', icon: 'menu_book' },
  { id: 'driving_license', label: 'Driving License', icon: 'card_membership' },
  { id: 'property', label: 'Property Registry', icon: 'home' },
  { id: 'insurance', label: 'Insurance Policy', icon: 'policy' },
  { id: 'certificate', label: 'Academic/Certificate', icon: 'school' },
  { id: 'tax', label: 'Tax & Financials', icon: 'account_balance' },
  { id: 'medical', label: 'Medical Reports', icon: 'medical_services' },
  { id: 'other', label: 'Other Documents', icon: 'description' },
];

export default function DocumentsPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterMemberId = searchParams.get('memberId') || 'all';

  const [docs, setDocs] = useState<Document[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Search & Filtering states
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMember, setSelectedMember] = useState(filterMemberId);
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, active, expiring, expired

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Document | null>(null);

  // Form states
  const [docName, setDocName] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docCategory, setDocCategory] = useState('other');
  const [docMemberId, setDocMemberId] = useState('');
  const [docExpiryDate, setDocExpiryDate] = useState('');
  const [docTags, setDocTags] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docIsSensitive, setDocIsSensitive] = useState(false);

  const fetchMembers = async () => {
    if (!user?.family_id) return;
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', user.family_id)
        .order('full_name', { ascending: true });
      setMembers(data || []);
      if (data && data.length > 0 && !docMemberId) {
        setDocMemberId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDocuments = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('family_id', user.family_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocs(data || []);
    } catch (err) {
      toast.error('Failed to load documents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.family_id) {
      fetchMembers();
      fetchDocuments();
    }
  }, [user?.family_id]);

  useEffect(() => {
    if (filterMemberId !== 'all') {
      setSelectedMember(filterMemberId);
    }
  }, [filterMemberId]);

  const resetForm = () => {
    setDocName('');
    setDocDescription('');
    setDocCategory('other');
    if (members.length > 0) setDocMemberId(members[0].id);
    setDocExpiryDate('');
    setDocTags('');
    setDocFile(null);
    setDocIsSensitive(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName) {
      toast.error('Document name is required');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        let fileUrl = 'https://placehold.co/600x400/161d1b/4fdbc8?text=' + encodeURIComponent(docName);
        let fileSize = 0;
        let mimeType = '';

        if (docFile) {
          fileSize = docFile.size;
          mimeType = docFile.type;
          
          // Attempt Storage Upload
          const fileExt = docFile.name.split('.').pop();
          const fileName = `${user?.family_id}/${Date.now()}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(fileName, docFile);

          if (uploadError) {
            console.warn('Storage upload error (falling back to placeholder):', uploadError.message);
            toast.warning(
              "Note: 'documents' bucket not found in storage. Saved file metadata with placeholder link."
            );
          } else if (uploadData) {
            const { data: urlData } = supabase.storage
              .from('documents')
              .getPublicUrl(fileName);
            fileUrl = urlData.publicUrl;
          }
        }

        const tagsArray = docTags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0);

        const { error: dbError } = await supabase.from('documents').insert({
          family_id: user?.family_id,
          member_id: docMemberId || null,
          category: docCategory,
          name: docName,
          description: docDescription || null,
          file_url: fileUrl,
          file_size: fileSize || null,
          mime_type: mimeType || null,
          tags: tagsArray,
          expiry_date: docExpiryDate || null,
          is_sensitive: docIsSensitive,
          created_by: user?.id,
        });

        if (dbError) throw dbError;
        
        toast.success(`Document "${docName}" vaulted successfully!`);
        setShowUploadModal(false);
        resetForm();
        fetchDocuments();
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload document');
        console.error(err);
      }
    });
  };

  const handleDelete = async () => {
    if (!docToDelete) return;

    startTransition(async () => {
      try {
        const supabase = createClient();
        
        // Soft delete: update deleted_at
        const { error } = await supabase
          .from('documents')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', docToDelete.id);

        if (error) throw error;

        toast.success(`Document "${docToDelete.name}" moved to Trash.`);
        setShowDeleteConfirm(false);
        setDocToDelete(null);
        fetchDocuments();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete document');
      }
    });
  };

  // Filtering Logic
  const filteredDocs = docs.filter((doc) => {
    // 1. Search keyword
    const matchesSearch =
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.description?.toLowerCase().includes(search.toLowerCase()) ||
      doc.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    // 2. Category
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;

    // 3. Member owner
    const matchesMember = selectedMember === 'all' || doc.member_id === selectedMember;

    // 4. Expiry status
    let matchesStatus = true;
    if (selectedStatus === 'expired') {
      matchesStatus = doc.expiry_date ? isExpired(doc.expiry_date) : false;
    } else if (selectedStatus === 'expiring') {
      matchesStatus = doc.expiry_date ? isExpiringSoon(doc.expiry_date) : false;
    } else if (selectedStatus === 'active') {
      matchesStatus = doc.expiry_date ? !isExpired(doc.expiry_date) : true;
    }

    return matchesSearch && matchesCategory && matchesMember && matchesStatus;
  });

  const getCategoryIcon = (cat: string) => {
    const matched = CATEGORIES.find((c) => c.id === cat);
    return matched ? matched.icon : 'description';
  };

  const getExpiryBadge = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const days = daysUntil(expiryDate);

    if (days < 0) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#690005]/20 text-[#ffb4ab] border border-[#ffb4ab]/10 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          Expired
        </span>
      );
    }
    if (days <= 30) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#7c2d11]/20 text-[#ffb59e] border border-[#ffb59e]/10 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">error</span>
          {days === 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-[#bbcac6]">
        Expires {formatDate(expiryDate)}
      </span>
    );
  };

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="material-symbols-outlined"
              style={{ color: '#adc6ff', fontSize: '28px', fontVariationSettings: "'FILL' 1" }}
            >
              description
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
              Documents Vault
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            Secure storage for legal certificates, financial accounts, and identity cards
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowScannerModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold border border-[#4fdbc8]/20 hover:bg-[#4fdbc8]/5 transition-all active:scale-[0.98]"
            style={{
              color: '#4fdbc8',
            }}
          >
            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            Scan Document
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowUploadModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(20,184,166,0.25)',
            }}
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            Upload Document
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="glass-card rounded-3xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border border-white/5">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents or tags..."
            className="input-glass w-full pl-11 pr-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
          />
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#859490]" style={{ fontSize: '18px' }}>
            search
          </span>
        </div>

        {/* Category */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Member Filter */}
        <select
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
          className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
        >
          <option value="all">All Members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Documents</option>
          <option value="expiring">Expiring Soon (30d)</option>
          <option value="expired">Expired Documents</option>
        </select>
      </div>

      {/* Grid of Documents */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass-card rounded-3xl p-6 h-48 animate-pulse border border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-white/5 rounded-full w-2/3" />
                  <div className="h-3 bg-white/5 rounded-full w-1/3" />
                </div>
              </div>
              <div className="h-3 bg-white/5 rounded-full w-5/6" />
              <div className="h-4 bg-white/5 rounded-full w-1/4" />
            </div>
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="glass-card rounded-[32px] p-12 text-center border border-white/5 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-[#859490]">
            <span className="material-symbols-outlined text-[32px]">folder_open</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-headline-sm font-semibold text-[#dde4e1]">No documents found</h3>
            <p className="text-body-sm text-[#859490] max-w-sm mx-auto">
              Try adjusting your filters, searching for a different keyword, or upload a new document.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map((doc) => {
            const docOwner = members.find((m) => m.id === doc.member_id);
            return (
              <div
                key={doc.id}
                className="glass-card rounded-[28px] p-6 border border-white/5 hover:border-[#adc6ff]/20 hover:shadow-[0_20px_60px_rgba(173,198,255,0.03)] transition-all duration-300 flex flex-col justify-between gap-4 relative group"
              >
                <div className="space-y-4">
                  {/* Top Header: Icon + Expiry */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#adc6ff]/10 flex items-center justify-center text-[#adc6ff]">
                      <span className="material-symbols-outlined text-[22px]">{getCategoryIcon(doc.category)}</span>
                    </div>
                    {getExpiryBadge(doc.expiry_date)}
                  </div>

                  {/* Document details */}
                  <div>
                    <h3 className="font-semibold text-[#dde4e1] truncate group-hover:text-[#adc6ff] transition-colors" style={{ fontFamily: 'Geist, sans-serif', fontSize: '18px' }}>
                      {doc.name}
                    </h3>
                    {doc.description && (
                      <p className="text-body-sm text-[#859490] line-clamp-2 mt-1">{doc.description}</p>
                    )}
                  </div>

                  {/* Tags */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-lg text-[10px] uppercase font-semibold text-[#859490] bg-white/5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="h-px bg-white/5" />

                  {/* Bottom details: Owner and Actions */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Owner avatar */}
                    {docOwner ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold relative overflow-hidden"
                          style={{ 
                            background: docOwner.avatar_url ? 'transparent' : getAvatarStyle(docOwner.full_name) 
                          }}
                        >
                          {docOwner.avatar_url ? (
                            <img
                              src={docOwner.avatar_url}
                              alt={docOwner.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getInitials(docOwner.full_name)
                          )}
                        </div>
                        <span className="text-label-sm truncate max-w-[100px]" style={{ color: '#bbcac6' }}>
                          {docOwner.full_name.split(' ')[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-label-sm" style={{ color: '#859490' }}>Shared</span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      {doc.file_size && (
                        <span className="text-label-sm text-[#859490] text-xs mr-1">
                          {formatFileSize(doc.file_size)}
                        </span>
                      )}
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-white/5 hover:bg-[#adc6ff]/15 transition-all text-[#adc6ff] flex items-center justify-center"
                        title="Download Document"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                      </a>
                      {(user?.role === 'owner' || user?.role === 'admin' || doc.created_by === user?.id) && (
                        <button
                          onClick={() => {
                            setDocToDelete(doc);
                            setShowDeleteConfirm(true);
                          }}
                          className="p-2 rounded-xl hover:bg-white/5 transition-colors text-[#ffb4ab]"
                          title="Delete Document"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Upload Modal */}
      <NexusModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Document"
        description="Securely store a digital scan of your identity card, policy, or academic certificate."
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Document Name</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. Aadhaar Card - Saran"
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Description (Optional)</label>
            <input
              type="text"
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
              placeholder="Brief details about the document"
              className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Category</label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                {CATEGORIES.slice(1).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Owner Profile</label>
              <select
                value={docMemberId}
                onChange={(e) => setDocMemberId(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1] bg-[#1a211f]"
              >
                <option value="">Family Shared (No Specific Owner)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Expiry Date (Optional)</label>
              <input
                type="date"
                value={docExpiryDate}
                onChange={(e) => setDocExpiryDate(e.target.value)}
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-label-sm uppercase text-[#859490]">Tags (Comma separated)</label>
              <input
                type="text"
                value={docTags}
                onChange={(e) => setDocTags(e.target.value)}
                placeholder="e.g. identity, govt, critical"
                className="input-glass w-full px-4 py-3 rounded-xl text-body-sm text-[#dde4e1]"
              />
            </div>
          </div>

          {/* File input */}
          <div className="space-y-2">
            <label className="text-label-sm uppercase text-[#859490]">Document File</label>
            <div
              className="border border-dashed border-white/10 rounded-2xl p-6 text-center cursor-pointer hover:border-[#adc6ff]/40 transition-colors"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setDocFile(e.target.files[0]);
                  }
                }}
              />
              <span className="material-symbols-outlined text-[32px] text-[#859490] mb-2">upload_file</span>
              <p className="text-body-sm text-[#dde4e1] font-semibold">
                {docFile ? docFile.name : 'Choose a file or drag here'}
              </p>
              <p className="text-label-sm text-[#859490] mt-1 text-xs">
                Supports PDF, JPG, PNG up to 10MB
              </p>
            </div>
          </div>

          {/* Sensitive Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer py-1 select-none">
            <input
              type="checkbox"
              checked={docIsSensitive}
              onChange={(e) => setDocIsSensitive(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 text-[#adc6ff] focus:ring-[#adc6ff]/20 bg-[#1a211f]"
            />
            <span className="text-body-sm" style={{ color: '#bbcac6' }}>
              Mark as sensitive (Requires PIN verification to view)
            </span>
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-60 mt-4"
            style={{
              background: 'linear-gradient(135deg, #14b8a6, #0566d9)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(20,184,166,0.3)',
            }}
          >
            {isPending ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Uploading Document...
              </>
            ) : (
              'Save to Vault'
            )}
          </button>
        </form>
      </NexusModal>

      {/* Delete Document Confirmation */}
      <NexusConfirm
        isOpen={showDeleteConfirm}
        title="Delete Document?"
        description={`Are you sure you want to move "${docToDelete?.name}" to the trash? It will be permanently deleted after 30 days.`}
        confirmText="Move to Trash"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDocToDelete(null);
        }}
        variant="danger"
        loading={isPending}
      />

      {/* Camera Document Scanner */}
      {user && (
        <DocumentScanner
          isOpen={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          onSuccess={fetchDocuments}
          userId={user.id}
          familyId={user.family_id}
        />
      )}
    </div>
  );
}
