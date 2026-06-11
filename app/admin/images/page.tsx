/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/images/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Image } from '../../../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Upload, Trash2, User, Phone,
  MapPin, X, ChevronLeft, ChevronRight,
  Package, ExternalLink
} from 'lucide-react';

export default function ImagesPage() {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { fetchImages(); }, []);

  const fetchImages = async () => {
    try {
      const res = await fetch('/api/admin/images');
      const data = await res.json();
      if (data.success) setImages(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(id);
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/admin/images?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setImages(prev => prev.filter(img => img._id !== id));
        if (selectedImage?._id === id) setSelectedImage(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteLoading(null);
    }
  };

  const filtered = images.filter(img =>
    !searchTerm ||
    img.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (img as any).extractedData?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (img as any).extractedData?.phoneNumber?.includes(searchTerm) ||
    (img as any).extractedData?.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (img as any).extractedData?.pinCode?.includes(searchTerm)
  );

  const selectedIdx = selectedImage ? filtered.findIndex(i => i._id === selectedImage._id) : -1;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  if (loading) {
    return (
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">

      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight">Packages</h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {images.length}
            </p>
          </div>
          <Button asChild size="sm" className="rounded-full gap-1.5">
            <a href="/admin/upload">
              <Upload className="w-3.5 h-3.5" /> Upload
            </a>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            inputMode="search"
            placeholder="Name, phone, PIN, address…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-muted text-sm font-medium placeholder:text-muted-foreground focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 p-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Package className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">
              {searchTerm ? 'No packages match' : 'No packages yet'}
            </p>
            {!searchTerm && (
              <Button asChild size="sm" className="rounded-full gap-1.5">
                <a href="/admin/upload"><Upload className="w-3.5 h-3.5" /> Upload</a>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((image: any) => (
              <div
                key={image._id}
                onClick={() => setSelectedImage(image)}
                className="relative group rounded-2xl overflow-hidden bg-muted cursor-pointer aspect-[3/4] shadow-sm active:scale-95 transition-transform"
              >
                <img
                  src={image.url}
                  alt={image.title}
                  className="w-full h-full object-cover"
                />
                {/* Name overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8">
                  <p className="text-white text-xs font-semibold truncate leading-tight">
                    {image.extractedData?.name || image.title}
                  </p>
                  {image.extractedData?.phoneNumber && (
                    <p className="text-white/70 text-xs truncate">{image.extractedData.phoneNumber}</p>
                  )}
                </div>

                {/* Delete button — visible on press */}
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelete(image._id); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>

                {deleteLoading === image._id && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail sheet */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm" onClick={closeIfBackdrop}>

          {/* Top controls */}
          <div className="flex items-center justify-between p-4 pt-safe">
            <button
              onClick={() => setSelectedImage(null)}
              className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            <div className="flex items-center gap-2">
              {/* Prev/next */}
              <button
                disabled={selectedIdx <= 0}
                onClick={() => setSelectedImage(filtered[selectedIdx - 1])}
                className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <span className="text-white text-xs font-medium">{selectedIdx + 1}/{filtered.length}</span>
              <button
                disabled={selectedIdx >= filtered.length - 1}
                onClick={() => setSelectedImage(filtered[selectedIdx + 1])}
                className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>

            <a
              href={selectedImage.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
            >
              <ExternalLink className="w-4 h-4 text-white" />
            </a>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center px-4 min-h-0">
            <img
              src={selectedImage.url}
              alt={selectedImage.title}
              className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
            />
          </div>

          {/* Bottom info sheet */}
          <div className="bg-background rounded-t-3xl px-4 pt-4 pb-6 pb-safe space-y-3 mt-3 max-h-[45vh] overflow-y-auto">

            {/* Handle */}
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-2" />

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-bold text-base truncate">
                  {selectedImage.extractedData?.name || selectedImage.title}
                </h2>
                <p className="text-xs text-muted-foreground">{formatDate(selectedImage.createdAt)}</p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0 capitalize">
                {selectedImage.documentType?.replace('_', ' ') || 'general'}
              </Badge>
            </div>

            {/* Extracted fields */}
            <div className="space-y-2">
              {selectedImage.extractedData?.phoneNumber && (
                <div className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2.5">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-semibold">{selectedImage.extractedData.phoneNumber}</p>
                  </div>
                  <a href={`tel:${selectedImage.extractedData.phoneNumber.split(',')[0].trim()}`} className="ml-auto text-primary text-xs font-medium">Call</a>
                </div>
              )}
              {selectedImage.extractedData?.name && (
                <div className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2.5">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Recipient</p>
                    <p className="text-sm font-semibold truncate">{selectedImage.extractedData.name}</p>
                  </div>
                </div>
              )}
              {selectedImage.extractedData?.address && (
                <div className="flex items-start gap-3 bg-muted rounded-xl px-3 py-2.5">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm font-medium leading-snug">{selectedImage.extractedData.address}</p>
                  </div>
                </div>
              )}
              {selectedImage.extractedData?.pinCode && (
                <div className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2.5">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">PIN Code</p>
                    <p className="text-sm font-semibold">{selectedImage.extractedData.pinCode}</p>
                  </div>
                </div>
              )}
              {selectedImage.extractedData?.orderId && (
                <div className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2.5">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Order ID</p>
                    <p className="text-sm font-semibold font-mono">{selectedImage.extractedData.orderId}</p>
                  </div>
                </div>
              )}
              {selectedImage.extractedData?.product && (
                <div className="flex items-center gap-3 bg-muted rounded-xl px-3 py-2.5">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Product</p>
                    <p className="text-sm font-medium truncate">{selectedImage.extractedData.product}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Delete */}
            <button
              onClick={() => setConfirmDelete(selectedImage._id)}
              disabled={!!deleteLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-semibold text-sm active:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Package
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm sheet */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={() => setConfirmDelete(null)}>
          <div className="w-full bg-background rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
            <h3 className="text-base font-bold text-center">Delete this package?</h3>
            <p className="text-sm text-muted-foreground text-center">This cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl h-12 gap-2"
                onClick={() => handleDelete(confirmDelete)}
                disabled={!!deleteLoading}
              >
                {deleteLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function closeIfBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setSelectedImage(null);
  }
}
