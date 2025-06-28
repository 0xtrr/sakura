import { useState, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useMediaCache } from './useMediaCache';
import { DEFAULT_BLOSSOM_SERVERS, createBlossomAPI, EnhancedBlossomAPI } from '../services/blossom';
import { validateFile, removeExifData, ExifRemovalError } from '../utils/fileUtils';
import type { UserServerList, BlossomServer, BlossomBlob } from '../types';

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
  url?: string;
  uploadDetails?: {
    serverUrl: string;
    attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }>;
  };
}

interface UseFileUploadOptions {
  userServerList: UserServerList | null;
  removeExif?: boolean;
  selectedServer?: BlossomServer;
}

export function useFileUpload({ 
  userServerList, 
  removeExif = true, 
  selectedServer = DEFAULT_BLOSSOM_SERVERS[0] 
}: UseFileUploadOptions) {
  const { getSigningMethod } = useAuth();
  const { addMedia } = useMediaCache();
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const updateUploadProgress = useCallback((file: File, updates: Partial<UploadProgress>) => {
    setUploads(prev => prev.map(upload =>
      upload.file === file 
        ? { ...upload, ...updates }
        : upload
    ));
  }, []);

  const addUpload = useCallback((file: File) => {
    const newUpload: UploadProgress = {
      file,
      progress: 0,
      status: 'processing'
    };
    setUploads(prev => [...prev, newUpload]);
    return newUpload;
  }, []);

  const removeUpload = useCallback((file: File) => {
    setUploads(prev => prev.filter(upload => upload.file !== file));
  }, []);

  const processFile = useCallback(async (file: File): Promise<File> => {
    // Validate file first
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed');
    }

    // Remove EXIF data if enabled and file is an image
    if (removeExif && file.type.startsWith('image/')) {
      try {
        updateUploadProgress(file, { status: 'processing', progress: 10 });
        const processedFile = await removeExifData(file);
        updateUploadProgress(file, { progress: 20 });
        return processedFile;
      } catch (error) {
        if (error instanceof ExifRemovalError) {
          // Let the component handle EXIF removal errors with user confirmation
          throw error;
        }
        throw new Error('Failed to process image');
      }
    }

    return file;
  }, [removeExif, updateUploadProgress]);

  const uploadFile = useCallback(async (file: File): Promise<{ url: string; uploadDetails?: { successful: number; failed: number; servers: string[] } }> => {
    const signingMethod = getSigningMethod();
    if (!signingMethod) {
      throw new Error('No signing method available. Please login again.');
    }

    updateUploadProgress(file, { status: 'uploading', progress: 30 });

    try {
      const processedFile = await processFile(file);
      updateUploadProgress(file, { progress: 50 });

      if (userServerList && userServerList.servers.length > 0) {
        // Upload to user's server list
        const enhancedAPI = new EnhancedBlossomAPI(selectedServer, userServerList);
        
        try {
          // Try uploading to ALL servers for maximum redundancy
          updateUploadProgress(file, { progress: 60 });
          const result = await enhancedAPI.uploadToAllServers(processedFile, signingMethod);
          
          // Create BlossomBlob object and add to cache
          const newBlob: BlossomBlob = {
            sha256: result.primaryResult.sha256,
            size: processedFile.size,
            type: processedFile.type,
            url: result.primaryResult.url,
            uploaded: Math.floor(Date.now() / 1000), // Unix timestamp
            metadata: {
              filename: processedFile.name
            },
            availableServers: [
              ...result.successful.map(s => ({ 
                serverUrl: s.serverUrl, 
                serverName: new URL(s.serverUrl).hostname,
                success: true 
              })),
              ...result.failed.map(f => ({ 
                serverUrl: f.serverUrl, 
                serverName: new URL(f.serverUrl).hostname,
                success: false 
              }))
            ]
          };
          
          // Add to media cache immediately
          addMedia(newBlob);
          
          updateUploadProgress(file, { 
            status: 'success', 
            progress: 100, 
            url: result.primaryResult.url,
            uploadDetails: {
              serverUrl: result.successful[0]?.serverUrl || '',
              attemptedServers: [
                ...result.successful.map(s => ({ serverUrl: s.serverUrl, success: true })),
                ...result.failed.map(f => ({ serverUrl: f.serverUrl, error: f.error.message, success: false }))
              ]
            }
          });

          return { 
            url: result.primaryResult.url, 
            uploadDetails: {
              successful: result.successful.length,
              failed: result.failed.length,
              servers: result.successful.map(s => s.serverUrl)
            }
          };
          
        } catch (error) {
          // Try fallback upload if parallel upload fails
          console.warn('Parallel upload failed, trying fallback:', error);
          updateUploadProgress(file, { progress: 70 });
          
          const fallbackResult = await enhancedAPI.uploadWithFallbackSequential(processedFile, signingMethod);
          
          // Create BlossomBlob object and add to cache for fallback upload
          const fallbackBlob: BlossomBlob = {
            sha256: fallbackResult.result.sha256,
            size: processedFile.size,
            type: processedFile.type,
            url: fallbackResult.result.url,
            uploaded: Math.floor(Date.now() / 1000),
            metadata: {
              filename: processedFile.name
            },
            availableServers: [{
              serverUrl: fallbackResult.serverUrl,
              serverName: new URL(fallbackResult.serverUrl).hostname,
              success: true
            }]
          };
          
          // Add to media cache immediately
          addMedia(fallbackBlob);
          
          updateUploadProgress(file, { 
            status: 'success', 
            progress: 100, 
            url: fallbackResult.result.url,
            uploadDetails: {
              serverUrl: fallbackResult.serverUrl,
              attemptedServers: fallbackResult.attemptedServers
            }
          });

          return { url: fallbackResult.result.url };
        }
      } else {
        // Upload to default server
        const api = createBlossomAPI(selectedServer);
        updateUploadProgress(file, { progress: 70 });
        
        const result = await api.uploadFile(processedFile, signingMethod);
        
        // Create BlossomBlob object and add to cache for default server upload
        const defaultBlob: BlossomBlob = {
          sha256: result.sha256,
          size: processedFile.size,
          type: processedFile.type,
          url: result.url,
          uploaded: Math.floor(Date.now() / 1000),
          metadata: {
            filename: processedFile.name
          },
          availableServers: [{
            serverUrl: selectedServer.url,
            serverName: selectedServer.name,
            success: true
          }]
        };
        
        // Add to media cache immediately
        addMedia(defaultBlob);
        
        updateUploadProgress(file, { 
          status: 'success', 
          progress: 100, 
          url: result.url 
        });

        return { url: result.url };
      }
    } catch (error) {
      // Extract upload details from enhanced error if available
      let uploadDetails: { serverUrl: string; attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }> } | undefined;
      if (error instanceof Error && 'attemptedServers' in error) {
        uploadDetails = {
          serverUrl: '',
          attemptedServers: (error as Error & { attemptedServers: Array<{ serverUrl: string; error?: string; success: boolean }> }).attemptedServers
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      updateUploadProgress(file, { 
        status: 'error', 
        progress: 0, 
        error: errorMessage,
        uploadDetails 
      });
      
      throw error;
    }
  }, [getSigningMethod, processFile, updateUploadProgress, userServerList, selectedServer]);

  const uploadFiles = useCallback(async (files: File[]): Promise<void> => {
    for (const file of files) {
      try {
        addUpload(file);
        await uploadFile(file);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        // Error is already handled in uploadFile by updating the progress
      }
    }
  }, [addUpload, uploadFile]);

  const clearCompletedUploads = useCallback(() => {
    setUploads(prev => prev.filter(upload => 
      upload.status === 'uploading' || upload.status === 'processing'
    ));
  }, []);

  const clearAllUploads = useCallback(() => {
    setUploads([]);
  }, []);

  return useMemo(() => ({
    uploads,
    uploadFile,
    uploadFiles,
    addUpload,
    removeUpload,
    updateUploadProgress,
    clearCompletedUploads,
    clearAllUploads,
    processFile
  }), [uploads, uploadFile, uploadFiles, addUpload, removeUpload, updateUploadProgress, clearCompletedUploads, clearAllUploads, processFile]);
}