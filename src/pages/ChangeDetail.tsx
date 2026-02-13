import { Link, useParams } from "react-router-dom";
import { useChange } from "../hooks/useOpenSpec";
import { TabView } from "../components/TabView";
import { TaskProgress } from "../components/TaskProgress";

export function ChangeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data, loading, error } = useChange(slug ?? "");

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;
  if (!data) return <p className="text-text-muted">Change not found</p>;

  const tabs = [
    {
      id: "proposal",
      label: "Proposal",
      content: data.proposal ? (
        <pre className="bg-bg-secondary border border-border rounded p-4 text-sm text-text-primary whitespace-pre-wrap overflow-x-auto leading-relaxed">
          {data.proposal}
        </pre>
      ) : (
        <p className="text-text-muted text-sm">No content</p>
      ),
    },
    {
      id: "design",
      label: "Design",
      content: data.design ? (
        <pre className="bg-bg-secondary border border-border rounded p-4 text-sm text-text-primary whitespace-pre-wrap overflow-x-auto leading-relaxed">
          {data.design}
        </pre>
      ) : (
        <p className="text-text-muted text-sm">No content</p>
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
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={task.completed ? "text-green-400" : "text-text-muted"}>
                        {task.completed ? "[x]" : "[ ]"}
                      </span>
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
    {
      id: "specs",
      label: "Specs",
      content:
        data.specs.length > 0 ? (
          <div className="space-y-6">
            {data.specs.map((spec) => (
              <div key={spec.topic}>
                <h3 className="text-sm font-semibold text-accent mb-2">{spec.topic}</h3>
                <pre className="bg-bg-secondary border border-border rounded p-4 text-sm text-text-primary whitespace-pre-wrap overflow-x-auto leading-relaxed">
                  {spec.content}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm">No delta specs</p>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/changes" className="text-text-muted text-sm hover:text-accent transition-colors">
          &larr; Back to Changes
        </Link>
        <h1 className="text-2xl font-bold mt-2">{slug}</h1>
      </div>

      <TabView tabs={tabs} />
    </div>
  );
}
