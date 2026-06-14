'use client';

import React, { useRef, useState, useEffect, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface DocumentScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  familyId: string;
}

export function DocumentScanner({ isOpen, onClose, onSuccess, userId, familyId }: DocumentScannerProps) {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [brightness, setBrightness] = useState<number>(100); // percentage (50 to 150)
  const [contrast, setContrast] = useState<number>(100); // percentage (50 to 150)
  
  // Document metadata state
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('other');
  const [docDescription, setDocDescription] = useState('');
  const [docExpiryDate, setDocExpiryDate] = useState('');
  const [docTags, setDocTags] = useState('');
  const [docIsSensitive, setDocIsSensitive] = useState(false);
  const [docMemberId, setDocMemberId] = useState('');
  
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  // Fetch family members for the dropdown
  useEffect(() => {
    async function getMembers() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('family_id', familyId);
        if (error) throw error;
        setFamilyMembers(data || []);
        if (data && data.length > 0) {
          setDocMemberId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch family members:', err);
      } finally {
        setLoadingMembers(false);
      }
    }
    if (familyId) {
      getMembers();
    }
  }, [familyId]);

  // Apply filters to canvas when image, brightness, or contrast changes
  useEffect(() => {
    if (!capturedImage) return;

    const img = new Image();
    img.src = capturedImage;
    img.onload = () => {
      originalImageRef.current = img;
      applyCanvasFilters();
    };
  }, [capturedImage, brightness, contrast]);

  const applyCanvasFilters = () => {
    const img = originalImageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale canvas to fit image while keeping maximum 1600px width/height for performance/storage
    const maxDim = 1600;
    let width = img.width;
    let height = img.height;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    canvas.width = width;
    canvas.height = height;

    // Clear and draw original
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // Get pixel data
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const bFactor = brightness / 100;
    const cFactor = contrast / 100;

    // Apply color contrast enhancement (preserving color tones)
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Apply brightness adjustment
      r = r * bFactor;
      g = g * bFactor;
      b = b * bFactor;

      // Apply contrast adjustment (around mid-gray 128)
      r = ((r - 128) * cFactor) + 128;
      g = ((g - 128) * cFactor) + 128;
      b = ((b - 128) * cFactor) + 128;

      // Clamp values
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imgData, 0, 0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target?.result as string);
        // Autofill default document name
        const baseName = file.name.split('.').slice(0, -1).join('.');
        setDocName(baseName || 'Scanned Document');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCaptureClick = () => {
    fileInputRef.current?.click();
  };

  const handleSave = () => {
    if (!docName) {
      toast.error('Please enter a document name');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error('No scanned image to save. Please scan first.');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        
        // Convert canvas to blob
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
        });

        if (!blob) throw new Error('Failed to process image canvas.');

        let fileUrl = 'https://placehold.co/600x400/161d1b/4fdbc8?text=' + encodeURIComponent(docName);
        const fileName = `${familyId}/scan_${Date.now()}.jpg`;

        // Upload to supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
          });

        if (uploadError) {
          console.warn('Storage upload error (falling back to placeholder):', uploadError.message);
          toast.warning("Note: 'documents' storage bucket not accessible. Metadata saved with fallback link.");
        } else if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(fileName);
          fileUrl = urlData.publicUrl;
        }

        const tagsArray = docTags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0);

        // Save metadata
        const { error: dbError } = await supabase.from('documents').insert({
          family_id: familyId,
          member_id: docMemberId || null,
          category: docCategory,
          name: docName,
          description: docDescription || null,
          file_url: fileUrl,
          file_size: blob.size,
          mime_type: 'image/jpeg',
          tags: tagsArray,
          expiry_date: docExpiryDate || null,
          is_sensitive: docIsSensitive,
          created_by: userId,
        });

        if (dbError) throw dbError;

        toast.success('Color document scanned and vaulted successfully!');
        resetForm();
        onSuccess();
        onClose();
      } catch (err: any) {
        toast.error(err.message || 'Failed to save scanned document');
        console.error(err);
      }
    });
  };

  const resetForm = () => {
    setCapturedImage(null);
    setBrightness(100);
    setContrast(100);
    setDocName('');
    setDocCategory('other');
    setDocDescription('');
    setDocExpiryDate('');
    setDocTags('');
    setDocIsSensitive(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl glass-modal rounded-2xl border border-white/10 max-h-[90vh] flex flex-col overflow-hidden text-[#dde4e1]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4fdbc8] text-[24px]">photo_camera</span>
            <h2 className="text-headline-sm font-semibold">Premium Color Scanner</h2>
          </div>
          <button 
            onClick={() => { resetForm(); onClose(); }}
            className="text-white/40 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Left Side: Camera Trigger and Filter Adjustments */}
          <div className="flex flex-col gap-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
            />

            {!capturedImage ? (
              <div 
                onClick={handleCaptureClick}
                className="flex-1 min-h-[300px] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer bg-white/[0.02] hover:bg-white/[0.04] transition-all"
              >
                <div className="w-16 h-16 rounded-full bg-[#4fdbc8]/10 flex items-center justify-center text-[#4fdbc8]">
                  <span className="material-symbols-outlined text-[32px]">camera_enhance</span>
                </div>
                <div className="text-center">
                  <p className="font-semibold text-white">Scan Document</p>
                  <p className="text-body-sm text-[#bbcac6] mt-1">Click to trigger device camera or upload photo</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="relative border border-white/10 rounded-xl overflow-hidden bg-black/40 aspect-[4/3] flex items-center justify-center">
                  <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
                </div>
                
                {/* Adjustments */}
                <div className="glass-card p-4 rounded-xl space-y-4">
                  <h3 className="text-label-md font-semibold text-[#4fdbc8]">Color Enhancement Sliders</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-body-sm text-[#bbcac6]">
                      <span>Brightness</span>
                      <span>{brightness}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="150" 
                      value={brightness} 
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-[#4fdbc8] bg-white/10 rounded-lg appearance-none h-1.5" 
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-body-sm text-[#bbcac6]">
                      <span>Contrast Booster</span>
                      <span>{contrast}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="150" 
                      value={contrast} 
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-[#4fdbc8] bg-white/10 rounded-lg appearance-none h-1.5" 
                    />
                  </div>
                </div>

                <button 
                  onClick={handleCaptureClick}
                  className="w-full border border-white/10 hover:border-white/20 hover:bg-white/[0.02] text-body-sm font-medium py-2 rounded-lg transition-all"
                >
                  Retake Photo
                </button>
              </div>
            )}
          </div>

          {/* Right Side: Metadata Form */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-label-md font-semibold text-[#4fdbc8]">Document Metadata</h3>
              
              <div className="space-y-1">
                <label className="text-body-sm text-[#bbcac6]">Document Name *</label>
                <input 
                  type="text" 
                  value={docName} 
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Aadhaar Card - Saran" 
                  className="w-full input-glass px-3 py-2 rounded-lg text-body-sm text-white" 
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-body-sm text-[#bbcac6]">Category</label>
                  <select 
                    value={docCategory} 
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="w-full input-glass px-3 py-2 rounded-lg text-body-sm bg-[#161d1b] text-white"
                  >
                    <option value="aadhaar">Aadhaar Card</option>
                    <option value="pan">PAN Card</option>
                    <option value="passport">Passport</option>
                    <option value="driving_license">Driving License</option>
                    <option value="insurance">Insurance Policy</option>
                    <option value="property">Property Document</option>
                    <option value="certificate">Educational Certificate</option>
                    <option value="tax">Tax Record</option>
                    <option value="medical">Medical Document</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-body-sm text-[#bbcac6]">For Member</label>
                  <select 
                    value={docMemberId} 
                    onChange={(e) => setDocMemberId(e.target.value)}
                    className="w-full input-glass px-3 py-2 rounded-lg text-body-sm bg-[#161d1b] text-white"
                    disabled={loadingMembers}
                  >
                    {familyMembers.map((m) => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-body-sm text-[#bbcac6]">Expiry Date (Optional)</label>
                <input 
                  type="date" 
                  value={docExpiryDate} 
                  onChange={(e) => setDocExpiryDate(e.target.value)}
                  className="w-full input-glass px-3 py-2 rounded-lg text-body-sm text-white" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-sm text-[#bbcac6]">Tags (Comma separated)</label>
                <input 
                  type="text" 
                  value={docTags} 
                  onChange={(e) => setDocTags(e.target.value)}
                  placeholder="e.g. personal, identity, national" 
                  className="w-full input-glass px-3 py-2 rounded-lg text-body-sm text-white" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-body-sm text-[#bbcac6]">Description (Optional)</label>
                <textarea 
                  value={docDescription} 
                  onChange={(e) => setDocDescription(e.target.value)}
                  placeholder="Additional details about the document..." 
                  rows={3}
                  className="w-full input-glass px-3 py-2 rounded-lg text-body-sm text-white resize-none" 
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="scanner-sensitive" 
                  checked={docIsSensitive}
                  onChange={(e) => setDocIsSensitive(e.target.checked)}
                  className="rounded border-white/15 bg-white/5 accent-[#4fdbc8] h-4 w-4" 
                />
                <label htmlFor="scanner-sensitive" className="text-body-sm text-[#bbcac6] select-none cursor-pointer">
                  Mark as Sensitive (Requires PIN verification to view)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button 
                onClick={() => { resetForm(); onClose(); }}
                className="flex-1 py-2.5 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/[0.02] text-body-sm font-semibold transition-all"
                disabled={isPending}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl teal-gradient text-black font-semibold text-body-sm hover:brightness-110 shadow-lg transition-all flex items-center justify-center gap-2"
                disabled={isPending || !capturedImage}
              >
                {isPending ? 'Saving Scan...' : 'Vault Document'}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
