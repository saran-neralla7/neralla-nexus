'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

interface NexusModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export default function NexusModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
}: NexusModalProps) {
  const sizeClasses = {
    sm: 'max-w-[400px]',
    md: 'max-w-[550px]',
    lg: 'max-w-[700px]',
    xl: 'max-w-[850px]',
    full: 'max-w-[95vw] h-[90vh]',
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-[#090f0e]/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        
        {/* Content Container */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Content
            className={cn(
              "w-full rounded-[28px] overflow-hidden flex flex-col glass-modal inner-glow relative",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
              "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
              "data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2",
              "duration-300 ease-out",
              sizeClasses[size]
            )}
          >
            {/* Header */}
            {(title || description) && (
              <div className="px-6 pt-6 pb-4 flex flex-col gap-1 border-b border-white/5">
                {title && (
                  <DialogPrimitive.Title
                    className="text-headline-sm text-[#dde4e1] font-semibold font-heading"
                  >
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description
                    className="text-body-sm text-[#859490]"
                  >
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            )}

            {/* Close Button */}
            {showCloseButton && (
              <DialogPrimitive.Close
                className="absolute right-5 top-5 rounded-xl p-2 text-[#bbcac6] hover:bg-white/5 hover:text-[#4fdbc8] transition-colors focus:outline-none focus:ring-1 focus:ring-[#4fdbc8]/30"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </DialogPrimitive.Close>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 max-h-[80vh]">
              {children}
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
