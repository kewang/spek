/**
 * 顏色契約。
 *
 * 這個套件的所有顏色都經由這 8 個 CSS 變數表達，`styles.css` 為它們宣告了深色預設值。
 * **宿主換膚 = 在自己的 `:root` 覆寫它們**，不需要用 Tailwind，也不需要與套件共用任何 token 命名。
 *
 * 這些元件原本讀的是 spek web 的 Tailwind token（`--color-border` / `--color-text-primary` …）。
 * 那對 web 以外的宿主是行不通的 —— 下游 Electron app 的 token 叫 `--color-ink` / `--color-accent`，
 * 名字對不上，圖會**完全沒有顏色**。所以套件必須擁有自己的變數名。
 */
export const CSS_VARS = {
  bgPrimary: "--spek-bg-primary",
  bgSecondary: "--spek-bg-secondary",
  bgTertiary: "--spek-bg-tertiary",
  border: "--spek-border",
  textPrimary: "--spek-text-primary",
  textSecondary: "--spek-text-secondary",
  textMuted: "--spek-text-muted",
  accent: "--spek-accent",
  nodeActive: "--spek-node-active",
} as const;

/** `styles.css` 未被載入時的最後防線 —— 讓圖至少畫得出來，而不是一片黑。 */
const FALLBACKS: Record<string, string> = {
  [CSS_VARS.bgPrimary]: "#0a0c0f",
  [CSS_VARS.bgSecondary]: "#111318",
  [CSS_VARS.bgTertiary]: "#1a1d24",
  [CSS_VARS.border]: "#2a2d35",
  [CSS_VARS.textPrimary]: "#e2e8f0",
  [CSS_VARS.textSecondary]: "#94a3b8",
  [CSS_VARS.textMuted]: "#8595aa",
  [CSS_VARS.accent]: "#f59e0b",
  [CSS_VARS.nodeActive]: "#22c55e",
};

/**
 * 解出一個顏色變數的當下值。
 *
 * d3 是命令式的 —— 它把顏色寫進 SVG 屬性，不能用 `var()`。因此力導向圖必須在繪製當下把變數解出來
 * （宿主換膚時要重繪，見 `SpecGraph` 的 `themeKey`）。React 渲染的部分則直接用 `var()`，不走這裡。
 */
export function resolveColor(name: string): string {
  // The last resort is a contract value, not a literal: a colour written here would be one more thing a
  // host cannot reach, which is the defect this contract exists to prevent.
  const lastResort = FALLBACKS[CSS_VARS.textSecondary];
  if (typeof document === "undefined") return FALLBACKS[name] ?? lastResort;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || FALLBACKS[name] || lastResort;
}
