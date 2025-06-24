/**
 * Error thrown when EXIF removal fails
 */
export class ExifRemovalError extends Error {
  public originalError?: unknown;
  
  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'ExifRemovalError';
    this.originalError = originalError;
  }
}

/**
 * Removes EXIF data using binary manipulation (preserves quality better)
 * @throws {ExifRemovalError} When binary EXIF removal fails
 */
async function removeBinaryExifData(file: File): Promise<File> {
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // For JPEG files, look for and remove EXIF segments
    if (file.type === 'image/jpeg') {
      const cleanedBuffer = removeJpegExifSegments(uint8Array);
      if (cleanedBuffer) {
        console.log('🔧 Binary EXIF removal successful for JPEG');
        return new File([cleanedBuffer], file.name, { type: file.type });
      }
    }
    
    // For other formats or if JPEG processing fails, throw to use canvas fallback
    throw new Error('Binary removal not available for this format');
    
  } catch (error) {
    throw new ExifRemovalError('Binary EXIF removal failed', error);
  }
}

/**
 * Removes EXIF segments from JPEG files
 */
function removeJpegExifSegments(data: Uint8Array): Uint8Array | null {
  try {
    // JPEG files start with FF D8 (SOI - Start of Image)
    if (data[0] !== 0xFF || data[1] !== 0xD8) {
      return null; // Not a valid JPEG
    }
    
    const result = [0xFF, 0xD8]; // Start with SOI marker
    let i = 2;
    
    while (i < data.length - 1) {
      // Look for segment markers (FF XX)
      if (data[i] === 0xFF) {
        const marker = data[i + 1];
        
        // Skip EXIF segments (APP0 = E0, APP1 = E1 which often contains EXIF)
        if (marker >= 0xE1 && marker <= 0xEF) {
          // Get segment length (next 2 bytes, big-endian)
          const segmentLength = (data[i + 2] << 8) | data[i + 3];
          console.log(`🗑️ Removing EXIF segment: FF${marker.toString(16).toUpperCase()}, length: ${segmentLength}`);
          i += 2 + segmentLength; // Skip this segment
          continue;
        }
        
        // Keep other segments (but still remove some metadata segments)
        if (marker === 0xE0) { // APP0 - may contain thumbnail, remove it too
          const segmentLength = (data[i + 2] << 8) | data[i + 3];
          console.log(`🗑️ Removing APP0 segment, length: ${segmentLength}`);
          i += 2 + segmentLength;
          continue;
        }
        
        // For SOS (Start of Scan) marker, copy everything from here to end
        if (marker === 0xDA) {
          // Copy the rest of the file (actual image data)
          result.push(...Array.from(data.slice(i)));
          break;
        }
        
        // For other markers, copy the segment
        result.push(data[i], data[i + 1]);
        i += 2;
        
        // If this marker has a length field, copy the segment data
        if (marker !== 0xD0 && marker !== 0xD1 && marker !== 0xD2 && 
            marker !== 0xD3 && marker !== 0xD4 && marker !== 0xD5 && 
            marker !== 0xD6 && marker !== 0xD7 && marker !== 0xD8 && 
            marker !== 0xD9) {
          const segmentLength = (data[i] << 8) | data[i + 1];
          result.push(...Array.from(data.slice(i, i + segmentLength)));
          i += segmentLength;
        }
      } else {
        result.push(data[i]);
        i++;
      }
    }
    
    return new Uint8Array(result);
  } catch (error) {
    console.error('Failed to process JPEG EXIF removal:', error);
    return null;
  }
}

/**
 * Removes EXIF data using canvas (fallback method, may reduce quality)
 * @throws {ExifRemovalError} When canvas EXIF removal fails
 */
async function removeCanvasExifData(file: File): Promise<File> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new ExifRemovalError('Canvas context not available');
    }

    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          // Use higher quality settings for canvas encoding
          canvas.toBlob((blob) => {
            if (blob) {
              const cleanedFile = new File([blob], file.name, {
                type: file.type,
                // Don't preserve lastModified timestamp for better privacy
              });
              // Clean up object URL
              URL.revokeObjectURL(img.src);
              console.log('🎨 Canvas EXIF removal successful');
              resolve(cleanedFile);
            } else {
              reject(new ExifRemovalError('Failed to create blob from canvas'));
            }
          }, file.type, 0.95); // High quality encoding
        } catch (error) {
          reject(new ExifRemovalError('Failed to process image on canvas', error));
        }
      };

      img.onerror = () => {
        reject(new ExifRemovalError('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  } catch (error) {
    throw new ExifRemovalError('Failed to remove EXIF data with canvas', error);
  }
}

/**
 * Removes EXIF data from image files for privacy
 * Uses binary removal first (quality preserving), falls back to canvas method
 * @throws {ExifRemovalError} When EXIF removal fails
 */
export async function removeExifData(file: File): Promise<File> {
  // Check if file is an image
  if (!file.type.startsWith('image/')) {
    // Log warning for video/audio files that may contain metadata
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      console.warn(
        `⚠️ Privacy Warning: ${file.type} files may contain metadata that cannot be removed client-side. ` +
        `Consider using server-side processing or dedicated tools to remove metadata from: ${file.name}`
      );
    }
    return file;
  }

  // Add memory check for large images
  if (file.size > 50 * 1024 * 1024) { // 50MB limit
    throw new ExifRemovalError(`File too large for client-side processing (${Math.round(file.size / 1024 / 1024)}MB). Consider using smaller images or server-side processing.`);
  }

  console.log(`🔒 Starting EXIF removal for ${file.name} (${file.type})`);

  try {
    // Try binary removal first (preserves quality better)
    return await removeBinaryExifData(file);
  } catch (binaryError) {
    console.log('🔄 Binary EXIF removal failed, trying canvas method...');
    
    try {
      // Fallback to canvas method
      return await removeCanvasExifData(file);
    } catch (canvasError) {
      // Both methods failed
      throw new ExifRemovalError(
        `Both EXIF removal methods failed. Binary: ${binaryError instanceof Error ? binaryError.message : 'Unknown'}. Canvas: ${canvasError instanceof Error ? canvasError.message : 'Unknown'}`,
        { binaryError, canvasError }
      );
    }
  }
}

/**
 * Validates file type and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 100 * 1024 * 1024; // 100MB
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
  ];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 100MB' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not supported' };
  }

  return { valid: true };
}

/**
 * Generates a thumbnail for image files
 */
export async function generateThumbnail(file: File, maxWidth = 300, maxHeight = 300): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    return null;
  }

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate thumbnail dimensions
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculates SHA-256 hash of a file with iOS Safari compatibility
 */
export async function calculateSHA256(file: File): Promise<string> {
  try {
    // Try modern crypto.subtle API first (for modern browsers)
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (error) {
    console.warn('crypto.subtle not available, falling back to crypto-js:', error);
  }

  // Fallback to crypto-js for iOS Safari and older browsers
  const CryptoJS = (await import('crypto-js')).default;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const hash = CryptoJS.SHA256(wordArray);
        resolve(hash.toString(CryptoJS.enc.Hex));
      } catch (error) {
        reject(new Error(`Failed to calculate SHA-256 hash: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file for hashing'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Formats file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Checks if file is an image
 */
export function isImage(file: File | string): boolean {
  const type = typeof file === 'string' ? file : file.type;
  return type.startsWith('image/');
}

/**
 * Checks if file is a video
 */
export function isVideo(file: File | string): boolean {
  const type = typeof file === 'string' ? file : file.type;
  return type.startsWith('video/');
}
