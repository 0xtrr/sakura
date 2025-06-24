import { memo, useCallback } from 'react';
import { formatFileSize, isImage } from '../utils/fileUtils';
import type { UploadProgress } from '../hooks/useFileUpload';

interface UploadProgressItemProps {
  upload: UploadProgress;
  onRemove: (file: File) => void;
  onToggleMetadata: (file: File) => void;
  isMetadataVisible: boolean;
  isCopied: boolean;
  onCopyUrl: (url: string) => void;
}

export const UploadProgressItem = memo(function UploadProgressItem({
  upload,
  onRemove,
  onToggleMetadata,
  isMetadataVisible,
  isCopied,
  onCopyUrl
}: UploadProgressItemProps) {
  const handleCopyUrl = useCallback(() => {
    if (upload.url) {
      onCopyUrl(upload.url);
    }
  }, [upload.url, onCopyUrl]);

  const handleToggleMetadata = useCallback(() => {
    onToggleMetadata(upload.file);
  }, [upload.file, onToggleMetadata]);

  const handleRemove = useCallback(() => {
    onRemove(upload.file);
  }, [upload.file, onRemove]);

  const getStatusColor = () => {
    switch (upload.status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'uploading': return 'text-blue-600';
      case 'processing': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (upload.status) {
      case 'success': return 'Uploaded';
      case 'error': return 'Failed';
      case 'uploading': return 'Uploading...';
      case 'processing': return 'Processing...';
      default: return 'Pending';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-900 truncate">
              {upload.file.name}
            </span>
            <span className="text-sm text-gray-500">
              ({formatFileSize(upload.file.size)})
            </span>
          </div>
          
          {/* Progress bar */}
          {(upload.status === 'uploading' || upload.status === 'processing') && (
            <div className="mt-2">
              <div className="bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-pink-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">{upload.progress}%</p>
            </div>
          )}

          {/* Status */}
          <div className={`text-sm font-medium mt-2 ${getStatusColor()}`}>
            {getStatusText()}
          </div>

          {/* Error message */}
          {upload.error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
              {upload.error}
            </div>
          )}

          {/* Upload details */}
          {upload.uploadDetails && (
            <div className="mt-2 text-xs text-gray-500">
              {upload.uploadDetails.attemptedServers && (
                <div>
                  Servers: {upload.uploadDetails.attemptedServers.filter(s => s.success).length} successful, {upload.uploadDetails.attemptedServers.filter(s => !s.success).length} failed
                </div>
              )}
            </div>
          )}

          {/* Success URL */}
          {upload.status === 'success' && upload.url && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyUrl}
                  className={`text-sm px-3 py-1 rounded transition-colors ${
                    isCopied 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {isCopied ? '✓ Copied!' : 'Copy URL'}
                </button>
                <a
                  href={upload.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View →
                </a>
              </div>
              
              {isImage(upload.file) && (
                <button
                  onClick={handleToggleMetadata}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  {isMetadataVisible ? 'Hide' : 'Show'} metadata
                </button>
              )}
            </div>
          )}
        </div>

        {/* Remove button */}
        <button
          onClick={handleRemove}
          className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
          title="Remove from list"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
});

interface UploadProgressListProps {
  uploads: UploadProgress[];
  onRemove: (file: File) => void;
  onToggleMetadata: (file: File) => void;
  metadataVisible: Set<string>;
  copiedUrls: Set<string>;
  onCopyUrl: (url: string) => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
}

export const UploadProgressList = memo(function UploadProgressList({
  uploads,
  onRemove,
  onToggleMetadata,
  metadataVisible,
  copiedUrls,
  onCopyUrl,
  onClearCompleted,
  onClearAll
}: UploadProgressListProps) {
  if (uploads.length === 0) {
    return null;
  }

  const completedCount = uploads.filter(u => u.status === 'success' || u.status === 'error').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Upload Progress ({uploads.length})
        </h3>
        <div className="space-x-2">
          {completedCount > 0 && (
            <button
              onClick={onClearCompleted}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Clear completed
            </button>
          )}
          <button
            onClick={onClearAll}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {uploads.map((upload) => (
          <UploadProgressItem
            key={`${upload.file.name}-${upload.file.size}-${upload.file.lastModified}`}
            upload={upload}
            onRemove={onRemove}
            onToggleMetadata={onToggleMetadata}
            isMetadataVisible={metadataVisible.has(upload.file.name)}
            isCopied={copiedUrls.has(upload.url || '')}
            onCopyUrl={onCopyUrl}
          />
        ))}
      </div>
    </div>
  );
});