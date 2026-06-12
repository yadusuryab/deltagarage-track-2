'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Upload, X, ChevronLeft, ChevronRight,
  Check, AlertCircle, Image as ImageIcon,
  Camera, FolderOpen, Trash2, CheckCircle2
} from 'lucide-react';

interface UploadItem {
  id: string;
  file: File | null;
  previewUrl: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
}

export default function UploadPage() {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const addFiles = (files: File[]) => {
    const newItems: UploadItem[] = files.map(file => ({
      id: Date.now().toString() + Math.random(),
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
    }));
    setUploadItems(prev => [...prev, ...newItems]);
    setGlobalError('');
    setDone(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  const removeItem = (id: string) => {
    setUploadItems(prev => {
      const next = prev.filter(i => i.id !== id);
      if (currentIndex >= next.length) setCurrentIndex(Math.max(0, next.length - 1));
      return next;
    });
  };

  const clearAll = () => {
    setUploadItems([]);
    setCurrentIndex(0);
    setGlobalError('');
    setSuccessCount(0);
    setDone(false);
  };

  const uploadSingleItem = async (item: UploadItem): Promise<boolean> => {
    try {
      const uploadData = new FormData();
      uploadData.append('image', item.file!);
      const autoTitle = item.file!.name.replace(/\.[^/.]+$/, '');
      uploadData.append('title', autoTitle);
      uploadData.append('description', `Uploaded document: ${autoTitle}`);
      uploadData.append('tags', 'auto-upload,bulk-upload');

      const response = await fetch('/api/admin/images/upload', { method: 'POST', body: uploadData });
      const data = await response.json();
      return data.success;
    } catch {
      return false;
    }
  };

  const handleBulkUpload = async () => {
    if (uploadItems.length === 0) { setGlobalError('Select at least one image.'); return; }
    setLoading(true);
    setGlobalError('');
    setSuccessCount(0);

    let successes = 0;
    for (const item of uploadItems) {
      setUploadItems(prev => prev.map(p => p.id === item.id ? { ...p, uploading: true } : p));
      const success = await uploadSingleItem(item);
      if (success) successes++;
      setSuccessCount(successes);
      setUploadItems(prev => prev.map(p =>
        p.id === item.id ? { ...p, uploading: false, uploaded: success, error: success ? undefined : 'Failed' } : p
      ));
    }

    setLoading(false);
    if (successes === uploadItems.length) {
      setDone(true);
      setTimeout(() => router.push('/admin/images'), 1500);
    } else if (successes > 0) {
      setGlobalError(`${successes} of ${uploadItems.length} uploaded. ${uploadItems.length - successes} failed — retry below.`);
    } else {
      setGlobalError('All uploads failed. Check your connection and try again.');
    }
  };

  const retryFailed = async () => {
    const failed = uploadItems.filter(i => i.error);
    if (failed.length === 0) return;
    setLoading(true);
    setGlobalError('');
    let extra = 0;
    for (const item of failed) {
      setUploadItems(prev => prev.map(p => p.id === item.id ? { ...p, uploading: true, error: undefined } : p));
      const success = await uploadSingleItem(item);
      if (success) extra++;
      setSuccessCount(prev => prev + (success ? 1 : 0));
      setUploadItems(prev => prev.map(p =>
        p.id === item.id ? { ...p, uploading: false, uploaded: success, error: success ? undefined : 'Failed again' } : p
      ));
    }
    setLoading(false);
    if (extra === failed.length) { setDone(true); setTimeout(() => router.push('/admin/images'), 1500); }
  };

  const currentItem = uploadItems[currentIndex];
  const failedCount = uploadItems.filter(i => i.error).length;
  const progress = uploadItems.length > 0 ? (successCount / uploadItems.length) * 100 : 0;

  // Hidden inputs — defined once, used via <label htmlFor> everywhere (mobile-safe)
  const hiddenInputs = (
    <>
      <input
        id="gallery-input"
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        id="camera-input"
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );

  // Empty state
  if (uploadItems.length === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex flex-col p-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Upload Packages</h1>
          <p className="text-sm text-muted-foreground">Select delivery label images to process</p>
        </div>

        {/* Primary action — gallery */}
        <label
          htmlFor="gallery-input"
          className="flex-1 min-h-[200px] flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 active:bg-primary/10 transition-colors cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <FolderOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Choose from Gallery</p>
            <p className="text-sm text-muted-foreground mt-0.5">Select one or multiple images</p>
          </div>
        </label>

        {/* Camera option */}
        <label
          htmlFor="camera-input"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 px-4 active:bg-muted transition-colors text-muted-foreground cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span className="text-xs font-medium">Take a photo instead</span>
        </label>

        {/* Guidelines */}
        <div className="rounded-2xl bg-muted p-4 text-sm space-y-2 text-muted-foreground">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Tips for best results</p>
          <p>📦 Ensure the label is flat and fully visible</p>
          <p>💡 Good lighting helps text extraction</p>
          <p>🔢 Name, phone and address must be readable</p>
        </div>

        {hiddenInputs}
      </div>
    );
  }

  // Done state
  if (done) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">All uploaded!</h2>
          <p className="text-sm text-muted-foreground mt-1">{successCount} package{successCount !== 1 ? 's' : ''} processed successfully</p>
        </div>
        <p className="text-xs text-muted-foreground">Redirecting to images…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">

      {/* Image viewer */}
      <div className="relative flex-1 bg-black min-h-[55vw] max-h-[60vh]">
        {currentItem?.previewUrl ? (
          <img
            src={currentItem.previewUrl}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-600" />
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white text-sm font-semibold">
            {currentIndex + 1} / {uploadItems.length}
          </span>
          <label
            htmlFor="gallery-input"
            className="bg-white/20 backdrop-blur-sm text-white rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Add
          </label>
        </div>

        {/* Nav arrows */}
        {uploadItems.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
              disabled={currentIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 disabled:opacity-20 rounded-full flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => setCurrentIndex(p => Math.min(uploadItems.length - 1, p + 1))}
              disabled={currentIndex === uploadItems.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 disabled:opacity-20 rounded-full flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </>
        )}

        {/* Status overlays */}
        {currentItem?.uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              <span className="text-sm font-medium">Uploading…</span>
            </div>
          </div>
        )}
        {currentItem?.uploaded && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1">
            <Check className="w-3 h-3" /> Uploaded
          </div>
        )}
        {currentItem?.error && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Failed
          </div>
        )}

        {/* Delete current */}
        <button
          onClick={() => removeItem(currentItem.id)}
          className="absolute bottom-3 right-3 w-9 h-9 bg-red-500/80 backdrop-blur-sm rounded-full flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Thumbnail strip */}
      {uploadItems.length > 1 && (
        <div className="flex gap-2 px-3 py-2 overflow-x-auto bg-black/90 scrollbar-none">
          {uploadItems.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(i)}
              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentIndex ? 'border-white' : 'border-transparent opacity-60'
              }`}
            >
              <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
              {item.uploaded && (
                <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              {item.error && (
                <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
              )}
              {item.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Bottom panel */}
      <div className="bg-background border-t border-border p-4 space-y-3">

        {loading && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading…</span>
              <span>{successCount} / {uploadItems.length}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {globalError && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{globalError}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="font-medium">{uploadItems.length} image{uploadItems.length !== 1 ? 's' : ''}</span>
            {successCount > 0 && (
              <span className="text-green-600 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />{successCount} done
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-red-500 font-medium">{failedCount} failed</span>
            )}
          </div>
          <button onClick={clearAll} className="text-muted-foreground text-xs underline underline-offset-2">
            Clear all
          </button>
        </div>

        {failedCount > 0 && !loading ? (
          <div className="flex gap-2">
            <Button onClick={retryFailed} variant="outline" className="flex-1 rounded-xl h-12 gap-2">
              <AlertCircle className="w-4 h-4" /> Retry Failed
            </Button>
            <Button onClick={handleBulkUpload} className="flex-1 rounded-xl h-12 gap-2" disabled={loading}>
              <Upload className="w-4 h-4" /> Upload All
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleBulkUpload}
            disabled={loading || uploadItems.every(i => i.uploaded)}
            size="lg"
            className="w-full h-14 rounded-2xl text-base font-semibold gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Uploading {uploadItems.length} image{uploadItems.length !== 1 ? 's' : ''}…
              </>
            ) : uploadItems.every(i => i.uploaded) ? (
              <><CheckCircle2 className="w-5 h-5" /> All uploaded!</>
            ) : (
              <><Upload className="w-5 h-5" /> Upload {uploadItems.length} image{uploadItems.length !== 1 ? 's' : ''}</>
            )}
          </Button>
        )}
      </div>

      {hiddenInputs}
    </div>
  );
}