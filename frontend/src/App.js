import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import BillManagement from "@/pages/BillManagement";
import PaymentHistory from "@/pages/PaymentHistory";
import RefundManagement from "@/pages/RefundManagement";
import ReceiptList from "@/pages/ReceiptList";
import UserPortal from "@/pages/UserPortal";
import PrintReceipt from "@/pages/PrintReceipt";
import BrochurePayment from "@/pages/BrochurePayment";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-sm text-[#6B7280]">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to={`/${location.search}`} replace />;
  
  if (user.role !== 'admin') {
    return <Navigate to={`/user-portal${location.search}`} replace />;
  }
  
  return children;
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
    if (user.role === 'admin') return <Navigate to={`/admin${location.search}`} replace />;
    if (user.role === 'student') return <Navigate to={`/user-portal${location.search}`} replace />;
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><AdminLogin /></PublicRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/bills" element={<ProtectedRoute><BillManagement /></ProtectedRoute>} />
      <Route path="/admin/payments" element={<ProtectedRoute><PaymentHistory /></ProtectedRoute>} />
      <Route path="/admin/refunds" element={<ProtectedRoute><RefundManagement /></ProtectedRoute>} />
      <Route path="/admin/receipts" element={<ProtectedRoute><ReceiptList /></ProtectedRoute>} />
      <Route path="/user" element={<UserPortal />} />
      <Route path="/user-portal" element={<UserPortal />} />
      <Route path="/pay/brochure" element={<BrochurePayment />} />
      <Route path="/receipt/:id/print" element={<PrintReceipt />} />
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
