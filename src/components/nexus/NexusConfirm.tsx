'use client';

import * as React from 'react';
import NexusModal from './NexusModal';

interface NexusConfirmProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function NexusConfirm({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  loading = false,
}: NexusConfirmProps) {
  const variantStyles = {
    danger: {
      bg: 'linear-gradient(135deg, #93000a, #690005)',
      hoverBg: 'rgba(255, 180, 171, 0.1)',
      textColor: '#ffb4ab',
      borderColor: 'rgba(255, 180, 171, 0.2)',
      icon: 'warning',
      shadow: '0 8px 32px rgba(147,0,10,0.3)',
    },
    warning: {
      bg: 'linear-gradient(135deg, #f38764, #7c2d11)',
      hoverBg: 'rgba(255, 181, 158, 0.1)',
      textColor: '#ffb59e',
      borderColor: 'rgba(255, 181, 158, 0.2)',
      icon: 'error',
      shadow: '0 8px 32px rgba(243,135,100,0.3)',
    },
    info: {
      bg: 'linear-gradient(135deg, #14b8a6, #0566d9)',
      hoverBg: 'rgba(79, 219, 200, 0.1)',
      textColor: '#4fdbc8',
      borderColor: 'rgba(79, 219, 200, 0.2)',
      icon: 'info',
      shadow: '0 8px 32px rgba(20,184,166,0.3)',
    },
  };

  const currentStyle = variantStyles[variant];

  return (
    <NexusModal
      isOpen={isOpen}
      onClose={onCancel}
      showCloseButton={!loading}
      size="sm"
    >
      <div className="flex flex-col items-center text-center py-4">
        {/* Warning Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{
            background: variant === 'danger' ? 'rgba(255,180,171,0.1)' : variant === 'warning' ? 'rgba(255,181,158,0.1)' : 'rgba(79,219,200,0.1)',
            border: `1px solid ${currentStyle.textColor}25`,
          }}
        >
          <span
            className="material-symbols-outlined text-[32px] animate-pulse"
            style={{ color: currentStyle.textColor, fontVariationSettings: "'FILL' 1" }}
          >
            {currentStyle.icon}
          </span>
        </div>

        {/* Text */}
        <h3
          className="text-headline-sm font-semibold mb-2"
          style={{ color: '#dde4e1', fontFamily: 'Geist, sans-serif' }}
        >
          {title}
        </h3>
        <p className="text-body-sm mb-8 px-2" style={{ color: '#859490' }}>
          {description}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl font-medium transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#bbcac6',
            }}
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
            style={{
              background: loading ? 'rgba(255, 255, 255, 0.1)' : currentStyle.bg,
              color: 'white',
              boxShadow: loading ? 'none' : currentStyle.shadow,
            }}
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </NexusModal>
  );
}
