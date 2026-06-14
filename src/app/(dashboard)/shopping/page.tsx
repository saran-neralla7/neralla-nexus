'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import {
  fetchShoppingItems,
  createShoppingItem,
  toggleShoppingItem,
  clearCompletedShoppingItems
} from './actions';
import { formatRelativeTime } from '@/lib/utils';

export default function ShoppingPage() {
  const { user } = useUser();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [category, setCategory] = useState('groceries');

  // Initial load
  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await fetchShoppingItems();
      setItems(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch shopping items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Item name is required');
      return;
    }

    startTransition(async () => {
      try {
        await createShoppingItem(name, quantity, category);
        toast.success(`"${name}" added to list!`);
        setName('');
        setQuantity('1');
        setCategory('groceries');
        loadItems();
      } catch (err: any) {
        toast.error(err.message || 'Failed to add item');
      }
    });
  };

  const handleToggle = async (itemId: string, isCompleted: boolean) => {
    try {
      await toggleShoppingItem(itemId, isCompleted);
      
      // Update local state
      setItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              is_completed: isCompleted,
              completer: isCompleted ? { full_name: user?.full_name } : null,
              completed_at: isCompleted ? new Date().toISOString() : null,
            };
          }
          return item;
        })
      );
      toast.success(isCompleted ? 'Item marked completed' : 'Item marked active');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update item');
    }
  };

  const handleClear = async () => {
    if (items.filter((i) => i.is_completed).length === 0) return;
    
    startTransition(async () => {
      try {
        await clearCompletedShoppingItems();
        toast.success('Cleared completed items.');
        loadItems();
      } catch (err: any) {
        toast.error(err.message || 'Failed to clear items');
      }
    });
  };

  // Group items by active and completed
  const activeItems = items.filter((i) => !i.is_completed);
  const completedItems = items.filter((i) => i.is_completed);

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-8 text-[#dde4e1]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[28px]">shopping_cart</span>
          </div>
          <div>
            <h1 className="text-headline-md font-bold tracking-tight text-white">Shopping & Pantry</h1>
            <p className="text-body-sm text-[#859490]">Collaborative checklist for household groceries and items</p>
          </div>
        </div>

        {completedItems.length > 0 && (
          <button
            onClick={handleClear}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold border border-red-500/20 hover:bg-red-500/5 text-red-400 text-body-sm transition-all"
            disabled={isPending}
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            Clear Checked
          </button>
        )}
      </div>

      {/* Input Form Card */}
      <div className="glass-card p-5 rounded-2xl border border-white/5 bg-white/[0.02]">
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          
          <div className="sm:col-span-2 space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Item Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Milk, Apples, Bread, Detergent"
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Quantity / Size</label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 2 litres, 1 kg, 1 pack"
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-[#4fdbc8] text-black font-semibold text-body-sm hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px] font-bold">add</span>
            Add Item
          </button>
        </form>
      </div>

      {/* List Sections */}
      <div className="space-y-6">
        
        {/* Active Items */}
        <div className="space-y-3">
          <h3 className="text-label-md font-bold text-[#4fdbc8] uppercase tracking-wider">Active Needs ({activeItems.length})</h3>
          
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-12 bg-white/[0.01] border border-white/5 rounded-xl" />
              <div className="h-12 bg-white/[0.01] border border-white/5 rounded-xl" />
            </div>
          ) : activeItems.length === 0 ? (
            <p className="text-body-sm text-[#859490] text-center py-6 border border-dashed border-white/5 rounded-xl bg-white/[0.005]">
              No pending shopping items. List is clean!
            </p>
          ) : (
            <div className="space-y-2">
              {activeItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(item.id, true)}
                      className="w-6 h-6 rounded-lg border border-white/15 hover:border-[#4fdbc8] flex items-center justify-center text-transparent hover:text-[#4fdbc8]/40 transition-all bg-white/5"
                    >
                      <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                    </button>
                    <div>
                      <span className="text-body-sm font-semibold text-white">{item.name}</span>
                      {item.quantity && (
                        <span className="text-label-sm text-[#859490] ml-2 font-bold px-1.5 py-0.5 rounded bg-white/5">
                          {item.quantity}
                        </span>
                      )}
                      <p className="text-[10px] text-[#859490] mt-0.5">
                        Added by {item.creator?.full_name || 'Member'} {formatRelativeTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/5">
            <h3 className="text-label-md font-bold text-teal-400 uppercase tracking-wider">Checked Off ({completedItems.length})</h3>
            <div className="space-y-2">
              {completedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.005] border border-white/5 opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(item.id, false)}
                      className="w-6 h-6 rounded-lg bg-[#4fdbc8] border border-[#4fdbc8] flex items-center justify-center text-black"
                    >
                      <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                    </button>
                    <div>
                      <span className="text-body-sm font-semibold text-[#859490] line-through">{item.name}</span>
                      {item.quantity && (
                        <span className="text-label-sm text-[#859490] ml-2 line-through font-bold px-1.5 py-0.5 rounded bg-white/5">
                          {item.quantity}
                        </span>
                      )}
                      <p className="text-[10px] text-[#859490] mt-0.5">
                        Checked off by {item.completer?.full_name || 'Member'} {formatRelativeTime(item.completed_at || item.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
