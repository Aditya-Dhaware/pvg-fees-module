import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  RefreshCw,
  Receipt,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";

export default function AdminLayout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  const handleLogout = async () => {
    await logout();
    window.location.href = process.env.REACT_APP_AUTH_FRONTEND_URL || "/";
  };

  const navItems = [
    {
      key: "dashboard",
      label: "Dashboard",
      path: "/admin",
      icon: LayoutDashboard,
    },
    { key: "bills", label: "Bills", path: "/admin/bills", icon: FileText },
    {
      key: "payments",
      label: "Payments",
      path: "/admin/payments",
      icon: CreditCard,
    },
    {
      key: "refunds",
      label: "Refunds",
      path: "/admin/refunds",
      icon: RefreshCw,
    },
    {
      key: "receipts",
      label: "Receipts",
      path: "/admin/receipts",
      icon: Receipt,
    },
  ];

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close sidebar on route change (for mobile)
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  return (
    <div
      className={`erp-admin-wrapper ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
    >
      {/* Overlay — shown on mobile when sidebar is open */}
      {isMobile && isSidebarOpen && (
        <div
          className="erp-sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 99,
            backdropFilter: "blur(4px)",
          }}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="erp-sidebar"
        style={{
          position: isMobile ? "fixed" : "sticky",
          top: 0,
          left: 0,
          bottom: 0,
          height: isMobile ? "100vh" : "100vh",
          zIndex: 100,
          width: "260px",
          flexShrink: 0,
          alignSelf: "flex-start",
          transform: isSidebarOpen ? "translateX(0)" : "translateX(-260px)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div className="erp-sidebar__brand">
          <div
            style={{
              background: "linear-gradient(135deg, white, #f1f5f9)",
              borderRadius: "12px",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              flexShrink: 0,
            }}
          >
            <ShieldCheck color="var(--erp-primary)" size={24} />
          </div>
          <div className="erp-sidebar__brand-text" style={{ marginLeft: 12, overflow: "hidden" }}>
            <h2
              style={{
                fontSize: "1.125rem",
                fontWeight: "800",
                letterSpacing: "-0.025em",
                whiteSpace: "nowrap",
              }}
            >
              PVGCOSC
            </h2>
            <span style={{ fontSize: "0.75rem", opacity: 0.8, whiteSpace: "nowrap" }}>
              Fees & Billing
            </span>
          </div>
          {isMobile && (
            <button
              className="erp-sidebar__close-btn"
              onClick={() => setIsSidebarOpen(false)}
              style={{
                marginLeft: "auto",
                flexShrink: 0,
                background: "none",
                border: "none",
                color: "white",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="erp-sidebar__nav">
          <div
            className="erp-nav-label"
            style={{
              opacity: 0.5,
              fontSize: "0.65rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              padding: "0 12px 12px",
              whiteSpace: "nowrap",
            }}
          >
            Main Menu
          </div>
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/admin" &&
                location.pathname.startsWith(item.path));
            return (
              <Link
                to={item.path}
                key={item.key}
                className={`erp-nav-item ${isActive ? "erp-nav-item--active" : ""}`}
                style={{
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  borderRadius: "10px",
                  margin: "2px 0",
                  whiteSpace: "nowrap",
                }}
              >
                <item.icon size={18} style={{ marginRight: "12px", flexShrink: 0 }} />
                <span
                  className="erp-nav-item__text"
                  style={{ fontWeight: isActive ? "700" : "500" }}
                >
                  {item.label}
                </span>
                {isActive && (
                  <div
                    style={{
                      marginLeft: "auto",
                      width: "4px",
                      height: "16px",
                      backgroundColor: "white",
                      borderRadius: "4px",
                      flexShrink: 0,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div
          className="erp-sidebar__footer"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="erp-avatar erp-avatar--md bg-white/10 text-white font-bold backdrop-blur-md border border-white/20">
            {user?.email?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="erp-sidebar__user-info">
            <p style={{ fontWeight: "600", fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email?.split("@")[0] || "Admin"}
            </p>
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
              Administrator
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="erp-sidebar__logout border-0 bg-white/5 hover:bg-white/10 p-2 rounded-lg cursor-pointer transition-colors"
            title="Logout"
          >
            <LogOut size={16} color="white" />
          </button>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────── */}
      <div
        className="erp-main-container"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          /*
           * Desktop: sidebar is position:relative so it takes 260px in the flex row.
           * When closed it slides left via translateX(-260px) but still occupies
           * that 260px space — we pull the container left by 260px to fill the gap.
           * Mobile: sidebar is position:fixed, never affects layout.
           */
          marginLeft: !isMobile && !isSidebarOpen ? "-260px" : "0",
          transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <header
          className="erp-topbar"
          style={{
            backdropFilter: "blur(12px)",
            backgroundColor: "rgba(255,255,255,0.8)",
            borderBottom: "1px solid var(--erp-border)",
            position: "sticky",
            top: 0,
            zIndex: 50,
            padding: "0 1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {/* Hamburger — always visible, toggles sidebar */}
          <button
            className="erp-topbar__btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={isSidebarOpen}
            style={{
              backgroundColor: "white",
              border: "1px solid var(--erp-border)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              flexShrink: 0,
            }}
          >
            <Menu size={20} />
          </button>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                fontSize: "0.875rem",
                color: "var(--erp-text-muted)",
                fontWeight: "500",
              }}
            >
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </div>
          </div>
        </header>

        <main className="erp-main" style={{ padding: "1rem 1.5rem" }}>
          {children}
        </main>
      </div>

      <style>{`
        .erp-admin-wrapper {
          display: flex;
          min-height: 100vh;
          background-color: #f8fafc;
        }
        
        .erp-sidebar {
          background: linear-gradient(180deg, var(--erp-primary) 0%, #6b1634 100%);
          color: white;
          display: flex;
          flex-direction: column;
        }

        .erp-sidebar__brand {
          display: flex;
          align-items: center;
          padding: 1.5rem;
        }

        .erp-sidebar__nav {
          flex: 1;
          padding: 1rem;
          display: flex;
          flex-direction: column;
        }

        .erp-nav-item {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          color: rgba(255,255,255,0.8);
          text-decoration: none;
        }

        .erp-sidebar__footer {
          display: flex;
          align-items: center;
          padding: 1.5rem;
          gap: 12px;
        }

        @media (max-width: 1024px) {
          /* On mobile the sidebar is position:fixed (set via JS inline style).
             The main container always fills full width — no margin adjustment needed. */
          .erp-main-container {
            margin-left: 0 !important;
            width: 100%;
          }
        }
        
        .erp-nav-item:hover {
          background-color: rgba(255,255,255,0.1);
          color: white;
          transform: translateX(4px);
        }
        
        .erp-nav-item--active {
          background-color: rgba(255,255,255,0.15);
          color: white;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
      `}</style>
    </div>
  );
}
