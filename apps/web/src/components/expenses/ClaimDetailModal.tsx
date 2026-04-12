"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:3001/api/v1';

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
  submitted:   { label: 'Submitted',    pill: 'bg-gray-100 text-gray-600 border-gray-200' },
  pending:     { label: 'Pending',      pill: 'bg-amber-100 text-amber-700 border-amber-200' },
  in_progress: { label: 'In Progress',  pill: 'bg-blue-100 text-blue-700 border-blue-200' },
  queried:     { label: 'Queried',      pill: 'bg-purple-100 text-purple-700 border-purple-200' },
  approved:    { label: 'Approved',     pill: 'bg-green-100 text-green-700 border-green-200' },
  rejected:    { label: 'Rejected',     pill: 'bg-red-100 text-red-700 border-red-200' },
  posted:      { label: 'Posted',       pill: 'bg-teal-100 text-teal-700 border-teal-200' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    + ' ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function getActorName(actorId: string, claim: any): string {
  if (!actorId) return '—';
  if (actorId === claim?.claimant || actorId === claim?.claimant?.toString?.()) {
    return claim.claimant_name ?? actorId;
  }
  const step = claim?.workflow?.steps?.find((s: any) => s.approver_id === actorId);
  if (step?.approver_name) return step.approver_name;
  return actorId.replace(/^person:/, '').replace(/_/g, ' ');
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-gray-100 rounded-xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Severity icon ────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: 'pass' | 'warn' | 'fail' }) {
  if (severity === 'pass')
    return <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
  if (severity === 'warn')
    return <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>;
  return <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}

// ─── Detailed workflow step ───────────────────────────────────────────────────

function WorkflowStep({ step, index }: { step: any; index: number }) {
  const statusMap: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    approved: { label: 'Approved',     icon: '✓', color: 'text-green-700',  bg: 'bg-green-500 text-white' },
    rejected: { label: 'Rejected',     icon: '✗', color: 'text-red-700',    bg: 'bg-red-500 text-white' },
    queried:  { label: 'Query sent',   icon: '?', color: 'text-purple-700', bg: 'bg-purple-500 text-white' },
    pending:  { label: 'Pending review',icon: '…', color: 'text-amber-700',  bg: 'bg-[#2E8B8B] text-white' },
    waiting:  { label: 'Waiting',      icon: '…', color: 'text-gray-400',   bg: 'bg-gray-200 text-gray-400' },
  };

  const cfg = statusMap[step.status] ?? statusMap.waiting;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="flex items-start gap-3"
    >
      {/* Step circle */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${cfg.bg}`}>
          {cfg.icon}
        </div>
        {/* Connector line (except last) */}
        <div className="w-px flex-1 bg-gray-100 mt-1 min-h-[16px]" />
      </div>

      {/* Step detail */}
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-[#1B2A4A] leading-tight">{step.approver_name}</p>
          {step.role_label && (
            <span className="text-[10px] font-bold bg-[#2E8B8B]/10 text-[#2E8B8B] px-2 py-0.5 rounded-full">
              {step.role_label}
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 font-medium ${cfg.color}`}>
          {step.acted_at
            ? `${cfg.label} — ${fmtDateTime(step.acted_at)}`
            : cfg.label === 'Waiting' ? '⏳ Waiting' : `⏳ ${cfg.label}`}
        </p>
        {step.note && (
          <p className="mt-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 italic">
            "{step.note}"
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Activity timeline entry ──────────────────────────────────────────────────

interface TimelineEntry {
  key: string;
  emoji: string;
  emojiBg: string;
  title: string;
  note?: string;
  timestamp?: string;
}

function buildTimeline(claim: any, timeline: any, policyAudit: any[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // Submission event (synthetic from claim.created_at)
  entries.push({
    key: 'submit',
    emoji: '📋',
    emojiBg: 'bg-gray-100',
    title: `Submitted by ${claim.claimant_name ?? 'claimant'}`,
    timestamp: claim.created_at,
  });

  // Policy audit entries
  for (const pa of policyAudit ?? []) {
    if (pa.evaluation_point === 'submission') {
      entries.push({
        key: `pa-sub-${pa.id ?? 0}`,
        emoji: '🔍',
        emojiBg: 'bg-blue-50',
        title: `Policy validated: ${pa.result?.summary?.passed ?? '?'}/${pa.result?.summary?.total ?? '?'} checks passed`,
        timestamp: pa.created_at,
      });
    } else if (pa.evaluation_point === 'approval_review') {
      entries.push({
        key: `pa-appr-${pa.id ?? 0}`,
        emoji: '🔍',
        emojiBg: 'bg-blue-50',
        title: `Policy re-validated at approval: ${pa.result?.summary?.passed ?? '?'}/${pa.result?.summary?.total ?? '?'} checks passed`,
        timestamp: pa.created_at,
      });
    }
  }

  // Workflow routing: for each step that's not 'waiting', show a routing event using resolution_path
  for (const step of claim.workflow?.steps ?? []) {
    if (step.status !== 'waiting') {
      entries.push({
        key: `route-${step.order}`,
        emoji: '🔀',
        emojiBg: 'bg-teal-50',
        title: `Routed to ${step.approver_name}${step.role_label ? ` (${step.role_label})` : ''}`,
        note: step.resolution_path,
        timestamp: claim.created_at, // approximate — same as submission
      });
    }
  }

  // Workflow actions
  for (const action of timeline?.actions ?? []) {
    if (action.action === 'created') continue;
    const actor = getActorName(action.actor_id, claim);
    let emoji = '📋', emojiBg = 'bg-gray-100', title = '';

    switch (action.action) {
      case 'approve':
        emoji = '✅'; emojiBg = 'bg-green-50';
        title = `Approved by ${actor}`;
        break;
      case 'reject':
        emoji = '❌'; emojiBg = 'bg-red-50';
        title = `Rejected by ${actor}`;
        break;
      case 'query':
        emoji = '❓'; emojiBg = 'bg-purple-50';
        title = `Query from ${actor}`;
        break;
      case 'respond':
        emoji = '💬'; emojiBg = 'bg-blue-50';
        title = `Response from ${actor}`;
        break;
    }
    if (title) {
      entries.push({ key: `act-${action.action}-${action.created_at}`, emoji, emojiBg, title, note: action.note, timestamp: action.created_at });
    }
  }

  // Sort chronologically; routing events (same ts as submit) come after submit
  return entries.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (ta === tb) {
      // submission before routing before policy
      const order = ['submit', 'route', 'pa-sub', 'pa-appr'];
      const oa = order.findIndex(p => a.key.startsWith(p));
      const ob = order.findIndex(p => b.key.startsWith(p));
      return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob);
    }
    return ta - tb;
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  claimId: string;
  userId: string;
  onClose: () => void;
  onActionComplete: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ClaimDetailModal({ claimId, userId, onClose, onActionComplete }: Props) {
  const [detail, setDetail]                   = useState<any>(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [policyExpanded, setPolicyExpanded]   = useState(false);
  const [resolutionExpanded, setResolutionExpanded] = useState(false);
  const [queryText, setQueryText]             = useState('');
  const [responding, setResponding]           = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/expenses/${encodeURIComponent(claimId)}`, {}, userId);
      setDetail(data.data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load claim');
    } finally {
      setLoading(false);
    }
  }, [claimId, userId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleRespond = async () => {
    const note = queryText.trim();
    if (!note) return;
    setResponding(true);
    try {
      await apiFetch(
        `/expenses/${encodeURIComponent(claimId)}/action`,
        { method: 'POST', body: JSON.stringify({ action: 'respond', note }) },
        userId
      );
      setQueryText('');
      await fetchDetail();
      onActionComplete();
    } catch { /* silent */ } finally {
      setResponding(false);
    }
  };

  const claim       = detail?.claim;
  const timeline    = detail?.timeline;
  const policyAudit = detail?.policy_audit ?? [];

  const cat = CATEGORIES[claim?.category ?? ''] ?? { label: claim?.category, emoji: '📋' };
  const st  = STATUS_CFG[claim?.status ?? ''] ?? STATUS_CFG.submitted;

  // Policy summary: prefer audit entries, fall back to claim.policy_result
  const submissionAudit  = policyAudit.find((p: any) => p.evaluation_point === 'submission');
  const approvalAudit    = policyAudit.find((p: any) => p.evaluation_point === 'approval_review');
  const submissionResult = submissionAudit?.result ?? claim?.policy_result;
  const approvalResult   = approvalAudit?.result   ?? claim?.policy_result_approval;

  const queriedStep  = claim?.workflow?.steps?.find((s: any) => s.status === 'queried');
  const isQueried    = claim?.status === 'queried';

  const timelineEntries = claim ? buildTimeline(claim, timeline, policyAudit) : [];

  const resolutionLog: string[] = timeline?.instance?.resolution_log
    ?? timeline?.resolution_log
    ?? claim?.workflow?.resolution_log
    ?? [];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <motion.div
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] max-w-full bg-white shadow-2xl flex flex-col"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{cat.emoji}</span>
            <div>
              <p className="font-bold text-[#1B2A4A] text-sm leading-tight">
                {claim?.description ?? cat.label ?? 'Expense Claim'}
              </p>
              {claim?.reference && (
                <p className="text-xs font-mono text-gray-400 mt-0.5">{claim.reference}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`rounded-xl bg-gray-100 animate-pulse ${i === 0 ? 'h-24' : 'h-40'}`} />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500 font-medium">{error}</p>
              <button onClick={fetchDetail} className="mt-3 text-sm font-semibold text-[#2E8B8B] hover:underline">
                Retry
              </button>
            </div>
          ) : (
            <div className="p-5 space-y-5">

              {/* ── 1. Claim header ─────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <p className="text-3xl font-bold text-[#1B2A4A] font-mono">
                    £{(claim?.amount ?? 0).toFixed(2)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${st.pill}`}>
                      {st.label}
                    </span>
                    <span className="text-xs text-gray-400">{fmtDate(claim?.date)}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs font-bold text-gray-500 capitalize">{cat.label}</span>
                  </div>
                  {claim?.has_receipt && (
                    <p className="text-xs text-green-600 font-semibold mt-1.5">📷 Receipt attached</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400 font-medium">Submitted by</p>
                  <p className="text-sm font-bold text-[#1B2A4A]">{claim?.claimant_name ?? '—'}</p>
                  {claim?.claimant_job_title && (
                    <p className="text-xs text-gray-400">{claim.claimant_job_title}</p>
                  )}
                </div>
              </div>

              {/* ── Query banner (if queried) ────────────────────────── */}
              {isQueried && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-purple-500 text-base shrink-0 mt-0.5">❓</span>
                    <div>
                      <p className="text-sm font-bold text-purple-900">
                        {queriedStep?.approver_name ?? 'Approver'} has a question
                      </p>
                      {queriedStep?.note && (
                        <p className="text-sm text-purple-700 mt-1 italic">"{queriedStep.note}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={queryText}
                      onChange={e => setQueryText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRespond()}
                      placeholder="Type your response…"
                      className="flex-1 border border-purple-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 bg-white"
                    />
                    <button
                      onClick={handleRespond}
                      disabled={!queryText.trim() || responding}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      {responding ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : 'Send Response'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── 2. Policy validation panel ───────────────────────── */}
              <Section title="Policy Checks">
                {!submissionResult ? (
                  <p className="text-sm text-gray-400 text-center py-2">No policy data available</p>
                ) : (
                  <div className="space-y-3">
                    {/* Summary badge row */}
                    <div className="flex flex-wrap gap-2">
                      <PolicySummaryBadge
                        label="At submission"
                        result={submissionResult}
                        timestamp={submissionAudit?.created_at ?? claim?.created_at}
                      />
                      {approvalResult && (
                        <PolicySummaryBadge
                          label="At approval review"
                          result={approvalResult}
                          timestamp={approvalAudit?.created_at}
                        />
                      )}
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setPolicyExpanded(v => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-[#2E8B8B] hover:text-[#257373] transition-colors"
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${policyExpanded ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      {policyExpanded ? 'Hide checks' : 'Show individual checks'}
                    </button>

                    <AnimatePresence>
                      {policyExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4 pt-1">
                            <PolicyChecksBlock
                              label="At submission"
                              result={submissionResult}
                              timestamp={submissionAudit?.created_at ?? claim?.created_at}
                            />
                            {approvalResult && (
                              <PolicyChecksBlock
                                label="At approval review"
                                result={approvalResult}
                                timestamp={approvalAudit?.created_at}
                              />
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </Section>

              {/* ── 3. Approval workflow ─────────────────────────────── */}
              <Section title="Approval Workflow">
                {!claim?.workflow?.steps?.length ? (
                  <p className="text-sm text-gray-400 text-center py-2">No workflow data available</p>
                ) : (
                  <div>
                    {claim.workflow.steps.map((step: any, i: number) => (
                      <WorkflowStep key={step.approver_id ?? i} step={step} index={i} />
                    ))}
                    {/* Skipped steps */}
                    {claim.workflow.skipped_steps?.map((skip: any) => (
                      <motion.div
                        key={`skip-${skip.step}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-start gap-3 opacity-40 pb-3"
                      >
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gray-100 text-gray-400">
                            {skip.step}
                          </div>
                        </div>
                        <div className="pt-1.5">
                          <p className="text-sm font-medium text-gray-400">
                            {skip.label && <span className="text-gray-500">{skip.label}</span>}
                          </p>
                          <p className="text-xs text-gray-400 italic">
                            Not required {skip.min_amount && `(below £${skip.min_amount})`}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </Section>

              {/* ── 4. Resolution path ───────────────────────────────── */}
              {resolutionLog.length > 0 && (
                <Section title="How Were Approvers Determined?">
                  <button
                    onClick={() => setResolutionExpanded(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#2E8B8B] hover:text-[#257373] transition-colors"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${resolutionExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    {resolutionExpanded ? 'Hide traversal log' : 'Show graph traversal log'}
                  </button>

                  <AnimatePresence>
                    {resolutionExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 bg-[#1B2A4A]/3 rounded-xl p-4 space-y-1 font-mono text-[11px]">
                          {resolutionLog.map((line, i) =>
                            line === '---' ? (
                              <div key={i} className="border-t border-gray-200 my-2" />
                            ) : (
                              <p
                                key={i}
                                className={
                                  line.startsWith('  ')
                                    ? 'text-[#2E8B8B] pl-3'
                                    : line.startsWith('Final')
                                    ? 'font-bold text-[#1B2A4A] mt-1'
                                    : 'text-gray-600'
                                }
                              >
                                {line}
                              </p>
                            )
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Section>
              )}

              {/* ── 5. Activity timeline ─────────────────────────────── */}
              <Section title="Activity Timeline">
                {timelineEntries.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">No activity yet</p>
                ) : (
                  <div className="space-y-0">
                    {timelineEntries.map((entry, i) => (
                      <motion.div
                        key={entry.key}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex gap-3 pb-4 last:pb-0"
                      >
                        {/* Icon column */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${entry.emojiBg}`}>
                            {entry.emoji}
                          </div>
                          {i < timelineEntries.length - 1 && (
                            <div className="w-px flex-1 bg-gray-100 mt-1 min-h-[12px]" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="pt-1 min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#1B2A4A] leading-snug">{entry.title}</p>
                          {entry.note && (
                            <p className="text-xs text-gray-500 mt-1 italic">"{entry.note}"</p>
                          )}
                          {entry.timestamp && (
                            <p className="text-[10px] text-gray-400 mt-0.5 font-mono">
                              {fmtDateTime(entry.timestamp)}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </Section>

            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Policy summary badge ─────────────────────────────────────────────────────

function PolicySummaryBadge({ label, result, timestamp }: { label: string; result: any; timestamp?: string }) {
  const { passed, warnings, failures, total } = result?.summary ?? {};
  const passedCount = passed ?? 0;
  const warnCount   = warnings ?? 0;
  const failCount   = failures ?? 0;
  const totalCount  = total ?? 0;

  const allPassed  = failCount === 0 && warnCount === 0;
  const hasWarning = warnCount > 0 && failCount === 0;
  const hasFail    = failCount > 0;

  const color = hasFail ? 'bg-red-50 text-red-700 border-red-200'
    : hasWarning ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-green-50 text-green-700 border-green-200';

  const badge = hasFail ? '✗'
    : hasWarning ? '⚠'
    : '✓';

  return (
    <div className={`flex-1 min-w-[160px] rounded-xl border p-3 ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
        <span className="font-bold text-sm">{badge}</span>
      </div>
      <p className="text-base font-bold mt-1">
        {passedCount}/{totalCount} passed
        {warnCount > 0 && ` · ${warnCount} warning${warnCount > 1 ? 's' : ''}`}
        {failCount > 0 && ` · ${failCount} failure${failCount > 1 ? 's' : ''}`}
      </p>
      {timestamp && (
        <p className="text-[10px] opacity-60 mt-0.5 font-mono">{fmtDateTime(timestamp)}</p>
      )}
    </div>
  );
}

// ─── Policy checks block ──────────────────────────────────────────────────────

function PolicyChecksBlock({ label, result, timestamp }: { label: string; result: any; timestamp?: string }) {
  const checks = result?.checks ?? [];
  if (!checks.length) return null;

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
        {label}
        {timestamp && <span className="font-normal normal-case ml-1 text-gray-300">— {fmtDateTime(timestamp)}</span>}
      </p>
      <div className="space-y-1.5">
        {checks.map((check: any, i: number) => (
          <motion.div
            key={check.rule_name ?? i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`flex items-start gap-2.5 text-sm px-3 py-2 rounded-lg ${
              check.severity === 'pass' ? 'bg-green-50 text-green-700'
              : check.severity === 'warn' ? 'bg-amber-50 text-amber-700'
              : 'bg-red-50 text-red-700'
            }`}
          >
            <SeverityIcon severity={check.severity} />
            <span className="leading-snug">{check.message}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
