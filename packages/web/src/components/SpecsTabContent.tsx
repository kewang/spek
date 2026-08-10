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
          {/*
            Topic 是這一段的容器，排版上就必須壓過它所包住的內容。原本是 text-sm 的 h3，卻夾著
            markdown 自己吐出的 text-xl h2 —— 不只更輕，而且身為 h3 又和那些 h2 是兄弟，
            大綱上不是包住它們而是被第一個 h2 終止，底下的 requirement 於是不屬於任何 topic。
            升成 h2 並拿回分隔線：多份 spec 疊在同一頁時，這條線就是 spec 之間的邊界。
          */}
          <h2 className="text-xl font-bold text-accent mb-3 pb-2 border-b border-border">{spec.topic}</h2>
          <MarkdownRenderer content={spec.content} idPrefix={`${spec.topic}--`} fold={fold} specShaped />
        </section>
      ))}
    </div>
  );
}
