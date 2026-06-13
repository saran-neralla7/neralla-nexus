'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Family } from '@/types';

export function useFamily(familyId?: string) {
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!familyId) {
      setLoading(false);
      return;
    }
    const fetchFamily = async () => {
      try {
        const supabase = createClient();
        const { data, error: dbError } = await supabase
          .from('families')
          .select('*')
          .eq('id', familyId)
          .single();
        if (dbError) throw dbError;
        setFamily(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    fetchFamily();
  }, [familyId]);

  return { family, loading, error };
}
