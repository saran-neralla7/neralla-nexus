import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { SystemFeature } from '@/types';

export const metadata = { title: 'System Progress' };

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data } = await supabase.from('users').select('*').eq('id', authUser.id).single();
  return data;
}

async function getSystemFeatures(): Promise<SystemFeature[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('system_features')
    .select('*')
    .order('phase', { ascending: true })
    .order('name', { ascending: true });
  return (data as SystemFeature[]) || [];
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    completed: { emoji: '✅', label: 'Completed', bg: 'rgba(79,219,200,0.1)', color: '#4fdbc8' },
    in_progress: { emoji: '🚧', label: 'In Progress', bg: 'rgba(173,198,255,0.1)', color: '#adc6ff' },
    not_started: { emoji: '❌', label: 'Not Started', bg: 'rgba(255,255,255,0.04)', color: '#859490' },
  };
  const c = config[status as keyof typeof config] || config.not_started;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.color }}
    >
      {c.emoji} {c.label}
    </span>
  );
}

export default async function SystemProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.is_owner) redirect('/dashboard');

  const features = await getSystemFeatures();

  const completed = features.filter((f) => f.status === 'completed').length;
  const inProgress = features.filter((f) => f.status === 'in_progress').length;
  const notStarted = features.filter((f) => f.status === 'not_started').length;
  const total = features.length;
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const phases = Array.from(new Set(features.map((f) => f.phase))).sort();

  return (
    <div className="px-4 md:px-8 py-6 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined" style={{ color: '#ffb59e', fontSize: '28px' }}>monitoring</span>
          <h1
            style={{
              fontFamily: 'Geist, sans-serif',
              fontSize: '32px',
              fontWeight: '700',
              color: '#dde4e1',
              letterSpacing: '-0.02em',
            }}
          >
            System Progress
          </h1>
        </div>
        <p className="text-body-md" style={{ color: '#859490' }}>
          Development status tracker for Neralla Nexus Family OS — Owner only
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Features', value: total, color: '#dde4e1' },
          { label: '✅ Completed', value: completed, color: '#4fdbc8' },
          { label: '🚧 In Progress', value: inProgress, color: '#adc6ff' },
          { label: '❌ Not Started', value: notStarted, color: '#859490' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-2xl p-5">
            <p
              style={{
                fontFamily: 'Geist, sans-serif',
                fontSize: '36px',
                fontWeight: '700',
                color: stat.color,
                letterSpacing: '-0.03em',
              }}
            >
              {stat.value}
            </p>
            <p className="text-body-sm mt-1" style={{ color: '#859490' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <span
            className="font-semibold"
            style={{ fontFamily: 'Geist, sans-serif', color: '#dde4e1', fontSize: '18px' }}
          >
            Overall Completion
          </span>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '24px',
              fontWeight: '700',
              color: '#4fdbc8',
            }}
          >
            {completionPct}%
          </span>
        </div>
        <div className="h-3 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${completionPct}%`,
              background: 'linear-gradient(90deg, #14b8a6, #4fdbc8)',
              boxShadow: '0 0 16px rgba(79,219,200,0.4)',
            }}
          />
        </div>
        <p className="text-label-sm mt-2" style={{ color: '#859490' }}>
          {completed} of {total} features complete across 8 phases
        </p>
      </div>

      {/* Phase Breakdown */}
      {phases.map((phase) => {
        const phaseFeatures = features.filter((f) => f.phase === phase);
        const phaseCompleted = phaseFeatures.filter((f) => f.status === 'completed').length;
        const phasePct = Math.round((phaseCompleted / phaseFeatures.length) * 100);

        const phaseNames: Record<number, string> = {
          1: 'Foundation (Auth, Family, Layout)',
          2: 'Profiles & Documents',
          3: 'Vault & Audit',
          4: 'Medical & Protection',
          5: 'Assets & Memories',
          6: 'Time & Emergency',
          7: 'Intelligence & Legacy',
          8: 'Utilities Extension (Phase 8)',
        };

        return (
          <div key={phase} className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className="px-3 py-1 rounded-full text-label-sm font-bold"
                    style={{
                      background: 'rgba(79,219,200,0.1)',
                      color: '#4fdbc8',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    Phase {phase}
                  </span>
                  <h3
                    style={{ fontFamily: 'Geist, sans-serif', fontSize: '18px', fontWeight: '600', color: '#dde4e1' }}
                  >
                    {phaseNames[phase]}
                  </h3>
                </div>
              </div>
              <span className="text-label-sm" style={{ color: '#859490' }}>
                {phaseCompleted}/{phaseFeatures.length}
              </span>
            </div>

            {/* Phase progress bar */}
            <div className="h-1.5 w-full rounded-full mb-5" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${phasePct}%`,
                  background: phasePct === 100 ? 'linear-gradient(90deg, #14b8a6, #4fdbc8)' : 'rgba(173,198,255,0.6)',
                }}
              />
            </div>

            {/* Feature List */}
            <div className="space-y-2">
              {phaseFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <div className="flex-1">
                    <p className="text-body-sm font-medium" style={{ color: '#dde4e1' }}>{feature.name}</p>
                    {feature.description && (
                      <p className="text-label-sm mt-0.5" style={{ color: '#859490' }}>{feature.description}</p>
                    )}
                  </div>
                  <StatusBadge status={feature.status} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
