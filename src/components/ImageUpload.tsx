import { useState, useCallback, useRef } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
import { validateFile, removeExifData, ExifRemovalError } from '../utils/fileUtils';
import type { UserServerList } from '../types';

interface ImageUploadProps {
  onImageUploaded: (url: string) => void;
  userServerList: UserServerList | null;
  accept?: string;
  maxSize?: number;
  className?: string;
  children: React.ReactNode;
}

export function ImageUpload({ 
  onImageUploaded, 
  userServerList, 
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  className = '',
  children 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile } = useFileUpload({
    userServerList,
    removeExif: true
  });

  const handleFileSelect = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid file');
      }

      // Check file size
      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`);
      }

      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      // Process image to remove EXIF data
      let processedFile = file;
      try {
        processedFile = await removeExifData(file);
      } catch (exifError) {
        if (exifError instanceof ExifRemovalError) {
          // Show warning but continue with upload
          console.warn('EXIF removal failed, uploading original file:', exifError.message);
        } else {
          throw exifError;
        }
      }

      // Upload the file
      const result = await uploadFile(processedFile);
      
      // Call the callback with the uploaded URL
      onImageUploaded(result.url);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadFile, onImageUploaded, maxSize]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = Array.from(event.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileSelect(imageFile);
    } else {
      setError('Please drop an image file');
    }
  }, [handleFileSelect]);

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`cursor-pointer transition-opacity ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {children}
      </div>

      {uploading && (
        <div className="mt-2 flex items-center text-sm text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Uploading image...
        </div>
      )}

      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}