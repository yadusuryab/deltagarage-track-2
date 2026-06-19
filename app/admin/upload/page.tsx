'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Upload, X, ChevronLeft, ChevronRight,
  Check, AlertCircle, Image as ImageIcon,
  Camera, FolderOpen, Trash2, CheckCircle2,
  Loader2, RefreshCw
} from 'lucide-react';
import { useBackgroundUpload } from '@/hooks/useBackgroundUpload';

interface UploadItem {
  id: string;
  file: File | null;
  previewUrl: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
  progress?: number;
}

export default function UploadPage() {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [done, setDone] = useState(false);
  const [showUploadStats, setShowUploadStats] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ── Background upload integration ──────────────────────────────────────────
  const { queueUploads, clearCompleted } = useBackgroundUpload(
    // onProgress: called from SW message or foreground fallback
    (id, status) => {
      setUploadItems(prev => prev.map(p =>
        p.id === id ? {
          ...p,
          uploading: status === 'uploading',
          uploaded: status === 'uploaded',
          error: status === 'failed' ? 'Upload failed' : undefined,
          progress: status === 'uploaded' ? 100 : status === 'uploading' ? 50 : 0,
        } : p
      ));
      if (status === 'uploaded') setSuccessCount(c => c + 1);
    },
    // onComplete: called when all done
    (successCount, failCount) => {
      setLoading(false);
      if (failCount === 0) {
        setDone(true);
        clearCompleted();
        setTimeout(() => router.push('/admin/images'), 1500);
      }
    }
  );
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      uploadItems.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        setGlobalError(`Skipped "${file.name}" - not an image file`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setGlobalError(`Skipped "${file.name}" - file too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newItems: UploadItem[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
      progress: 0,
    }));

    setUploadItems(prev => [...prev, ...newItems]);
    setGlobalError('');
    setDone(false);
    setSuccessCount(0);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  }, [addFiles]);

  const removeItem = useCallback((id: string) => {
    setUploadItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      const next = prev.filter(i => i.id !== id);
      if (currentIndex >= next.length) setCurrentIndex(Math.max(0, next.length - 1));
      return next;
    });
  }, [currentIndex]);

  const clearAll = useCallback(() => {
    uploadItems.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setUploadItems([]);
    setCurrentIndex(0);
    setGlobalError('');
    setSuccessCount(0);
    setDone(false);
    setLoading(false);
    setShowUploadStats(false);
  }, [uploadItems]);

  // ── Main upload trigger ───────────────────────────────────────────────────
  const handleBulkUpload = useCallback(async () => {
    const pending = uploadItems.filter(i => !i.uploaded && !i.error && i.file);
    if (pending.length === 0) {
      if (uploadItems.every(i => i.uploaded)) {
        setDone(true);
        setTimeout(() => router.push('/admin/images'), 1500);
      }
      return;
    }

    setLoading(true);
    setGlobalError('');
    setShowUploadStats(true);

    // Mark all as "uploading" optimistically in UI
    setUploadItems(prev => prev.map(p =>
      !p.uploaded && !p.error ? { ...p, uploading: true, progress: 10 } : p
    ));

    await queueUploads(
      pending.map(i => ({ id: i.id, file: i.file!, title: i.file!.name.replace(/\.[^/.]+$/, '') }))
    );
    // onProgress/onComplete callbacks update state as uploads finish
  }, [uploadItems, queueUploads, router]);

  const retryFailed = useCallback(async () => {
    const failed = uploadItems.filter(i => i.error && i.file);
    if (failed.length === 0) return;

    setUploadItems(prev => prev.map(p =>
      p.error ? { ...p, error: undefined, uploading: true, progress: 10 } : p
    ));
    setLoading(true);
    setGlobalError('');

    await queueUploads(
      failed.map(i => ({ id: i.id, file: i.file!, title: i.file!.name.replace(/\.[^/.]+$/, '') }))
    );
  }, [uploadItems, queueUploads]);
  // ──────────────────────────────────────────────────────────────────────────

  const currentItem = uploadItems[currentIndex];
  const failedCount = uploadItems.filter(i => i.error).length;
  const totalUploaded = uploadItems.filter(i => i.uploaded).length;
  const totalProgress = uploadItems.length > 0 ? (totalUploaded / uploadItems.length) * 100 : 0;

  const uploadStats = {
    total: uploadItems.length,
    uploaded: totalUploaded,
    failed: failedCount,
    pending: uploadItems.length - totalUploaded - failedCount,
    progress: totalProgress,
  };

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

  if (uploadItems.length === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex flex-col p-4 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Upload Packages</h1>
          <p className="text-sm text-muted-foreground">Select delivery label images to process</p>
        </div>

        <label
          htmlFor="gallery-input"
          className="flex-1 min-h-[200px] flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 active:bg-primary/10 transition-colors cursor-pointer"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <FolderOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Choose from Gallery</p>
            <p className="text-sm text-muted-foreground mt-0.5">Select multiple images</p>
          </div>
        </label>

        <label
          htmlFor="camera-input"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 px-4 active:bg-muted transition-colors text-muted-foreground cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span className="text-xs font-medium">Take a photo instead</span>
        </label>

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
        <Button onClick={() => router.push('/admin/images')}>View Images</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {showUploadStats && uploadStats.total > 0 && (
        <div className="bg-background border-b border-border p-3 space-y-2 flex-shrink-0">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">
              {uploadStats.uploaded} of {uploadStats.total} uploaded
            </span>
            <span className="text-muted-foreground text-xs">
              {uploadStats.failed > 0 && `⚠️ ${uploadStats.failed} failed`}
              {uploadStats.pending > 0 && ` • ${uploadStats.pending} pending`}
            </span>
          </div>
          <Progress value={uploadStats.progress} className="h-2" />
        </div>
      )}

      <div className="relative flex-1 bg-black min-h-[0px] max-h-[55vh]">
        {currentItem?.previewUrl ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img src={currentItem.previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-600" />
          </div>
        )}

        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white text-sm font-semibold">
            {currentIndex + 1} / {uploadItems.length}
          </span>
          <label
            htmlFor="gallery-input"
            className="bg-white/20 backdrop-blur-sm text-white rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:bg-white/30 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Add
          </label>
        </div>

        {uploadItems.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
              disabled={currentIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 disabled:opacity-20 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => setCurrentIndex(p => Math.min(uploadItems.length - 1, p + 1))}
              disabled={currentIndex === uploadItems.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 hover:bg-black/70 disabled:opacity-20 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </>
        )}

        {currentItem?.uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="bg-white dark:bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div>
                <span className="text-sm font-medium">Uploading…</span>
                {currentItem.progress !== undefined && (
                  <Progress value={currentItem.progress} className="w-32 h-1.5 mt-1" />
                )}
              </div>
            </div>
          </div>
        )}

        {currentItem?.uploaded && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1 animate-in fade-in slide-in-from-top-2">
            <Check className="w-3 h-3" /> Uploaded
          </div>
        )}

        {currentItem?.error && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-3 h-3" /> Failed
          </div>
        )}

        <button
          onClick={() => removeItem(currentItem.id)}
          className="absolute bottom-3 right-3 w-9 h-9 bg-red-500/80 hover:bg-red-600 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors shadow-lg"
        >
          <Trash2 className="w-4 h-4 text-white" />
        </button>
      </div>

      {uploadItems.length > 1 && (
        <div className="flex gap-2 px-3 py-2 overflow-x-auto bg-black/90 flex-shrink-0">
          {uploadItems.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(i)}
              className={`relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentIndex ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
              {item.uploaded && (
                <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              {item.error && (
                <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                  <AlertCircle className="w-3 h-3 text-white" />
                </div>
              )}
              {item.uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
              )}
              {item.uploading && item.progress !== undefined && item.progress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${item.progress}%` }} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="bg-background border-t border-border p-4 flex-shrink-0">
        {globalError && (
          <Alert variant="destructive" className="py-2 mb-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{globalError}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium">{uploadItems.length} image{uploadItems.length !== 1 ? 's' : ''}</span>
            {totalUploaded > 0 && (
              <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />{totalUploaded} done
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-red-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />{failedCount} failed
              </span>
            )}
          </div>
          <button
            onClick={clearAll}
            className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        </div>

        {failedCount > 0 && !loading && !uploadItems.every(i => i.uploaded) ? (
          <div className="flex gap-3">
            <Button
              onClick={retryFailed}
              variant="outline"
              className="flex-1 h-12 gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4" /> Retry ({failedCount})
            </Button>
            <Button
              onClick={handleBulkUpload}
              className="flex-1 h-12 gap-2 bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              <Upload className="w-4 h-4" /> Upload All ({uploadItems.length})
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleBulkUpload}
            disabled={loading || uploadItems.every(i => i.uploaded)}
            size="lg"
            className="w-full h-14 rounded-2xl text-base font-semibold gap-2 shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Uploading {totalUploaded} of {uploadItems.length}...
              </>
            ) : uploadItems.every(i => i.uploaded) ? (
              <><CheckCircle2 className="w-5 h-5" /> All Uploaded!</>
            ) : (
              <><Upload className="w-5 h-5" /> Upload {uploadItems.length} Image{uploadItems.length !== 1 ? 's' : ''}</>
            )}
          </Button>
        )}

        {loading && (
          <p className="text-center text-xs text-muted-foreground animate-pulse mt-2">
            Uploading in background — you can close this tab
          </p>
        )}
      </div>

      {hiddenInputs}
    </div>
  );
}