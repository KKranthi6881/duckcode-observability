/**
 * JobConfiguration Component
 * Configure options and trigger documentation generation
 */

import { useState, useEffect } from 'react';
import { Zap, AlertCircle, CheckCircle, Loader2, Key } from 'lucide-react';
import { aiDocumentationService } from '../../../services/aiDocumentationService';
import { supabase } from '../../../config/supabaseClient';

interface JobConfigurationProps {
  organizationId: string;
  selectedObjectIds: string[];
  onJobCreated: (jobId: string) => void;
}

export function JobConfiguration({ organizationId, selectedObjectIds, onJobCreated }: JobConfigurationProps) {
  const [options, setOptions] = useState({
    skipExisting: true,
    regenerateAll: false,
    maxRetries: 3,
  });

  const [creating, setCreating] = useState(false);
  const [hasAPIKey, setHasAPIKey] = useState<boolean | null>(null);
  const [checkingAPIKey, setCheckingAPIKey] = useState(true);

  useEffect(() => {
    checkAPIKey();
  }, [organizationId]);

  const checkAPIKey = async () => {
    try {
      setCheckingAPIKey(true);
      const { data, error } = await supabase
        .schema('enterprise')
        .from('organization_api_keys')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('provider', 'openai')
        .eq('status', 'active')
        .eq('is_default', true)
        .single();

      setHasAPIKey(!error && !!data);
    } catch (error) {
      console.error('Error checking API key:', error);
      setHasAPIKey(false);
    } finally {
      setCheckingAPIKey(false);
    }
  };


  const handleCreate = async () => {
    if (!hasAPIKey) {
      alert('Please configure an OpenAI API key first.');
      return;
    }

    if (selectedObjectIds.length === 0) {
      alert('Please select at least one object.');
      return;
    }

    try {
      setCreating(true);
      const result = await aiDocumentationService.createJob(
        organizationId,
        selectedObjectIds,
        options
      );

      onJobCreated(result.jobId);
    } catch (error: any) {
      console.error('Error creating job:', error);
      alert(`Failed to create job: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* API Key Status */}
      <div className={`
        p-4 rounded-lg border-2
        ${checkingAPIKey 
          ? 'border-gray-200 bg-gray-50' 
          : hasAPIKey 
            ? 'border-green-200 bg-green-50' 
            : 'border-red-200 bg-red-50'
        }
      `}>
        <div className="flex items-start gap-3">
          {checkingAPIKey ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin flex-shrink-0 mt-0.5" />
          ) : hasAPIKey ? (
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className={`text-sm font-medium ${
              checkingAPIKey ? 'text-gray-700' : hasAPIKey ? 'text-green-900' : 'text-red-900'
            }`}>
              {checkingAPIKey ? 'Checking API Key...' : hasAPIKey ? 'OpenAI API Key Configured' : 'OpenAI API Key Required'}
            </h3>
            <p className={`text-xs mt-1 ${
              checkingAPIKey ? 'text-gray-600' : hasAPIKey ? 'text-green-700' : 'text-red-700'
            }`}>
              {checkingAPIKey 
                ? 'Verifying your organization has a configured OpenAI API key...'
                : hasAPIKey 
                  ? 'Your organization has a valid OpenAI API key configured.'
                  : 'Configure an OpenAI API key in API Keys settings to enable documentation generation.'
              }
            </p>
            {!checkingAPIKey && !hasAPIKey && (
              <a
                href="/admin/api-keys"
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-red-600 hover:text-red-700"
              >
                <Key className="h-3 w-3" />
                Configure API Key
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Configuration Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Generation Options</h3>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={options.skipExisting}
            onChange={(e) => setOptions({ ...options, skipExisting: e.target.checked })}
            className="mt-1 h-4 w-4 text-[#2AB7A9] border-gray-300 rounded focus:ring-[#2AB7A9]"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">Skip Existing Documentation</div>
            <div className="text-xs text-gray-600">Only generate documentation for objects that don't have it yet</div>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={options.regenerateAll}
            onChange={(e) => setOptions({ ...options, regenerateAll: e.target.checked })}
            className="mt-1 h-4 w-4 text-[#2AB7A9] border-gray-300 rounded focus:ring-[#2AB7A9]"
          />
          <div>
            <div className="text-sm font-medium text-gray-900">Regenerate All</div>
            <div className="text-xs text-gray-600">Overwrite existing documentation with new versions</div>
          </div>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Max Retries per Object
          </label>
          <input
            type="number"
            min="0"
            max="5"
            value={options.maxRetries}
            onChange={(e) => setOptions({ ...options, maxRetries: parseInt(e.target.value) })}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent"
          />
          <p className="text-xs text-gray-600 mt-1">Number of retry attempts if generation fails</p>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleCreate}
        disabled={creating || !hasAPIKey || selectedObjectIds.length === 0 || checkingAPIKey}
        className={`
          w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
          ${creating || !hasAPIKey || selectedObjectIds.length === 0 || checkingAPIKey
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-[#2AB7A9] text-white hover:bg-[#238F85] hover:shadow-lg'
          }
        `}
      >
        {creating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Creating Job...
          </>
        ) : (
          <>
            <Zap className="h-5 w-5" />
            Generate Documentation
          </>
        )}
      </button>

      {selectedObjectIds.length === 0 && (
        <p className="text-center text-sm text-gray-500">
          Select at least one object to generate documentation
        </p>
      )}
    </div>
  );
}
