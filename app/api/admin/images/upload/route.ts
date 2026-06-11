/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/admin/images/upload/route.ts
import { uploadToCloudinary } from '@/lib/cloudinary';
import { connectToDatabase } from '@/lib/mongodb';
import { detectDocumentType, extractTextFromImage } from '@/lib/vision';
import Image from '@/models/Image';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

export async function POST(request: Request) {
  let cloudinaryResult: any = null;
  
  try {
    console.log('=== IMAGE UPLOAD PROCESS STARTED ===');

    // Test database connection first
    try {
      await connectToDatabase();
      console.log('✅ Database connected successfully');
    } catch (dbError: any) {
      console.error('❌ Database connection failed:', dbError.message);
      return NextResponse.json(
        { success: false, message: 'Database connection failed' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const tags = formData.get('tags') as string;

    console.log('📁 Form data received:', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      title: title,
      description: description ? 'Provided' : 'Missing',
      tags: tags ? 'Provided' : 'Missing'
    });

    // Validate required fields
    if (!file) {
      console.error('❌ No file uploaded');
      return NextResponse.json(
        { success: false, message: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!title || title.trim().length === 0) {
      console.error('❌ Title is required');
      return NextResponse.json(
        { success: false, message: 'Title is required' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      console.error('❌ Invalid file type:', file.type);
      return NextResponse.json(
        { success: false, message: 'File must be an image' },
        { status: 400 }
      );
    }

    console.log('🔄 Processing image file...');
    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer) as Buffer;
    
    
    console.log('📊 Original image size:', originalBuffer.length, 'bytes');

    // Set max size to 1MB
    const maxSize = 1 * 1024 * 1024;
    
    // Compress image function
const compressImage = async (inputBuffer: Buffer): Promise<Buffer> => {
      try {
        const imageProcessor = sharp(inputBuffer);
        const imageInfo = await imageProcessor.metadata();
        
        console.log('🖼️ Image metadata:', {
          format: imageInfo.format,
          width: imageInfo.width,
          height: imageInfo.height,
          size: inputBuffer.length
        });

        // Progressive compression to get under 1MB
        let currentQuality = 85;
        let compressedResult = inputBuffer;
        
        while (currentQuality >= 50 && compressedResult.length > maxSize) {
          console.log(`🔄 Trying compression with quality: ${currentQuality}%`);
          
          const trialBuffer = await sharp(inputBuffer)
            .jpeg({ 
              quality: currentQuality,
              mozjpeg: true,
              chromaSubsampling: '4:4:4'
            })
            .resize(1600, 1600, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .toBuffer();
          
          console.log(`📦 Compressed to: ${trialBuffer.length} bytes with quality ${currentQuality}%`);
          
          // Check if we're under the size limit
          if (trialBuffer.length <= maxSize) {
            return trialBuffer;
          }
          
          // Reduce quality for next iteration if still too large
          currentQuality -= 10;
          compressedResult = trialBuffer;
        }
        
        console.log('✅ Final compressed size:', compressedResult.length, 'bytes');
        return compressedResult;
        
      } catch (compressionError: any) {
        console.warn('⚠️ Sharp compression failed, using original:', compressionError.message);
        return inputBuffer;
      }
    };

    // Compress the image
    let processedBuffer: Buffer = originalBuffer;
    if (originalBuffer.length > maxSize) {
      console.log('⚡ Compressing image to under 1MB...');
      processedBuffer = await compressImage(originalBuffer);
    }

    // Final size check after compression
    if (processedBuffer.length > maxSize) {
      console.error('❌ File still too large after compression:', processedBuffer.length, 'bytes');
      return NextResponse.json(
        { 
          success: false, 
          message: `File size (${Math.round(processedBuffer.length / 1024)}KB) exceeds 1MB limit after compression` 
        },
        { status: 400 }
      );
    }

    // Convert to base64 for Cloudinary
    const base64Image = processedBuffer.toString('base64');
    const mimeType = 'image/jpeg';
    const base64Data = `data:${mimeType};base64,${base64Image}`;
    
    console.log('☁️ Uploading to Cloudinary...');
    try {
      cloudinaryResult = await uploadToCloudinary(base64Data);
      console.log('✅ Cloudinary upload successful');
    } catch (cloudinaryError: any) {
      console.error('❌ Cloudinary upload failed:', cloudinaryError.message);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to upload image to cloud storage'
        },
        { status: 500 }
      );
    }

    // Extract Cloudinary fields
    const publicId = cloudinaryResult.publicId;
    const url = cloudinaryResult.url;
    const width = cloudinaryResult.width;
    const height = cloudinaryResult.height;
    const format = cloudinaryResult.format;
    const fileSize = cloudinaryResult.bytes || processedBuffer.length;

    console.log('📋 Extracted Cloudinary data:', {
      publicId: publicId ? 'Found' : 'Missing',
      url: url ? 'Found' : 'Missing',
      width,
      height,
      format,
      fileSize
    });

    // Validate required Cloudinary fields
    if (!publicId || !url) {
      console.error('❌ Missing required Cloudinary fields:', {
        publicId: !!publicId,
        url: !!url
      });
      throw new Error('Cloudinary response missing required fields');
    }

    // Vision API processing
    let extractedData: any = { rawText: '' };
    let documentType = 'general';
    
    try {
      console.log('🔍 Starting OCR processing...');
      [extractedData, documentType] = await Promise.all([
        extractTextFromImage(processedBuffer),
        detectDocumentType(processedBuffer)
      ]);
      console.log('✅ OCR processing completed:', {
        documentType,
        textLength: extractedData?.rawText?.length || 0
      });
    } catch (visionError: any) {
      console.warn('⚠️ Vision API processing failed:', visionError.message);
    }

    // Parse tags
    const tagList = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : [];

    // Save to database
    console.log('💾 Saving to database...');
    const imageDoc = new Image({
      title: title.trim(),
      description: description?.trim() || '',
      publicId: publicId,
      url: url,
      width: width,
      height: height,
      format: format,
      bytes: fileSize,
      extractedData,
      documentType,
      tags: tagList,
      uploadedBy: 'admin',
    });

    await imageDoc.save();
    console.log('✅ Database save successful, image ID:', imageDoc._id);

   return NextResponse.json({
  success: true,
  message: 'Image uploaded and processed successfully',
  data: {
    id: imageDoc._id,
    publicId: imageDoc.publicId,
    url: imageDoc.url,
    title: imageDoc.title,
    format: imageDoc.format,
    size: imageDoc.bytes,
    documentType: imageDoc.documentType,
    // ↓ add these
    extractedName: imageDoc.extractedData?.name,
    extractedPhone: imageDoc.extractedData?.phoneNumber,
    extractedPin: imageDoc.extractedData?.pinCode,
    extractedAddress: imageDoc.extractedData?.address,
    extractedOrderId: imageDoc.extractedData?.orderId,
    extractedProduct: imageDoc.extractedData?.product,
    textLength: imageDoc.extractedData?.rawText?.length || 0
  },
});

  } catch (error: any) {
    console.error('❌ UPLOAD PROCESS FAILED:', {
      error: error.message,
      stack: error.stack,
      cloudinaryResult: cloudinaryResult ? 'Uploaded' : 'Failed'
    });

    return NextResponse.json(
      { 
        success: false, 
        message: 'Upload failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}