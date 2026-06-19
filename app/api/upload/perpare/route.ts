// POST /api/upload/prepare
// Body: { sessionId: string, files: { fileId: string, filename: string }[] }
// Returns: { jobs: { fileId, signature, timestamp, apiKey, cloudName, folder }[] }

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import UploadJob from '@/models/UploadJob';
import { connectToDatabase } from '@/lib/mongodb';

function signCloudinary(params: Record<string, string | number>, apiSecret: string): string {
  const str = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(str + apiSecret).digest('hex');
}

export async function POST(req: NextRequest) {
  const { sessionId, files } = await req.json();

  if (!sessionId || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await connectToDatabase();

  const apiKey    = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const folder    = 'packages';

  const jobs = await Promise.all(
    files.map(async ({ fileId, filename }: { fileId: string; filename: string }) => {
      // Upsert job record
      await UploadJob.findOneAndUpdate(
        { sessionId, fileId },
        { sessionId, fileId, filename, status: 'pending' },
        { upsert: true, new: true }
      );

      // Sign for direct Cloudinary upload
      const timestamp = Math.round(Date.now() / 1000);
      const publicId  = `${folder}/${sessionId}-${fileId}`;
      const toSign    = { folder, public_id: publicId, timestamp };
      const signature = signCloudinary(toSign, apiSecret);

      return { fileId, signature, timestamp, apiKey, cloudName, folder, publicId };
    })
  );

  return NextResponse.json({ jobs });
}