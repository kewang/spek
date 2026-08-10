import { useMemo, useState, useEffect } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { RepoProvider, useRepo } from "./contexts/RepoContext";
import { ThemeProvider, useThemeControl } from "./contexts/ThemeContext";
import { RefreshProvider, useRefresh } from "./contexts/RefreshContext";
import { AggregationScopeProvider } from "./contexts/AggregationScopeContext";
import { ApiAdapterProvider } from "./api/ApiAdapterContext";
import { FetchAdapter } from "./api/FetchAdapter";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { SpecList } from "./pages/SpecList";
import { SpecDetail } from "./pages/SpecDetail";
import { ChangeList } from "./pages/ChangeList";
import { ChangeDetail } from "./pages/ChangeDetail";
import { GraphView } from "./pages/GraphView";
import { SchemaList } from "./pages/SchemaList";
import { SchemaDetail } from "./pages/SchemaDetail";
import { TimelinePage } from "./pages/TimelinePage";

// 從 URL query params 讀取 config（由 IntelliJ plugin 注入）
function getUrlParam(name: string): string {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}

const INTELLIJ_PROJECT_PATH = getUrlParam("projectPath");
const INTELLIJ_API_BASE = getUrlParam("apiBase");
const INTELLIJ_THEME = getUrlParam("theme") || "dark";

// URL hash 可作為初始路由（fallback 外部瀏覽器導覽用）
const initialPath = window.location.hash
  ? window.location.hash.slice(1)
  : "/dashboard";

const router = createMemoryRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: "/", element: <Dashboard /> },
        { path: "/dashboard", element: <Dashboard /> },
        { path: "/specs", element: <SpecList /> },
        { path: "/specs/:topic", element: <SpecDetail /> },
        { path: "/changes", element: <ChangeList /> },
        { path: "/changes/:slug", element: <ChangeDetail /> },
        { path: "/graph", element: <GraphView /> },
        { path: "/schemas", element: <SchemaList /> },
        { path: "/schemas/:name", element: <SchemaDetail /> },
        { path: "/timeline", element: <TimelinePage /> },
      ],
    },
  ],
  {
    initialEntries: [initialPath],
  },
);

function IntellijAppInner() {
  const { setRepoPath } = useRepo();
  const { setTheme } = useThemeControl();
  const refresh = useRefresh();
  const [ready, setReady] = useState(false);

  const adapter = useMemo(() => {
    return new FetchAdapter(INTELLIJ_PROJECT_PATH, {
      baseUrl: INTELLIJ_API_BASE,
      dirParam: "projectPath",
    });
  }, []);

  useEffect(() => {
    if (INTELLIJ_PROJECT_PATH) {
      setRepoPath(INTELLIJ_PROJECT_PATH);
    }

    setTheme(INTELLIJ_THEME as "dark" | "light");
    document.documentElement.classList.add(INTELLIJ_THEME);

    setReady(true);

    // 監聽 spek 自訂事件（由 JCEF executeJavaScript 觸發）
    const handleRefresh = () => {
      refresh();
    };
    const handleNavigate = (e: Event) => {
      const path = (e as CustomEvent).detail?.path;
      if (path) router.navigate(path);
    };
    const handleThemeChange = (e: Event) => {
      const theme = (e as CustomEvent).detail?.theme;
      if (theme) setTheme(theme);
    };

    window.addEventListener("spek:fileChanged", handleRefresh);
    window.addEventListener("spek:navigate", handleNavigate);
    window.addEventListener("spek:themeChange", handleThemeChange);

    return () => {
      window.removeEventListener("spek:fileChanged", handleRefresh);
      window.removeEventListener("spek:navigate", handleNavigate);
      window.removeEventListener("spek:themeChange", handleThemeChange);
    };
  }, [setRepoPath, setTheme, refresh]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary text-text-muted">
        Loading spek...
      </div>
    );
  }

  return (
    <ApiAdapterProvider adapter={adapter}>
      <AggregationScopeProvider>
        <RouterProvider router={router} />
      </AggregationScopeProvider>
    </ApiAdapterProvider>
  );
}

export function IntellijApp() {
  return (
    <ThemeProvider>
      <RepoProvider>
        <RefreshProvider>
          <IntellijAppInner />
        </RefreshProvider>
      </RepoProvider>
    </ThemeProvider>
  );
}
