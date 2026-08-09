import { MarkdownRenderer } from "./MarkdownRenderer";
import type { FoldOptions } from "../utils/foldSections";

interface SpecsTabContentProps {
  specs: { topic: string; content: string }[];
  // 一份 change 的 delta spec 跟它修改的 spec 是同一種文件，摺疊規則必須相同
  fold?: FoldOptions;
}

// Change 的 Specs tab：多份 delta spec 合併渲染。
// 每份 spec 的 heading id 以 `<topic>--` 為前綴，避免不同 spec 間 slug 衝突
// （例如兩 spec 同時有 `### Requirement: Foo`）。
export function SpecsTabContent({ specs, fold }: SpecsTabContentProps) {
  return (
    <div className="space-y-6">
      {specs.map((spec) => (
        <section key={spec.topic} id={`spec-${spec.topic}`}>
          <h3 className="text-sm font-semibold text-accent mb-2">{spec.topic}</h3>
          <MarkdownRenderer content={spec.content} idPrefix={`${spec.topic}--`} fold={fold} />
        </section>
      ))}
    </div>
  );
}
