"use client";

import { useState } from "react";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";

interface AdminNavItem {
  id: string;
  label: string;
}

interface AdminMobileSidebarProps {
  navItems: AdminNavItem[];
  defaultActiveId?: string;
  userName: string;
  userRole: string;
}

export function AdminMobileSidebar({
  navItems,
  defaultActiveId = "overview",
  userName,
  userRole,
}: AdminMobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        type="button"
        className="admin-mobile-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay */}
      <div
        className={`admin-mobile-overlay ${isOpen ? "open" : ""}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`admin-sidebar ${isOpen ? "open" : ""}`}>
        <div className="admin-brand">
          <button
            type="button"
            onClick={closeSidebar}
            className="admin-sidebar-close-btn"
            style={{
              position: "absolute",
              top: "0.75rem",
              right: "0.75rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="admin-brand-title">Grand Sunshine</p>
          <p className="admin-brand-subtitle">Hospitality Admin v2</p>
        </div>

        <div className="admin-mobile-user" style={{ padding: "0.75rem", borderBottom: "1px solid #d7deea" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>{userName}</p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>{userRole}</p>
        </div>

        <AdminSidebarNav items={navItems} defaultActiveId={defaultActiveId} />
      </aside>
    </>
  );
}