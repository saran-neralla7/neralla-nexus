'use server';

import { createClient } from '@/lib/supabase/server';
import { safeDecrypt } from '@/lib/encryption';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export async function askNexus(query: string, pinVerified = false) {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);

  // Get user profile for family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', authUser.id)
    .single();

  if (!userData?.family_id) {
    return {
      answer: "I couldn't verify your family profile. Please log in again.",
      matches: [],
    };
  }

  const familyId = userData.family_id;
  const tokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (tokens.length === 0) {
    return {
      answer: "Please ask a specific question (e.g. 'Where is my passport?', 'Who is my doctor?', or 'Show my policies').",
      matches: [],
    };
  }

  const matches: any[] = [];

  // Helper to check match score
  const getMatchScore = (text: string | null | undefined) => {
    if (!text) return 0;
    const lower = text.toLowerCase();
    let score = 0;
    tokens.forEach((token) => {
      if (lower.includes(token)) score++;
    });
    return score;
  };

  // 1. Search family members
  const { data: members } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_id', familyId);

  if (members) {
    members.forEach((m: any) => {
      const score = getMatchScore(m.full_name) * 3 + getMatchScore(m.relationship) * 2 + getMatchScore(m.bio) + getMatchScore(m.blood_group);
      if (score > 0) {
        matches.push({
          type: 'member',
          title: m.full_name,
          subtitle: `Family Member (${m.relationship || 'Unspecified'})`,
          description: `Blood Group: ${m.blood_group || 'Unknown'}. Phone: ${m.phone || 'N/A'}. ${m.bio || ''}`,
          link: '/family',
          score,
        });
      }
    });
  }

  // 2. Search documents (non-sensitive or sensitive if PIN is verified)
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('family_id', familyId)
    .is('deleted_at', null);

  if (docs) {
    docs.forEach((d: any) => {
      const score = getMatchScore(d.name) * 3 + getMatchScore(d.description) * 2 + (d.tags ? d.tags.map(getMatchScore).reduce((a: number, b: number) => a + b, 0) : 0);
      if (score > 0) {
        if (d.is_sensitive && !pinVerified) {
          matches.push({
            type: 'document_locked',
            title: `🔒 ${d.name} (Sensitive)`,
            subtitle: `Document Vault (${d.category})`,
            description: "This document is sensitive and requires PIN verification to reveal.",
            link: '/vault/documents',
            score,
          });
        } else {
          matches.push({
            type: 'document',
            title: d.name,
            subtitle: `Document Vault (${d.category})`,
            description: d.description || `Category: ${d.category}. Download or view in Vault.`,
            link: d.file_url,
            score,
          });
        }
      }
    });
  }

  // 3. Search medical records
  const { data: medical } = await supabase
    .from('medical_records')
    .select('*')
    .eq('family_id', familyId);

  if (medical) {
    medical.forEach((m: any) => {
      const score = getMatchScore(m.title) * 3 + getMatchScore(m.doctor) * 2 + getMatchScore(m.hospital) * 2 + getMatchScore(m.notes);
      if (score > 0) {
        matches.push({
          type: 'medical',
          title: m.title,
          subtitle: `Medical Record (${m.type})`,
          description: `Doctor: ${m.doctor || 'N/A'}. Hospital: ${m.hospital || 'N/A'}. Notes: ${m.notes || ''}`,
          link: '/medical',
          score,
        });
      }
    });
  }

  // 4. Search policies
  const { data: policies } = await supabase
    .from('policies')
    .select('*')
    .eq('family_id', familyId);

  if (policies) {
    policies.forEach((p: any) => {
      const score = getMatchScore(p.name) * 3 + getMatchScore(p.provider) * 2 + getMatchScore(p.coverage);
      if (score > 0) {
        matches.push({
          type: 'policy',
          title: p.name,
          subtitle: `Insurance Policy (${p.type})`,
          description: `Provider: ${p.provider}. Premium Amount: ₹${p.premium_amount || 'N/A'}. Expiry: ${p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : 'N/A'}`,
          link: '/policies',
          score,
        });
      }
    });
  }

  // 5. Search assets
  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('family_id', familyId);

  if (assets) {
    assets.forEach((a: any) => {
      const score = getMatchScore(a.name) * 3 + getMatchScore(a.description) * 2 + getMatchScore(a.type);
      if (score > 0) {
        matches.push({
          type: 'asset',
          title: a.name,
          subtitle: `Asset (${a.type})`,
          description: `${a.description || ''} Current Value: ₹${a.current_value || 'N/A'}`,
          link: '/assets',
          score,
        });
      }
    });
  }

  // 6. Search trusted contacts
  const { data: contacts } = await supabase
    .from('trusted_contacts')
    .select('*')
    .eq('family_id', familyId);

  if (contacts) {
    contacts.forEach((c: any) => {
      const score = getMatchScore(c.name) * 3 + getMatchScore(c.company) * 2 + getMatchScore(c.notes) + getMatchScore(c.category);
      if (score > 0) {
        matches.push({
          type: 'contact',
          title: c.name,
          subtitle: `Trusted Contact (${c.category})${c.is_emergency ? ' 🚨 EMERGENCY' : ''}`,
          description: `Company: ${c.company || 'N/A'}. Phone: ${c.phone || 'N/A'}. Email: ${c.email || 'N/A'}. Notes: ${c.notes || ''}`,
          link: '/contacts',
          score,
        });
      }
    });
  }

  // Sort matches by relevance score
  const sorted = matches.sort((a, b) => b.score - a.score);

  // Formulate a clean conversational reply
  let answer = "";
  if (sorted.length === 0) {
    answer = `I scanned your family vault but couldn't find matches for "${query}". Try searching for categories like 'passport', 'doctor', 'insurance', or a family member's name.`;
  } else {
    const topMatch = sorted[0];
    answer = `Based on your family vault search, I found **${sorted.length}** relevant results.\n\n`;
    
    // Add custom smart narrative for top result
    if (topMatch.type === 'member') {
      answer += `Here is **${topMatch.title}**'s profile: they are listed as your **${topMatch.subtitle.split('(')[1].replace(')', '')}** and have **${topMatch.description.split('.')[0]}**. You can manage their full credentials in the Family Profiles panel.\n\n`;
    } else if (topMatch.type === 'contact') {
      answer += `I found **${topMatch.title}** who is registered as a **${topMatch.subtitle.split('(')[1].replace(')', '')}**. Contact number is **${topMatch.description.split('Phone: ')[1].split('.')[0]}**. you can call them directly in the service contacts grid.\n\n`;
    } else if (topMatch.type === 'document_locked') {
      answer += `I found a matching document: **${topMatch.title}** but it is locked. Please navigate to the Vault page and input your PIN code to retrieve it.\n\n`;
    } else if (topMatch.type === 'medical') {
      answer += `I found medical file **${topMatch.title}** under medical center. ${topMatch.description}\n\n`;
    }

    if (sorted.length > 1) {
      answer += `Other matches found:`;
    }
  }

  return {
    answer,
    matches: sorted.slice(0, 5),
  };
}
