import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { Plus, X } from "lucide-react";

export default function RefundManagement() {
  const [refunds, setRefunds] = useState([]);
  const [years, setYears] = useState([]);
  const [academicYear, setAcademicYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ payment_id: "", amount: "", reason: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState({}); // { refundId: errorMsg }
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: '' }

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => { loadYears(); }, []);
  useEffect(() => { 
    loadRefunds(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear]);

  const loadYears = async () => {
    try { const { data } = await api.get("/dashboard/academic-years"); setYears(data); } catch {}
  };

  const loadRefunds = async () => {
    setLoading(true);
    try {
      const params = academicYear ? `?academic_year=${academicYear}` : "";
      const { data } = await api.get(`/refunds/${params}`);
      setRefunds(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    try {
      await api.post("/refunds/", {
        payment_id: createForm.payment_id,
        amount: parseFloat(createForm.amount),
        reason: createForm.reason
      });
      setShowCreate(false);
      setCreateForm({ payment_id: "", amount: "", reason: "" });
      showToast("Refund request created successfully!");
      loadRefunds();
    } catch (err) {
      setCreateError(err.response?.data?.detail || "Failed to create refund");
    }
    setCreateLoading(false);
  };

  const handleUpdateStatus = async (refundId, status) => {
    setActionLoading(refundId);
    setActionError(prev => ({ ...prev, [refundId]: null }));
    try {
      const { data } = await api.put(`/refunds/${refundId}`, { status });
      if (status === 'REFUNDED') {
        const msg = data.razorpay_refund_id 
          ? `Refund of ₹${data.amount} successful! ID: ${data.razorpay_refund_id}`
          : "Refund approved successfully!";
        showToast(msg);
      } else {
        showToast("Refund request rejected.");
      }
      loadRefunds();
    } catch (err) {
      console.error(err);
      setActionError(prev => ({ ...prev, [refundId]: err.response?.data?.detail || "Failed to update" }));
    }
    setActionLoading(null);
  };

  const getStatusBadge = (status) => {
    if (status === "REFUNDED") return "erp-badge--success";
    if (status === "PENDING") return "erp-badge--warning";
    return "erp-badge--danger";
  }

  return (
    <AdminLayout title="Refund Management">
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '12px 24px',
          backgroundColor: toast.type === 'error' ? 'var(--erp-danger)' : 'var(--erp-success)',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ fontWeight: 'bold' }}>{toast.type === 'error' ? 'Error' : 'Success'}!</div>
          <div style={{ fontSize: '0.875rem' }}>{toast.message}</div>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginLeft: '10px', opacity: 0.8 }}>
            <X size={16} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--erp-dark)' }}>Refunds</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <select 
            className="erp-form-control" 
            style={{ width: '150px' }}
            value={academicYear} 
            onChange={(e) => setAcademicYear(e.target.value)}
          >
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          
          <button className="erp-btn erp-btn--primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} style={{ marginRight: '6px' }} /> New Refund
          </button>

          {showCreate && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', width: '100%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', position: 'relative' }}>
                <button onClick={() => setShowCreate(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--erp-text-muted)' }}>
                  <X size={20} />
                </button>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--erp-dark)' }}>
                  Create Refund
                </div>
                <form onSubmit={handleCreate}>
                <div className="erp-form-group">
                  <label>Payment ID (UUID) <span style={{color: 'red'}}>*</span></label>
                  <input className="erp-form-control" value={createForm.payment_id} onChange={(e) => setCreateForm({ ...createForm, payment_id: e.target.value })} required />
                </div>
                <div className="erp-form-group">
                  <label>Amount (₹) <span style={{color: 'red'}}>*</span></label>
                  <input type="number" className="erp-form-control" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} required min="1" />
                </div>
                <div className="erp-form-group">
                  <label>Reason <span style={{color: 'red'}}>*</span></label>
                  <input className="erp-form-control" value={createForm.reason} onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })} required />
                </div>
                {createError && (
                  <div className="erp-alert erp-alert--danger" style={{ marginBottom: '1rem' }}>{createError}</div>
                )}
                <button type="submit" disabled={createLoading} className="erp-btn erp-btn--primary" style={{ width: '100%' }}>
                  {createLoading ? "Creating..." : "Create Refund"}
                </button>
              </form>
            </div>
           </div>
          )}
        </div>
      </div>

      <div className="erp-card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ borderBottom: '1px solid var(--erp-border)', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--erp-text-muted)' }}>
              <tr>
                <th style={{ padding: '12px 16px' }}>Refund ID</th>
                <th style={{ padding: '12px 16px' }}>User ID</th>
                <th style={{ padding: '12px 16px' }}>Program</th>
                <th style={{ padding: '12px 16px' }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '12px 16px' }}>Reason</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                <th style={{ padding: '12px 16px' }}>Date</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.875rem' }}>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--erp-text-muted)' }}>Loading refunds...</td></tr>
              ) : refunds.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--erp-text-muted)' }}>No refunds found</td></tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.refund_id} style={{ borderBottom: '1px solid var(--erp-border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--erp-dark)' }}>{r.refund_id.slice(0, 8)}...</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--erp-text-muted)' }}>{r.user_id.slice(0, 8)}...</td>
                    <td style={{ padding: '12px 16px' }}>{r.program_name || "—"}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="erp-badge erp-badge--primary">{r.bill_type}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>₹{Number(r.amount).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--erp-text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`erp-badge ${getStatusBadge(r.status)}`}>{r.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {r.status === "PENDING" && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button disabled={actionLoading === r.refund_id} className="erp-btn erp-btn--success" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleUpdateStatus(r.refund_id, "REFUNDED")}>
                              {actionLoading === r.refund_id ? "..." : "Approve"}
                            </button>
                            <button disabled={actionLoading === r.refund_id} className="erp-btn erp-btn--danger" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleUpdateStatus(r.refund_id, "REJECTED")}>
                              Reject
                            </button>
                          </div>
                          {actionError[r.refund_id] && (
                            <div style={{ fontSize: '10px', color: 'var(--erp-danger)', maxWidth: '150px', lineHeight: '1.2' }}>
                              {actionError[r.refund_id]}
                              <button 
                                onClick={() => setActionError(prev => ({ ...prev, [r.refund_id]: null }))}
                                style={{ background: 'none', border: 'none', color: 'var(--erp-primary)', cursor: 'pointer', marginLeft: '4px', textDecoration: 'underline' }}
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--erp-text-muted)', fontSize: '0.8rem' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
