import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WebviewApp } from "./WebviewApp";
import "./styles/global.css";

// acquireVsCodeApi 只能呼叫一次，存到全域供 MessageAdapter 使用
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscodeApi = acquireVsCodeApi();
(window as unknown as Record<string, unknown>).__vscodeApi = vscodeApi;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebviewApp />
  </StrictMode>,
);

// 通知 extension host 我們已經 ready
vscodeApi.postMessage({ type: "ready" });
