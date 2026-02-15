## Why

P0+P1 設計修正後，仍有多項 P2 級別的 UI/UX 問題影響使用體驗：頁面標題緊貼 navbar 缺乏呼吸空間、Change Detail tab 順序與 OpenSpec 實際工作流程不符、返回導航字體偏小且缺乏層級感、各列表頁信息密度不足、tab 切換缺少過渡動畫等。這些改善將顯著提升瀏覽體驗的流暢度與專業感。

## What Changes

- 增加主內容區的頂部間距，讓 h1 不再緊貼 navbar
- 修正 Change Detail tab 排列順序為 Proposal → Design → Specs → Tasks（符合 OpenSpec 工作流程）
- 放大「← Back to Specs/Changes」返回連結字體，增強可點擊性
- Change Detail tab 切換加入 fade 過渡動畫
- Specs/Changes 列表加入內容摘要或副標題，提高信息密度
- 搜尋結果加入匹配文字高亮、分類 filter、空狀態改善
- Active/Archived changes 加入更明顯的視覺區隔
- Tasks checkbox 使用自訂樣式取代原生外觀，已完成項加入淡化效果

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `shared-layout`: 增加主內容區頂部間距（h1 與 navbar 之間的空間）
- `change-browsing`: 修正 tab 順序、加入 tab 切換動畫、改善返回連結樣式、Active/Archived 視覺區隔、tasks checkbox 自訂樣式
- `spec-browsing`: 改善返回連結樣式、列表加入摘要預覽
- `search-ui`: 搜尋結果匹配高亮、分類 filter、空狀態改善

## Impact

- 前端元件：Layout.tsx、ChangeDetail.tsx、SpecDetail.tsx、SpecList.tsx、ChangeList.tsx、TabView.tsx、SearchDialog.tsx
- 無 API 變更、無 breaking changes
- 可能需要新的 CSS 動畫 keyframes
- Demo 頁面會自動受益（共用同一套元件）
