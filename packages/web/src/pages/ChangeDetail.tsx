import { Link, useParams } from "react-router-dom";
import { useChange, useSpecs } from "../hooks/useOpenSpec";
import { TabView } from "../components/TabView";
import { TaskProgress } from "../components/TaskProgress";
import { MarkdownRenderer } from "../components/MarkdownRenderer";

export function ChangeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useChange(slug ?? "");
  const { data: specsData } = useSpecs();
  const specTopics = specsData?.map((s) => s.topic) ?? [];

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;
  if (!data) return <p className="text-text-muted">Change not found</p>;

  const tabs = [
    {
      id: "proposal",
      label: "Proposal",
      content: data.proposal ? (
        <MarkdownRenderer content={data.proposal} specTopics={specTopics} />
      ) : (
        <p className="text-text-muted text-sm">No content</p>
      ),
    },
    {
      id: "design",
      label: "Design",
      content: data.design ? (
        <MarkdownRenderer content={data.design} />
      ) : (
        <p className="text-text-muted text-sm">No content</p>
      ),
    },
    {
      id: "specs",
      label: "Specs",
      content:
        data.specs.length > 0 ? (
          <div className="space-y-6">
            {data.specs.map((spec) => (
              <div key={spec.topic}>
                <h3 className="text-sm font-semibold text-accent mb-2">{spec.topic}</h3>
                <MarkdownRenderer content={spec.content} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm">No delta specs</p>
        ),
    },
    {
      id: "tasks",
      label: "Tasks",
      content: data.tasks ? (
        <div className="space-y-4">
          <TaskProgress completed={data.tasks.completed} total={data.tasks.total} />
          <div className="space-y-4">
            {data.tasks.sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">{section.title}</h3>
                <div className="space-y-1">
                  {section.tasks.map((task, i) => (
                    <div key={i} className={`flex items-start gap-2 text-sm ${task.completed ? "opacity-60" : ""}`}>
                      {task.completed ? (
                        <svg className="w-4 h-4 mt-0.5 shrink-0 text-green-400" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.2" />
                          <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mt-0.5 shrink-0 text-text-muted" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                      <span className={task.completed ? "text-text-secondary line-through" : "text-text-primary"}>
                        {task.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-text-muted text-sm">No content</p>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/changes" className="text-text-muted text-base font-medium hover:text-accent transition-colors">
          &larr; Back to Changes
        </Link>
        <h1 className="text-2xl font-bold mt-2">{slug}</h1>
      </div>

      <TabView tabs={tabs} />
    </div>
  );
}
