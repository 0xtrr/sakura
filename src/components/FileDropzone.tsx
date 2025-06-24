import { memo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  accept?: Record<string, string[]>;
  className?: string;
}

export const FileDropzone = memo(function FileDropzone({
  onDrop,
  disabled = false,
  maxFiles = 10,
  accept = {
    'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
    'video/*': ['.mp4', '.webm', '.mov'],
    'audio/*': ['.mp3', '.wav', '.ogg']
  },
  className = ''
}: FileDropzoneProps) {
  const handleDrop = useCallback((acceptedFiles: File[]) => {
    onDrop(acceptedFiles);
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    disabled,
    maxFiles,
    accept,
    multiple: true
  });

  const getDropzoneStyles = () => {
    if (disabled) {
      return 'border-gray-200 bg-gray-50 cursor-not-allowed';
    }
    if (isDragReject) {
      return 'border-red-300 bg-red-50';
    }
    if (isDragActive) {
      return 'border-pink-400 bg-pink-50';
    }
    return 'border-gray-300 hover:border-pink-400 hover:bg-pink-50';
  };

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
        ${getDropzoneStyles()}
        ${className}
      `}
    >
      <input {...getInputProps()} />
      
      <div className="space-y-4">
        {/* Upload icon */}
        <div className="flex justify-center">
          <svg 
            className={`w-12 h-12 ${
              disabled ? 'text-gray-300' : 
              isDragReject ? 'text-red-400' :
              isDragActive ? 'text-pink-500' : 'text-gray-400'
            }`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
        </div>

        {/* Text content */}
        <div>
          {disabled ? (
            <p className="text-gray-500">Upload disabled</p>
          ) : isDragReject ? (
            <div>
              <p className="text-red-600 font-medium">Unsupported file type</p>
              <p className="text-sm text-red-500 mt-1">
                Please upload images, videos, or audio files
              </p>
            </div>
          ) : isDragActive ? (
            <p className="text-pink-600 font-medium">Drop files here...</p>
          ) : (
            <div>
              <p className="text-lg font-medium text-gray-900">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supports images, videos, and audio files up to 100MB
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Maximum {maxFiles} files at once
              </p>
            </div>
          )}
        </div>

        {/* Supported formats */}
        {!disabled && !isDragActive && !isDragReject && (
          <div className="text-xs text-gray-400">
            <p>Supported formats:</p>
            <p>Images: JPEG, PNG, GIF, WebP</p>
            <p>Videos: MP4, WebM, MOV</p>
            <p>Audio: MP3, WAV, OGG</p>
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      {!disabled && (
        <div className="absolute bottom-2 right-2">
          <kbd className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded">
            Click or Space
          </kbd>
        </div>
      )}
    </div>
  );
});