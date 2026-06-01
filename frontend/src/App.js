import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AuthGate from "@/auth/AuthGate";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import BillManagement from "@/pages/BillManagement";
import PaymentHistory from "@/pages/PaymentHistory";
import RefundManagement from "@/pages/RefundManagement";
import ReceiptList from "@/pages/ReceiptList";
import UserPortal from "@/pages/UserPortal";
import PrintReceipt from "@/pages/PrintReceipt";
import BrochurePayment from "@/pages/BrochurePayment";

function AdminProtectedRoute({ children }) {
  return (
    <AuthGate allowedRoles={["admin", "accountant", "principal", "vice_principal"]}>
      {children}
    </AuthGate>
  );
}

function StudentProtectedRoute() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("user_id") || searchParams.get("student_id") || "";
  
  return (
    <AuthGate allowedRoles={["Student", "admin", "accountant", "principal", "vice_principal"]} checkUserId={userId}>
      <UserPortal />
    </AuthGate>
  );
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-sm text-[#6B7280]">Loading...</div>
      </div>
    );
  }
  
  if (user) {
    const role = String(user.role || "").toLowerCase();
    if (role === "admin" || role === "accountant" || role === "principal" || role === "vice_principal") {
      return <Navigate to={`/admin${location.search}`} replace />;
    }
    if (role === "student") {
      return <Navigate to={`/user-portal${location.search}`} replace />;
    }
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><AdminLogin /></PublicRoute>} />
      <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />
      <Route path="/admin/bills" element={<AdminProtectedRoute><BillManagement /></AdminProtectedRoute>} />
      <Route path="/admin/payments" element={<AdminProtectedRoute><PaymentHistory /></AdminProtectedRoute>} />
      <Route path="/admin/refunds" element={<AdminProtectedRoute><RefundManagement /></AdminProtectedRoute>} />
      <Route path="/admin/receipts" element={<AdminProtectedRoute><ReceiptList /></AdminProtectedRoute>} />
      <Route path="/user" element={<StudentProtectedRoute />} />
      <Route path="/user-portal" element={<StudentProtectedRoute />} />
      <Route path="/pay/brochure" element={<BrochurePayment />} />
      <Route path="/receipt/:id/print" element={
        <AuthGate allowedRoles={["Student", "admin", "accountant", "principal", "vice_principal"]}>
          <PrintReceipt />
        </AuthGate>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
