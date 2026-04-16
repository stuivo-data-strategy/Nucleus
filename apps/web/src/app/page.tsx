"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { Card, Avatar, Button, Badge, Skeleton } from '../components/ui/System';
import NewClaimModal from '../components/expenses/NewClaimModal';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

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

function greeting(name: string) {
  const h = new Date().getHours();
  const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${time}, ${name.split(' ')[0]}`;
}

const fmtGBP = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:    { label: 'Pending',    bg: 'bg-amber-50',  text: 'text-amber-700'  },
  submitted:  { label: 'Submitted',  bg: 'bg-blue-50',   text: 'text-blue-700'   },
  queried:    { label: 'Queried',    bg: 'bg-purple-50', text: 'text-purple-700' },
  approved:   { label: 'Approved',   bg: 'bg-green-50',  text: 'text-green-700'  },
  rejected:   { label: 'Rejected',   bg: 'bg-red-50',    text: 'text-red-700'    },
  in_progress:{ label: 'In Review',  bg: 'bg-teal-50',   text: 'text-teal-700'   },
  posted:     { label: 'Posted',     bg: 'bg-gray-50',   text: 'text-gray-600'   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2500); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1B2A4A] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3">
      <span>🚧</span> {message}
    </motion.div>
  );
}

// ─── Skeleton Cards ───────────────────────────────────────────────────────────
function DashSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end pb-6 border-b border-gray-200">
        <div className="space-y-2"><Skeleton className="h-10 w-72" /><Skeleton className="h-5 w-48" /></div>
        <Skeleton className="h-10 w-48" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="space-y-3">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── Employee Dashboard ───────────────────────────────────────────────────────
function EmployeeDashboard({ userId, onNewClaim }: { userId: string; onNewClaim: () => void }) {
  const [claims, setClaims] = useState<any[]>([]);
  const [policyCount, setPolicyCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/expenses?role=claimant', userId).then(r => r.json()),
      apiFetch('/policies/rules', userId).then(r => r.json()),
    ]).then(([claimsData, rulesData]) => {
      setClaims(claimsData.data?.claims ?? []);
      setPolicyCount(rulesData.data?.length ?? 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <DashSkeleton />;

  const queried = claims.filter(c => c.status === 'queried');
  const recent = claims.slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Pending Actions */}
      <AnimatePresence>
        {queried.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden border-purple-200 shadow-md">
              <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-4 flex justify-between items-center text-white">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                  Response Required
                </h2>
                <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-lg">{queried.length} {queried.length === 1 ? 'query' : 'queries'}</span>
              </div>
              {queried.map(claim => (
                <div key={claim.id} className="px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b last:border-0 hover:bg-purple-50/30 transition-colors">
                  <div>
                    <p className="font-semibold text-[#1B2A4A]">{claim.reference} — {claim.description || claim.category}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{fmtGBP(claim.amount)} · Awaiting your response</p>
                  </div>
                  <Link href="/expenses">
                    <Button size="sm" className="shrink-0">Respond</Button>
                  </Link>
                </div>
              ))}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-[#1B2A4A] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { emoji: '📸', label: 'New Expense', color: 'hover:bg-teal-bg hover:border-teal/50 group-hover:text-teal', action: onNewClaim },
            { emoji: '🏖', label: 'Request Leave', color: 'hover:bg-blue-50 hover:border-blue-300 group-hover:text-blue-600', action: () => setToast('Leave management coming in Phase 2') },
            { emoji: '⏱', label: 'Log Time', color: 'hover:bg-amber-50 hover:border-amber-300 group-hover:text-amber-600', action: () => setToast('Timesheets coming in Phase 2') },
            { emoji: '🎯', label: 'Update Goals', color: 'hover:bg-purple-50 hover:border-purple-300 group-hover:text-purple-600', action: () => setToast('Performance goals coming in Phase 2') },
          ].map(({ emoji, label, color, action }) => (
            <Card key={label} interactive onClick={action}
              className={`p-6 flex flex-col items-center justify-center text-center group transition-all min-h-[100px] ${color}`}>
              <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">{emoji}</span>
              <span className="text-sm font-bold text-[#1B2A4A]">{label}</span>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Claims */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-[#1B2A4A]">Recent Claims</h2>
          <Link href="/expenses" className="text-sm font-semibold text-[#2E8B8B] hover:underline">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <Card className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">🧾</p>
            <p className="font-semibold text-gray-500">No expenses yet</p>
            <p className="text-sm mt-1">Tap New Expense above to submit your first claim</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((claim, i) => (
              <motion.div key={claim.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="px-5 py-4 flex items-center justify-between gap-4 hover:shadow-md transition-all">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-semibold text-gray-400">{claim.reference}</span>
                      <StatusBadge status={claim.status} />
                    </div>
                    <p className="font-semibold text-[#1B2A4A] truncate">{claim.description || claim.category}</p>
                  </div>
                  <span className="font-mono font-semibold text-[#1B2A4A] shrink-0">{fmtGBP(claim.amount)}</span>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* PBAC Note */}
      {policyCount > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-teal-bg rounded-xl border border-teal/20">
          <svg width="18" height="18" className="text-teal shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          <p className="text-sm text-teal font-medium">Your claims are validated against <strong>{policyCount} active policy rules</strong> on every submission.</p>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Manager Dashboard ────────────────────────────────────────────────────────
function ManagerDashboard({ userId, onNewClaim }: { userId: string; onNewClaim: () => void }) {
  const { availableUsers } = useAuth();
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    apiFetch('/expenses?role=approver', userId)
      .then(r => r.json())
      .then(d => setPending(d.data?.claims ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <DashSkeleton />;

  const totalPending = pending.reduce((s, c) => s + (c.amount || 0), 0);
  const reports = availableUsers.filter(u => u.id !== userId).slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Pending Approvals Card */}
      <Card className="overflow-hidden border-amber-200 shadow-md">
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-4 flex justify-between items-center text-white">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Pending Approvals
          </h2>
          <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-lg">{pending.length} claims</span>
        </div>
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {pending.length === 0 ? (
            <p className="text-gray-500 font-medium">All caught up ✓ — no pending approvals</p>
          ) : (
            <>
              <div>
                <p className="text-3xl font-bold text-[#1B2A4A]">{pending.length}</p>
                <p className="text-sm text-gray-500 mt-0.5">claims totalling <span className="font-semibold text-[#1B2A4A]">{fmtGBP(totalPending)}</span></p>
              </div>
              <Link href="/approvals">
                <Button className="bg-amber-500 hover:bg-amber-600 text-white">Review Approvals →</Button>
              </Link>
            </>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-[#1B2A4A] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/approvals">
            <Card interactive className="p-6 flex flex-col items-center justify-center text-center group hover:bg-amber-50 hover:border-amber-300 transition-all min-h-[100px] relative">
              <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">✅</span>
              <span className="text-sm font-bold text-[#1B2A4A]">Approvals</span>
              {pending.length > 0 && (
                <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{pending.length}</span>
              )}
            </Card>
          </Link>
          <Card interactive onClick={onNewClaim} className="p-6 flex flex-col items-center justify-center text-center group hover:bg-teal-bg hover:border-teal/50 transition-all min-h-[100px]">
            <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">📸</span>
            <span className="text-sm font-bold text-[#1B2A4A]">New Expense</span>
          </Card>
          <Card interactive onClick={() => setToast('Team insights coming in Phase 2')} className="p-6 flex flex-col items-center justify-center text-center group hover:bg-blue-50 hover:border-blue-300 transition-all min-h-[100px]">
            <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">👥</span>
            <span className="text-sm font-bold text-[#1B2A4A]">My Team</span>
          </Card>
          <Card interactive onClick={() => setToast('Spend reports coming in Phase 2')} className="p-6 flex flex-col items-center justify-center text-center group hover:bg-purple-50 hover:border-purple-300 transition-all min-h-[100px]">
            <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">📊</span>
            <span className="text-sm font-bold text-[#1B2A4A]">Reports</span>
          </Card>
        </div>
      </div>

      {/* Team Overview */}
      {reports.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[#1B2A4A]">Team</h2>
            <Link href="/people" className="text-sm font-semibold text-[#2E8B8B] hover:underline">View all →</Link>
          </div>
          <Card className="p-4">
            <div className="flex flex-wrap gap-4">
              {reports.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors flex-1 min-w-[180px]">
                  <Avatar name={u.name} size="md" />
                  <div>
                    <p className="text-sm font-bold text-[#1B2A4A]">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Finance Dashboard ────────────────────────────────────────────────────────
function FinanceDashboard({ userId, onNewClaim }: { userId: string; onNewClaim: () => void }) {
  const [summary, setSummary] = useState<{ count: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    apiFetch('/expenses/approved', userId)
      .then(r => r.json())
      .then(d => setSummary({ count: d.data?.approved?.length ?? 0, total: d.data?.total_pending ?? 0 }))
      .catch(() => setSummary({ count: 0, total: 0 }))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <DashSkeleton />;

  return (
    <div className="space-y-8">
      {/* Finance Processing Card */}
      <Card className="overflow-hidden border-green-200 shadow-md">
        <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4 flex justify-between items-center text-white">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            Finance Processing
          </h2>
          <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-lg">Ready for export</span>
        </div>
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {summary?.count === 0 ? (
            <p className="text-gray-500 font-medium">No claims ready for export</p>
          ) : (
            <>
              <div>
                <p className="text-3xl font-bold text-[#1B2A4A]">{summary?.count ?? 0}</p>
                <p className="text-sm text-gray-500 mt-0.5">approved claims totalling <span className="font-semibold text-[#1B2A4A]">{fmtGBP(summary?.total ?? 0)}</span></p>
              </div>
              <Link href="/finance">
                <Button className="bg-green-600 hover:bg-green-700 text-white">Open Finance Export →</Button>
              </Link>
            </>
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-[#1B2A4A] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/finance">
            <Card interactive className="p-6 flex flex-col items-center justify-center text-center group hover:bg-green-50 hover:border-green-300 transition-all min-h-[100px] relative">
              <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">📤</span>
              <span className="text-sm font-bold text-[#1B2A4A]">Finance Export</span>
              {(summary?.count ?? 0) > 0 && (
                <span className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{summary?.count}</span>
              )}
            </Card>
          </Link>
          <Link href="/policy">
            <Card interactive className="p-6 flex flex-col items-center justify-center text-center group hover:bg-teal-bg hover:border-teal/50 transition-all min-h-[100px]">
              <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">📋</span>
              <span className="text-sm font-bold text-[#1B2A4A]">Policy Rules</span>
            </Card>
          </Link>
          <Card interactive onClick={onNewClaim} className="p-6 flex flex-col items-center justify-center text-center group hover:bg-blue-50 hover:border-blue-300 transition-all min-h-[100px]">
            <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">📸</span>
            <span className="text-sm font-bold text-[#1B2A4A]">New Expense</span>
          </Card>
          <Card interactive onClick={() => setToast('Spend analytics coming in Phase 2')} className="p-6 flex flex-col items-center justify-center text-center group hover:bg-purple-50 hover:border-purple-300 transition-all min-h-[100px]">
            <span className="text-3xl mb-2 group-hover:-translate-y-0.5 transition-transform block">📊</span>
            <span className="text-sm font-bold text-[#1B2A4A]">Spend Report</span>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast('')} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [showNewClaim, setShowNewClaim] = useState(false);

  if (!user) return (
    <div className="space-y-8">
      <div className="flex justify-between items-end pb-6 border-b border-gray-200">
        <div className="space-y-2"><Skeleton className="h-10 w-72" /><Skeleton className="h-5 w-48" /></div>
      </div>
      <DashSkeleton />
    </div>
  );

  const isFinance = user.roles?.includes('finance_approver');
  const isManager = !isFinance && (user.roles?.includes('manager') || user.permissions?.includes('people:read:team'));

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className="max-w-[1200px] mx-auto pb-12">

      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-gray-200 pb-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-[#1B2A4A] tracking-tight">{greeting(user.name)}</h1>
          <p className="text-gray-500 mt-1.5 font-medium">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isFinance && <Badge className="bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-3 py-1">Finance</Badge>}
          {isManager && <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-3 py-1">Manager</Badge>}
          {!isFinance && !isManager && <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-3 py-1">Employee</Badge>}
          <span className="text-sm text-gray-500 font-medium capitalize">{user.roles?.[0]?.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Role-specific content */}
      {isFinance && <FinanceDashboard userId={user.sub} onNewClaim={() => setShowNewClaim(true)} />}
      {isManager && <ManagerDashboard userId={user.sub} onNewClaim={() => setShowNewClaim(true)} />}
      {!isFinance && !isManager && <EmployeeDashboard userId={user.sub} onNewClaim={() => setShowNewClaim(true)} />}

      <AnimatePresence>
        {showNewClaim && (
          <NewClaimModal onClose={() => setShowNewClaim(false)} onSuccess={() => setShowNewClaim(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
