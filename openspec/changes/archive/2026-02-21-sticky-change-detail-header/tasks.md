## 1. TabView 元件擴充

- [x] 1.1 在 TabView 新增可選 `header` (ReactNode) 和 `sticky` (boolean) props
- [x] 1.2 當 `sticky` 為 true 時，將 header + tab bar 包在 `sticky top-14 z-[5] bg-bg-primary -mx-6 px-6` 容器中
- [x] 1.3 非 sticky 模式維持原有行為不變

## 2. ChangeDetail 頁面調整

- [x] 2.1 將 change 標題（返回連結 + slug 標題）移至 TabView 的 `header` prop
- [x] 2.2 為 TabView 加上 `sticky` prop

## 3. 驗證

- [x] 3.1 確認 type-check 通過
- [x] 3.2 手動驗證：長內容捲動時標題和 tab bar 固定在 header 下方
- [x] 3.3 手動驗證：sticky 背景色正確遮住捲動內容，z-index 不與 header/sidebar 衝突
