// PATCH /api/upload/job
// Body: { sessionId, fileId, status, cloudinaryPublicId?, cloudinaryUrl?, error? }

import { NextRequest, NextResponse } from 'next/server';
import UploadJob from '@/models/UploadJob';
import { connectToDatabase } from '@/lib/mongodb';

export async function PATCH(req: NextRequest) {
  const { sessionId, fileId, status, cloudinaryPublicId, cloudinaryUrl, error } = await req.json();

  await connectToDatabase();

  await UploadJob.findOneAndUpdate(
    { sessionId, fileId },
    { status, cloudinaryPublicId, cloudinaryUrl, error }
  );

  // If done, trigger your existing OCR / image-save logic here
  if (status === 'done' && cloudinaryPublicId) {
    // e.g. await processImage({ cloudinaryPublicId, cloudinaryUrl });
  }

  return NextResponse.json({ ok: true });
}