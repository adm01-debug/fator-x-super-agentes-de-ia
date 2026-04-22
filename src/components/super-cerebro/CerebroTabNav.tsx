/**
 * Super Cérebro v2 — 8-Tab Navigation
 * The Enterprise Memory Layer that no competitor has.
 */

import { useCerebroStore } from '@/stores/cerebroStore';
import { CEREBRO_TABS } from './cerebroTabs.constants';

export function CerebroTabNav() {
  const { activeTab, setActiveTab } = useCerebroStore();

  return (
    <div className="flex gap-1 overflow-x-auto pb-2 border-b border-border mb-6">
      {CEREBRO_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all
            ${
              activeTab === tab.id
                ? 'bg-primary/5 text-primary border border-primary/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-card'
            }
          `}
          title={tab.description}
        >
          <span>{tab.icon}</span>
          <span className="hidden md:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export default CerebroTabNav;
