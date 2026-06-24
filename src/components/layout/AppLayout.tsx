import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="layout-container">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="page-scroll-area">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
