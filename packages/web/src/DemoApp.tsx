import { useEffect, useMemo } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { RepoProvider, useRepo } from "./contexts/RepoContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ApiAdapterProvider } from "./api/ApiAdapterContext";
import { StaticAdapter } from "./api/StaticAdapter";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { SpecList } from "./pages/SpecList";
import { SpecDetail } from "./pages/SpecDetail";
import { ChangeList } from "./pages/ChangeList";
import { ChangeDetail } from "./pages/ChangeDetail";

const router = createHashRouter([
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
]);

function DemoAppInner() {
  const { setRepoPath } = useRepo();
  const adapter = useMemo(() => new StaticAdapter(), []);

  // Layout 需要 repoPath 才會渲染，設一個固定值
  useEffect(() => {
    setRepoPath("demo");
  }, [setRepoPath]);

  return (
    <ApiAdapterProvider adapter={adapter}>
      <RouterProvider router={router} />
    </ApiAdapterProvider>
  );
}

export function DemoApp() {
  return (
    <ThemeProvider>
      <RepoProvider>
        <DemoAppInner />
      </RepoProvider>
    </ThemeProvider>
  );
}
