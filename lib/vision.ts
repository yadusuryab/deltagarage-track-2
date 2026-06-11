/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/vision-ocrspace.ts
import sharp from 'sharp';

export interface ExtractedData {
  name?: string;
  phoneNumber?: string;
  address?: string;
  pinCode?: string;
  orderId?: string;
  product?: string;
  otherText?: string;
  rawText: string;
}

async function callOCRSpaceAPI(base64Image: string): Promise<any> {
  const apiKey = process.env.OCR_SPACE_API_KEY || 'helloworld';

  const formData = new URLSearchParams();
  formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
  formData.append('apikey', apiKey);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('OCREngine', '2');
  formData.append('scale', 'true');
  formData.append('isTable', 'true');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR.space API failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  if (result.IsErroredOnProcessing) {
    throw new Error(result.ErrorMessage?.[0] || 'OCR.space processing failed');
  }

  return result;
}

async function extractWithAutoRotate(imageBuffer: Buffer): Promise<string> {
  const rotations = [0, 90, 180, 270];
  let bestText = '';
  let bestScore = -1;

  for (const angle of rotations) {
    try {
      const rotated = angle === 0
        ? imageBuffer
        : await sharp(imageBuffer).rotate(angle).jpeg({ quality: 85 }).toBuffer();

      const base64 = rotated.toString('base64');
      const result = await callOCRSpaceAPI(base64);
      const text: string = result.ParsedResults?.[0]?.ParsedText?.replace(/\r\n/g, '\n').trim() || '';

      const score = scoreLabelText(text);
      console.log(`Rotation ${angle}°: score=${score}, length=${text.length}`);

      if (score > bestScore) {
        bestScore = score;
        bestText = text;
      }

      if (score >= 4) break;
    } catch (err: any) {
      console.warn(`Rotation ${angle}° OCR failed:`, err.message);
    }
  }

  return bestText;
}

function scoreLabelText(text: string): number {
  let score = 0;
  if (/\bto\b/i.test(text)) score++;
  if (/mob/i.test(text)) score++;
  if (/pin[:\s]+\d{6}/i.test(text)) score++;
  if (/ord-/i.test(text)) score++;
  if (/product/i.test(text)) score++;
  if (/[6-9]\d{9}/.test(text)) score++;
  return score;
}

async function extractNameWithClaude(rawText: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: `This is OCR text from an Indian delivery package label. Extract ONLY the recipient full name (the person the package is addressed "To"). Return just the name, nothing else. If not found, return "UNKNOWN".\n\nOCR text:\n${rawText}`
        }]
      })
    });

    if (!response.ok) {
      console.warn('Claude name extraction HTTP error:', response.status);
      return null;
    }

    const data = await response.json();
    const name = data.content?.[0]?.text?.trim();
    console.log('Claude extracted name:', name);
    return (!name || name === 'UNKNOWN') ? null : name;
  } catch (err: any) {
    console.warn('extractNameWithClaude error:', err.message);
    return null;
  }
}

export async function extractTextFromImage(imageBuffer: Buffer | string): Promise<ExtractedData> {
  try {
    console.log('Starting OCR with auto-rotation...');

    let buffer: Buffer;
    if (typeof imageBuffer === 'string') {
      const base64 = imageBuffer.startsWith('data:') ? imageBuffer.split(',')[1] : imageBuffer;
      buffer = Buffer.from(base64, 'base64');
    } else {
      buffer = imageBuffer;
    }

    const rawText = await extractWithAutoRotate(buffer);
    console.log('Best raw text length:', rawText.length);
    console.log('=== FULL RAW OCR TEXT ===\n', rawText, '\n=== END ===');

    return await parseExtractedData(rawText);
  } catch (error: any) {
    console.error('extractTextFromImage failed:', error.message);
    return { rawText: '' };
  }
}

export async function detectDocumentType(imageBuffer: Buffer | string): Promise<string> {
  try {
    let buffer: Buffer;
    if (typeof imageBuffer === 'string') {
      const base64 = imageBuffer.startsWith('data:') ? imageBuffer.split(',')[1] : imageBuffer;
      buffer = Buffer.from(base64, 'base64');
    } else {
      buffer = imageBuffer;
    }

    const base64 = buffer.toString('base64');
    const result = await callOCRSpaceAPI(base64);
    const text = result.ParsedResults?.[0]?.ParsedText || '';
    const lower = text.toLowerCase();

    if (lower.includes('mob:') || lower.includes('pin:') || /ord-/i.test(text)) return 'delivery_label';
    if (lower.includes('invoice')) return 'invoice';
    if (lower.includes('receipt')) return 'receipt';
    if (lower.includes('prescription')) return 'prescription';
    if (lower.includes('medical')) return 'medical';
    if (lower.includes('bill')) return 'bill';

    return 'general';
  } catch (error: any) {
    console.error('detectDocumentType failed:', error.message);
    return 'general';
  }
}

async function parseExtractedData(rawText: string): Promise<ExtractedData> {
  if (!rawText?.trim()) return { rawText: '' };

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const data: ExtractedData = { rawText };

  // ORDER ID
  const orderMatch = rawText.match(/ORD-[A-Z0-9\-]+/i);
  if (orderMatch) data.orderId = orderMatch[0].trim();

  // PIN CODE
  const pinMatch = rawText.match(/pin[:\s]+(\d{6})/i);
  if (pinMatch) data.pinCode = pinMatch[1];

  // PHONE — capture multiple numbers
  const mobLineMatch = rawText.match(/mob(?:ile)?[:\s]+([6-9]\d{9}(?:[,\s]+[6-9]\d{9})*)/i);
  if (mobLineMatch) {
    data.phoneNumber = mobLineMatch[1].replace(/\s+/g, ' ').trim();
  } else {
    const plainMatch = rawText.match(/\b([6-9]\d{9})\b/);
    if (plainMatch) data.phoneNumber = plainMatch[1];
  }

  // PRODUCT — stop at tab, PIN, Mob, or newline
  const productMatch = rawText.match(/product[:\s]+([^\n]+?)(?=\s*(?:\t|pin\b|mob\b|$))/i);
  if (productMatch) data.product = productMatch[1].trim();

  // NAME — 5 strategies in order

  // 1: "To\nName" block
  const toBlockMatch = rawText.match(/\bto[\s\t]*\n([^\n]+)/i);
  if (toBlockMatch) {
    const c = toBlockMatch[1].trim();
    if (!/^ORD-/i.test(c) && !/\d{5,}/.test(c)) data.name = c;
  }

  // 2: "To" alone on a line, name is next line
  if (!data.name) {
    const toIdx = lines.findIndex(l => /^to\s*$/i.test(l));
    if (toIdx !== -1 && lines[toIdx + 1]) {
      const c = lines[toIdx + 1];
      if (!/^ORD-/i.test(c) && !/\d{5,}/.test(c)) data.name = c;
    }
  }

  // 3: "To SomeName" inline
  if (!data.name) {
    const toInlineMatch = rawText.match(/\bto\s+([A-Z][a-z][^\n]{2,40})/);
    if (toInlineMatch) {
      const c = toInlineMatch[1].trim();
      if (!/^ORD-/i.test(c) && !/\d{5,}/.test(c)) data.name = c;
    }
  }

  // 4: Heuristic — proper noun line before address
  if (!data.name) {
    for (const line of lines.slice(0, 12)) {
      if (
        /^[A-Z][a-z]/.test(line) &&
        !/\d/.test(line) &&
        !/^(product|mob|pin|ord|to|from|note|cover|seatbelt|sparco|swift|cradder|step|hub|diffuser|black|white|detailing|landmark)/i.test(line) &&
        !/^ORD-/i.test(line) &&
        line.split(/\s+/).length >= 2 &&
        line.split(/\s+/).length <= 6
      ) {
        data.name = line;
        break;
      }
    }
  }

  // 5: Claude AI fallback
  if (!data.name) {
    console.log('Regex failed — using Claude for name extraction...');
    const aiName = await extractNameWithClaude(rawText);
    if (aiName) data.name = aiName;
  }

  // ADDRESS — lines between name and PIN
  const nameLineIdx = data.name ? lines.findIndex(l => l === data.name) : -1;
  const pinLineIdx = lines.findIndex(l => /\bpin\b/i.test(l));

  if (nameLineIdx !== -1 && pinLineIdx > nameLineIdx + 1) {
    data.address = lines
      .slice(nameLineIdx + 1, pinLineIdx)
      .filter(l => !/^(mob|product|ord)/i.test(l))
      .join(', ');
  }

  // OTHER
  const captured = new Set(
    [data.name, data.phoneNumber, data.address, data.pinCode, data.orderId, data.product]
      .filter(Boolean) as string[]
  );

  const otherLines = lines.filter(l =>
    !captured.has(l) &&
    l.length > 3 &&
    !/^(to|mob|pin|product)\b/i.test(l)
  );

  const extras: string[] = [];
  if (data.orderId) extras.push(`Order: ${data.orderId}`);
  if (data.product) extras.push(`Product: ${data.product}`);
  if (data.pinCode) extras.push(`PIN: ${data.pinCode}`);

  data.otherText = [...extras, ...otherLines].join('\n');

  console.log('Parsed:', {
    name: data.name,
    phone: data.phoneNumber,
    pin: data.pinCode,
    orderId: data.orderId,
    product: data.product,
    address: data.address,
  });

  return data;
}