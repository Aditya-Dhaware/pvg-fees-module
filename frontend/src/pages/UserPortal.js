import React, { useState, useCallback, useEffect } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Printer,
  User,
  Wallet,
  Calendar,
  ArrowRight,
  Download,
  ReceiptText,
  LayoutDashboard,
  ExternalLink
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

export default function UserPortal() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultUserId =
    searchParams.get("student_id") || searchParams.get("user_id") || "";

  const [userId, setUserId] = useState(defaultUserId);
  const [bills, setBills] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchedId, setSearchedId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [payingBillId, setPayingBillId] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  // Auto-dismiss payment status after 5 seconds if it's info or error
  useEffect(() => {
    if (paymentStatus && (paymentStatus.type === "info" || paymentStatus.type === "error")) {
      const timer = setTimeout(() => setPaymentStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus]);

  const lookupBills = useCallback(
    async (idOverride) => {
      // Ensure we're using a string and not an event object
      const idToSearch =
        (typeof idOverride === "string" ? idOverride : userId) || "";

      if (!idToSearch || typeof idToSearch !== "string" || !idToSearch.trim())
        return;

      setLoading(true);
      setSearched(true);
      setSearchedId(idToSearch);
      try {
        const [billsRes, receiptsRes] = await Promise.all([
          api.get(`/bills/user/${idToSearch}`),
          api.get(`/receipts/user/${idToSearch}`),
        ]);
        setBills(billsRes.data);
        setReceipts(receiptsRes.data);
      } catch (err) {
        console.error("Lookup failed:", err);
        setBills([]);
        setReceipts([]);
      }
      setLoading(false);
    },
    [userId],
  );

  // Auto-trigger search if the id is in the URL parameter or if user is logged in
  useEffect(() => {
    if (defaultUserId) {
      console.log("Auto-fetching bills from URL:", defaultUserId);
      setUserId(defaultUserId);
      lookupBills(defaultUserId);
    } else if (user && user.role === 'student') {
      const studentId = user.id || user.email;
      if (studentId) {
        console.log("Auto-fetching bills for logged-in student:", studentId);
        setUserId(studentId);
        lookupBills(studentId);
      }
    }
  }, [defaultUserId, user, lookupBills]);

  const handlePay = async (bill) => {
    setPayingBillId(bill.bill_id);
    setPaymentStatus({
      type: "info",
      message: "Step 1: Contacting backend...",
    });
    try {
      const { data } = await api.post(
        `/payments/create-order?bill_id=${bill.bill_id}&user_id=${bill.user_id}`,
      );

      if (!data || !data.key_id) {
        throw new Error("Invalid response from backend");
      }

      setPaymentStatus({
        type: "info",
        message: "Step 2: Opening Razorpay...",
      });

      const options = {
        key: data.key_id,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: "College ERP",
        description: `${bill.bill_type} Fee - ${bill.program_name || ""}`,
        handler: async (response) => {
          console.log("RAZORPAY HANDLER TRIGGERED", response);
          window.handlerCalled = true;
          try {
            setPaymentStatus({
              type: "info",
              message: "Step 3: Verifying payment...",
            });
            console.log("SENDING VERIFY REQUEST...");
            const verifyRes = await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            console.log("VERIFY RESPONSE:", verifyRes.data);
            setPaymentStatus({
              type: "success",
              message: `Payment successful! Receipt: ${verifyRes.data.receipt.receipt_number}`,
            });
            lookupBills();
          } catch (err) {
            setPaymentStatus({
              type: "error",
              message:
                err.response?.data?.detail ||
                "Payment verification failed. Please contact admin.",
            });
          }
          setPayingBillId(null);
        },
        modal: {
          ondismiss: () => {
            setPayingBillId(null);
            setPaymentStatus({
              type: "info",
              message: "Payment cancelled by user.",
            });
          },
        },
        theme: { color: "#881f42" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setPayingBillId(null);
        setPaymentStatus({
          type: "error",
          message: "Payment failed. Please try again.",
        });
      });
      rzp.open();
      // Keep button as processing while modal is open
    } catch (err) {
      console.error("Payment initiation error:", err);
      setPayingBillId(null);
      setPaymentStatus({
        type: "error",
        message:
          err.message ||
          err.response?.data?.detail ||
          "Could not initiate payment.",
      });
    }
  };

  const pendingBills = bills.filter((b) => b.status === "UNPAID");
  const paidBills = bills.filter((b) => b.status === "PAID");
  const totalPending = pendingBills.reduce(
    (sum, b) => sum + Number(b.amount),
    0,
  );
  const totalPaid = paidBills.reduce((sum, b) => sum + Number(b.amount), 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", backgroundImage: "radial-gradient(at 0% 0%, hsla(342,63%,33%,0.05) 0, transparent 50%), radial-gradient(at 50% 0%, hsla(342,63%,33%,0.02) 0, transparent 50%)" }}>
      <header
        className="erp-topbar"
        style={{ 
          position: "sticky", 
          top: 0, 
          zIndex: 50, 
          backgroundColor: "rgba(255, 255, 255, 0.8)", 
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
          padding: "0 1.5rem",
          height: "64px",
          display: "flex",
          alignItems: "center",
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              backgroundColor: "var(--erp-primary)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 6px -1px rgba(var(--erp-primary-rgb), 0.2)"
            }}
          >
            <Wallet color="white" size={18} />
          </div>
          <div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: "700",
                color: "var(--erp-dark)",
                lineHeight: "1.2"
              }}
            >
              Students Fee Portal
            </div>
            <div style={{ fontSize: "11px", color: "var(--erp-text-muted)", fontWeight: "500" }}>
              College ERP System
            </div>
          </div>
        </div>
        
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingRight: "1.5rem", borderRight: "1px solid #e2e8f0" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--erp-dark)" }}>{user.name || "Student"}</div>
                <div style={{ fontSize: "11px", color: "var(--erp-text-muted)" }}>{user.email}</div>
              </div>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={16} color="#64748b" />
              </div>
            </div>
          )}
          {/* <a
            href="/admin"
            style={{
              fontSize: "13px",
              color: "var(--erp-primary)",
              fontWeight: "600",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "rgba(var(--erp-primary-rgb), 0.05)"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            data-testid="admin-link"
          >
            Admin Access <ExternalLink size={14} />
          </a> */}
        </div>
      </header>

      <main
        className="erp-main"
        data-erp-page="User Portal"
        style={{
          maxWidth: "1024px",
          margin: "0 auto",
          padding: "2rem 1.5rem",
          minHeight: "calc(100vh - 64px)"
        }}
      >
        <div
          className="erp-card"
          style={{ 
            marginBottom: "2.5rem", 
            border: "none", 
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
            overflow: "hidden"
          }}
        >
          <div 
            style={{ 
              padding: "2.5rem 2rem", 
              background: "linear-gradient(135deg, var(--erp-primary) 0%, #6b1634 100%)",
              color: "white",
              position: "relative"
            }}
          >
            <div style={{ position: "relative", zIndex: 1 }}>
              <h1 style={{ fontSize: "1.875rem", fontWeight: "800", marginBottom: "0.5rem", color: "white" }}>
                Find Your Bills
              </h1>
              <p style={{ fontSize: "0.9375rem", opacity: 0.9, maxWidth: "600px" }}>
                Enter your registered Email address to access your pending payments
              </p>
            </div>
            {/* Decorative element */}
            <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "150px", height: "150px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "50%" }}></div>
          </div>
          
          <div className="erp-card__body" style={{ padding: "2rem" }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                lookupBills();
              }}
              style={{ display: "flex", gap: "12px", maxWidth: "800px" }}
            >
              <div style={{ flex: 1, position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  className="erp-form-control"
                  style={{ 
                    width: "100%", 
                    paddingLeft: "42px", 
                    height: "52px", 
                    fontSize: "15px", 
                    borderRadius: "12px",
                    border: "2px solid #e2e8f0",
                    transition: "all 0.2s"
                  }}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Student ID (e.g. 1001) or Email Address"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="erp-btn erp-btn--primary"
                style={{ 
                  height: "52px", 
                  padding: "0 2rem", 
                  borderRadius: "12px", 
                  fontSize: "15px", 
                  fontWeight: "600",
                  display: "flex", 
                  alignItems: "center", 
                  gap: "10px",
                  boxShadow: "0 4px 6px -1px rgba(var(--erp-primary-rgb), 0.3)"
                }}
              >
                {loading ? "Searching..." : "Track Bills"}
                <ArrowRight size={18} />
              </button>
            </form>
            
            <div style={{ marginTop: "1.25rem", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b" }}>Quick Search:</span>
              <div style={{ display: "flex", gap: "8px" }}>
                {["1001", "1002"].map(id => (
                  <button
                    key={id}
                    className="erp-btn"
                    style={{ 
                      padding: "4px 12px", 
                      fontSize: "12px", 
                      backgroundColor: "#f1f5f9", 
                      color: "#475569",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: "500"
                    }}
                    onClick={() => {
                      setUserId(id);
                      lookupBills(id);
                    }}
                  >
                    ID: {id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {paymentStatus && (
          <div
            className={`erp-alert ${paymentStatus.type === "success" ? "erp-alert--success" : paymentStatus.type === "error" ? "erp-alert--danger" : "erp-alert--info"}`}
            style={{ 
              marginBottom: "2rem", 
              borderRadius: "12px", 
              padding: "1rem 1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
            }}
          >
            {paymentStatus.type === "success" ? (
              <div style={{ backgroundColor: "#dcfce7", padding: "6px", borderRadius: "8px" }}><CheckCircle size={18} color="#16a34a" /></div>
            ) : paymentStatus.type === "error" ? (
              <div style={{ backgroundColor: "#fee2e2", padding: "6px", borderRadius: "8px" }}><AlertCircle size={18} color="#dc2626" /></div>
            ) : (
              <div style={{ backgroundColor: "#e0f2fe", padding: "6px", borderRadius: "8px" }}><AlertCircle size={18} color="#0284c7" /></div>
            )}
            <div style={{ fontSize: "14px", fontWeight: "500" }}>{paymentStatus.message}</div>
          </div>
        )}

        {searched && !loading && (
          <>
            {bills.length === 0 && receipts.length === 0 ? (
              <div
                className="erp-card"
                style={{
                  padding: "4rem 2rem",
                  textAlign: "center",
                  border: "1px solid #fee2e2",
                  background: "linear-gradient(to bottom, #ffffff, #fff5f5)",
                  marginTop: "1rem",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    backgroundColor: "#fef2f2",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <AlertCircle size={32} color="#ef4444" />
                </div>
                <h3
                  style={{
                    color: "#991b1b",
                    margin: "0 0 8px",
                    fontSize: "1.25rem",
                    fontWeight: "700",
                  }}
                >
                  No such student exists!
                </h3>
                <p
                  style={{
                    color: "#b91c1c",
                    margin: 0,
                    fontSize: "0.95rem",
                    opacity: 0.8,
                  }}
                >
                  We couldn't find any billing records for the{" "}
                  {searchedId.includes("@") ? "Email" : "ID"}:{" "}
                  <strong style={{ fontFamily: "monospace" }}>
                    {searchedId}
                  </strong>
                </p>
                <div
                  style={{
                    marginTop: "24px",
                    paddingTop: "20px",
                    borderTop: "1px solid #fee2e2",
                    display: "inline-block",
                  }}
                >
                  <p style={{ fontSize: "0.85rem", color: "#7f1d1d" }}>
                    Please verify the ID or contact the account department.
                  </p>
                </div>
              </div>
            ) : (
              <div className="erp-portal-content">
                {bills.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "1.5rem",
                      marginBottom: "2rem",
                    }}
                  >
                    {[
                      { label: "Unpaid Bills", value: pendingBills.length, icon: ReceiptText, color: "#881f42", bg: "#fdf2f8" },
                      { label: "Pending Amount", value: `₹${totalPending.toLocaleString("en-IN")}`, icon: Wallet, color: "#f59e0b", bg: "#fffbeb" },
                      { label: "Total Paid", value: `₹${totalPaid.toLocaleString("en-IN")}`, icon: CheckCircle, color: "#10b981", bg: "#ecfdf5" },
                      { label: "Total Receipts", value: receipts.length, icon: Printer, color: "#64748b", bg: "#f8fafc" }
                    ].map((stat, i) => (
                      <div
                        key={i}
                        className="erp-card"
                        style={{ 
                          padding: "1.5rem", 
                          display: "flex", 
                          alignItems: "center", 
                          gap: "1.25rem",
                          border: "1px solid rgba(226, 232, 240, 0.5)",
                          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                          transition: "transform 0.2s, box-shadow 0.2s",
                          cursor: "default"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = "translateY(-4px)";
                          e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.05)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
                        }}
                      >
                        <div style={{ 
                          width: "48px", 
                          height: "48px", 
                          backgroundColor: stat.bg, 
                          borderRadius: "12px", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          color: stat.color
                        }}>
                          <stat.icon size={24} />
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: "600", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.025em" }}>
                            {stat.label}
                          </div>
                          <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "#1e293b", marginTop: "2px" }}>
                            {stat.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "2rem",
                    padding: "4px",
                    backgroundColor: "#f1f5f9",
                    borderRadius: "14px",
                    width: "fit-content"
                  }}
                >
                  {[
                    { id: "pending", label: "Pending", count: pendingBills.length, icon: Wallet },
                    { id: "paid", label: "Paid", count: paidBills.length, icon: CheckCircle },
                    { id: "receipts", label: "Receipts", count: receipts.length, icon: ReceiptText }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 20px",
                        borderRadius: "10px",
                        border: "none",
                        fontSize: "14px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        backgroundColor: activeTab === tab.id ? "white" : "transparent",
                        color: activeTab === tab.id ? "var(--erp-primary)" : "#64748b",
                        boxShadow: activeTab === tab.id ? "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)" : "none"
                      }}
                    >
                      <tab.icon size={16} />
                      {tab.label}
                      <span style={{ 
                        fontSize: "11px", 
                        backgroundColor: activeTab === tab.id ? "rgba(var(--erp-primary-rgb), 0.1)" : "#e2e8f0", 
                        padding: "2px 8px", 
                        borderRadius: "20px",
                        marginLeft: "4px"
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {activeTab === "pending" && (
                  <div style={{ animation: "fadeIn 0.5s ease-out" }}>
                    {pendingBills.length === 0 ? (
                      <div
                        className="erp-card"
                        style={{ 
                          padding: "4rem 2rem", 
                          textAlign: "center", 
                          color: "#64748b",
                          border: "1px dashed #cbd5e1"
                        }}
                      >
                        No pending bills to show.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "1rem" }}>
                        {pendingBills.map((b) => (
                          <div 
                            key={b.bill_id} 
                            className="erp-card"
                            style={{ 
                              padding: "1.25rem 1.5rem",
                              borderLeft: "4px solid #3b82f6",
                              transition: "transform 0.2s, box-shadow 0.2s"
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.transform = "translateX(4px)";
                              e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.05)";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.transform = "translateX(0)";
                              e.currentTarget.style.boxShadow = "none";
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                                <div style={{ 
                                  width: "40px", 
                                  height: "40px", 
                                  backgroundColor: "#eff6ff", 
                                  borderRadius: "10px", 
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "center",
                                  color: "#3b82f6"
                                }}>
                                  <ReceiptText size={20} />
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                                      {b.program_name || "Brochure Fee"}
                                    </span>
                                    <span style={{ 
                                      fontSize: "10px", 
                                      fontWeight: "800", 
                                      color: "#3b82f6",
                                      backgroundColor: "#dbeafe",
                                      padding: "1px 6px",
                                      borderRadius: "4px"
                                    }}>
                                      PENDING
                                    </span>
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                                    {b.bill_type} — {b.academic_year} {b.installment_number && (
                                      <span style={{ fontWeight: "600", color: "#3b82f6" }}>
                                        (Inst. {b.installment_number})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Due Amount</div>
                                  <div style={{ fontSize: "1.25rem", fontWeight: "800", color: "#1e293b" }}>₹{Number(b.amount).toLocaleString("en-IN")}</div>
                                </div>
                                <button
                                  onClick={() => handlePay(b)}
                                  disabled={payingBillId === b.bill_id}
                                  className="erp-btn erp-btn--primary"
                                  style={{ 
                                    padding: "10px 20px", 
                                    borderRadius: "10px", 
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    minWidth: "120px",
                                    justifyContent: "center"
                                  }}
                                >
                                  {payingBillId === b.bill_id ? (
                                    <>
                                      <div className="erp-spinner" style={{ width: "16px", height: "16px", border: "2px solid white", borderTopColor: "transparent" }}></div>
                                      Wait...
                                    </>
                                  ) : (
                                    <>
                                      Pay Now <CreditCard size={16} />
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "paid" && (
                  <div style={{ animation: "fadeIn 0.5s ease-out" }}>
                    {paidBills.length === 0 ? (
                      <div
                        className="erp-card"
                        style={{
                          padding: "4rem 2rem",
                          textAlign: "center",
                          color: "#64748b",
                          border: "1px dashed #cbd5e1"
                        }}
                      >
                        No completed payments found.
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: "1rem" }}>
                        {paidBills.map((b) => (
                          <div 
                            key={b.bill_id} 
                            className="erp-card"
                            style={{ 
                              padding: "1.25rem 1.5rem",
                              borderLeft: "4px solid #10b981"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                                <div style={{ 
                                  width: "40px", 
                                  height: "40px", 
                                  backgroundColor: "#ecfdf5", 
                                  borderRadius: "10px", 
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "center",
                                  color: "#10b981"
                                }}>
                                  <CheckCircle size={20} />
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>
                                      {b.program_name || "Brochure Fee"}
                                    </span>
                                    <span style={{ 
                                      fontSize: "10px", 
                                      fontWeight: "800", 
                                      color: "#10b981",
                                      backgroundColor: "#d1fae5",
                                      padding: "1px 6px",
                                      borderRadius: "4px"
                                    }}>
                                      PAID
                                    </span>
                                  </div>
                                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                                    {b.bill_type} — {b.academic_year} {b.installment_number && `(Installment ${b.installment_number})`}
                                  </div>
                                </div>
                              </div>
                              <div style={{ fontSize: "1.25rem", fontWeight: "800", color: "#10b981" }}>
                                ₹{Number(b.amount).toLocaleString("en-IN")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "receipts" && (
                  <div style={{ animation: "fadeIn 0.5s ease-out" }}>
                    {receipts.length === 0 ? (
                      <div
                        className="erp-card"
                        style={{
                          padding: "4rem 2rem",
                          textAlign: "center",
                          color: "#64748b",
                          border: "1px dashed #cbd5e1"
                        }}
                      >
                        No receipts found.
                      </div>
                    ) : (
                      <div className="erp-card" style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                            <thead style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                              <tr>
                                <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Receipt #</th>
                                <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Details</th>
                                <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Amount</th>
                                <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</th>
                                <th style={{ padding: "14px 20px", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {receipts.map((r) => (
                                <tr key={r.receipt_id} style={{ borderBottom: "1px solid #f1f5f9", transition: "background-color 0.1s" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"} onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                                  <td style={{ padding: "16px 20px", fontWeight: "700", color: "var(--erp-primary)", fontSize: "14px", fontFamily: "monospace" }}>{r.receipt_number}</td>
                                  <td style={{ padding: "16px 20px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>{r.bill_type}</div>
                                    <div style={{ fontSize: "12px", color: "#64748b" }}>{r.user_class} • {r.academic_year}</div>
                                  </td>
                                  <td style={{ padding: "16px 20px", textAlign: "right", fontWeight: "700", color: "#1e293b", fontSize: "15px" }}>₹{Number(r.amount).toLocaleString("en-IN")}</td>
                                  <td style={{ padding: "16px 20px", color: "#64748b", fontSize: "13px" }}>{new Date(r.created_at).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                  <td style={{ padding: "16px 20px", textAlign: "center" }}>
                                    <button
                                      onClick={() => window.open(`/receipt/${r.receipt_id}/print`, "_blank")}
                                      className="erp-btn"
                                      style={{ 
                                        padding: "8px 12px", 
                                        borderRadius: "8px", 
                                        backgroundColor: "#f1f5f9", 
                                        border: "none", 
                                        color: "var(--erp-primary)",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        fontSize: "13px",
                                        fontWeight: "600",
                                        cursor: "pointer"
                                      }}
                                    >
                                      <Download size={14} /> Download
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
      
      {/* Dynamic styles for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .erp-spinner {
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top: 2px solid white;
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
