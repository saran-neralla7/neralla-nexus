'use server';

import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function fetchArticles() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile to find family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) return [];

  const { data, error } = await supabase
    .from('knowledge_articles')
    .select('*')
    .eq('family_id', userData.family_id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((entry: any) => ({
    ...entry,
    tags: entry.tags || [],
    attachments: entry.attachments || [],
  }));
}

export async function createArticle(data: {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  attachments?: string[];
  published?: boolean;
}) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) throw new Error('No family assigned');

  const { error } = await supabase
    .from('knowledge_articles')
    .insert({
      family_id: userData.family_id,
      title: data.title,
      content: data.content || '',
      category: data.category || 'general',
      tags: data.tags || [],
      attachments: data.attachments || [],
      published: data.published ?? true,
      created_by: authUser.id,
    });

  if (error) throw error;
  return { success: true };
}

export async function updateArticle(
  id: string,
  data: {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    attachments?: string[];
    published?: boolean;
  }
) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentEntry } = await supabase
    .from('knowledge_articles')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentEntry?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('knowledge_articles')
    .update({
      title: data.title,
      content: data.content || '',
      category: data.category || 'general',
      tags: data.tags || [],
      attachments: data.attachments || [],
      published: data.published ?? true,
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

export async function deleteArticle(id: string) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Verify family ownership
  const { data: currentEntry } = await supabase
    .from('knowledge_articles')
    .select('family_id')
    .eq('id', id)
    .single();

  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (userData?.family_id !== currentEntry?.family_id) {
    throw new Error('Access denied');
  }

  const { error } = await supabase
    .from('knowledge_articles')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}
