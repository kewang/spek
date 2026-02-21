import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabViewProps {
  tabs: Tab[];
  header?: React.ReactNode;
  sticky?: boolean;
}

export function TabView({ tabs, header, sticky }: TabViewProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");

  const activeTab = tabs.find((t) => t.id === activeId);

  const tabBar = (
    <>
      {header}
      <div className="flex border-b border-border">
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
    </>
  );

  return (
    <div>
      {sticky ? (
        <div className="sticky top-14 z-[5] bg-bg-primary -mx-6 px-6 pb-px">
          {tabBar}
        </div>
      ) : (
        <div className="mb-4">{tabBar}</div>
      )}
      <div key={activeId} className={`animate-fade-in ${sticky ? "mt-4" : ""}`}>
        {activeTab?.content}
      </div>
    </div>
  );
}
