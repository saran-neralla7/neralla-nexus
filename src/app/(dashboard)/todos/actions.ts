'use server';

import { createClient } from '@/lib/supabase/server';

// Helper to get authenticated user from supabase
async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

// Get user profile details
async function getUserProfile(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('User profile not found');
  return data;
}

/**
 * Fetches todos.
 * Regular members only see todos assigned to them or created by them.
 * Owners see all family todos.
 */
export async function fetchTodos(memberUserId?: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  let query = supabase
    .from('todos')
    .select(`
      *,
      assigned_user:users!todos_assigned_to_fkey (id, full_name, avatar_url),
      creator:users!todos_created_by_fkey (id, full_name)
    `)
    .eq('family_id', currentUserProfile.family_id);

  const isOwner = currentUserProfile.role === 'owner' || currentUserProfile.role === 'admin';

  if (!isOwner) {
    // Regular members see only their assigned or created tasks
    query = query.or(`assigned_to.eq.${authUser.id},created_by.eq.${authUser.id}`);
  } else if (memberUserId) {
    // Owner can filter by a specific member
    query = query.eq('assigned_to', memberUserId);
  }

  const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

/**
 * Creates a new todo
 */
export async function createTodo(todoData: {
  title: string;
  description?: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  assigned_to?: string;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  let assignedId = todoData.assigned_to || authUser.id;
  const isOwner = currentUserProfile.role === 'owner' || currentUserProfile.role === 'admin';

  // Regular members can only assign to themselves
  if (!isOwner) {
    assignedId = authUser.id;
  } else if (todoData.assigned_to) {
    // Verify target user is in same family
    const targetUserProfile = await getUserProfile(supabase, todoData.assigned_to);
    if (targetUserProfile.family_id !== currentUserProfile.family_id) {
      throw new Error('Assigned member is not part of your family.');
    }
  }

  const { error } = await supabase
    .from('todos')
    .insert({
      family_id: currentUserProfile.family_id,
      title: todoData.title,
      description: todoData.description || '',
      due_date: todoData.due_date || null,
      priority: todoData.priority || 'medium',
      status: 'todo',
      assigned_to: assignedId,
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

/**
 * Updates todo status (e.g. todo, in_progress, completed)
 */
export async function updateTodoStatus(todoId: string, status: 'todo' | 'in_progress' | 'completed') {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  // Check permissions
  const { data: todo, error: todoErr } = await supabase
    .from('todos')
    .select('assigned_to, created_by, family_id')
    .eq('id', todoId)
    .single();

  if (todoErr || !todo) throw new Error('Task not found');
  if (todo.family_id !== currentUserProfile.family_id) throw new Error('Access denied');

  const isOwner = currentUserProfile.role === 'owner' || currentUserProfile.role === 'admin';
  const isAssigned = todo.assigned_to === authUser.id;
  const isCreator = todo.created_by === authUser.id;

  if (!isOwner && !isAssigned && !isCreator) {
    throw new Error('Access denied. You can only update status for tasks assigned or created by you.');
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  } else {
    updateData.completed_at = null;
  }

  const { error } = await supabase
    .from('todos')
    .update(updateData)
    .eq('id', todoId);

  if (error) throw error;
  return { success: true };
}

/**
 * Deletes a todo
 */
export async function deleteTodo(todoId: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  const currentUserProfile = await getUserProfile(supabase, authUser.id);

  // Check permissions
  const { data: todo, error: todoErr } = await supabase
    .from('todos')
    .select('created_by, family_id')
    .eq('id', todoId)
    .single();

  if (todoErr || !todo) throw new Error('Task not found');
  if (todo.family_id !== currentUserProfile.family_id) throw new Error('Access denied');

  const isOwner = currentUserProfile.role === 'owner' || currentUserProfile.role === 'admin';
  const isCreator = todo.created_by === authUser.id;

  if (!isOwner && !isCreator) {
    throw new Error('Access denied. You can only delete tasks created by you.');
  }

  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', todoId);

  if (error) throw error;
  return { success: true };
}
