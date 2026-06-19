'use client';

import { useEffect, useCallback, useRef } from 'react';

const DB_NAME = 'optikx-uploads';
const DB_VERSION = 1;
const STORE_NAME = 'pending-uploads';

export interface PendingUpload {
  id: string;
  blob: Blob;
  filename: string;
  title?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
  addedAt: number;
}

export type UploadProgressCallback = (id: string, status: PendingUpload['status']) => void;
export type UploadCompleteCallback = (successCount: number, failCount: number) => void;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function addToDB(item: PendingUpload): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromDB(): Promise<PendingUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFromDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.error('SW registration failed:', e);
    return null;
  }
}

export function useBackgroundUpload(
  onProgress?: UploadProgressCallback,
  onComplete?: UploadCompleteCallback
) {
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;

  // Listen for SW messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent) => {
      const { type, id, status, successCount, failCount } = event.data || {};
      if (type === 'UPLOAD_PROGRESS' && id && status) {
        onProgressRef.current?.(id, status);
      }
      if (type === 'UPLOAD_COMPLETE') {
        onCompleteRef.current?.(successCount, failCount);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  /**
   * Queue files for background upload.
   * Returns immediately — actual upload happens in SW even if tab closes.
   */
  const queueUploads = useCallback(async (
    files: Array<{ id: string; file: File; title?: string }>
  ): Promise<void> => {
    // Request permissions upfront
    await requestNotificationPermission();
    const reg = await registerServiceWorker();

    // Store files in IndexedDB as blobs
    for (const { id, file, title } of files) {
      await addToDB({
        id,
        blob: file,
        filename: file.name,
        title,
        status: 'pending',
        addedAt: Date.now(),
      });
    }

    // Trigger background sync if supported
    if (reg && 'sync' in reg) {
      try {
        await (reg as any).sync.register('upload-images');
        return; // SW will handle it
      } catch {
        // Fall through to foreground upload
      }
    }

    // Fallback: foreground upload (SW not available or sync not supported)
    await foregroundUpload(files.map(f => f.id));
  }, []);

  /**
   * Fallback for browsers without Background Sync.
   * Uploads in-page but at least survives page navigation within the app.
   */
  async function foregroundUpload(ids: string[]) {
    const pending = await getAllFromDB();
    const toUpload = pending.filter(p => ids.includes(p.id));

    let successCount = 0;
    let failCount = 0;

    for (const item of toUpload) {
      try {
        onProgressRef.current?.(item.id, 'uploading');
        const formData = new FormData();
        formData.append('image', item.blob, item.filename);
        formData.append('title', item.title || item.filename.replace(/\.[^/.]+$/, ''));
        formData.append('description', `Uploaded document: ${item.filename}`);
        formData.append('tags', 'auto-upload,bulk-upload');

        const res = await fetch('/api/admin/images/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.success) {
          await deleteFromDB(item.id);
          successCount++;
          onProgressRef.current?.(item.id, 'uploaded');
        } else {
          failCount++;
          onProgressRef.current?.(item.id, 'failed');
        }
      } catch {
        failCount++;
        onProgressRef.current?.(item.id, 'failed');
      }
    }

    onCompleteRef.current?.(successCount, failCount);

    // Manual notification for fallback
    if (Notification.permission === 'granted') {
      new Notification(failCount === 0 ? '✅ Upload Complete' : '⚠️ Upload Partial', {
        body: failCount === 0
          ? `${successCount} image${successCount !== 1 ? 's' : ''} uploaded successfully`
          : `${successCount} uploaded, ${failCount} failed`,
        icon: '/favicon.ico',
      });
    }
  }

  const clearCompleted = useCallback(async () => {
    const all = await getAllFromDB();
    for (const item of all) {
      if (item.status === 'uploaded') await deleteFromDB(item.id);
    }
  }, []);

  const getPending = useCallback(() => getAllFromDB(), []);

  return { queueUploads, clearCompleted, getPending };
}