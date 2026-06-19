// GET /api/upload/status?sessionId=xxx

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import UploadJob from '@/models/UploadJob';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  await connectToDatabase();

  const jobs = await UploadJob.find({ sessionId }).lean() as Array<{ fileId: string; filename: string; status: string; error?: string }>;

  const summary = {
    total:     jobs.length,
    pending:   jobs.filter((j) => j.status === 'pending').length,
    uploading: jobs.filter((j) => j.status === 'uploading').length,
    done:      jobs.filter((j) => j.status === 'done').length,
    failed:    jobs.filter((j) => j.status === 'failed').length,
    jobs:      jobs.map((j) => ({ fileId: j.fileId, filename: j.filename, status: j.status, error: j.error })),
  };

  return NextResponse.json(summary);
}