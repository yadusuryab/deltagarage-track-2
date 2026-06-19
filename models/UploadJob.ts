import mongoose, { Schema, Document } from 'mongoose';

export interface IUploadJob extends Document {
  sessionId: string;       // groups all images from one upload batch
  fileId: string;          // client-generated per-file ID
  filename: string;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  cloudinaryPublicId?: string;
  cloudinaryUrl?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UploadJobSchema = new Schema<IUploadJob>(
  {
    sessionId:         { type: String, required: true, index: true },
    fileId:            { type: String, required: true },
    filename:          { type: String, required: true },
    status:            { type: String, enum: ['pending', 'uploading', 'done', 'failed'], default: 'pending' },
    cloudinaryPublicId:{ type: String },
    cloudinaryUrl:     { type: String },
    error:             { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.UploadJob ||
  mongoose.model<IUploadJob>('UploadJob', UploadJobSchema);