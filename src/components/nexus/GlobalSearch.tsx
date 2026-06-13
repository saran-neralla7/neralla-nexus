'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  type: 'page' | 'member' | 'document' | 'password' | 'action';
  title: string;
  subtitle?: string;
  href?: string;
  icon: string;
  action?: () => void;
}

const STATIC_PAGES: SearchItem[] = [
  { id: 'dash', type: 'page', title: 'Go to Command Center', subtitle: 'Family home dashboard', href: '/dashboard', icon: 'dashboard' },
  { id: 'tree', type: 'page', title: 'Go to Family Tree', subtitle: 'Visual interactive lineage', href: '/tree', icon: 'account_tree' },
  { id: 'mems', type: 'page', title: 'Go to Family Profiles', subtitle: 'Manage members & documents', href: '/family', icon: 'group' },
  { id: 'docs', type: 'page', title: 'Go to Documents Vault', subtitle: 'IDs, records and archives', href: '/vault/documents', icon: 'folder_open' },
  { id: 'pass', type: 'page', title: 'Go to Password Vault', subtitle: 'Secure AES-256 credentials', href: '/vault/passwords', icon: 'password' },
  { id: 'meds', type: 'page', title: 'Go to Medical Center', subtitle: 'Health timeline & prescriptions', href: '/medical', icon: 'medical_services' },
  { id: 'pols', type: 'page', title: 'Go to Policies & Insurance', subtitle: 'LIC, health & vehicle policies', href: '/policies', icon: 'policy' },
  { id: 'assets', type: 'page', title: 'Go to Assets & Wealth', subtitle: 'Property, gold and investments', href: '/assets', icon: 'payments' },
  { id: 'sys', type: 'page', title: 'Go to System Progress', subtitle: 'Development roadmap tracker', href: '/system-progress', icon: 'track_changes' },
];

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via layout handler (which controls state)
          // Since layout controls state, we let the parent layout handle it.
          // We can dispatch a custom event
          window.dispatchEvent(new CustomEvent('toggle-global-search'));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset index and queries when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(STATIC_PAGES);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Handle Search Input Queries
  useEffect(() => {
    if (!isOpen) return;

    if (query.trim().length < 2) {
      setResults(STATIC_PAGES);
      setSelectedIndex(0);
      return;
    }

    const performSearch = async () => {
      if (!user?.family_id) return;
      try {
        setLoading(true);
        const supabase = createClient();
        const searchQuery = `%${query.trim()}%`;

        // 1. Search family members
        const { data: members } = await supabase
          .from('family_members')
          .select('id, full_name, relationship')
          .eq('family_id', user.family_id)
          .ilike('full_name', searchQuery)
          .limit(3);

        // 2. Search documents (non-deleted)
        const { data: docs } = await supabase
          .from('documents')
          .select('id, name, category')
          .eq('family_id', user.family_id)
          .is('deleted_at', null)
          .ilike('name', searchQuery)
          .limit(4);

        // 3. Search passwords (non-deleted)
        const { data: passwords } = await supabase
          .from('passwords')
          .select('id, title, category')
          .eq('family_id', user.family_id)
          .is('deleted_at', null)
          .ilike('title', searchQuery)
          .limit(4);

        // Map database results
        const memberItems: SearchItem[] = (members || []).map((m) => ({
          id: `m-${m.id}`,
          type: 'member',
          title: m.full_name,
          subtitle: `Family Profile (${m.relationship || 'Member'})`,
          href: `/family?tab=members&id=${m.id}`,
          icon: 'person',
        }));

        const docItems: SearchItem[] = (docs || []).map((d) => ({
          id: `d-${d.id}`,
          type: 'document',
          title: d.name,
          subtitle: `Document (${d.category})`,
          href: `/vault/documents?id=${d.id}`,
          icon: 'description',
        }));

        const passItems: SearchItem[] = (passwords || []).map((p) => ({
          id: `p-${p.id}`,
          type: 'password',
          title: p.title,
          subtitle: `Password Vault (${p.category})`,
          href: `/vault/passwords`,
          icon: 'vpn_key',
        }));

        // Filter pages matching query
        const matchedPages = STATIC_PAGES.filter(
          (p) =>
            p.title.toLowerCase().includes(query.toLowerCase()) ||
            p.subtitle?.toLowerCase().includes(query.toLowerCase())
        );

        setResults([...matchedPages, ...memberItems, ...docItems, ...passItems]);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(performSearch, 250);
    return () => clearTimeout(timer);
  }, [query, isOpen, user]);

  // Keyboard navigation inside search dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      triggerItem(results[selectedIndex]);
    }
  };

  const triggerItem = (item: SearchItem) => {
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
    onClose();
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-[#090f0e]/85 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* Dialog Content */}
        <div className="fixed inset-x-0 top-10 md:top-[12vh] z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Content
            onKeyDown={handleKeyDown}
            className="w-full max-w-[600px] rounded-[24px] overflow-hidden flex flex-col glass-modal inner-glow relative data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 relative">
              <span className="material-symbols-outlined text-[#859490] text-[22px]">search</span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search documents, profiles, vaults, settings..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-body-md text-white placeholder-[#859490] border-none outline-none focus:ring-0 w-full"
              />
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[18px] text-[#4fdbc8]">
                  progress_activity
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[#859490] border border-white/8 px-1.5 py-0.5 rounded-lg">
                  ESC
                </span>
              )}
            </div>

            {/* Results Body */}
            <div className="flex-1 overflow-y-auto max-h-[350px] p-2">
              {results.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <span className="material-symbols-outlined text-[32px] text-[#859490]">sentiment_dissatisfied</span>
                  <p className="text-body-sm text-[#bbcac6]">No matching results found for &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => triggerItem(item)}
                        className={cn(
                          "w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all border border-transparent",
                          isSelected
                            ? "bg-white/5 border-white/10 text-white"
                            : "text-[#bbcac6] hover:bg-white/3 hover:text-white"
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
                            isSelected
                              ? "bg-[#4fdbc8]/15 border-[#4fdbc8]/30 text-[#4fdbc8]"
                              : "bg-white/3 border-white/5 text-[#859490]"
                          )}
                        >
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        </div>

                        {/* Text labels */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-body-sm font-semibold truncate">{item.title}</h4>
                          {item.subtitle && (
                            <p className="text-[10px] text-[#859490] truncate mt-0.5">{item.subtitle}</p>
                          )}
                        </div>

                        {/* Active indicator */}
                        {isSelected && (
                          <span className="material-symbols-outlined text-[16px] text-[#4fdbc8]">
                            arrow_forward_ios
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/5 bg-[#0e1513]/40 flex items-center justify-between text-[11px] text-[#859490] font-mono">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="border border-white/8 px-1 py-0.2 rounded bg-white/3">↓↑</span> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <span className="border border-white/8 px-1 py-0.2 rounded bg-white/3">↵</span> Select
                </span>
              </div>
              <div>
                <span>Press <kbd className="border border-white/8 px-1 py-0.2 rounded bg-white/3">⌘K</kbd> to toggle</span>
              </div>
            </div>

          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
