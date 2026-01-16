import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { ApiSettings } from "../types";

type SettingsModalProps = {
  onClose: () => void;
  onSave: (settings: ApiSettings) => void;
  currentSettings: ApiSettings | null;
};

export function SettingsModal({ onClose, onSave, currentSettings }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(currentSettings?.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(currentSettings?.baseUrl || "");
  const [model, setModel] = useState(currentSettings?.model || "");
  const [temperature, setTemperature] = useState(currentSettings?.temperature?.toString() || "0.3");
  const [tavilyApiKey, setTavilyApiKey] = useState(currentSettings?.tavilyApiKey || "");
  const [permissionMode, setPermissionMode] = useState<'default' | 'ask'>(currentSettings?.permissionMode || 'ask');
  const [enableMemory, setEnableMemory] = useState(currentSettings?.enableMemory || false);
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTavilyPassword, setShowTavilyPassword] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      setApiKey(currentSettings.apiKey || "");
      setBaseUrl(currentSettings.baseUrl || "");
      setModel(currentSettings.model || "");
      setTemperature(currentSettings.temperature?.toString() || "0.3");
      setTavilyApiKey(currentSettings.tavilyApiKey || "");
      setPermissionMode(currentSettings.permissionMode || 'ask');
      setEnableMemory(currentSettings.enableMemory || false);
    }
  }, [currentSettings]);

  // Load memory content when modal opens and memory is enabled
  useEffect(() => {
    if (enableMemory) {
      loadMemoryContent();
    }
  }, [enableMemory]);

  const loadMemoryContent = async () => {
    setMemoryLoading(true);
    try {
      const content = await window.electron.invoke('read-memory');
      setMemoryContent(content || "");
    } catch (error) {
      console.error('Failed to load memory:', error);
      setMemoryContent("");
    } finally {
      setMemoryLoading(false);
    }
  };

  const saveMemoryContent = async () => {
    try {
      await window.electron.invoke('write-memory', memoryContent);
    } catch (error) {
      console.error('Failed to save memory:', error);
    }
  };

  const handleSave = async () => {
    const tempValue = parseFloat(temperature);
    
    // Save memory content if changed
    if (enableMemory) {
      await saveMemoryContent();
    }
    
    onSave({
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      temperature: !isNaN(tempValue) ? tempValue : 0.3,
      tavilyApiKey: tavilyApiKey.trim() || undefined,
      permissionMode,
      enableMemory
    });
    onClose();
  };

  const handleReset = () => {
    setApiKey("");
    setBaseUrl("");
    setModel("");
    setTemperature("0.3");
    setTavilyApiKey("");
    setPermissionMode('ask');
    setEnableMemory(false);
  };

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[90vh] rounded-2xl border border-ink-900/10 bg-surface shadow-2xl flex flex-col">
          <div className="px-6 pt-6 pb-4 border-b border-ink-900/10">
            <Dialog.Title className="text-xl font-semibold text-ink-900">
              API Settings
            </Dialog.Title>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="w-full px-4 py-2.5 pr-10 text-sm border border-ink-900/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-700"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="e.g., https://api.example.com"
                className="w-full px-4 py-2.5 text-sm border border-ink-900/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Model Name
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., claude-3-5-sonnet-20241022"
                className="w-full px-4 py-2.5 text-sm border border-ink-900/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Temperature
              </label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="0.3"
                className="w-full px-4 py-2.5 text-sm border border-ink-900/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/20 transition-all"
              />
              <p className="mt-1 text-xs text-ink-500">
                Lower = more focused (0.0-1.0 recommended for code, default: 0.3)
              </p>
            </div>

            <div className="border-t border-ink-900/10 pt-4">
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Tavily API Key (Optional)
                <span className="ml-2 text-xs font-normal text-ink-500">For web search</span>
              </label>
              <div className="relative">
                <input
                  type={showTavilyPassword ? "text" : "password"}
                  value={tavilyApiKey}
                  onChange={(e) => setTavilyApiKey(e.target.value)}
                  placeholder="tvly-... (optional)"
                  className="w-full px-4 py-2.5 pr-10 text-sm border border-ink-900/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowTavilyPassword(!showTavilyPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-700"
                >
                  {showTavilyPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                Get your API key at <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="text-ink-700 hover:underline">tavily.com</a>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Permission Mode
              </label>
              <select
                value={permissionMode}
                onChange={(e) => setPermissionMode(e.target.value as 'default' | 'ask')}
                className="w-full px-4 py-2.5 text-sm border border-ink-900/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ink-900/20 transition-all"
              >
                <option value="default">Auto-execute (default)</option>
                <option value="ask">Ask before each tool</option>
              </select>
              <p className="mt-1 text-xs text-ink-500">
                Choose whether tools execute automatically or require confirmation
              </p>
            </div>

            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex-1">
                  <span className="block text-sm font-medium text-ink-700">Enable Memory</span>
                  <p className="mt-1 text-xs text-ink-500">
                    Allow agent to store and recall information in memory.md (stored in ~/.localdesk/)
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={enableMemory}
                    onChange={(e) => setEnableMemory(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-ink-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-ink-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </div>
              </label>
              {enableMemory && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-ink-700">
                      Memory Content
                    </label>
                    <button
                      onClick={loadMemoryContent}
                      disabled={memoryLoading}
                      className="text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      {memoryLoading ? "Loading..." : "Reload"}
                    </button>
                  </div>
                  <textarea
                    value={memoryContent}
                    onChange={(e) => setMemoryContent(e.target.value)}
                    placeholder="Memory is empty. Agent will automatically add information here during conversations..."
                    className="w-full h-32 px-3 py-2 text-xs border border-ink-900/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none font-mono"
                  />
                  <p className="mt-1 text-xs text-ink-500">
                    File: <code className="bg-ink-50 px-1 py-0.5 rounded">~/.localdesk/memory.md</code>
                  </p>
                </div>
              )}
            </div>

          </div>

          <div className="px-6 py-4 border-t border-ink-900/10 flex gap-3">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-ink-600 bg-ink-50 rounded-lg hover:bg-ink-100 transition-colors"
            >
              Reset to Default
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-ink-600 bg-ink-50 rounded-lg hover:bg-ink-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-ink-900 rounded-lg hover:bg-ink-800 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
