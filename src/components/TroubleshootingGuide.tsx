import { useState } from 'react';
import type { ErrorCategory } from '../utils/errorHandling';

interface TroubleshootingStep {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface TroubleshootingGuideProps {
  category: ErrorCategory;
  error?: string;
  onClose: () => void;
  context?: Record<string, unknown>;
}

export function TroubleshootingGuide({ 
  category, 
  error, 
  onClose, 
  context 
}: TroubleshootingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const getStepsForCategory = (): TroubleshootingStep[] => {
    switch (category) {
      case 'network':
        return [
          {
            title: 'Check Internet Connection',
            description: 'Verify that your device has a stable internet connection.',
            action: {
              label: 'Test Connection',
              onClick: () => testNetworkConnection()
            }
          },
          {
            title: 'Check Service Status',
            description: 'Some services might be temporarily unavailable.',
            action: {
              label: 'Check Status',
              onClick: () => window.open('https://status.example.com', '_blank')
            }
          },
          {
            title: 'Try Different Network',
            description: 'If possible, try connecting from a different network (mobile data, different WiFi).'
          },
          {
            title: 'Restart Application',
            description: 'Sometimes a simple restart can resolve network issues.',
            action: {
              label: 'Refresh Page',
              onClick: () => window.location.reload()
            }
          }
        ];

      case 'server':
        return [
          {
            title: 'Verify Server Configuration',
            description: 'Check that your Blossom servers are configured correctly in Settings.',
            action: {
              label: 'Open Settings',
              onClick: () => {/* Navigate to settings */}
            }
          },
          {
            title: 'Test Server Connectivity',
            description: 'Try accessing your server directly to see if it\'s responding.'
          },
          {
            title: 'Try Alternative Server',
            description: 'If you have multiple servers configured, try using a different one.',
            action: {
              label: 'Switch Server',
              onClick: () => {/* Switch to backup server */}
            }
          },
          {
            title: 'Contact Server Administrator',
            description: 'If the problem persists, contact your server administrator for assistance.'
          }
        ];

      case 'authentication':
        return [
          {
            title: 'Check Nostr Extension',
            description: 'Make sure your Nostr extension (Alby, nos2x) is installed and unlocked.',
            action: {
              label: 'Test Extension',
              onClick: () => testNostrExtension()
            }
          },
          {
            title: 'Verify Private Key',
            description: 'If using a private key, ensure it\'s in the correct format (nsec...).'
          },
          {
            title: 'Restart Browser',
            description: 'Sometimes browser extensions need a restart to work properly.',
            action: {
              label: 'Get Restart Instructions',
              onClick: () => showRestartInstructions()
            }
          },
          {
            title: 'Try Alternative Login',
            description: 'If using extension login, try private key login or vice versa.'
          }
        ];

      case 'configuration':
        return [
          {
            title: 'Review Settings',
            description: 'Check your relay and server configurations in the Settings page.',
            action: {
              label: 'Open Settings',
              onClick: () => {/* Navigate to settings */}
            }
          },
          {
            title: 'Reset to Defaults',
            description: 'If settings seem corrupted, try resetting to default configuration.',
            action: {
              label: 'Reset Settings',
              onClick: () => {/* Reset settings */}
            }
          },
          {
            title: 'Import Configuration',
            description: 'Try importing a working configuration from another device or backup.'
          },
          {
            title: 'Manual Setup',
            description: 'Set up your relays and servers manually using the guided setup.'
          }
        ];

      default:
        return [
          {
            title: 'Basic Troubleshooting',
            description: 'Try refreshing the page or restarting the application.',
            action: {
              label: 'Refresh Page',
              onClick: () => window.location.reload()
            }
          },
          {
            title: 'Clear Browser Data',
            description: 'Clear browser cache and local storage, then try again.'
          },
          {
            title: 'Try Different Browser',
            description: 'Test if the issue occurs in a different browser or incognito mode.'
          },
          {
            title: 'Get Help',
            description: 'If the problem persists, seek help from the community or support.'
          }
        ];
    }
  };

  const steps = getStepsForCategory();

  const markStepComplete = (stepIndex: number) => {
    setCompletedSteps(prev => new Set(prev).add(stepIndex));
  };

  const testNetworkConnection = async () => {
    try {
      await fetch('https://httpbin.org/get', { method: 'HEAD' });
      alert('✅ Network connection is working');
      markStepComplete(0);
    } catch {
      alert('❌ Network connection failed');
    }
  };

  const testNostrExtension = async () => {
    try {
      if (window.nostr) {
        await window.nostr.getPublicKey();
        alert('✅ Nostr extension is working');
        markStepComplete(0);
      } else {
        alert('❌ No Nostr extension found');
      }
    } catch {
      alert('❌ Nostr extension failed');
    }
  };

  const showRestartInstructions = () => {
    alert('To restart your browser:\n\n1. Close all browser windows\n2. Wait 5 seconds\n3. Open browser again\n4. Try the operation again');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Troubleshooting Guide
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2">Error Details</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 transition-colors ${
                  completedSteps.has(index)
                    ? 'bg-green-50 border-green-200'
                    : currentStep === index
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-current text-sm font-medium mr-3">
                        {completedSteps.has(index) ? (
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </span>
                      <h3 className="font-medium text-gray-900">{step.title}</h3>
                    </div>
                    
                    <p className="text-sm text-gray-600 ml-9">
                      {step.description}
                    </p>
                  </div>
                  
                  {step.action && (
                    <button
                      onClick={() => {
                        step.action!.onClick();
                        setCurrentStep(index);
                      }}
                      className="ml-4 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      {step.action.label}
                    </button>
                  )}
                </div>
                
                {!completedSteps.has(index) && (
                  <div className="ml-9 mt-3">
                    <button
                      onClick={() => markStepComplete(index)}
                      className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Mark as completed
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                Still having issues? The problem might be more complex.
              </p>
              
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => {
                    const logs = {
                      error,
                      category,
                      context,
                      userAgent: navigator.userAgent,
                      timestamp: new Date().toISOString()
                    };
                    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
                    alert('Diagnostic information copied to clipboard');
                  }}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Copy Debug Info
                </button>
                
                <button
                  onClick={() => window.open('https://github.com/your-repo/issues', '_blank')}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Report Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}