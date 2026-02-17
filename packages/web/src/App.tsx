import { useMemo } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RepoProvider, useRepo } from "./contexts/RepoContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ApiAdapterProvider } from "./api/ApiAdapterContext";
import { FetchAdapter } from "./api/FetchAdapter";
import { Layout } from "./components/Layout";
import { SelectRepo } from "./pages/SelectRepo";
import { Dashboard } from "./pages/Dashboard";
import { SpecList } from "./pages/SpecList";
import { SpecDetail } from "./pages/SpecDetail";
import { ChangeList } from "./pages/ChangeList";
import { ChangeDetail } from "./pages/ChangeDetail";
import { GraphView } from "./pages/GraphView";

const router = createBrowserRouter([
  {
    path: "/",
    element: <SelectRepo />,
  },
  {
    element: <Layout />,
    children: [
      { path: "/dashboard", element: <Dashboard /> },
      { path: "/specs", element: <SpecList /> },
      { path: "/specs/:topic", element: <SpecDetail /> },
      { path: "/changes", element: <ChangeList /> },
      { path: "/changes/:slug", element: <ChangeDetail /> },
      { path: "/graph", element: <GraphView /> },
    ],
  },
]);

function AppWithAdapter() {
  const { repoPath } = useRepo();
  const adapter = useMemo(() => new FetchAdapter(repoPath), [repoPath]);

  return (
    <ApiAdapterProvider adapter={adapter}>
      <RouterProvider router={router} />
    </ApiAdapterProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <RepoProvider>
        <AppWithAdapter />
      </RepoProvider>
    </ThemeProvider>
  );
}
