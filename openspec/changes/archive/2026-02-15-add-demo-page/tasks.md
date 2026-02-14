## 1. StaticAdapter

- [x] 1.1 Create `packages/web/src/api/StaticAdapter.ts` — 實作 `ApiAdapter`，從 `window.__DEMO_DATA__` 讀取資料，search 用字串比對

## 2. Demo Entry Point

- [x] 2.1 Create `packages/web/src/DemoApp.tsx` — 仿 WebviewApp，使用 HashRouter + StaticAdapter
- [x] 2.2 Create `packages/web/src/main.demo.tsx` — demo 進入點
- [x] 2.3 Create `packages/web/index.demo.html` — demo HTML template

## 3. Vite Config

- [x] 3.1 Create `packages/web/vite.demo.config.ts` — IIFE 打包，仿 vite.webview.config.ts

## 4. Build Script

- [x] 4.1 Create `scripts/build-demo.ts` — 用 @spek/core 收集資料，執行 vite build，組裝 inline 單檔 HTML 到 `docs/demo.html`
- [x] 4.2 在 root `package.json` 新增 `build:demo` script

## 5. Verification

- [x] 5.1 執行 `npm run build:demo` 驗證產出正常，在瀏覽器開啟 `docs/demo.html` 確認功能完整
