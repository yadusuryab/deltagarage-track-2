// models/Image.ts
import mongoose from 'mongoose';

const ExtractedDataSchema = new mongoose.Schema({
  name: {
    type: String,
    default: '',
  },
  phoneNumber: {
    type: String,
    default: '',
  },
  address: {
    type: String,
    default: '',
  },
  otherText: {
    type: String,
    default: '',
  },
  rawText: {
    type: String,
    default: '',
  },
});

const ImageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  extractedData: {
    type: ExtractedDataSchema,
    required: true,
    default: () => ({}),
  },
  documentType: {
    type: String,
    default: 'general',
  },
  tags: [{
    type: String,
  }],
  uploadedBy: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Add expiresAt field for TTL index
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from creation
  },
});

// Create TTL index on expiresAt field (auto-delete after expiration)
ImageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Text search indexes
ImageSchema.index({ 
  title: 'text', 
  description: 'text', 
  'extractedData.rawText': 'text',
  'extractedData.name': 'text',
  'extractedData.phoneNumber': 'text',
  'extractedData.address': 'text',
  tags: 'text' 
});

// Pre-save middleware to ensure expiresAt is set
ImageSchema.pre('save', function(next) {
  if (this.isNew) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
  }
  next();
});

export default mongoose.models.Image || mongoose.model('Image', ImageSchema);