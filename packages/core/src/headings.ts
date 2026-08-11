export interface Heading {
  level: 2 | 3;
  text: string;
  slug: string;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// OpenSpec 的 spec 格式關鍵字。大小寫敏感、只認行首 —— 見 specHeadingLabel。
const SPEC_HEADING_KEYWORD_RE = /^(?:Requirement|Scenario):[ \t]*/;

/**
 * 一個 spec 標題要顯示成什麼：把開頭的格式關鍵字（`Requirement:` / `Scenario:`）拿掉。
 *
 * 純顯示用。`Heading.text` 是檔案裡寫的字，`Heading.slug` 由 text 推導，而這個 label 是第三個值，
 * **不會有任何東西從它推導** —— 特別是 slug：slug 餵養每一個錨點，用 label 算 slug 等於無聲地讓所有
 * 既有深連結失效。`extractHeadings` 因此刻意不呼叫這裡。
 *
 * 參數必須是**完整**的標題文字。呼叫端手上都有整行，而這裡的兩個判斷（有沒有關鍵字、拿掉之後還剩
 * 不剩東西）只有在看得到全文時才會對：`Requirement: \`@spekjs/ui\` package exports …` 的第一段純文字
 * 恰好就是 `"Requirement: "`，只看那一段會判定「拿掉就沒東西了」而放棄，於是內文保留關鍵字、而讀整行
 * 的 TOC 照剝 —— 兩個介面對同一個標題講不同的話，正是把規則收斂到這裡要防的事。
 *
 * 移除的範圍精確到「關鍵字 + 冒號 + 緊接的空白」，尾端不 trim：標題會繼續接到 label 帶不走的 markup
 * 上，`Requirement: The \`foo\` flag` 的文字段結尾那個空格一旦被 trim 掉，code span 就會黏在前一個字。
 */
export function specHeadingLabel(text: string): string {
  const match = SPEC_HEADING_KEYWORD_RE.exec(text);
  if (!match) return text;
  const rest = text.slice(match[0].length);
  // 只剩關鍵字的標題沒有別的名字可顯示，原樣留著。
  if (rest.trim() === "") return text;
  return rest;
}

const HEADING_RE = /^(#{2,3})\s+(.+?)\s*$/;
const FENCE_RE = /^(`{3,}|~{3,})/;

export function extractHeadings(content: string): Heading[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const headings: Heading[] = [];
  const slugCounts = new Map<string, number>();
  let fence: string | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      const marker = fenceMatch[1][0].repeat(3);
      if (fence === null) {
        fence = marker;
      } else if (line.trimStart().startsWith(fence)) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;

    const match = line.match(HEADING_RE);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].trim();
    const baseSlug = slugifyHeading(text);
    if (!baseSlug) continue;
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    headings.push({ level, text, slug });
  }

  return headings;
}
