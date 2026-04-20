"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { Card } from '../../components/ui/System';
import NewClaimModal from '../../components/expenses/NewClaimModal';
import ClaimDetailModal from '../../components/expenses/ClaimDetailModal';

// ─── API ─────────────────────────────────────────────────────────────────────

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
    const err: any = new Error(body.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  meals:          { label: 'Meals',      emoji: '🍽️' },
  travel:         { label: 'Travel',     emoji: '✈️' },
  accommodation:  { label: 'Hotel',      emoji: '🏨' },
  transport:      { label: 'Transport',  emoji: '🚕' },
  office_supplies:{ label: 'Supplies',   emoji: '📦' },
  training:       { label: 'Training',   emoji: '🎓' },
  mileage:        { label: 'Mileage',    emoji: '🚗' },
  other:          { label: 'Other',      emoji: '📋' },
};

const STATUS_CFG: Record<string, { label: string; pill: string }> = {
  submitted:   { label: 'Submitted',    pill: 'bg-gray-100 text-gray-600' },
  pending:     { label: 'Pending',      pill: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'In Progress',  pill: 'bg-blue-100 text-blue-700' },
  queried:     { label: 'Queried',      pill: 'bg-purple-100 text-purple-700' },
  approved:    { label: 'Approved',     pill: 'bg-green-100 text-green-700' },
  rejected:    { label: 'Rejected',     pill: 'bg-red-100 text-red-700' },
  posted:      { label: 'Posted',       pill: 'bg-teal-100 text-teal-700' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── StatusTracker (compact, horizontal) ────────────────────────────────────

function StatusTracker({
  steps,
  skipped = [],
}: {
  steps: any[];
  skipped?: { step: number; label: string; reason: string }[];
}) {
  if (!steps?.length) return null;

  function stepStyle(status: string) {
    switch (status) {
      case 'approved': return { ring: 'bg-green-500 text-white',  line: 'bg-green-300',  icon: '✓' };
      case 'rejected': return { ring: 'bg-red-500 text-white',    line: 'bg-red-300',    icon: '✗' };
      case 'queried':  return { ring: 'bg-purple-500 text-white', line: 'bg-purple-300', icon: '?' };
      case 'pending':  return { ring: 'bg-[#6cffc6] text-white',  line: 'bg-[#6cffc6]/30', icon: null };
      default:         return { ring: 'bg-gray-200 text-gray-400',line: 'bg-gray-100',   icon: null };
    }
  }

  const allActive = steps.map((s, i) => ({ ...s, _idx: i }));

  return (
    <div className="flex items-start mt-3 overflow-x-auto pb-1 -mx-1 px-1">
      {allActive.map((step, i) => {
        const { ring, line, icon } = stepStyle(step.status);
        const label = icon || String(step.order || i + 1);
        return (
          <React.Fragment key={step.approver_id || i}>
            {i > 0 && <div className={`h-0.5 w-6 sm:w-10 mt-3.5 shrink-0 ${line}`} />}
            <div className="flex flex-col items-center gap-0.5 shrink-0" style={{ minWidth: 64 }}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${ring}`}>
                {label}
              </div>
              <p className="text-[10px] text-gray-500 text-center leading-tight truncate w-16">
                {step.approver_name?.split(' ')[0] ?? '—'}
              </p>
              {step.acted_at && (
                <p className="text-[9px] text-gray-400">{fmtShort(step.acted_at)}</p>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {skipped.map(skip => (
        <React.Fragment key={`skip-${skip.step}`}>
          <div className="h-0.5 w-6 sm:w-10 mt-3.5 shrink-0 bg-gray-100" />
          <div className="flex flex-col items-center gap-0.5 shrink-0 opacity-40" style={{ minWidth: 64 }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-400">
              {skip.step}
            </div>
            <p className="text-[10px] text-gray-400 text-center leading-tight truncate w-16">
              {skip.label || '—'}
            </p>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { user } = useAuth();
  const userId = user?.sub ?? 'person:sarah_chen';

  const [claims, setClaims]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [showNewClaim, setShowNewClaim] = useState(false);

  // Inline query respond state
  const [queryTexts, setQueryTexts]   = useState<Record<string, string>>({});
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/expenses?role=claimant', {}, userId);
      setClaims(data.data?.claims ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  // ── Summary aggregations ─────────────────────────────────────────────────
  const now = new Date();
  const thisMonth = claims.filter(c => {
    const d = new Date(c.date ?? c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const pending = claims.filter(c =>
    ['submitted', 'pending', 'in_progress', 'queried'].includes(c.status)
  );

  // ── Respond to query ─────────────────────────────────────────────────────
  const handleRespond = async (claimId: string) => {
    const note = queryTexts[claimId]?.trim();
    if (!note) return;
    setRespondingIds(prev => new Set([...prev, claimId]));
    try {
      await apiFetch(
        `/expenses/${encodeURIComponent(claimId)}/action`,
        { method: 'POST', body: JSON.stringify({ action: 'respond', note }) },
        userId
      );
      setQueryTexts(prev => ({ ...prev, [claimId]: '' }));
      await fetchClaims();
    } catch { /* silent — list will refresh */ } finally {
      setRespondingIds(prev => { const s = new Set(prev); s.delete(claimId); return s; });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-28 animate-in fade-in duration-300">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[#000053] tracking-tight">My Expenses</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {loading ? 'Loading…' : `${claims.length} claim${claims.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <button
          onClick={() => setShowNewClaim(true)}
          className="hidden sm:flex items-center gap-2 bg-[#6cffc6] text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#5ae8b0] transition-colors shadow-sm shadow-[#6cffc6]/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Claim
        </button>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 border-gray-200 shadow-sm">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">This Month</p>
          <p className="text-2xl font-bold text-[#000053] font-mono">
            £{thisMonth.reduce((s, c) => s + (c.amount ?? 0), 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {thisMonth.length} claim{thisMonth.length !== 1 ? 's' : ''}
          </p>
        </Card>
        <Card className="p-5 border-gray-200 shadow-sm">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pending Approval</p>
          <p className="text-2xl font-bold text-amber-600 font-mono">
            £{pending.reduce((s, c) => s + (c.amount ?? 0), 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {pending.length} claim{pending.length !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>

      {/* ── Claims list ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center border-gray-200">
          <p className="text-red-500 font-medium">{error}</p>
          <button onClick={fetchClaims} className="mt-3 text-sm font-semibold text-[#000053] hover:underline">
            Try again
          </button>
        </Card>
      ) : claims.length === 0 ? (
        <Card className="p-12 text-center border-gray-200">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-bold text-[#000053]">No claims yet</p>
          <p className="text-sm text-gray-500 mt-1">Submit your first expense to get started.</p>
          <button
            onClick={() => setShowNewClaim(true)}
            className="mt-4 text-sm font-semibold text-[#000053] hover:underline"
          >
            Submit a claim →
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {claims.map((claim, i) => {
            const cat = CATEGORIES[claim.category] ?? { label: claim.category, emoji: '📋' };
            const st  = STATUS_CFG[claim.status]   ?? STATUS_CFG.submitted;
            const queriedStep = claim.workflow?.steps?.find((s: any) => s.status === 'queried');
            const isQueried   = claim.status === 'queried';

            return (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.22 }}
              >
                <Card
                  className={`p-5 border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer ${
                    isQueried ? 'border-purple-200 ring-1 ring-purple-100' : ''
                  }`}
                  onClick={() => setSelectedId(claim.id)}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl shrink-0 mt-0.5">{cat.emoji}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-[#000053] truncate leading-snug">
                          {claim.description || cat.label}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="text-xs text-gray-400">{fmtDate(claim.date)}</span>
                          <span className="text-gray-200 text-xs">·</span>
                          <span className="text-xs font-mono text-gray-400">{claim.reference}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold font-mono text-[#000053]">
                        £{(claim.amount ?? 0).toFixed(2)}
                      </p>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${st.pill}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>

                  {/* Compact workflow tracker */}
                  {claim.workflow?.steps?.length > 0 && (
                    <StatusTracker
                      steps={claim.workflow.steps}
                      skipped={claim.workflow.skipped_steps ?? []}
                    />
                  )}

                  {/* Query callout — stop click propagating to detail open */}
                  {isQueried && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3 overflow-hidden"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-purple-500 text-base shrink-0 mt-0.5">❓</span>
                        <div>
                          <p className="text-sm font-bold text-purple-900">
                            {queriedStep?.approver_name ?? 'Approver'} has a question
                          </p>
                          {queriedStep?.note && (
                            <p className="text-sm text-purple-700 mt-0.5 italic">
                              "{queriedStep.note}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={queryTexts[claim.id] ?? ''}
                          onChange={e =>
                            setQueryTexts(prev => ({ ...prev, [claim.id]: e.target.value }))
                          }
                          onKeyDown={e => e.key === 'Enter' && handleRespond(claim.id)}
                          placeholder="Type your response…"
                          className="flex-1 border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white"
                        />
                        <button
                          onClick={() => handleRespond(claim.id)}
                          disabled={!queryTexts[claim.id]?.trim() || respondingIds.has(claim.id)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                        >
                          {respondingIds.has(claim.id) ? (
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : 'Send'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── FAB (mobile) ────────────────────────────────────────────────── */}
      <motion.button
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => setShowNewClaim(true)}
        className="fixed bottom-8 right-6 sm:hidden w-14 h-14 bg-[#6cffc6] text-white rounded-full shadow-xl flex items-center justify-center text-3xl font-light z-40"
        aria-label="New claim"
      >
        +
      </motion.button>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewClaim && (
          <NewClaimModal
            onClose={() => setShowNewClaim(false)}
            onSuccess={() => { setShowNewClaim(false); fetchClaims(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedId && (
          <ClaimDetailModal
            claimId={selectedId}
            userId={userId}
            onClose={() => setSelectedId(null)}
            onActionComplete={fetchClaims}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
