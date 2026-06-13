'use client';
import Link from 'next/link';

const features = [
  'Properties',
  'Vehicles',
  'Investments',
  'Gold',
  'Valuables',
  'Documents',
  'Photos',
  'Portfolio View',
];

export default function AssetsPage() {
  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span
            className="material-symbols-outlined"
            style={{ color: '#4fdbc8', fontSize: '28px', fontVariationSettings: "'FILL' 1" }}
          >
            inventory_2
          </span>
          <h1
            style={{
              fontFamily: 'Geist, sans-serif',
              fontSize: '32px',
              fontWeight: '700',
              color: '#dde4e1',
              letterSpacing: '-0.02em',
            }}
          >
            Assets &amp; Wealth
          </h1>
        </div>
        <p className="text-body-md" style={{ color: '#859490' }}>
          Complete wealth tracking for properties, vehicles, investments and valuables
        </p>
      </div>

      <div className="glass-card rounded-2xl p-8 text-center">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #14b8a6, #0566d9)' }}
        >
          <span
            className="material-symbols-outlined text-white"
            style={{ fontSize: '36px', fontVariationSettings: "'FILL' 1" }}
          >
            inventory_2
          </span>
        </div>

        <h2
          style={{
            fontFamily: 'Geist, sans-serif',
            fontSize: '24px',
            fontWeight: '600',
            color: '#dde4e1',
          }}
        >
          Coming in Phase 5
        </h2>
        <p className="text-body-md mt-2 max-w-md mx-auto" style={{ color: '#859490' }}>
          Complete wealth tracking for properties, vehicles, investments and valuables
        </p>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg mx-auto">
          {features.map((f) => (
            <div
              key={f}
              className="flex items-center gap-2 p-3 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '16px', color: '#4fdbc8' }}
              >
                check_circle
              </span>
              <span className="text-label-sm" style={{ color: '#bbcac6', fontSize: '11px' }}>
                {f}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold"
          style={{
            background: 'rgba(79,219,200,0.1)',
            color: '#4fdbc8',
            border: '1px solid rgba(79,219,200,0.2)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            arrow_back
          </span>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
