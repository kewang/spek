import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { RepoProvider } from "./contexts/RepoContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";
import { SelectRepo } from "./pages/SelectRepo";
import { Dashboard } from "./pages/Dashboard";
import { SpecList } from "./pages/SpecList";
import { SpecDetail } from "./pages/SpecDetail";
import { ChangeList } from "./pages/ChangeList";
import { ChangeDetail } from "./pages/ChangeDetail";

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
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider>
      <RepoProvider>
        <RouterProvider router={router} />
      </RepoProvider>
    </ThemeProvider>
  );
}
