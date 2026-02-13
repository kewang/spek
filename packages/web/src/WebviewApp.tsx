import { useEffect, useMemo, useState } from "react";
import {
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { RepoProvider, useRepo } from "./contexts/RepoContext";
import { ThemeProvider, useThemeControl } from "./contexts/ThemeContext";
import { ApiAdapterProvider } from "./api/ApiAdapterContext";
import { MessageAdapter } from "./api/MessageAdapter";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { SpecList } from "./pages/SpecList";
import { SpecDetail } from "./pages/SpecDetail";
import { ChangeList } from "./pages/ChangeList";
import { ChangeDetail } from "./pages/ChangeDetail";

// Webview 使用 MemoryRouter（沒有真正的 URL）
const router = createMemoryRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/specs", element: <SpecList /> },
      { path: "/specs/:topic", element: <SpecDetail /> },
      { path: "/changes", element: <ChangeList /> },
      { path: "/changes/:slug", element: <ChangeDetail /> },
    ],
  },
], {
  initialEntries: ["/dashboard"],
});

function WebviewAppInner() {
  const { setRepoPath } = useRepo();
  const { setTheme } = useThemeControl();
  const adapter = useMemo(() => new MessageAdapter(), []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;

      if (msg.type === "init") {
        // 收到 workspace path，設定 repo 並標記 ready
        if (msg.workspacePath) {
          setRepoPath(msg.workspacePath);
        }
        if (msg.theme) {
          setTheme(msg.theme);
        }
        setReady(true);
      }

      if (msg.type === "themeChange") {
        setTheme(msg.theme);
      }

      if (msg.type === "openSearch") {
        // 觸發搜尋快捷鍵
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true }),
        );
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setRepoPath, setTheme]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary text-text-muted">
        Loading spek...
      </div>
    );
  }

  return (
    <ApiAdapterProvider adapter={adapter}>
      <RouterProvider router={router} />
    </ApiAdapterProvider>
  );
}

export function WebviewApp() {
  return (
    <ThemeProvider>
      <RepoProvider>
        <WebviewAppInner />
      </RepoProvider>
    </ThemeProvider>
  );
}
