import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_BLOSSOM_SERVERS, createBlossomAPI, EnhancedBlossomAPI } from '../services/blossom';
import { validateFile, removeExifData, formatFileSize, isImage, ExifRemovalError } from '../utils/fileUtils';
import { copyToClipboard } from '../utils/clipboard';
import { MetadataViewer } from './MetadataViewer';
import type { UserServerList } from '../types';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
  url?: string;
  // Fallback upload details
  uploadDetails?: {
    serverUrl: string;
    attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }>;
  };
}

interface PendingFile {
  file: File;
  id: string;
}

interface UploadZoneProps {
  userServerList: UserServerList | null;
}

export function UploadZone({ userServerList }: UploadZoneProps) {
  const { getSigningMethod } = useAuth();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [selectedServer, setSelectedServer] = useState(DEFAULT_BLOSSOM_SERVERS[0]);
  const [removeExif, setRemoveExif] = useState(true);
  const [uploadToAllServers, setUploadToAllServers] = useState(false); // Default to primary server only
  const [copiedUrls, setCopiedUrls] = useState<Set<string>>(new Set());
  const [metadataVisible, setMetadataVisible] = useState<Set<string>>(new Set());
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  // Initialize selected server when user server list changes
  useEffect(() => {
    if (userServerList && userServerList.servers.length > 0) {
      // Use user's primary server (first in list) as the selected server for API operations
      const primaryServerUrl = userServerList.servers[0];
      const primaryServer = DEFAULT_BLOSSOM_SERVERS.find(s => s.url === primaryServerUrl) || {
        url: primaryServerUrl,
        name: new URL(primaryServerUrl).hostname,
        description: 'User server'
      };
      setSelectedServer(primaryServer);
    }
  }, [userServerList]);  const processFile = async (file: File): Promise<void> => {
    // Add file to upload queue
    setUploads(prev => [...prev, {
      file,
      progress: 0,
      status: 'processing'
    }]);

    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      setUploads(prev => prev.map(upload =>
        upload.file === file 
          ? { 
              ...upload, 
              status: 'error' as const, 
              error: 'No signing method available. Please login again.'
            }
          : upload
      ));
      return;
    }

    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }


      // Process file (remove EXIF if enabled and it's an image)
      let processedFile = file;
      if (removeExif && isImage(file)) {
        setUploads(prev => prev.map(upload => 
          upload.file === file 
            ? { ...upload, status: 'processing' as const }
            : upload
        ));
        
        try {
          processedFile = await removeExifData(file);
        } catch (error) {
          if (error instanceof ExifRemovalError) {
            // Show user confirmation dialog for EXIF removal failure
            const userChoice = window.confirm(
              `Warning: Failed to remove EXIF data from "${file.name}". ` +
              `This means the image may contain sensitive metadata like location data, device information, and timestamps.\n\n` +
              `Do you want to continue uploading the original file with metadata intact?\n\n` +
              `Click "OK" to upload anyway, or "Cancel" to abort the upload.`
            );
            
            if (!userChoice) {
              // User chose to cancel the upload
              setUploads(prev => prev.filter(upload => upload.file !== file));
              return;
            }
            
            // User chose to continue with original file
            console.warn('EXIF removal failed, proceeding with original file:', error.message);
            processedFile = file;
          } else {
            // Re-throw unexpected errors
            throw error;
          }
        }
      }

      // Start upload
      setUploads(prev => prev.map(upload => 
        upload.file === file 
          ? { ...upload, status: 'uploading' as const, progress: 10 }
          : upload
      ));

      // Use enhanced API to upload to PRIMARY server with fallback if user has server list
      let result;
      let uploadDetails;
      if (userServerList && userServerList.servers.length > 0) {
        const enhancedAPI = new EnhancedBlossomAPI(selectedServer, userServerList);
        
        // Update progress to show upload starting
        setUploads(prev => prev.map(upload => 
          upload.file === file 
            ? { ...upload, progress: 20 }
            : upload
        ));

        if (uploadToAllServers) {
          // Upload to all servers simultaneously for maximum redundancy
          const uploadResult = await enhancedAPI.uploadToAllServers(processedFile, signingMethod);
          result = uploadResult.primaryResult;
          uploadDetails = {
            serverUrl: uploadResult.successful[0]?.serverUrl || 'unknown',
            attemptedServers: [
              ...uploadResult.successful.map(s => ({ 
                serverUrl: s.serverUrl, 
                success: true 
              })),
              ...uploadResult.failed.map(f => ({ 
                serverUrl: f.serverUrl, 
                error: f.error.message, 
                success: false 
              }))
            ]
          };
        } else {
          // Upload to primary server with fallback to other servers if needed
          const uploadResult = await enhancedAPI.uploadWithFallbackSequential(processedFile, signingMethod);
          result = uploadResult.result;
          uploadDetails = {
            serverUrl: uploadResult.serverUrl,
            attemptedServers: uploadResult.attemptedServers
          };
        }
      } else {
        const blossomAPI = createBlossomAPI(selectedServer);
        result = await blossomAPI.uploadFile(processedFile, signingMethod);
        uploadDetails = {
          serverUrl: selectedServer.url,
          attemptedServers: [{ serverUrl: selectedServer.url, success: true }]
        };
      }

      // Update progress to 100% and mark as success
      setUploads(prev => prev.map(upload => 
        upload.file === file 
          ? { 
              ...upload, 
              status: 'success' as const, 
              progress: 100,
              url: result.url,
              uploadDetails
            }
          : upload
      ));

    } catch (error) {
      // Extract upload details from enhanced error if available
      let uploadDetails: { serverUrl: string; attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }> } | undefined;
      if (error instanceof Error && 'attemptedServers' in error) {
        // Enhanced error from uploadWithFallbackSequential contains attempt details
        uploadDetails = {
          serverUrl: '', // No successful server
          attemptedServers: (error as Error & { attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }> }).attemptedServers
        };
      } else if (error instanceof Error && error.message.includes('Upload failed on all')) {
        // Try to parse server URLs from error message as fallback
        // This is less reliable but better than nothing
        const servers = userServerList?.servers || [selectedServer.url];
        uploadDetails = {
          serverUrl: '',
          attemptedServers: servers.map(serverUrl => ({
            serverUrl,
            error: error.message.includes(serverUrl) ? 
              error.message.split(serverUrl + ': ')[1]?.split(';')[0] || 'Upload failed' :
              'Upload failed',
            success: false
          }))
        };
      }
      
      setUploads(prev => prev.map(upload =>
        upload.file === file 
          ? { 
              ...upload, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : 'Upload failed',
              uploadDetails
            }
          : upload
      ));
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Add files to pending review instead of immediate upload
    const newPendingFiles = acceptedFiles.map(file => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`
    }));
    setPendingFiles(prev => [...prev, ...newPendingFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const clearCompleted = () => {
    setUploads(prev => prev.filter(upload => 
      upload.status === 'uploading' || upload.status === 'processing'
    ));
  };

  const handleCopyUrl = async (url: string) => {
    try {
      const success = await copyToClipboard(url);
      
      if (success) {
        setCopiedUrls(prev => new Set(prev).add(url));
        
        // Reset the copied state after 2 seconds
        setTimeout(() => {
          setCopiedUrls(prev => {
            const newSet = new Set(prev);
            newSet.delete(url);
            return newSet;
          });
        }, 2000);
      } else {
        console.error('Failed to copy URL to clipboard');
      }
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const toggleMetadataVisibility = (fileName: string) => {
    setMetadataVisible(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }
      return newSet;
    });
  };

  const removePendingFile = (fileId: string) => {
    setPendingFiles(prev => prev.filter(pf => pf.id !== fileId));
    // Also remove from metadata visible set if it was there
    const pendingFile = pendingFiles.find(pf => pf.id === fileId);
    if (pendingFile) {
      setMetadataVisible(prev => {
        const newSet = new Set(prev);
        newSet.delete(pendingFile.file.name);
        return newSet;
      });
    }
  };

  const uploadPendingFile = (fileId: string) => {
    const pendingFile = pendingFiles.find(pf => pf.id === fileId);
    if (pendingFile) {
      processFile(pendingFile.file);
      removePendingFile(fileId);
    }
  };

  const uploadAllPending = () => {
    pendingFiles.forEach(pf => {
      processFile(pf.file);
    });
    setPendingFiles([]);
    setMetadataVisible(new Set());
  };

  const clearAllPending = () => {
    setPendingFiles([]);
    setMetadataVisible(new Set());
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Upload Media</h2>
        {uploads.length > 0 && (
          <button
            onClick={clearCompleted}
            className="btn-secondary text-sm w-full sm:w-auto"
          >
            Clear Completed
          </button>
        )}
      </div>

      {/* Show message when no servers are configured */}
      {userServerList === null && (
        <div className="card border-l-4 border-yellow-500 bg-yellow-50">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                No Blossom servers configured
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  You need to configure at least one Blossom server before you can upload media.
                  Please go to <span className="font-medium">Settings</span> to set up your servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Only show upload interface if servers are configured */}
      {userServerList && userServerList.servers.length > 0 && (
        <>
          {/* Upload Settings */}
          <div className="card">
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Privacy Settings</h3>
        
        <div className="space-y-4">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="removeExif"
              checked={removeExif}
              onChange={(e) => setRemoveExif(e.target.checked)}
              className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded mt-0.5"
            />
            <label htmlFor="removeExif" className="ml-2 text-sm text-gray-700 leading-relaxed">
              Remove EXIF data from images for privacy
            </label>
          </div>

          {userServerList && userServerList.servers.length > 1 && (
            <div className="flex items-start">
              <input
                type="checkbox"
                id="uploadToAllServers"
                checked={uploadToAllServers}
                onChange={(e) => setUploadToAllServers(e.target.checked)}
                className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded mt-0.5"
              />
              <label htmlFor="uploadToAllServers" className="ml-2 text-sm text-gray-700 leading-relaxed">
                Upload to all servers simultaneously (maximum redundancy)
              </label>
            </div>
          )}

          {/* Video/Audio metadata warning */}
          <div className="flex items-start text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
            <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div className="flex-1 leading-relaxed">
              <p className="font-medium">Video & Audio Privacy Notice</p>
              <p className="mt-1 text-xs">
                Video and audio files may contain metadata that cannot be automatically removed, including creation timestamps, device information, and potentially location data. Review your files before uploading if privacy is a concern.
              </p>
            </div>
          </div>

          {userServerList && userServerList.servers.length > 1 && (
            <div className="flex items-start text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
              <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1 leading-relaxed">
                <p className="font-medium">
                  {uploadToAllServers ? 'Upload to All Servers Simultaneously' : 'Primary Server Upload with Fallback'}
                </p>
                <p className="mt-1">
                  {uploadToAllServers ? (
                    <>Files will be uploaded to <span className="font-medium">all {userServerList.servers.length} servers</span> at the same time for maximum redundancy</>
                  ) : (
                    <>Files will be uploaded to your primary server: <span className="font-medium">{new URL(userServerList.servers[0]).hostname}</span></>
                  )}
                </p>
                <p className="mt-1 text-xs opacity-75">
                  {uploadToAllServers ? (
                    <>This provides maximum decentralization but uses more bandwidth and may take longer.</>
                  ) : (
                    <>If the primary server fails, we'll automatically try your other {userServerList.servers.length - 1} server(s) as fallback.</>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

          {/* Pending Files Review */}
          {pendingFiles.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">
                  Review Files Before Upload
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={clearAllPending}
                    className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={uploadAllPending}
                    className="btn-primary text-sm"
                  >
                    Upload All ({pendingFiles.length})
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {pendingFiles.map((pendingFile) => (
                  <div key={pendingFile.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center min-w-0 flex-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-3 flex-shrink-0"></div>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {pendingFile.file.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatFileSize(pendingFile.file.size)}
                      </span>
                    </div>

                    {/* File validation warnings */}
                    {(() => {
                      const validation = validateFile(pendingFile.file);
                      if (!validation.valid) {
                        return (
                          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div className="text-sm">
                                <p className="font-medium text-red-800">File Validation Error</p>
                                <p className="text-red-700 mt-1">{validation.error}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Metadata Viewer for image files */}
                    {isImage(pendingFile.file) && (
                      <div className="mb-3">
                        <MetadataViewer
                          file={pendingFile.file}
                          isVisible={metadataVisible.has(pendingFile.file.name)}
                          onToggle={() => toggleMetadataVisibility(pendingFile.file.name)}
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <button
                        onClick={() => removePendingFile(pendingFile.id)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => uploadPendingFile(pendingFile.id)}
                        disabled={!validateFile(pendingFile.file).valid}
                        className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Upload This File
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Zone */}
          <div
            {...getRootProps()}
            className={`card border-dashed border-2 transition-colors cursor-pointer ${
              isDragActive
                ? 'border-pink-500 bg-pink-50'
                : 'border-gray-300 hover:border-pink-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="text-center py-8 sm:py-12">
              <svg
                className={`mx-auto h-8 w-8 sm:h-12 sm:w-12 ${
                  isDragActive ? 'text-pink-500' : 'text-gray-400'
                }`}
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="mt-3 sm:mt-4">
                <p className="text-base sm:text-lg font-medium text-gray-900">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or <span className="text-pink-600 font-medium">tap to choose files</span>
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Files will be staged for review before upload • Supports images, videos, and audio up to 100MB
                </p>
              </div>
            </div>
          </div>

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <div className="card">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">Upload Progress</h3>
              <div className="space-y-3">
                {uploads.map((upload, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center min-w-0 flex-1">
                        <div className={`w-3 h-3 rounded-full mr-3 flex-shrink-0 ${
                          upload.status === 'processing' ? 'bg-yellow-500' :
                          upload.status === 'uploading' ? 'bg-blue-500' :
                          upload.status === 'success' ? 'bg-green-500' :
                          upload.status === 'error' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`}></div>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {upload.file.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatFileSize(upload.file.size)}
                      </span>
                    </div>
                
                {upload.status === 'uploading' && (
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className="bg-pink-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    ></div>
                  </div>
                )}
                
                <div className="text-xs text-gray-600">
                  {upload.status === 'processing' && 'Processing file...'}
                  {upload.status === 'uploading' && (
                    <div>
                      <div>{`Uploading... ${upload.progress}%`}</div>
                    </div>
                  )}
                  {upload.status === 'success' && (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-green-600">Upload complete</span>
                          {upload.uploadDetails && (
                            <span className="text-xs text-gray-500">
                              Uploaded to: {new URL(upload.uploadDetails.serverUrl).hostname}
                              {upload.uploadDetails.attemptedServers.length > 1 && (
                                <span className="text-blue-600">
                                  {' '}(tried {upload.uploadDetails.attemptedServers.length} servers)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {upload.url && (
                          <button
                            onClick={() => handleCopyUrl(upload.url!)}
                            className={`text-xs font-medium self-start sm:self-auto transition-colors ${
                              copiedUrls.has(upload.url)
                                ? 'text-green-600 hover:text-green-700'
                                : 'text-pink-600 hover:text-pink-700'
                            }`}
                          >
                            {copiedUrls.has(upload.url) ? 'Copied!' : 'Copy URL'}
                          </button>
                        )}
                      </div>
                      
                      {/* Show fallback attempt details if multiple servers were tried */}
                      {upload.uploadDetails && upload.uploadDetails.attemptedServers.length > 1 && (
                        <details className="bg-gray-50 rounded-md p-2">
                          <summary className="text-xs font-medium text-gray-700 cursor-pointer">
                            Upload attempt details ({upload.uploadDetails.attemptedServers.filter(s => !s.success).length} failed)
                          </summary>
                          <div className="mt-2 space-y-1">
                            {upload.uploadDetails.attemptedServers.map((server, idx) => (
                              <div key={idx} className="flex items-start text-xs">
                                <div className={`w-2 h-2 rounded-full mr-2 mt-0.5 flex-shrink-0 ${
                                  server.success ? 'bg-green-500' : 'bg-red-500'
                                }`}></div>
                                <div className="min-w-0 flex-1">
                                  <span className={`block truncate ${
                                    server.success ? 'text-green-700' : 'text-red-700'
                                  }`}>
                                    {new URL(server.serverUrl).hostname}
                                  </span>
                                  {server.error && (
                                    <span className="text-red-600 text-xs opacity-75 block">
                                      {server.error}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                  {upload.status === 'error' && (
                    <div className="space-y-2">
                      <span className="text-red-600 break-words">{upload.error}</span>
                      
                      {/* Show detailed error information if available */}
                      {upload.uploadDetails && upload.uploadDetails.attemptedServers.length > 0 && (
                        <details className="bg-red-50 rounded-md p-2">
                          <summary className="text-xs font-medium text-red-700 cursor-pointer">
                            Server error details ({upload.uploadDetails.attemptedServers.length} servers tried)
                          </summary>
                          <div className="mt-2 space-y-1">
                            {upload.uploadDetails.attemptedServers.map((server, idx) => (
                              <div key={idx} className="flex items-start text-xs">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-2 mt-0.5 flex-shrink-0"></div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-red-700 block truncate">
                                    {new URL(server.serverUrl).hostname}
                                  </span>
                                  {server.error && (
                                    <span className="text-red-600 text-xs opacity-75 block">
                                      {server.error}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
