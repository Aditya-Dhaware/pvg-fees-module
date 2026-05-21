import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  FileText,
  ArrowLeft,
  Shield,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

export default function BrochurePayment() {
  const [searchParams] = useSearchParams();
  const billId = searchParams.get("bill_id");
  const userId = searchParams.get("user_id");

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paying, setPaying] = useState(false);
  const [countdown, setCountdown] = useState(null);

  // Use the provided ngrok link as the default destination
  const ADMISSION_URL =
    searchParams.get("redirect_url") ||
    "https://impotence-synthetic-ambition.ngrok-free.dev/brochure";

  // Handle countdown and redirect
  useEffect(() => {
    let timer;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      window.location.href = ADMISSION_URL;
    }
    return () => clearTimeout(timer);
  }, [countdown, ADMISSION_URL]);

  // Start countdown if bill is already paid when loaded
  useEffect(() => {
    if (bill?.status === "PAID" && countdown === null && !loading) {
      setCountdown(5);
    }
  }, [bill?.status, loading, countdown]);

  // Auto-dismiss payment status after 5 seconds if it's info or error
  useEffect(() => {
    if (
      paymentStatus &&
      (paymentStatus.type === "info" || paymentStatus.type === "error")
    ) {
      const timer = setTimeout(() => setPaymentStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus]);

  const fetchBill = useCallback(async () => {
    if (!billId) {
      setError(
        "No bill ID provided. Please use the link from the Admission portal.",
      );
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get(`/bills/${billId}`);
      if (data.bill_type !== "BROCHURE") {
        setError("This page is only for brochure fee payments.");
        setLoading(false);
        return;
      }
      setBill(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not load bill details. Please check the link.",
      );
    }
    setLoading(false);
  }, [billId]);

  useEffect(() => {
    fetchBill();
  }, [fetchBill]);

  const handlePay = async () => {
    if (!bill) return;
    setPaying(true);
    setPaymentStatus(null);
    try {
      const { data } = await api.post(
        `/payments/create-order?bill_id=${bill.bill_id}&user_id=${bill.user_id}`,
      );
      const options = {
        key: data.key_id,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: "College ERP",
        description: "Brochure Fee Payment",
        handler: async (response) => {
          try {
            const verifyRes = await api.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentStatus({
              type: "success",
              message: `Payment successful! Receipt: ${verifyRes.data.receipt.receipt_number}`,
              receipt: verifyRes.data.receipt,
            });
            // Refresh bill and start countdown
            setCountdown(5);
            fetchBill();
          } catch {
            setPaymentStatus({
              type: "error",
              message: "Payment verification failed. Please contact admin.",
            });
          }
          setPaying(false);
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setPaymentStatus({
              type: "info",
              message: "Payment was cancelled. You can try again.",
            });
          },
        },
        theme: { color: "#881f42" },
      };
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setPaying(false);
        setPaymentStatus({
          type: "error",
          message: "Payment failed. Please try again.",
        });
      });
      rzp.open();
    } catch (err) {
      setPaying(false);
      setPaymentStatus({
        type: "error",
        message: err.response?.data?.detail || "Could not initiate payment.",
      });
    }
  };

  const isPaid = bill?.status === "PAID";

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        className="erp-topbar"
        style={{
          width: "100%",
          padding: "0 32px",
          zIndex: 10,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          height: "72px",
          position: "sticky",
          top: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "linear-gradient(135deg, #881f42, #6b1634)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(136, 31, 66, 0.2)",
            }}
          >
            <Shield color="white" size={20} />
          </div>
          <div>
            <span
              style={{
                fontSize: "15px",
                fontWeight: "800",
                color: "#1e293b",
                letterSpacing: "-0.01em",
              }}
            >
              PVG COET&M
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "#64748b",
                display: "block",
                marginTop: "-2px",
                fontWeight: "600",
              }}
            >
              Secure Payment Gateway
            </span>
          </div>
        </div>
        {/* Student Portal button removed as requested */}
      </header>

      <main
        className="erp-main"
        style={{
          maxWidth: "800px",
          width: "95%",
          margin: "0 auto",
          paddingTop: "2rem",
          paddingBottom: "2rem",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Payment Status Alert */}
        {paymentStatus && (
          <div
            className={`erp-alert ${paymentStatus.type === "success" ? "erp-alert--success" : paymentStatus.type === "error" ? "erp-alert--danger" : "erp-alert--info"}`}
            style={{
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              borderRadius: "14px",
              padding: "16px 20px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
              animation: "slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              border: "1px solid transparent",
            }}
          >
            {paymentStatus.type === "success" ? (
              <CheckCircle size={22} />
            ) : (
              <AlertCircle size={22} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "700", fontSize: "14px" }}>
                {paymentStatus.message}
              </div>
              {paymentStatus.type === "success" && (
                <div
                  style={{ fontSize: "12px", marginTop: "4px", opacity: 0.9 }}
                >
                  Payment recorded successfully. Redirecting you back shortly.
                </div>
              )}
            </div>
            {(paymentStatus.type === "info" ||
              paymentStatus.type === "error") && (
              <div
                style={{ fontSize: "10px", fontWeight: "700", opacity: 0.5 }}
              >
                AUTODISMISS
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div
            className="erp-card"
            style={{
              padding: "4rem",
              textAlign: "center",
              borderRadius: "20px",
            }}
          >
            <div
              className="erp-spinner"
              style={{
                width: "40px",
                height: "40px",
                border: "3px solid #f1f5f9",
                borderTopColor: "#881f42",
                margin: "0 auto 1.5rem",
              }}
            />
            <p style={{ color: "#64748b", fontWeight: "600" }}>
              Securing connection...
            </p>
          </div>
        ) : error ? (
          <div
            className="erp-card"
            style={{
              padding: "4rem",
              textAlign: "center",
              borderRadius: "20px",
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
                margin: "0 auto 1.5rem",
              }}
            >
              <AlertCircle size={32} color="#ef4444" />
            </div>
            <h3
              style={{
                color: "#1e293b",
                fontSize: "1.25rem",
                fontWeight: "800",
                marginBottom: "0.75rem",
              }}
            >
              Unable to load payment
            </h3>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.9375rem",
                lineHeight: "1.6",
                maxWidth: "400px",
                margin: "0 auto",
              }}
            >
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "2rem",
                color: "#881f42",
                fontWeight: "700",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Retry Connection
            </button>
          </div>
        ) : (
          bill && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "2rem",
                animation: "fadeIn 0.6s ease-out",
              }}
            >
              <div
                className="erp-card"
                style={{
                  overflow: "hidden",
                  borderRadius: "24px",
                  border: "1px solid rgba(255, 255, 255, 0.6)",
                  background: "rgba(255, 255, 255, 0.7)",
                  backdropFilter: "blur(20px)",
                  boxShadow:
                    "0 25px 50px -12px rgba(136, 31, 66, 0.15), 0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                  display: "grid",
                  gridTemplateColumns: "minmax(300px, 1.2fr) 1fr",
                }}
              >
                {/* Left Side: Payment Summary */}
                <div
                  style={{
                    padding: "3rem",
                    borderRight: "1px solid rgba(136, 31, 66, 0.1)",
                    background: "rgba(255, 255, 255, 0.5)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "2.5rem",
                    }}
                  >
                    <FileText size={20} color="#881f42" />
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        color: "#64748b",
                      }}
                    >
                      Order Summary
                    </span>
                  </div>

                  <h2
                    style={{
                      fontSize: "2rem",
                      fontWeight: "900",
                      color: "#1e293b",
                      marginBottom: "0.5rem",
                    }}
                  >
                    ₹{Number(bill.amount).toLocaleString("en-IN")}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "2.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: isPaid ? "#10b981" : "#f59e0b",
                      }}
                    ></div>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: "700",
                        color: isPaid ? "#10b981" : "#f59e0b",
                      }}
                    >
                      {isPaid ? "Payment Completed" : "Payment Required"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: "1.5rem" }}>
                    <div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          marginBottom: "4px",
                        }}
                      >
                        Academic Year
                      </div>
                      <div
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: "700",
                          color: "#334155",
                        }}
                      >
                        {bill.academic_year}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          marginBottom: "4px",
                        }}
                      >
                        Service Type
                      </div>
                      <div
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: "700",
                          color: "#334155",
                        }}
                      >
                        {bill.bill_type} (Application Fee)
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          marginBottom: "4px",
                        }}
                      >
                        Student Reference
                      </div>
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          color: "#64748b",
                          fontFamily: "monospace",
                        }}
                      >
                        {bill.user_id}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Action Area */}
                <div
                  style={{
                    padding: "3rem",
                    backgroundColor: "rgba(250, 251, 252, 0.6)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  {isPaid ? (
                    <div style={{ textAlign: "center" }}>
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          backgroundColor: "#ecfdf5",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          margin: "0 auto 1.5rem",
                          boxShadow: "0 0 0 8px #f0fdf4",
                        }}
                      >
                        <CheckCircle size={40} color="#10b981" />
                      </div>
                      <h3
                        style={{
                          fontSize: "1.25rem",
                          fontWeight: "800",
                          color: "#065f46",
                          marginBottom: "1rem",
                        }}
                      >
                        Verified Success
                      </h3>
                      <p
                        style={{
                          fontSize: "0.875rem",
                          color: "#047857",
                          marginBottom: "2rem",
                          lineHeight: "1.6",
                        }}
                      >
                        Your application brochure fee has been cleared.
                      </p>

                      <button
                        onClick={() => (window.location.href = ADMISSION_URL)}
                        style={{
                          width: "100%",
                          padding: "16px",
                          borderRadius: "14px",
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          fontWeight: "800",
                          fontSize: "0.9375rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "12px",
                          boxShadow: "0 10px 15px -3px rgba(16, 185, 129, 0.2)",
                        }}
                      >
                        {countdown !== null
                          ? `Redirecting in ${countdown}s...`
                          : "Return to Portal"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: "2rem" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "1rem",
                          }}
                        >
                          <Shield size={16} color="#881f42" />
                          <span
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: "700",
                              color: "#475569",
                            }}
                          >
                            Secure Checkout
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "0.8125rem",
                            color: "#64748b",
                            lineHeight: "1.6",
                          }}
                        >
                          Click below to initiate a secure transaction via
                          Razorpay. All data is encrypted.
                        </p>
                      </div>

                      <button
                        onClick={handlePay}
                        disabled={paying}
                        style={{
                          width: "100%",
                          padding: "16px",
                          background:
                            "linear-gradient(135deg, #881f42, #6b1634)",
                          color: "white",
                          border: "none",
                          borderRadius: "14px",
                          fontWeight: "800",
                          fontSize: "1rem",
                          cursor: paying ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "12px",
                          boxShadow: "0 10px 20px -5px rgba(136, 31, 66, 0.4)",
                          transition: "all 0.2s",
                        }}
                        onMouseOver={(e) => {
                          if (!paying)
                            e.currentTarget.style.transform =
                              "translateY(-2px)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        {paying ? (
                          <div
                            className="erp-spinner"
                            style={{
                              width: "20px",
                              height: "20px",
                              border: "2px solid white",
                              borderTopColor: "transparent",
                            }}
                          />
                        ) : (
                          <>
                            <CreditCard size={20} /> Pay Securely
                          </>
                        )}
                      </button>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: "20px",
                          marginTop: "2.5rem",
                          opacity: 0.5,
                        }}
                      >
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                          height="14"
                          alt="PayPal"
                        />

                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg"
                          height="14"
                          alt="Mastercard"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <footer
                style={{ textAlign: "center", padding: "1rem", opacity: 0.6 }}
              >
                <p style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Powered by PVG's COET Fees & Billing Module ©{" "}
                  {new Date().getFullYear()}
                </p>
              </footer>
            </div>
          )
        )}
      </main>

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .erp-spinner { border: 2px solid rgba(0,0,0,0.1); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        @media (max-width: 768px) {
          .erp-card { grid-template-columns: 1fr !important; }
          .erp-card \u003e div:first-child { border-right: none !important; border-bottom: 1px solid #f1f5f9 !important; padding: 2rem !important; }
          .erp-card \u003e div:last-child { padding: 2rem !important; }
        }
      `}</style>
    </div>
  );
}
