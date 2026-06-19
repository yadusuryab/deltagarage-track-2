const CACHE_NAME = 'optikx-v1';
const DB_NAME = 'optikx-uploads';
const DB_VERSION = 1;
const STORE_NAME = 'pending-uploads';

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getPendingUploads() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deletePendingUpload(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function updateUploadStatus(id, status, error = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.status = status;
        if (error) item.error = error;
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// Handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'upload-images') {
    event.waitUntil(processUploads());
  }
});

async function processUploads() {
  const pending = await getPendingUploads();
  const toUpload = pending.filter(item => item.status === 'pending' || item.status === 'failed');

  if (toUpload.length === 0) return;

  let successCount = 0;
  let failCount = 0;

  // Notify clients that upload started
  broadcastToClients({ type: 'UPLOAD_STARTED', total: toUpload.length });

  for (const item of toUpload) {
    try {
      await updateUploadStatus(item.id, 'uploading');
      broadcastToClients({ type: 'UPLOAD_PROGRESS', id: item.id, status: 'uploading' });

      // Reconstruct FormData from stored blob
      const formData = new FormData();
      formData.append('image', item.blob, item.filename);
      formData.append('title', item.title || item.filename.replace(/\.[^/.]+$/, ''));
      formData.append('description', `Uploaded document: ${item.filename}`);
      formData.append('tags', 'auto-upload,bulk-upload');

      const response = await fetch('/api/admin/images/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        await deletePendingUpload(item.id);
        successCount++;
        broadcastToClients({ type: 'UPLOAD_PROGRESS', id: item.id, status: 'uploaded' });
      } else {
        await updateUploadStatus(item.id, 'failed', 'Server error');
        failCount++;
        broadcastToClients({ type: 'UPLOAD_PROGRESS', id: item.id, status: 'failed' });
      }
    } catch (err) {
      await updateUploadStatus(item.id, 'failed', err.message);
      failCount++;
      broadcastToClients({ type: 'UPLOAD_PROGRESS', id: item.id, status: 'failed' });
    }
  }

  // Show notification
  const title = failCount === 0
    ? `✅ Upload Complete`
    : `⚠️ Upload Partial`;

  const body = failCount === 0
    ? `${successCount} image${successCount !== 1 ? 's' : ''} uploaded successfully`
    : `${successCount} uploaded, ${failCount} failed`;

  if (self.registration.showNotification) {
    await self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'upload-complete',
      data: { url: '/admin/images' },
      actions: [
        { action: 'view', title: 'View Images' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    });
  }

  broadcastToClients({ type: 'UPLOAD_COMPLETE', successCount, failCount });
}

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/admin') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow('/admin/images');
      })
    );
  }
});

function broadcastToClients(message) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => client.postMessage(message));
  });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));