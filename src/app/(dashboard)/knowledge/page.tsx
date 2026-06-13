'use client';

import { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import type { KnowledgeArticle, Document } from '@/types';
import {
  fetchArticles,
  createArticle,
  updateArticle,
  deleteArticle,
} from './actions';

const KNOWLEDGE_CATEGORIES = [
  { id: 'all', label: 'All Wiki', icon: 'menu_book', color: '#4fdbc8' },
  { id: 'guidelines', label: 'Guidelines', icon: 'gavel', color: '#adc6ff' },
  { id: 'procedures', label: 'Procedures', icon: 'checklist', color: '#ffb4ab' },
  { id: 'recipes', label: 'Recipes', icon: 'restaurant', color: '#ffb59e' },
  { id: 'tech', label: 'Tech & Home', icon: 'router', color: '#a78bfa' },
  { id: 'general', label: 'General', icon: 'import_contacts', color: '#859490' },
];

export default function KnowledgePage() {
  const { user } = useUser();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [vaultDocs, setVaultDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Article View State
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Modals & Form State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [formAttachments, setFormAttachments] = useState<string[]>([]);
  const [formPublished, setFormPublished] = useState(true);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user?.family_id) return;
    try {
      setLoading(true);
      const data = await fetchArticles();
      setArticles(data as KnowledgeArticle[]);

      // Select first article by default if any
      if (data && data.length > 0 && !selectedArticleId) {
        setSelectedArticleId(data[0].id);
      }

      // Fetch vault documents for attachment links
      const supabase = createClient();
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('family_id', user.family_id)
        .is('deleted_at', null)
        .order('name');
      setVaultDocs(docs || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load wiki articles');
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
    setFormCategory('general');
    setFormContent('');
    setFormTags([]);
    setTagInput('');
    setFormAttachments([]);
    setFormPublished(true);
    setShowFormModal(true);
  };

  const openEditModal = (article: KnowledgeArticle) => {
    setEditingId(article.id);
    setFormTitle(article.title);
    setFormCategory(article.category || 'general');
    setFormContent(article.content);
    setFormTags(article.tags || []);
    setTagInput('');
    setFormAttachments(article.attachments || []);
    setFormPublished(article.published);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error('Article title is required');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          title: formTitle,
          content: formContent,
          category: formCategory,
          tags: formTags,
          attachments: formAttachments,
          published: formPublished,
        };

        if (editingId) {
          await updateArticle(editingId, payload);
          toast.success('Wiki article updated successfully');
        } else {
          await createArticle(payload);
          toast.success('Wiki article published successfully');
        }

        setShowFormModal(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save article');
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await deleteArticle(deleteId);
      toast.success('Wiki article deleted successfully');
      setDeleteId(null);
      if (selectedArticleId === deleteId) {
        setSelectedArticleId(null);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete article');
    }
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

  const toggleAttachmentLink = (fileUrl: string) => {
    setFormAttachments((prev) =>
      prev.includes(fileUrl) ? prev.filter((url) => url !== fileUrl) : [...prev, fileUrl]
    );
  };

  // Simple Markdown Parser
  const parseInlineMarkdown = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-[#4fdbc8] font-bold">{part}</strong>;
      }
      return part;
    });
  };

  const renderMarkdown = (md: string) => {
    if (!md) return <p className="text-[#859490] italic">No content written yet.</p>;
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-[#dde4e1] font-heading font-semibold text-headline-sm mt-5 mb-2.5">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-[#dde4e1] font-heading font-semibold text-headline-md mt-6 mb-3">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} className="text-[#dde4e1] font-heading font-bold text-headline-lg mt-8 mb-4">{line.replace('# ', '')}</h2>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.substring(2);
        return (
          <ul key={idx} className="list-disc pl-5 my-1.5 space-y-1 text-[#bbcac6]">
            <li>{parseInlineMarkdown(text)}</li>
          </ul>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-3" />;
      }
      return <p key={idx} className="text-[#bbcac6] leading-relaxed mb-3.5">{parseInlineMarkdown(line)}</p>;
    });
  };

  // Filter & Search
  const filteredArticles = articles.filter((art) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      art.title.toLowerCase().includes(searchLower) ||
      art.content.toLowerCase().includes(searchLower) ||
      art.tags.some((t) => t.toLowerCase().includes(searchLower));

    if (!matchesSearch) return false;
    if (selectedCategory === 'all') return true;
    return art.category === selectedCategory;
  });

  const activeArticle = articles.find((a) => a.id === selectedArticleId);

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
              menu_book
            </span>
            <h1
              className="text-headline-lg"
              style={{
                fontFamily: 'Geist, sans-serif',
                color: '#dde4e1',
                letterSpacing: '-0.02em',
              }}
            >
              Knowledge Center
            </h1>
          </div>
          <p className="text-body-md" style={{ color: '#859490' }}>
            A private wiki and repository for family procedures, tech logs, rules, and recipes.
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
          <span className="material-symbols-outlined text-[20px]">edit_note</span>
          Create Article
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none mask-image-right">
          {KNOWLEDGE_CATEGORIES.map((cat) => (
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
            placeholder="Search wiki articles..."
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

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Article List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between text-label-sm text-[#859490] uppercase tracking-wider pl-1">
            <span>Articles ({filteredArticles.length})</span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="glass-card rounded-2xl p-5 h-24 animate-pulse border border-white/5 space-y-3">
                  <div className="h-4 bg-white/5 rounded-full w-2/3" />
                  <div className="h-3 bg-white/5 rounded-full w-1/3" />
                </div>
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center border border-white/5">
              <span className="material-symbols-outlined text-[32px] text-[#859490]">find_in_page</span>
              <p className="text-body-sm text-[#859490] mt-2">No articles found.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {filteredArticles.map((art) => {
                const cat = KNOWLEDGE_CATEGORIES.find((c) => c.id === art.category) || KNOWLEDGE_CATEGORIES[5];
                const isActive = art.id === selectedArticleId;

                return (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArticleId(art.id)}
                    className="glass-card rounded-2xl p-4 border transition-all duration-300 cursor-pointer flex flex-col gap-2.5 relative group"
                    style={{
                      border: isActive ? '1px solid rgba(79, 219, 200, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                      background: isActive ? 'rgba(79, 219, 200, 0.03)' : undefined,
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-[9px] uppercase font-semibold tracking-wider"
                          style={{ color: cat.color }}
                        >
                          {cat.label}
                        </span>
                        {!art.published && (
                          <span className="text-[9px] uppercase font-semibold text-[#ffb4ab] bg-[#690005]/20 px-1.5 py-0.5 rounded">
                            Draft
                          </span>
                        )}
                      </div>
                      <h3 className="font-heading font-semibold text-body-md text-[#dde4e1] group-hover:text-[#4fdbc8] transition-colors truncate mt-1">
                        {art.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {art.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-[9px] uppercase font-semibold text-[#859490] bg-white/3"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Article Reader */}
        <div className="lg:col-span-8">
          {activeArticle ? (
            <div className="glass-card rounded-[28px] p-6 md:p-8 border border-white/5 space-y-6">
              {/* Reader Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/5 pb-5">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-label-sm font-semibold"
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        color: (KNOWLEDGE_CATEGORIES.find((c) => c.id === activeArticle.category) || KNOWLEDGE_CATEGORIES[5]).color,
                      }}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {(KNOWLEDGE_CATEGORIES.find((c) => c.id === activeArticle.category) || KNOWLEDGE_CATEGORIES[5]).icon}
                      </span>
                      {activeArticle.category}
                    </span>

                    {activeArticle.created_at && (
                      <span className="text-label-sm text-[#859490]">
                        Published {formatDate(activeArticle.created_at)}
                      </span>
                    )}
                  </div>
                  <h2
                    className="text-headline-md font-bold text-[#dde4e1]"
                    style={{ fontFamily: 'Geist, sans-serif' }}
                  >
                    {activeArticle.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2 self-start">
                  <button
                    onClick={() => openEditModal(activeArticle)}
                    className="p-2.5 rounded-xl hover:bg-white/5 text-[#bbcac6] hover:text-[#4fdbc8] border border-white/5 transition-all"
                    title="Edit Article"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => setDeleteId(activeArticle.id)}
                    className="p-2.5 rounded-xl hover:bg-[#93000a]/10 text-[#bbcac6] hover:text-[#ffb4ab] border border-white/5 transition-all"
                    title="Delete Article"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Reader Content Body */}
              <article className="prose prose-invert max-w-none text-body-md font-sans">
                {renderMarkdown(activeArticle.content)}
              </article>

              {/* Reader Attachments */}
              {activeArticle.attachments && activeArticle.attachments.length > 0 && (
                <div className="border-t border-white/5 pt-5 space-y-3">
                  <h4 className="text-label-sm text-[#859490] uppercase tracking-wider">Linked Document Attachments</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeArticle.attachments.map((docUrl, idx) => {
                      const matchedDoc = vaultDocs.find((d) => d.file_url === docUrl);
                      return (
                        <a
                          key={idx}
                          href={docUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3.5 rounded-xl bg-white/3 border border-white/5 text-[#bbcac6] hover:text-[#4fdbc8] hover:border-[#4fdbc8]/25 transition-all group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[#859490] group-hover:text-[#4fdbc8]">
                              description
                            </span>
                            <span className="truncate text-body-sm font-medium">
                              {matchedDoc?.name || `Attached Document ${idx + 1}`}
                            </span>
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
            </div>
          ) : (
            <div className="glass-card rounded-[28px] p-12 text-center border border-white/5 text-[#859490]">
              <span className="material-symbols-outlined text-[48px]">library_books</span>
              <p className="text-body-md mt-3">Select a wiki article from the list to view its contents.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      <NexusModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingId ? 'Edit Wiki Article' : 'Compose Wiki Article'}
        description={editingId ? 'Modify article content, category, tags, and document links.' : 'Log a family standard operating procedure, recipe, guidelines, or logs.'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Article Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. WiFi Router Configurations"
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
                {KNOWLEDGE_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-[#1a211f] text-[#dde4e1]">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-label-sm text-[#bbcac6] mb-1.5 flex justify-between">
              <span>Article Content (supports Markdown) *</span>
              <span className="text-[#859490]" style={{ fontSize: '10px' }}>
                Use # for headers, - for bullets, **bold** for emphasis.
              </span>
            </label>
            <textarea
              required
              placeholder="# Heading&#10;&#10;Use this page to document...&#10;&#10;- Bullet point 1&#10;- Bullet point 2"
              rows={8}
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-body-sm input-glass text-[#dde4e1] font-mono resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tag adder */}
            <div>
              <label className="block text-label-sm text-[#bbcac6] mb-1.5">Add Tags</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. router, backup"
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
                  Add
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

            {/* Linked Documents selection */}
            {vaultDocs.length > 0 && (
              <div>
                <label className="block text-label-sm text-[#bbcac6] mb-1.5">Attach Vault Documents</label>
                <div className="max-h-[140px] overflow-y-auto border border-white/8 rounded-xl p-2.5 bg-white/2 space-y-1.5">
                  {vaultDocs.map((doc) => {
                    const isChecked = formAttachments.includes(doc.file_url);
                    return (
                      <label
                        key={doc.id}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/3 cursor-pointer text-body-sm text-[#bbcac6] select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAttachmentLink(doc.file_url)}
                          className="rounded border-white/10 text-[#4fdbc8] focus:ring-[#4fdbc8]/30 bg-transparent"
                        />
                        <span className="truncate">{doc.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div
            className="flex items-center justify-between p-4 rounded-xl"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div>
              <p className="text-body-sm font-semibold text-[#dde4e1]">Publish Immediately</p>
              <p className="text-[12px] text-[#859490]">If disabled, this article will remain a draft only seen by authors.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formPublished}
                onChange={(e) => setFormPublished(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#bbcac6] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4fdbc8] peer-checked:after:bg-[#003731] peer-checked:after:border-none"></div>
            </label>
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
                'Save Article'
              )}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Delete Confirmation */}
      <NexusConfirm
        isOpen={deleteId !== null}
        title="Delete Wiki Article"
        description="Are you sure you want to delete this article? This will permanently remove the record."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        variant="danger"
      />
    </div>
  );
}
