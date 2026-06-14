'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useUser } from '@/hooks/useUser';
import { toast } from 'sonner';
import {
  fetchTodos,
  createTodo,
  updateTodoStatus,
  deleteTodo
} from './actions';
import { fetchFamilyMembersForExpenses } from '../finance/actions';
import NexusModal from '@/components/nexus/NexusModal';
import NexusConfirm from '@/components/nexus/NexusConfirm';
import { formatDate, getAvatarStyle, getInitials } from '@/lib/utils';

export default function TodosPage() {
  const { user } = useUser();
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Family members list
  const [members, setMembers] = useState<any[]>([]);
  const [selectedFilterMember, setSelectedFilterMember] = useState<string>('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState<any | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [assignedTo, setAssignedTo] = useState('');

  // Initial load
  useEffect(() => {
    if (user) {
      loadTodos(selectedFilterMember === 'all' ? undefined : selectedFilterMember);
      loadFamilyMembers();
    }
  }, [user, selectedFilterMember]);

  const loadTodos = async (memberId?: string) => {
    try {
      setLoading(true);
      const data = await fetchTodos(memberId);
      setTodos(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadFamilyMembers = async () => {
    try {
      const data = await fetchFamilyMembersForExpenses();
      setMembers(data || []);
      // Set default assignment to current user
      setAssignedTo(user?.id || '');
    } catch (err) {
      console.error('Failed to load family members:', err);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }

    startTransition(async () => {
      try {
        await createTodo({
          title,
          description,
          due_date: dueDate || undefined,
          priority,
          assigned_to: assignedTo,
        });
        toast.success(`Task "${title}" created!`);
        setShowAddModal(false);
        resetForm();
        loadTodos(selectedFilterMember === 'all' ? undefined : selectedFilterMember);
      } catch (err: any) {
        toast.error(err.message || 'Failed to create task');
      }
    });
  };

  const handleStatusChange = async (todoId: string, targetStatus: 'todo' | 'in_progress' | 'completed') => {
    try {
      await updateTodoStatus(todoId, targetStatus);
      
      // Update local state instantly
      setTodos((prevTodos) =>
        prevTodos.map((t) => (t.id === todoId ? { ...t, status: targetStatus } : t))
      );
      toast.success('Task status updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update task');
    }
  };

  const handleDelete = async () => {
    if (!todoToDelete) return;
    startTransition(async () => {
      try {
        await deleteTodo(todoToDelete.id);
        toast.success('Task deleted.');
        setShowDeleteConfirm(false);
        setTodoToDelete(null);
        loadTodos(selectedFilterMember === 'all' ? undefined : selectedFilterMember);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete task');
      }
    });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setPriority('medium');
    setAssignedTo(user?.id || '');
  };

  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  // Kanban Columns
  const todoTasks = todos.filter((t) => t.status === 'todo');
  const inProgressTasks = todos.filter((t) => t.status === 'in_progress');
  const completedTasks = todos.filter((t) => t.status === 'completed');

  const renderTaskCard = (task: any) => {
    const isOverdue = task.due_date && new Date(task.due_date).getTime() < Date.now() - 86400000 && task.status !== 'completed';
    return (
      <div
        key={task.id}
        className="glass-card rounded-xl p-4 border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all space-y-3 relative group"
      >
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-body-sm font-semibold text-white group-hover:text-[#4fdbc8] transition-colors">
            {task.title}
          </h4>
          
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            {(task.created_by === user?.id || isOwner) && (
              <button
                onClick={() => {
                  setTodoToDelete(task);
                  setShowDeleteConfirm(true);
                }}
                className="p-1 hover:bg-white/5 rounded text-[#859490] hover:text-red-400"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            )}
          </div>
        </div>

        {task.description && (
          <p className="text-body-sm text-[#bbcac6] line-clamp-2">{task.description}</p>
        )}

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Priority Badge */}
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                task.priority === 'high' ? 'bg-red-500/10 text-red-400 border border-red-500/25' :
                task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25' :
                'bg-blue-500/10 text-blue-400 border border-blue-500/25'
              }`}
            >
              {task.priority}
            </span>

            {/* Due Date */}
            {task.due_date && (
              <span className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${isOverdue ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white/5 text-[#859490]'}`}>
                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                {formatDate(task.due_date)}
              </span>
            )}
          </div>

          {/* Assigned Avatar */}
          {task.assigned_user && (
            <div
              title={`Assigned to ${task.assigned_user.full_name}`}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-white/10 relative overflow-hidden"
              style={{ 
                background: task.assigned_user.avatar_url ? 'transparent' : getAvatarStyle(task.assigned_user.full_name) 
              }}
            >
              {task.assigned_user.avatar_url ? (
                <img
                  src={task.assigned_user.avatar_url}
                  alt={task.assigned_user.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(task.assigned_user.full_name)
              )}
            </div>
          )}
        </div>

        {/* State Toggle Buttons */}
        <div className="flex border-t border-white/5 pt-3 gap-2">
          {task.status !== 'todo' && (
            <button
              onClick={() => handleStatusChange(task.id, 'todo')}
              className="flex-1 py-1 text-[11px] text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all"
            >
              Move to Todo
            </button>
          )}
          {task.status !== 'in_progress' && task.status !== 'completed' && (
            <button
              onClick={() => handleStatusChange(task.id, 'in_progress')}
              className="flex-1 py-1 text-[11px] text-[#4fdbc8] bg-[#4fdbc8]/5 hover:bg-[#4fdbc8]/10 border border-[#4fdbc8]/15 rounded-lg transition-all"
            >
              Start Task
            </button>
          )}
          {task.status !== 'completed' && (
            <button
              onClick={() => handleStatusChange(task.id, 'completed')}
              className="flex-1 py-1 text-[11px] text-teal-400 bg-teal-400/5 hover:bg-teal-400/10 border border-teal-400/15 rounded-lg transition-all"
            >
              Complete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 text-[#dde4e1]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl premium-gradient flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-[28px]">splitscreen</span>
          </div>
          <div>
            <h1 className="text-headline-md font-bold tracking-tight text-white">Shared Todos</h1>
            <p className="text-body-sm text-[#859490]">Create, organize, and assign daily chores and tasks</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Owner Filter Selector */}
          {isOwner && members.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-body-sm text-[#859490]">Assignee:</span>
              <select
                value={selectedFilterMember}
                onChange={(e) => setSelectedFilterMember(e.target.value)}
                className="input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                <option value="all">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-[#4fdbc8] text-black hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create Task
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Todo */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-white/[0.01] flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <h3 className="text-body-md font-bold text-white">To Do</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-label-sm text-[#859490]">{todoTasks.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {loading ? (
              <div className="h-28 bg-white/[0.01] border border-white/5 rounded-xl animate-pulse" />
            ) : todoTasks.length === 0 ? (
              <p className="text-body-sm text-[#859490] text-center py-12">No tasks to do.</p>
            ) : (
              todoTasks.map(renderTaskCard)
            )}
          </div>
        </div>

        {/* Column 2: In Progress */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-white/[0.01] flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <h3 className="text-body-md font-bold text-white">In Progress</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-label-sm text-[#859490]">{inProgressTasks.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {loading ? (
              <div className="h-28 bg-white/[0.01] border border-white/5 rounded-xl animate-pulse" />
            ) : inProgressTasks.length === 0 ? (
              <p className="text-body-sm text-[#859490] text-center py-12">No tasks in progress.</p>
            ) : (
              inProgressTasks.map(renderTaskCard)
            )}
          </div>
        </div>

        {/* Column 3: Completed */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-white/[0.01] flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <h3 className="text-body-md font-bold text-white">Completed</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-label-sm text-[#859490]">{completedTasks.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4">
            {loading ? (
              <div className="h-28 bg-white/[0.01] border border-white/5 rounded-xl animate-pulse" />
            ) : completedTasks.length === 0 ? (
              <p className="text-body-sm text-[#859490] text-center py-12">No completed tasks.</p>
            ) : (
              completedTasks.map(renderTaskCard)
            )}
          </div>
        </div>

      </div>

      {/* Add Todo Modal */}
      <NexusModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create Family Task"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          
          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wash family car, Pay internet bill"
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-body-sm text-[#bbcac6]">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter chore details or additional notes..."
              rows={3}
              className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Due Date (Optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm text-white"
              />
            </div>
          </div>

          {/* User Assignment (Only visible to Owner/Admin) */}
          {isOwner && members.length > 0 && (
            <div className="space-y-1">
              <label className="text-body-sm text-[#bbcac6]">Assign Task To</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full input-glass px-3 py-2.5 rounded-xl text-body-sm bg-[#161d1b] text-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => { setShowAddModal(false); resetForm(); }}
              className="flex-1 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-body-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-[#4fdbc8] text-black font-semibold text-body-sm hover:brightness-110 shadow-lg shadow-[#4fdbc8]/15 transition-all"
            >
              {isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </NexusModal>

      {/* Delete Confirmation */}
      <NexusConfirm
        isOpen={showDeleteConfirm}
        title="Delete Chore Task?"
        description={`Are you sure you want to permanently delete task "${todoToDelete?.title}"?`}
        confirmText="Delete Task"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setTodoToDelete(null);
        }}
        variant="danger"
        loading={isPending}
      />

    </div>
  );
}
