"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { Card, Button, Skeleton } from '../../components/ui/System';

const API = 'http://localhost:3001/api/v1';

function apiFetch(path: string, userId: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> || {}),
  };
  return fetch(`${API}${path}`, { ...opts, headers });
}

const fmtGBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const fmtDate = (s: string) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return s; }
};

const CATEGORY_LABELS: Record<string, string> = {
  meals: 'Meals', travel: 'Travel', accommodation: 'Accommodation',
  office_supplies: 'Office Supplies', equipment: 'Equipment', training: 'Training', other: 'Other',
};

// ─── Table Skeleton ───────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[0,1,2,3].map(i => (
        <div key={i} className="flex gap-4 px-4 py-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

// ─── Claims Table ─────────────────────────────────────────────────────────────
function ClaimsTable({ claims, isPosted = false }: { claims: any[]; isPosted?: boolean }) {
  if (claims.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['Claim ID', 'Employee', 'Description', 'Category', 'Amount (Net)', 'VAT', 'Amount (Gross)', 'GL Code', 'Cost Centre', 'Approved'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {claims.map((claim, i) => (
            <motion.tr key={claim.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`hover:bg-gray-50 transition-colors ${isPosted ? 'opacity-60' : ''}`}>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-500 whitespace-nowrap">{claim.reference}</td>
              <td className="px-4 py-3 font-medium text-[#1B2A4A] whitespace-nowrap">{claim.employee_name}</td>
              <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{claim.description || '—'}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                  {CATEGORY_LABELS[claim.category] || claim.category}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-sm text-right text-gray-700 whitespace-nowrap">{fmtGBP(claim.amount_net)}</td>
              <td className="px-4 py-3 font-mono text-sm text-right text-gray-400 whitespace-nowrap">
                {fmtGBP(claim.vat_amount)}
                <span className="text-xs ml-1 text-gray-300">({claim.vat_rate}%)</span>
              </td>
              <td className="px-4 py-3 font-mono text-sm font-semibold text-right text-[#1B2A4A] whitespace-nowrap">{fmtGBP(claim.amount_gross)}</td>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-teal whitespace-nowrap">
                {claim.gl_code || <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                {claim.cost_centre ? claim.cost_centre.replace('cost_centre:', '') : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(claim.approved_date)}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const { user } = useAuth();
  const [approved, setApproved] = useState<any[]>([]);
  const [posted, setPosted] = useState<any[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState('');

  const isFinance = user?.roles?.includes('finance_approver');

  const loadData = useCallback(async () => {
    if (!user?.sub || !isFinance) return;
    setLoading(true);
    setError('');
    try {
      const r = await apiFetch('/expenses/approved', user.sub);
      if (r.status === 403) { setError('access_denied'); return; }
      const d = await r.json();
      setApproved(d.data?.approved ?? []);
      setPosted(d.data?.posted ?? []);
      setTotalPending(d.data?.total_pending ?? 0);
    } catch {
      setError('connection');
    } finally {
      setLoading(false);
    }
  }, [user?.sub, isFinance]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = async () => {
    if (!user?.sub || approved.length === 0) return;
    setExporting(true);
    try {
      const r = await apiFetch('/expenses/export', user.sub, { method: 'POST' });
      const d = await r.json();
      const csv = d.data?.csv;
      if (!csv) { setToast('No data to export'); return; }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nucleus-expenses-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast(`Exported ${d.data.claims_count} claims`);
    } catch {
      setToast('Export failed — please retry');
    } finally {
      setExporting(false);
    }
  };

  const handleMarkPosted = async () => {
    if (!user?.sub || approved.length === 0) return;
    setMarking(true);
    try {
      const ids = approved.map(c => c.id);
      const r = await apiFetch('/expenses/mark-posted', user.sub, {
        method: 'POST',
        body: JSON.stringify({ claim_ids: ids }),
      });
      const d = await r.json();
      setToast(`${d.data?.updated ?? 0} claims marked as posted`);
      await loadData();
    } catch {
      setToast('Failed to mark as posted — please retry');
    } finally {
      setMarking(false);
    }
  };

  // ── Guard: not authenticated yet ──
  if (!user) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <TableSkeleton />
    </div>
  );

  // ── Guard: wrong role ──
  if (!isFinance) return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto mt-24 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h1 className="text-2xl font-bold text-[#1B2A4A] mb-2">Access Denied</h1>
      <p className="text-gray-500">Finance Export is only available to users with the <strong>Finance Approver</strong> role.</p>
      <p className="text-sm text-gray-400 mt-2">Switch to Robert Shaw to access this view.</p>
    </motion.div>
  );

  // ── Guard: connection error ──
  if (error === 'connection') return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto mt-24 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold text-[#1B2A4A] mb-2">Cannot reach API</h1>
      <p className="text-gray-500 mb-4">Make sure the API server is running on <code className="font-mono text-sm bg-gray-100 px-1 rounded">localhost:3001</code></p>
      <Button onClick={loadData}>Retry</Button>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className="max-w-[1400px] mx-auto pb-12 space-y-8">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2A4A] tracking-tight">Finance Export</h1>
          <p className="text-gray-500 mt-1">Review approved claims, export to CSV, and mark as posted.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button variant="secondary" onClick={handleExport} isLoading={exporting}
            className="flex items-center gap-2" disabled={approved.length === 0}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export to CSV
          </Button>
          <Button onClick={handleMarkPosted} isLoading={marking}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2" disabled={approved.length === 0}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            Mark All as Posted
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Ready to Export', value: approved.length, sub: fmtGBP(totalPending), color: 'border-green-200 bg-green-50' },
          { label: 'Total Gross', value: fmtGBP(totalPending), sub: `${approved.length} claims`, color: 'border-[#2E8B8B]/30 bg-teal-bg' },
          { label: 'Previously Posted', value: posted.length, sub: 'this period', color: 'border-gray-200 bg-gray-50' },
        ].map(stat => (
          <Card key={stat.label} className={`p-5 border ${stat.color}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-[#1B2A4A]">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{stat.sub}</p>
          </Card>
        ))}
      </div>

      {/* Approved Claims (Ready to Export) */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-bold text-[#1B2A4A]">Ready to Export</h2>
          {approved.length > 0 && (
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">{approved.length}</span>
          )}
        </div>

        {loading ? <TableSkeleton /> : approved.length === 0 ? (
          <Card className="p-12 text-center text-gray-400 border-dashed">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-semibold text-gray-500">No claims ready for export</p>
            <p className="text-sm mt-1">Approved claims will appear here once the workflow completes</p>
          </Card>
        ) : (
          <ClaimsTable claims={approved} />
        )}
      </div>

      {/* Posted Claims */}
      {(loading || posted.length > 0) && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-400">Posted</h2>
            {posted.length > 0 && (
              <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">{posted.length}</span>
            )}
          </div>
          {loading ? <TableSkeleton /> : <ClaimsTable claims={posted} isPosted />}
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1B2A4A] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3"
            onClick={() => setToast('')}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
