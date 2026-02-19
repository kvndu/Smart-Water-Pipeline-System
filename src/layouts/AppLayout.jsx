import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";

export default function AppLayout() {
  return (
    <div className="appShell">
      <Sidebar />
      <main className="appMain">
        <Outlet />
      </main>
    </div>
  );
}
