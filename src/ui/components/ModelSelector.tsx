import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ApiSettings, ModelInfo } from "../types";

interface ModelSelectorProps {
  selectedModel: string | null;
  onModelChange: (model: string | null) => void;
  availableModels: ModelInfo[];
  apiSettings: ApiSettings | null;
  placeholder?: string;
  className?: string;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  availableModels,
  apiSettings,
  placeholder = "Select model...",
  className = ""
}: ModelSelectorProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter models by search query
  const filteredModels = searchQuery
    ? availableModels.filter(model => model.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : availableModels;

  const displayModel = selectedModel || apiSettings?.model || placeholder;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={`w-full rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors text-left flex items-center justify-between ${className}`}>
        <span className="truncate">{displayModel}</span>
        <svg className="w-4 h-4 text-muted shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="z-50 min-w-[300px] max-w-[400px] rounded-xl border border-ink-900/10 bg-white p-1 shadow-lg max-h-80 overflow-y-auto" sideOffset={8}>
          {availableModels.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted">No models available. Check your API settings.</div>
          ) : (
            <>
              <div className="p-2 border-b border-ink-900/10 relative">
                <input
                  type="text"
                  placeholder="Filter models..."
                  className="w-full rounded-lg border border-ink-900/10 bg-surface-secondary pl-9 pr-3 py-1.5 text-sm text-ink-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                  onChange={ (e) => setSearchQuery(e.target.value.toLowerCase()) }
                  value={ searchQuery }
                  onClick={ (e) => e.stopPropagation() }
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted">
                  <path stroke-linecap="round" stroke-linejoin="round"
                        d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"/>
                </svg>
              </div>
              { filteredModels.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted">No models found.</div>
              ) : (
                filteredModels.map((model) => (
                  <DropdownMenu.Item
                    key={ model.id }
                    className="flex flex-col cursor-pointer rounded-lg px-3 py-2 text-sm text-ink-700 outline-none hover:bg-ink-900/5"
                    onSelect={ () => {
                      onModelChange(model.id)
                      setSearchQuery('');
                    }}
                  >
                    <span className="font-medium truncate">{model.name}</span>
                    {model.description && (
                      <span className="text-xs text-muted truncate">{model.description}</span>
                    )}
                  </DropdownMenu.Item>
                ))
              )}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
