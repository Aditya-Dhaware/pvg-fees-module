import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Users,
  Banknote,
  Clock,
  RefreshCw,
  FileText,
  CreditCard,
  Receipt,
} from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [academicYear, setAcademicYear] = useState("");
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadYears();
  }, []);

  const loadYears = async () => {
    try {
      const { data } = await api.get("/dashboard/academic-years");
      setYears(data);
      if (data.length > 0) setAcademicYear(data[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStats = useCallback(async () => {
    if (!academicYear) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/dashboard/stats?academic_year=${academicYear}`,
      );
      setStats(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [academicYear]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const pieData = stats
    ? [
        { name: "Paid", value: stats.paid_bills },
        { name: "Unpaid", value: stats.unpaid_bills },
      ]
    : [];

  return (
    <AdminLayout title="Dashboard">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0",
              fontSize: "2rem",
              fontWeight: "800",
              color: "var(--erp-dark)",
              letterSpacing: "-0.025em",
            }}
          >
            Welcome, Admin
          </h2>
          <p
            style={{
              margin: "2px 0 0",
              color: "var(--erp-text-muted)",
              fontSize: "0.9375rem",
            }}
          >
            Real-time financial analytics and student billing status.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: "600",
              color: "var(--erp-text-muted)",
            }}
          >
            Academic Year:
          </span>
          <select
            className="erp-form-control"
            style={{
              width: "auto",
              padding: "8px 16px",
              borderRadius: "10px",
              backgroundColor: "white",
              border: "1px solid var(--erp-border)",
              fontWeight: "600",
            }}
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "5rem",
            color: "var(--erp-text-muted)",
          }}
        >
          <div
            className="erp-spinner"
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid var(--erp-border)",
              borderTopColor: "var(--erp-primary)",
              marginBottom: "1rem",
            }}
          ></div>
          <p>Analyzing statistics...</p>
        </div>
      ) : stats ? (
        <div style={{ animation: "fadeIn 0.5s ease-out" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.5rem",
              marginBottom: "2.5rem",
            }}
          >
            {[
              {
                label: "Total Students",
                value: stats.total_students,
                sub: `${stats.total_bills} bills`,
                icon: Users,
                color: "#881f42",
                bg: "linear-gradient(135deg, #fdf2f8, #fce7f3)",
              },
              {
                label: "Revenue Collected",
                value: `₹${stats.total_revenue.toLocaleString("en-IN")}`,
                sub: `${stats.paid_bills} paid`,
                icon: Banknote,
                color: "#10b981",
                bg: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
              },
              {
                label: "Pending Amount",
                value: `₹${stats.total_pending_amount.toLocaleString("en-IN")}`,
                sub: `${stats.unpaid_bills} unpaid`,
                icon: Clock,
                color: "#f59e0b",
                bg: "linear-gradient(135deg, #fffbeb, #fef3c7)",
              },
              {
                label: "Refunds Issued",
                value: `₹${stats.total_refunds.toLocaleString("en-IN")}`,
                sub: `${stats.pending_refunds} pending`,
                icon: RefreshCw,
                color: "#ef4444",
                bg: "linear-gradient(135deg, #fef2f2, #fee2e2)",
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="erp-card"
                style={{
                  padding: "1.5rem",
                  border: "1px solid rgba(226, 232, 240, 0.5)",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 15px -3px rgba(0, 0, 0, 0.05)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: stat.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: stat.color,
                    }}
                  >
                    <stat.icon size={22} />
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      color: stat.color,
                      backgroundColor: "white",
                      padding: "4px 8px",
                      borderRadius: "20px",
                      border: `1px solid ${stat.color}22`,
                    }}
                  >
                    {stat.sub}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: "800",
                    color: "#1e293b",
                    marginBottom: "4px",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#64748b",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
              gap: "1.5rem",
              marginBottom: "2.5rem",
            }}
          >
            <div className="erp-card" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <h3
                  style={{ margin: 0, fontSize: "1.125rem", fontWeight: "700" }}
                >
                  Bill Collection Status
                </h3>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "var(--erp-primary)",
                  }}
                ></div>
              </div>
              <div style={{ height: "300px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={idx === 0 ? "#10b981" : "#f59e0b"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      }}
                      formatter={(val) => [`${val} Bills`, ""]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="erp-card" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <h3
                  style={{ margin: 0, fontSize: "1.125rem", fontWeight: "700" }}
                >
                  Revenue vs Pending by Program
                </h3>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--erp-text-muted)",
                  }}
                >
                  Values in Thousands (k)
                </div>
              </div>
              <div style={{ height: "300px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.program_stats} barGap={8}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="program_name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 500, fill: "#64748b" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fontWeight: 500, fill: "#64748b" }}
                      tickFormatter={(v) =>
                        `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      }}
                      formatter={(val) => [
                        `₹${Number(val).toLocaleString("en-IN")}`,
                        "",
                      ]}
                    />
                    <Bar
                      dataKey="collected"
                      name="Collected"
                      fill="#881f42"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="pending"
                      name="Pending"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      height={36}
                      iconType="circle"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div
            className="erp-card"
            style={{ marginBottom: "2.5rem", overflow: "hidden" }}
          >
            <div
              style={{
                padding: "1.5rem",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{ margin: 0, fontSize: "1.125rem", fontWeight: "700" }}
              >
                Program Summary Breakdown
              </h3>
              <button
                className="erp-btn erp-btn--outline"
                style={{ padding: "6px 12px", fontSize: "0.75rem" }}
              >
                Export PDF
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "#f8fafc",
                      color: "#64748b",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <th style={{ padding: "16px 20px", fontWeight: "700" }}>
                      Program
                    </th>
                    <th
                      style={{
                        padding: "16px 20px",
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      Paid Bills
                    </th>
                    <th
                      style={{
                        padding: "16px 20px",
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      Unpaid Bills
                    </th>
                    <th
                      style={{
                        padding: "16px 20px",
                        fontWeight: "700",
                        textAlign: "right",
                      }}
                    >
                      Collected Amount
                    </th>
                    <th
                      style={{
                        padding: "16px 20px",
                        fontWeight: "700",
                        textAlign: "right",
                      }}
                    >
                      Pending Amount
                    </th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: "0.875rem" }}>
                  {stats.program_stats.map((p, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        transition: "background-color 0.1s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.backgroundColor = "#fcfdfe")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "16px 20px",
                          fontWeight: "700",
                          color: "#1e293b",
                        }}
                      >
                        {p.program_name}
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        <span
                          style={{
                            backgroundColor: "#ecfdf5",
                            color: "#10b981",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontWeight: "700",
                            fontSize: "0.75rem",
                          }}
                        >
                          {p.paid}
                        </span>
                      </td>
                      <td style={{ padding: "16px 20px", textAlign: "center" }}>
                        <span
                          style={{
                            backgroundColor: "#fffbeb",
                            color: "#f59e0b",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontWeight: "700",
                            fontSize: "0.75rem",
                          }}
                        >
                          {p.unpaid}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "16px 20px",
                          textAlign: "right",
                          fontWeight: "700",
                          color: "#1e293b",
                          fontFamily: "monospace",
                        }}
                      >
                        ₹{Number(p.collected).toLocaleString("en-IN")}
                      </td>
                      <td
                        style={{
                          padding: "16px 20px",
                          textAlign: "right",
                          color: "#ef4444",
                          fontWeight: "700",
                          fontFamily: "monospace",
                        }}
                      >
                        ₹{Number(p.pending).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "1rem",
              marginTop: "2rem",
            }}
          >
            {[
              {
                label: "Manage Bills",
                icon: FileText,
                path: "/admin/bills",
                color: "#881f42",
              },
              {
                label: "View Payments",
                icon: CreditCard,
                path: "/admin/payments",
                color: "#10b981",
              },
              {
                label: "Process Refunds",
                icon: RefreshCw,
                path: "/admin/refunds",
                color: "#ef4444",
              },
              {
                label: "View Receipts",
                icon: Receipt,
                path: "/admin/receipts",
                color: "#64748b",
              },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="erp-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "1.25rem",
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  textAlign: "left",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.backgroundColor = `${action.color}05`;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ color: action.color }}>
                  <action.icon size={20} />
                </div>
                <span style={{ fontWeight: "700", color: "#1e293b" }}>
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
