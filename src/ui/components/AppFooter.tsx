import { useEffect, useState } from 'react';

export function AppFooter() {
  const [buildInfo, setBuildInfo] = useState<{
    version: string;
    commit: string;
    commitShort: string;
  } | null>(null);

  useEffect(() => {
    // Get build info from Electron main process
    window.electron.invoke('get-build-info').then(setBuildInfo);
  }, []);

  if (!buildInfo) return null;

  return (
    <div className="fixed bottom-0 left-[280px] right-0 h-6 bg-surface-secondary/80 backdrop-blur-sm border-t border-ink-900/10 flex items-center justify-center px-4 text-xs text-muted select-none z-10">
      <div className="flex items-center gap-3">
        <span className="font-medium">LocalDesk v{buildInfo.version}</span>
        <span className="text-ink-400">•</span>
        <span className="font-mono" title={`Commit: ${buildInfo.commit}`}>
          {buildInfo.commitShort}
        </span>
      </div>
    </div>
  );
}
