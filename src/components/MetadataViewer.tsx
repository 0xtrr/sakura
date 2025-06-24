import { useState, useEffect, useCallback } from 'react';
import { parse } from 'exifr';

interface MetadataViewerProps {
  file: File;
  isVisible: boolean;
  onToggle: () => void;
}

interface ExifData {
  [key: string]: unknown;
}

export function MetadataViewer({ file, isVisible, onToggle }: MetadataViewerProps) {
  const [metadata, setMetadata] = useState<ExifData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMetadata = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Parse EXIF data using exifr with basic options
      const exifData = await parse(file, true);

      setMetadata(exifData || {});
    } catch (err) {
      console.warn('Failed to parse EXIF data:', err);
      setError('No metadata found or failed to parse');
      setMetadata({});
    } finally {
      setLoading(false);
    }
  }, [file]);

  useEffect(() => {
    // Always load metadata for image files to show privacy risks immediately
    if (file && file.type.startsWith('image/')) {
      loadMetadata();
    }
  }, [file, loadMetadata]);

  const formatValue = (value: unknown): string => {
    if (value == null) return 'N/A';
    
    if (typeof value === 'object') {
      if (value instanceof Date) {
        return value.toLocaleString();
      }
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return JSON.stringify(value, null, 2);
    }
    
    return String(value);
  };

  const getSensitiveFields = () => {
    const sensitive = [];
    if (metadata?.latitude && metadata?.longitude) {
      sensitive.push('GPS Location');
    }
    if (metadata?.Make || metadata?.Model) {
      sensitive.push('Device Information');
    }
    if (metadata?.DateTime || metadata?.DateTimeOriginal || metadata?.DateTimeDigitized) {
      sensitive.push('Timestamps');
    }
    if (metadata?.Software) {
      sensitive.push('Software Information');
    }
    if (metadata?.Artist || metadata?.Copyright) {
      sensitive.push('Personal Information');
    }
    return sensitive;
  };

  const getImportantMetadata = () => {
    if (!metadata) return [];
    
    const important = [];
    
    // GPS Information
    if (metadata.latitude && metadata.longitude) {
      important.push({
        category: 'Location (Privacy Risk)',
        fields: [
          { key: 'GPS Coordinates', value: `${metadata.latitude}, ${metadata.longitude}` },
          { key: 'GPS Altitude', value: String(metadata.altitude || 'N/A') },
        ]
      });
    }

    // Device Information
    const deviceFields = [];
    if (metadata.Make) deviceFields.push({ key: 'Camera Make', value: String(metadata.Make) });
    if (metadata.Model) deviceFields.push({ key: 'Camera Model', value: String(metadata.Model) });
    if (metadata.Software) deviceFields.push({ key: 'Software', value: String(metadata.Software) });
    if (deviceFields.length > 0) {
      important.push({
        category: 'Device Information',
        fields: deviceFields
      });
    }

    // Timestamps
    const timeFields = [];
    if (metadata.DateTimeOriginal) timeFields.push({ key: 'Photo Taken', value: formatValue(metadata.DateTimeOriginal) });
    if (metadata.DateTime) timeFields.push({ key: 'Last Modified', value: formatValue(metadata.DateTime) });
    if (metadata.DateTimeDigitized) timeFields.push({ key: 'Digitized', value: formatValue(metadata.DateTimeDigitized) });
    if (timeFields.length > 0) {
      important.push({
        category: 'Timestamps',
        fields: timeFields
      });
    }

    // Personal Information
    const personalFields = [];
    if (metadata.Artist) personalFields.push({ key: 'Artist', value: String(metadata.Artist) });
    if (metadata.Copyright) personalFields.push({ key: 'Copyright', value: String(metadata.Copyright) });
    if (metadata.UserComment) personalFields.push({ key: 'User Comment', value: String(metadata.UserComment) });
    if (personalFields.length > 0) {
      important.push({
        category: 'Personal Information',
        fields: personalFields
      });
    }

    return important;
  };

  const getAllMetadata = () => {
    if (!metadata) return [];
    
    return Object.entries(metadata)
      .filter(([, value]) => value != null)
      .sort(([a], [b]) => a.localeCompare(b));
  };

  const sensitiveFields = metadata ? getSensitiveFields() : [];
  const importantMetadata = getImportantMetadata();
  const allMetadata = getAllMetadata();

  if (!file.type.startsWith('image/')) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg flex items-center justify-between"
      >
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            View File Metadata
          </span>
          {sensitiveFields.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
              {sensitiveFields.length} privacy risk{sensitiveFields.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isVisible ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isVisible && (
        <div className="px-4 pb-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="ml-2 text-sm text-gray-600">Reading metadata...</span>
            </div>
          )}

          {error && (
            <div className="py-4 text-center text-sm text-gray-500">
              {error}
            </div>
          )}

          {metadata && !loading && !error && (
            <div className="space-y-4">
              {/* Privacy Warning */}
              {sensitiveFields.length > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="text-sm">
                      <p className="font-medium text-orange-800">Privacy-Sensitive Data Found</p>
                      <p className="text-orange-700 mt-1">
                        This image contains: {sensitiveFields.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Important Metadata */}
              {importantMetadata.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-900">Key Metadata</h4>
                  {importantMetadata.map((category, idx) => (
                    <div key={idx} className="bg-white rounded-lg border border-gray-200 p-3">
                      <h5 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                        {category.category}
                      </h5>
                      <div className="space-y-1">
                        {category.fields.map((field, fieldIdx) => (
                          <div key={fieldIdx} className="flex justify-between text-sm">
                            <span className="text-gray-600">{field.key}:</span>
                            <span className="font-mono text-gray-900 text-right max-w-48 truncate" title={field.value}>
                              {field.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All Metadata (Collapsible) */}
              {allMetadata.length > 0 && (
                <details className="bg-white rounded-lg border border-gray-200">
                  <summary className="p-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 rounded-lg">
                    All Metadata ({allMetadata.length} fields)
                  </summary>
                  <div className="px-3 pb-3 pt-0 max-h-64 overflow-y-auto">
                    <div className="space-y-1 text-xs">
                      {allMetadata.map(([key, value]) => (
                        <div key={key} className="flex justify-between py-1 border-b border-gray-100 last:border-b-0">
                          <span className="text-gray-600 font-medium">{key}:</span>
                          <span className="font-mono text-gray-900 text-right max-w-48 truncate" title={formatValue(value)}>
                            {formatValue(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}

              {allMetadata.length === 0 && !loading && (
                <div className="text-center py-4 text-sm text-gray-500">
                  No metadata found in this image
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
