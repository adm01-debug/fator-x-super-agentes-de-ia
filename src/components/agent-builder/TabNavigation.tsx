import { useRef, useEffect } from 'react';
import { TABS } from '@/data/agentBuilderData';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { cn } from '@/lib/utils';

export function TabNavigation() {
  const { activeTab, setActiveTab } = useAgentBuilderStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      className="flex gap-0.5 overflow-x-auto px-3 border-b scrollbar-hide"
      style={{ borderColor: 'hsl(var(--nexus-border))' }}
      role="tablist"
      aria-label="Módulos do agente"
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all duration-200 border-b-2 shrink-0',
              isActive
                ? 'text-primary border-primary bg-primary/5 font-bold'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30'
            )}
          >
            <span className="text-sm">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
