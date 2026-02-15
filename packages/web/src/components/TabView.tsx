import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabViewProps {
  tabs: Tab[];
}

export function TabView({ tabs }: TabViewProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  const activeTab = tabs.find((t) => t.id === activeId);

  return (
    <div>
      <div className="flex border-b border-border mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              tab.id === activeId
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div key={activeId} className="animate-fade-in">
        {activeTab?.content}
      </div>
    </div>
  );
}
