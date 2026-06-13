'use client';

import { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { formatDate, getInitials, getAvatarStyle } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { Memory, FamilyMember } from '@/types';
import {
  fetchMemories,
  createMemory,
  updateMemory,
  deleteMemory,
} from './actions';

const MEMORY_CATEGORIES = [
  { id: 'all', label: 'All Memories', icon: 'auto_awesome', color: '#4fdbc8' },
  { id: 'photo', label: 'Photos', icon: 'photo_camera', color: '#4fdbc8' },
  { id: 'video', label: 'Videos', icon: 'videocam', color: '#adc6ff' },
  { id: 'trip', label: 'Trips & Travels', icon: 'flight_takeoff', color: '#a78bfa' },
  { id: 'event', label: 'Family Events', icon: 'celebration', color: '#ffb59e' },
  { id: 'achievement', label: 'Achievements', icon: 'emoji_events', color: '#eab308' },
  { id: 'other', label: 'Others', icon: 'bookmark', color: '#859490' },
];

export default function MemoriesPage() {
  const { user } = useUser();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('photo');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formMediaUrls, setFormMediaUrls] = useState<string[]>([]);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [formTaggedMembers, setFormTaggedMembers] = useState<string[]>([]);

  // Viewed Detail Modal State
  const [viewedMemory, setViewedMemory] = useState<Memory | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const data = await fetchMemories();
      setMemories(data as Memory[]);

      // Fetch family members for tagging
      const supabase = createClient();
      const { data: membersData } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', user.family_id)
        .order('full_name');
      setMembers(membersData || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const openAddModal = () => {
    setEditingId(null);
    setFormTitle('');
    setFormCategory('photo');
    setFormDescription('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormMediaUrls([]);
    setMediaUrlInput('');
    setFormTags([]);
    setTagInput('');
    setFormTaggedMembers([]);
    setShowFormModal(true);
  };

  const openEditModal = (memory: Memory) => {
    setEditingId(memory.id);
    setFormTitle(memory.title);
    setFormCategory(memory.category);
    setFormDescription(memory.description || '');
    setFormDate(memory.date || '');
    setFormMediaUrls(memory.media_urls || []);
    setMediaUrlInput('');
    setFormTags(memory.tags || []);
    setTagInput('');
    setFormTaggedMembers(memory.members || []);
    setShowFormModal(true);
    setViewedMemory(null); // Close viewed modal
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Memory title is required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          title: formTitle,
          category: formCategory,
          description: formDescription || undefined,
          date: formDate || undefined,
          media_urls: formMediaUrls,
          tags: formTags,
          members: formTaggedMembers,
        };

        if (editingId) {
          await updateMemory(editingId, payload);
          toast.success('Memory updated successfully');
        } else {
          await createMemory(payload);
          toast.success('Memory captured successfully');
        }

        setShowFormModal(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save memory');
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteMemory(deleteId);
      toast.success('Memory deleted successfully');
      setDeleteId(null);
      setViewedMemory(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete memory');
    }
  };

  const addMediaUrl = () => {
    if (!mediaUrlInput.trim()) return;
    setFormMediaUrls((prev) => [...prev, mediaUrlInput.trim()]);
    setMediaUrlInput('');
  };

  const removeMediaUrl = (idx: number) => {
    setFormMediaUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    const cleanTag = tagInput.trim().toLowerCase();
    if (!formTags.includes(cleanTag)) {
      setFormTags((prev) => [...prev, cleanTag]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setFormTags((prev) => prev.filter((t) => t !== tag));
  };

  const toggleMemberTag = (id: string) => {
    setFormTaggedMembers((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
  };

  // Filter & Search
  const filteredMemories = memories.filter((mem) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      mem.title.toLowerCase().includes(searchLower) ||
      (mem.description && mem.description.toLowerCase().includes(searchLower)) ||
      mem.tags.some((t) => t.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    return mem.category === selectedCategory;
  });

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span
              className="material-symbols-outlined"
              style={{ color: '#4fdbc8', fontSize: '32px', fontVariationSettings: "'FILL' 1" }}
            >
              photo_library
            </span>
            <h1
              className="text-headline-lg"
              style={{
                fontFamily: 'Geist, sans-serif',
                color: '#dde4e1',
                letterSpacing: '-0.02em',
              }}
            >
              Family Memories
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            Capture and share beautiful family milestones, trips, achievements, and everyday moments.
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
          <span className="material-symbols-outlined text-[20px]">add_a_photo</span>
          Capture Memory
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none mask-image-right">
          {MEMORY_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: selectedCategory === cat.id ? 'rgba(79, 219, 200, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${selectedCategory === cat.id ? 'rgba(79, 219, 200, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                color: selectedCategory === cat.id ? '#4fdbc8' : '#bbcac6',
              }}
            >
              <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
              {cat.label}
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
            placeholder="Search by title, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#859490] hover:text-[#dde4e1]"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <span className="material-symbols-outlined animate-spin text-[40px] text-[#4fdbc8]">
            progress_activity
          </span>
          <p className="text-body-md" style={{ color: '#859490' }}>Loading memories gallery...</p>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="glass-card rounded-[32px] p-12 text-center max-w-xl mx-auto space-y-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}
          >
            <span className="material-symbols-outlined text-[32px] text-[#859490]">
              photo_camera_back
            </span>
          </div>
          <div>
            <h3 className="text-headline-sm font-semibold text-[#dde4e1] mb-2">No Memories Found</h3>
            <p className="text-body-sm text-[#859490]">
              {searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your filters or search terms.'
                : 'Share your first family memories now.'}
            </p>
          </div>
          {searchQuery || selectedCategory !== 'all' ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
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
              Capture Memory
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMemories.map((mem) => {
            const hasMedia = mem.media_urls && mem.media_urls.length > 0;
            const previewUrl = hasMedia ? mem.media_urls[0] : '/placeholder-memory.jpg'; // or nice CSS gradient
            const categoryInfo = MEMORY_CATEGORIES.find((c) => c.id === mem.category) || MEMORY_CATEGORIES[1];

            return (
              <div
                key={mem.id}
                onClick={() => {
                  setViewedMemory(mem);
                  setActivePhotoIndex(0);
                }}
                className="glass-card rounded-[28px] overflow-hidden flex flex-col justify-between border border-white/5 hover:border-[#4fdbc8]/20 hover:shadow-[0_20px_50px_rgba(79,219,200,0.02)] transition-all duration-300 cursor-pointer group"
              >
                {/* Image Section */}
                <div className="relative aspect-video w-full overflow-hidden bg-white/2">
                  {hasMedia ? (
                    <img
                      src={previewUrl}
                      alt={mem.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex flex-col items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, rgba(20,184,166,0.1), rgba(5,102,217,0.05))',
                      }}
                    >
                      <span className="material-symbols-outlined text-[36px]" style={{ color: categoryInfo.color }}>
                        {categoryInfo.icon}
                      </span>
                      <span className="text-label-sm" style={{ color: '#859490' }}>
                        {categoryInfo.label}
                      </span>
                    </div>
                  )}
                  {/* Category icon overlay top right */}
                  <span
                    className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-white backdrop-blur-md"
                    style={{
                      background: 'rgba(9, 15, 14, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: categoryInfo.color,
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]">{categoryInfo.icon}</span>
                  </span>
                </div>

                {/* Content info */}
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    {mem.date && (
                      <p className="text-label-sm text-[#859490]" style={{ fontSize: '11px' }}>
                        {formatDate(mem.date)}
                      </p>
                    )}
                    <h3 className="font-heading font-semibold text-[#dde4e1] text-[18px] group-hover:text-[#4fdbc8] transition-colors truncate">
                      {mem.title}
                    </h3>
                    {mem.description && (
                      <p className="text-body-sm text-[#859490] line-clamp-2">{mem.description}</p>
                    )}
                  </div>

                  {/* Members / Tags */}
                  {(mem.members.length > 0 || mem.tags.length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                      {/* Tagged members */}
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {mem.members.map((memberId) => {
                          const mInfo = members.find((m) => m.id === memberId);
                          if (!mInfo) return null;
                          return (
                            <div
                              key={memberId}
                              className="w-6 h-6 rounded-full border border-[#090f0e] flex items-center justify-center text-white font-bold text-[9px]"
                              style={{ background: getAvatarStyle(mInfo.full_name) }}
                              title={mInfo.full_name}
                            >
                              {getInitials(mInfo.full_name)}
                            </div>
                          );
                        })}
                      </div>

                      {/* Tag labels */}
                      <div className="flex flex-wrap gap-1">
                        {mem.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded bg-white/3 border border-white/5 text-[9px] uppercase font-semibold text-[#859490]"
                          >
                            #{t}
                          </span>
                        ))}
                        {mem.tags.length > 2 && (
                          <span className="text-[10px] text-[#859490] font-mono">+{mem.tags.length - 2}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Viewed Detail Modal */}
      <NexusModal
        isOpen={viewedMemory !== null}
        onClose={() => setViewedMemory(null)}
        title={viewedMemory?.title || 'Memory Detail'}
        description="Cherished family moment."
        size="lg"
      >
        {viewedMemory && (
          <div className="space-y-6 py-1 text-body-sm">
            {/* Carousel / Image Showcase */}
            {viewedMemory.media_urls && viewedMemory.media_urls.length > 0 && (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden aspect-video bg-black/40 border border-white/8">
                  <img
                    src={viewedMemory.media_urls[activePhotoIndex]}
                    alt={`${viewedMemory.title} ${activePhotoIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                  {/* Arrows */}
                  {viewedMemory.media_urls.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setActivePhotoIndex((prev) =>
                            prev === 0 ? viewedMemory.media_urls.length - 1 : prev - 1
                          )
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-black/50 hover:bg-black/80 flex items-center justify-center text-white border border-white/10 transition-all"
                      >
                        <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                      </button>
                      <button
                        onClick={() =>
                          setActivePhotoIndex((prev) =>
                            prev === viewedMemory.media_urls.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-black/50 hover:bg-black/80 flex items-center justify-center text-white border border-white/10 transition-all"
                      >
                        <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                      </button>
                    </>
                  )}
                </div>
                {/* Thumbnails indicator */}
                {viewedMemory.media_urls.length > 1 && (
                  <div className="flex gap-2 justify-center overflow-x-auto py-1">
                    {viewedMemory.media_urls.map((photo, i) => (
                      <button
                        key={i}
                        onClick={() => setActivePhotoIndex(i)}
                        className={`w-12 h-8 rounded-lg overflow-hidden border transition-all ${
                          activePhotoIndex === i ? 'border-[#4fdbc8] scale-105' : 'border-white/10 opacity-60'
                        }`}
                      >
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description & metadata */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-body-sm border-b border-white/5 pb-3">
                {viewedMemory.date && (
                  <span className="text-[#859490] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                    {formatDate(viewedMemory.date)}
                  </span>
                )}
                <span className="capitalize px-3 py-1 rounded bg-white/4 border border-white/8 text-[#bbcac6]">
                  {viewedMemory.category}
                </span>
              </div>

              {viewedMemory.description && (
                <p className="text-[#dde4e1] leading-relaxed text-body-md whitespace-pre-line bg-white/[0.01] p-4 rounded-2xl border border-white/[0.03]">
                  {viewedMemory.description}
                </p>
              )}

              {/* Tagged members list */}
              {viewedMemory.members.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-label-sm text-[#859490] uppercase tracking-wider">Tagged Family Members</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewedMemory.members.map((mid) => {
                      const m = members.find((mb) => mb.id === mid);
                      if (!m) return null;
                      return (
                        <div
                          key={mid}
                          className="flex items-center gap-2 bg-white/3 border border-white/5 pl-2 pr-3.5 py-1.5 rounded-full"
                        >
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px]"
                            style={{ background: getAvatarStyle(m.full_name) }}
                          >
                            {getInitials(m.full_name)}
                          </div>
                          <span className="text-[#bbcac6] text-body-sm font-medium">{m.full_name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags */}
              {viewedMemory.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-label-sm text-[#859490] uppercase tracking-wider">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewedMemory.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full bg-[#4fdbc8]/10 border border-[#4fdbc8]/20 text-[#4fdbc8] text-body-sm"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-3 pt-5 border-t border-white/5">
              <button
                type="button"
                onClick={() => setDeleteId(viewedMemory.id)}
                className="flex-1 py-3 rounded-xl font-semibold bg-white/5 border border-white/10 text-[#ffb4ab] hover:bg-[#93000a]/10 hover:border-red-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Delete Memory
              </button>
              <button
                type="button"
                onClick={() => openEditModal(viewedMemory)}
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
        title={editingId ? 'Edit Memory Details' : 'Capture New Memory'}
        description={editingId ? 'Modify memory details, tags, and media links.' : 'Log a milestone, trip, event, or special family memory.'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Memory Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Arjun's Graduation Ceremony"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
              />
            </div>

            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Category</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] bg-[#1a211f]"
              >
                {MEMORY_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-[#1a211f] text-[#dde4e1]">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Date of Event</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] font-mono"
              />
            </div>

            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Add Media Links (Photos/Videos)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste image/video URL..."
                  value={mediaUrlInput}
                  onChange={(e) => setMediaUrlInput(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
                />
                <button
                  type="button"
                  onClick={addMediaUrl}
                  className="px-4 rounded-xl text-white font-semibold flex items-center justify-center"
                  style={{ background: 'rgba(79, 219, 200, 0.15)', border: '1px solid rgba(79, 219, 200, 0.3)', color: '#4fdbc8' }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Media Links list */}
          {formMediaUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2.5 border border-white/8 rounded-xl bg-white/2">
              {formMediaUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg bg-white/3 border border-white/5 text-[11px] text-[#bbcac6] min-w-0"
                >
                  <span className="truncate max-w-[150px]">{url}</span>
                  <button
                    type="button"
                    onClick={() => removeMediaUrl(idx)}
                    className="text-red-400 hover:text-red-300 p-0.5"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-label-sm text-[#bbcac6] mb-1.5">Description / Story</label>
            <textarea
              placeholder="Tell the story or add notes about this memory."
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tag adder */}
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Add Tags</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. graduation, family"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1]"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 rounded-xl text-white font-semibold flex items-center justify-center"
                  style={{ background: 'rgba(79, 219, 200, 0.15)', border: '1px solid rgba(79, 219, 200, 0.3)', color: '#4fdbc8' }}
                >
                  Tag
                </button>
              </div>
              {formTags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {formTags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded bg-[#4fdbc8]/8 border border-[#4fdbc8]/15 text-[#4fdbc8] text-[11px]"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="p-0.5 text-[#4fdbc8] hover:text-[#71f8e4] rounded"
                      >
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Tag family members checklist */}
            {members.length > 0 && (
              <div>
                <label className="block text-label-sm text-[#bbcac6] mb-1.5">Tag Family Members</label>
                <div className="max-h-[140px] overflow-y-auto border border-white/8 rounded-xl p-2.5 bg-white/2 space-y-1.5">
                  {members.map((m) => {
                    const isChecked = formTaggedMembers.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/3 cursor-pointer text-body-sm text-[#bbcac6] select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMemberTag(m.id)}
                          className="rounded border-white/10 text-[#4fdbc8] focus:ring-[#4fdbc8]/30 bg-transparent"
                        />
                        <span className="truncate">{m.full_name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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
                'Save Memory'
              )}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Delete Confirmation */}
      <NexusConfirm
        isOpen={deleteId !== null}
        title="Delete Memory"
        description="Are you sure you want to delete this memory? This will permanently remove it."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />
    </div>
  );
}
