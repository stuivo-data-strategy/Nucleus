"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';

// ─── API ──────────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function apiFetch(endpoint: string, options: RequestInit = {}, userId?: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['x-user-id'] = userId;
  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message || `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  meals:           { label: 'Meals',      emoji: '🍽️' },
  travel:          { label: 'Travel',     emoji: '✈️' },
  accommodation:   { label: 'Hotel',      emoji: '🏨' },
  transport:       { label: 'Transport',  emoji: '🚕' },
  office_supplies: { label: 'Supplies',   emoji: '📦' },
  training:        { label: 'Training',   emoji: '🎓' },
  mileage:         { label: 'Mileage',    emoji: '🚗' },
  other:           { label: 'Other',      emoji: '📋' },
};

const FLAG_REASONS = [
  'Receipt unclear/illegible',
  'Amount mismatch',
  'Missing information',
  'Unusual pattern',
  'Requires management confirmation',
  'VAT query',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `£${n.toFixed(2)}`; }
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function vat(amount: number) { return amount / 6; }

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${color}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="text-3xl font-bold font-mono leading-none">{value}</p>
      {sub && <p className="text-xs opacity-60 font-medium">{sub}</p>}
    </div>
  );
}

// ─── Policy badge row ─────────────────────────────────────────────────────────

function PolicyBadges({ result }: { result: any }) {
  if (!result) return <span className="text-xs text-gray-300">No policy data</span>;
  const { passed = 0, total = 0, failures = 0 } = result.summary ?? {};
  const ok = failures === 0;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
      ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
    }`}>
      {ok ? '✓' : '✗'} Policy {passed}/{total}
    </span>
  );
}

// ─── Flag inline form ─────────────────────────────────────────────────────────

function FlagForm({ onSubmit, onCancel }: {
  onSubmit: (reason: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden"
    >
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-3 space-y-3">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Flag for Review</p>
        <select
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-[#000053] bg-white focus:outline-none focus:border-amber-500"
        >
          <option value="">Select reason…</option>
          {FLAG_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Additional notes (optional)…"
          rows={2}
          className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-[#000053] bg-white focus:outline-none focus:border-amber-500 resize-none placeholder:text-amber-400"
        />
        <div className="flex gap-2">
          <button
            onClick={() => reason && onSubmit(reason, notes)}
            disabled={!reason}
            className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 disabled:opacity-40 transition-colors"
          >
            ⚠ Confirm Flag
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Audit card ───────────────────────────────────────────────────────────────

interface AuditCardProps {
  claim: any;
  userId: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onCleared: (id: string, amount: number) => void;
  onFlagged: (id: string) => void;
  isFlaggedSection?: boolean;
  onResolved?: (id: string) => void;
  autoFocus?: boolean;
}

function AuditCard({
  claim, userId, selected, onToggleSelect, onCleared, onFlagged, isFlaggedSection, onResolved, autoFocus,
}: AuditCardProps) {
  const [flagging, setFlagging] = useState(false);
  const [actionState, setActionState] = useState<'idle' | 'clearing' | 'flagging' | 'resolving' | 'done-clear' | 'done-flag' | 'done-resolve'>('idle');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) cardRef.current?.focus();
  }, [autoFocus]);

  const cat = CATEGORIES[claim.category] ?? { label: claim.category, emoji: '📋' };
  const claimAmt   = claim.claim_amount   ?? claim.amount;
  const receiptAmt = claim.receipt_amount ?? claim.amount;
  const policyLimit = claim.policy_result?.checks?.find((c: any) => c.rule_name === 'Category Limit')?.details?.limit;
  const withinLimit = policyLimit == null || claimAmt <= policyLimit;
  const approverStep = claim.workflow?.steps?.find((s: any) => s.status === 'approved');
  const allApprovers = (claim.workflow?.steps ?? []).filter((s: any) => s.status === 'approved');

  const handleClear = async () => {
    setActionState('clearing');
    try {
      await apiFetch(`/audit/${encodeURIComponent(claim.id)}/clear`, { method: 'POST' }, userId);
      setActionState('done-clear');
      setTimeout(() => onCleared(claim.id, claimAmt), 700);
    } catch { setActionState('idle'); }
  };

  const handleFlag = async (reason: string, notes: string) => {
    setActionState('flagging');
    setFlagging(false);
    try {
      await apiFetch(`/audit/${encodeURIComponent(claim.id)}/flag`, {
        method: 'POST', body: JSON.stringify({ reason, notes }),
      }, userId);
      setActionState('done-flag');
      setTimeout(() => onFlagged(claim.id), 700);
    } catch { setActionState('idle'); }
  };

  const handleResolve = async () => {
    setActionState('resolving');
    try {
      await apiFetch(`/audit/${encodeURIComponent(claim.id)}/resolve`, { method: 'POST' }, userId);
      setActionState('done-resolve');
      setTimeout(() => onResolved?.(claim.id), 700);
    } catch { setActionState('idle'); }
  };

  const isDone = actionState.startsWith('done-');

  return (
    <motion.div
      ref={cardRef as any}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDone ? 0 : 1, y: isDone ? -8 : 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      tabIndex={0}
      className={`rounded-2xl border bg-white shadow-sm transition-colors outline-none focus:ring-2 focus:ring-[#6cffc6]/40 ${
        selected ? 'border-[#6cffc6] ring-1 ring-[#6cffc6]/30' : 'border-gray-200'
      } ${isFlaggedSection ? 'border-amber-200 bg-amber-50/30' : ''}`}
    >
      {/* ── Header row ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Selection checkbox */}
        {!isFlaggedSection && (
          <button
            onClick={() => onToggleSelect(claim.id)}
            className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
              selected ? 'bg-[#6cffc6] border-[#6cffc6]' : 'border-gray-300 hover:border-[#6cffc6]'
            }`}
          >
            {selected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
          </button>
        )}

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-[#000053] text-white text-sm font-bold flex items-center justify-center shrink-0">
          {claim.claimant_initials}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#000053] text-sm">{claim.claimant_name}</span>
            <span className="text-xs text-gray-400">{claim.claimant_job_title}</span>
            <span className="text-xs font-mono text-gray-300">{claim.reference}</span>
            {claim.exception_requested && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">Exception</span>
            )}
            {claim.partial_claim && (
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">Partial</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {cat.emoji} {claim.description || cat.label} · {fmtDate(claim.date)}
          </p>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className="text-xl font-bold font-mono text-[#000053]">{fmt(claimAmt)}</p>
          <p className="text-[10px] text-gray-400 font-mono">VAT: {fmt(vat(claimAmt))}</p>
        </div>
      </div>

      {/* ── Comparison grid ────────────────────────────────── */}
      <div className="mx-4 mb-3 grid grid-cols-3 gap-2 text-center">
        {/* Receipt */}
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Receipt</p>
          <p className="text-base font-bold font-mono text-[#000053]">{fmt(receiptAmt)}</p>
          {claim.partial_claim && receiptAmt !== claimAmt && (
            <p className="text-[10px] text-gray-400 mt-0.5">Full receipt</p>
          )}
        </div>

        {/* Claimed */}
        <div className={`rounded-xl p-2.5 ${claim.partial_claim && receiptAmt !== claimAmt ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Claimed</p>
          <p className="text-base font-bold font-mono text-[#000053]">{fmt(claimAmt)}</p>
          {claim.partial_claim && receiptAmt !== claimAmt && (
            <p className="text-[10px] text-amber-600 mt-0.5">
              Δ {fmt(receiptAmt - claimAmt)}
            </p>
          )}
        </div>

        {/* Policy limit */}
        <div className={`rounded-xl p-2.5 ${withinLimit ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Limit</p>
          <p className={`text-base font-bold font-mono ${withinLimit ? 'text-green-700' : 'text-red-600'}`}>
            {policyLimit != null ? fmt(policyLimit) : '—'}
          </p>
          <p className={`text-[10px] mt-0.5 font-bold ${withinLimit ? 'text-green-600' : 'text-red-500'}`}>
            {withinLimit ? '✓ Within' : '✗ Exceeds'}
          </p>
        </div>
      </div>

      {/* Partial reason */}
      {claim.partial_claim && claim.partial_reason && (
        <div className="mx-4 mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
          <span className="font-bold">Reason: </span>{claim.partial_reason.replace(/_/g, ' ')}
        </div>
      )}

      {/* Exception justification */}
      {claim.exception_requested && claim.exception_justification && (
        <div className="mx-4 mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <span className="font-bold">Exception: </span>"{claim.exception_justification}"
        </div>
      )}

      {/* ── Status badges ──────────────────────────────────── */}
      <div className="mx-4 mb-3 flex flex-wrap gap-1.5">
        <PolicyBadges result={claim.policy_result} />

        {/* Receipt status */}
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
          claim.has_receipt
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-600 border-red-200'
        }`}>
          {claim.has_receipt ? '📎 Receipt ✓' : '⚠ No receipt'}
        </span>

        {/* Approver chain */}
        {allApprovers.length > 0 ? (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-200">
            ✓ Approved {allApprovers.length > 1 ? `(${allApprovers.length} steps)` : `by ${allApprovers[0]?.approver_name}`}
          </span>
        ) : (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-200">
            No approver
          </span>
        )}

        {/* Flagged reason (flagged section) */}
        {isFlaggedSection && claim.audit_flag?.reason && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-300">
            ⚠ {claim.audit_flag.reason}
          </span>
        )}
      </div>

      {/* Flag form */}
      <AnimatePresence>
        {flagging && (
          <div className="px-4">
            <FlagForm
              onSubmit={handleFlag}
              onCancel={() => setFlagging(false)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* ── Action buttons ─────────────────────────────────── */}
      <div className="flex gap-2 px-4 pb-4 pt-1">
        {!isFlaggedSection ? (
          <>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleClear}
              disabled={actionState !== 'idle'}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm shadow-green-600/20 flex items-center justify-center gap-1.5"
            >
              {actionState === 'clearing' ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : actionState === 'done-clear' ? (
                '✓ Cleared'
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Clear for Payment
                </>
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setFlagging(v => !v)}
              disabled={actionState !== 'idle'}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors border ${
                flagging
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              } disabled:opacity-50`}
            >
              {actionState === 'flagging' ? (
                <span className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin inline-block" />
              ) : actionState === 'done-flag' ? '⚠ Flagged' : '⚠ Flag'}
            </motion.button>
          </>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleResolve}
            disabled={actionState !== 'idle'}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[#6cffc6] text-white hover:bg-[#5ae8b0] disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            {actionState === 'resolving' ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : actionState === 'done-resolve' ? '✓ Returned to Queue' : '↩ Return to Queue'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { user } = useAuth();
  const userId = user?.sub || 'person:lisa_thornton';
  const isAuditor = user?.roles?.includes('expenses_auditor') || user?.roles?.includes('system_admin');

  const [queue, setQueue]     = useState<any[]>([]);
  const [flagged, setFlagged] = useState<any[]>([]);
  const [stats, setStats]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchClearing, setBatchClearing] = useState(false);
  const [clearedCount, setClearedCount]   = useState(0);
  const [clearedAmount, setClearedAmount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, fRes, sRes] = await Promise.all([
        apiFetch('/audit/queue', {}, userId),
        apiFetch('/audit/flagged', {}, userId),
        apiFetch('/audit/stats', {}, userId),
      ]);
      setQueue(qRes.data?.claims ?? []);
      setFlagged(fRes.data?.claims ?? []);
      setStats(sRes.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      // Future: focus-tracking for keyboard shortcuts
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === queue.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(queue.map(c => c.id)));
    }
  };

  const handleCleared = (id: string, amount: number) => {
    setQueue(q => q.filter(c => c.id !== id));
    setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    setClearedCount(n => n + 1);
    setClearedAmount(a => a + amount);
    setStats((s: any) => s ? { ...s, ready_for_audit: Math.max(0, s.ready_for_audit - 1), cleared_today: s.cleared_today + 1 } : s);
  };

  const handleFlagged = (id: string) => {
    const claim = queue.find(c => c.id === id);
    setQueue(q => q.filter(c => c.id !== id));
    setSelected(s => { const n = new Set(s); n.delete(id); return n; });
    if (claim) setFlagged(f => [{ ...claim, audit_status: 'flagged' }, ...f]);
    setStats((s: any) => s ? { ...s, ready_for_audit: Math.max(0, s.ready_for_audit - 1), flagged: s.flagged + 1 } : s);
  };

  const handleResolved = (id: string) => {
    const claim = flagged.find(c => c.id === id);
    setFlagged(f => f.filter(c => c.id !== id));
    if (claim) setQueue(q => [...q, { ...claim, audit_status: 'pending_audit', audit_flag: undefined }]);
    setStats((s: any) => s ? { ...s, flagged: Math.max(0, s.flagged - 1), ready_for_audit: s.ready_for_audit + 1 } : s);
  };

  const handleBatchClear = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBatchClearing(true);
    try {
      await apiFetch('/audit/batch-clear', { method: 'POST', body: JSON.stringify({ claim_ids: ids }) }, userId);
      const totalAmount = queue.filter(c => selected.has(c.id)).reduce((sum, c) => sum + (c.claim_amount ?? c.amount), 0);
      setQueue(q => q.filter(c => !selected.has(c.id)));
      setClearedCount(n => n + ids.length);
      setClearedAmount(a => a + totalAmount);
      setSelected(new Set());
      setStats((s: any) => s ? { ...s, ready_for_audit: Math.max(0, s.ready_for_audit - ids.length), cleared_today: s.cleared_today + ids.length } : s);
    } catch { /* silent */ } finally {
      setBatchClearing(false);
    }
  };

  if (!isAuditor) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🔒</p>
          <p className="font-bold text-[#000053] text-lg">Audit access required</p>
          <p className="text-gray-500 text-sm mt-2">Switch to Lisa Thornton (Expenses Officer) to access the audit queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ── Page header ──────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#000053]">Expense Audit</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review approved claims before payment processing</p>
          </div>
          {(clearedCount > 0) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 border border-green-200 rounded-2xl px-4 py-2 text-right"
            >
              <p className="text-xs text-green-600 font-bold">{clearedCount} cleared this session</p>
              <p className="text-lg font-bold font-mono text-green-700">{fmt(clearedAmount)}</p>
            </motion.div>
          )}
        </div>

        {/* ── Stats ────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border bg-white h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Ready for Audit"
              value={stats?.ready_for_audit ?? queue.length}
              sub="pending review"
              color="bg-white border-gray-200 text-[#000053]"
            />
            <StatCard
              label="Flagged for Review"
              value={stats?.flagged ?? flagged.length}
              sub="need attention"
              color={flagged.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-white border-gray-200 text-[#000053]'}
            />
            <StatCard
              label="Cleared Today"
              value={stats?.cleared_today ?? clearedCount}
              sub="ready for payment"
              color="bg-green-50 border-green-200 text-green-800"
            />
            <StatCard
              label="Avg Processing"
              value={stats?.avg_processing_hours != null ? `${stats.avg_processing_hours}h` : '—'}
              sub="approval to clearance"
              color="bg-white border-gray-200 text-[#000053]"
            />
          </div>
        )}

        {/* ── Audit queue ───────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-[#000053]">Audit Queue</h2>
              {queue.length > 0 && (
                <span className="text-xs font-bold bg-[#000053] text-white px-2 py-0.5 rounded-full">
                  {queue.length}
                </span>
              )}
            </div>

            {queue.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold text-[#000053] hover:text-[#5ae8b0] transition-colors"
                >
                  {selected.size === queue.length ? 'Deselect all' : 'Select all'}
                </button>
                {selected.size > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleBatchClear}
                    disabled={batchClearing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm"
                  >
                    {batchClearing ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Clear {selected.size} selected
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border bg-white h-48 animate-pulse" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-bold text-[#000053]">Queue is clear</p>
              <p className="text-sm text-gray-500 mt-1">All approved claims have been processed</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {queue.map((claim, i) => (
                <AuditCard
                  key={claim.id}
                  claim={claim}
                  userId={userId}
                  selected={selected.has(claim.id)}
                  onToggleSelect={toggleSelect}
                  onCleared={handleCleared}
                  onFlagged={handleFlagged}
                  autoFocus={i === 0}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* ── Flagged section ───────────────────────────────── */}
        {flagged.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-amber-700">Flagged for Review</h2>
              <span className="text-xs font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full">
                {flagged.length}
              </span>
            </div>
            <AnimatePresence mode="popLayout">
              {flagged.map(claim => (
                <AuditCard
                  key={claim.id}
                  claim={claim}
                  userId={userId}
                  selected={false}
                  onToggleSelect={() => {}}
                  onCleared={handleCleared}
                  onFlagged={() => {}}
                  onResolved={handleResolved}
                  isFlaggedSection
                />
              ))}
            </AnimatePresence>
          </div>
        )}

      </div>
    </div>
  );
}
