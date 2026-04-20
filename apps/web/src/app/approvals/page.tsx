"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { Card, Avatar } from '../../components/ui/System';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' ' +
    dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

/** Extract the template step label from the resolution_log, e.g. "Line Manager" */
function extractRoleLabel(log: string[], stepOrder: number): string {
  const line = log?.find(l => l.startsWith(`Step ${stepOrder} (`));
  const m = line?.match(/Step \d+ \(([^)]+)\)/);
  return m?.[1] ?? '';
}

// ─── Severity icon ────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: 'pass' | 'warn' | 'fail' }) {
  if (severity === 'pass')
    return <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>;
  if (severity === 'warn')
    return <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>;
  return <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}

// ─── Policy context panel ─────────────────────────────────────────────────────

function PolicyPanel({ result }: { result: any }) {
  const [expanded, setExpanded] = useState(false);

  if (!result) return null;

  const { passed = 0, warnings = 0, failures = 0, total = 0 } = result.summary ?? {};
  const allGreen = failures === 0 && warnings === 0;
  const hasWarning = warnings > 0 && failures === 0;

  const badgeColor = failures > 0
    ? 'bg-red-100 text-red-700 border-red-200'
    : hasWarning
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-green-100 text-green-700 border-green-200';

  const badgeIcon = failures > 0 ? '✗' : hasWarning ? '⚠' : '✓';

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Policy Validation</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {passed}/{total} passed {badgeIcon}
            {warnings > 0 && ` · ${warnings} warning${warnings > 1 ? 's' : ''}`}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-1.5">
              {(result.checks ?? []).map((check: any, i: number) => (
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Prior approvals ──────────────────────────────────────────────────────────

function PriorApprovals({ steps, currentOrder, resolutionLog }: {
  steps: any[];
  currentOrder: number;
  resolutionLog: string[];
}) {
  const prior = steps?.filter(s => s.order < currentOrder && s.status === 'approved') ?? [];
  if (!prior.length) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Prior Approvals</p>
      {prior.map((step, i) => {
        const role = extractRoleLabel(resolutionLog, step.order);
        return (
          <div key={step.approver_id ?? i} className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-gray-700">
              <span className="font-semibold">Step {step.order}:</span> Approved by{' '}
              <span className="font-semibold">{step.approver_name}</span>
              {role && <span className="text-gray-400"> ({role})</span>}
              {step.acted_at && (
                <span className="text-gray-400"> — {fmtDateTime(step.acted_at)}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Approver routing context ─────────────────────────────────────────────────

function ApproverContext({ currentStep, roleLabel, resolutionLog }: {
  currentStep: any;
  roleLabel: string;
  resolutionLog: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (!currentStep) return null;

  // Find the "Resolved via:" line for this step
  const stepOrder = currentStep.order;
  const resolvedViaLine = resolutionLog?.find(l =>
    l.startsWith(`  Resolved via:`) &&
    resolutionLog.indexOf(l) > resolutionLog.findIndex(ll => ll.startsWith(`Step ${stepOrder} (`))
  );

  return (
    <div className="bg-[#6cffc6]/5 border border-[#6cffc6]/20 rounded-xl px-4 py-3 space-y-1">
      <p className="text-xs text-[#000053] font-semibold">
        You are reviewing as:{' '}
        <span className="font-bold">
          {roleLabel || 'Approver'}
        </span>
      </p>

      {(currentStep.resolution_path || resolvedViaLine) && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[11px] text-[#000053]/70 hover:text-[#000053] transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Why am I in this chain?
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <p className="text-[11px] font-mono text-[#000053]/80 pt-1 leading-relaxed">
                  {currentStep.resolution_path}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ─── Post-action overlay ──────────────────────────────────────────────────────

function PostActionState({
  result,
  claim,
  actionData,
}: {
  result: 'approved' | 'queried' | 'rejected';
  claim: any;
  actionData: { nextApprover?: string; isFinal?: boolean };
}) {
  if (result === 'approved') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <motion.div
          className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 280 }}
        >
          <motion.svg
            className="w-7 h-7 text-green-600"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <motion.path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </motion.svg>
        </motion.div>
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="font-bold text-green-700 text-lg">Approved</p>
          <p className="text-sm text-gray-500 mt-0.5">
            {actionData.isFinal
              ? 'Claim approved — reimbursement queued'
              : actionData.nextApprover
              ? `Forwarded to ${actionData.nextApprover}`
              : 'Claim advanced to next approver'}
          </p>
        </motion.div>
      </div>
    );
  }

  if (result === 'queried') {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <motion.div
          className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center text-2xl"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 280 }}
        >
          ❓
        </motion.div>
        <motion.p
          className="text-sm font-medium text-purple-700 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Query sent to {claim.claimant_name ?? 'claimant'} — awaiting response
        </motion.p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <motion.div
        className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-2xl"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 280 }}
      >
        ✗
      </motion.div>
      <motion.p
        className="text-sm font-medium text-red-700 text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Rejected — claimant notified
      </motion.p>
    </div>
  );
}

// ─── Approval card ────────────────────────────────────────────────────────────

interface ApprovalCardProps {
  claim: any;
  userId: string;
  onDismiss: (id: string, result: 'approved' | 'queried' | 'rejected', amount: number) => void;
  onRequestReject: (claim: any) => void;
}

function ApprovalCard({ claim, userId, onDismiss, onRequestReject }: ApprovalCardProps) {
  const [actionState, setActionState] = useState<
    'idle' | 'loading-approve' | 'loading-query' | 'approved' | 'queried' | 'rejected'
  >('idle');
  const [actionData, setActionData] = useState<{ nextApprover?: string; isFinal?: boolean }>({});
  const [queryActive, setQueryActive] = useState(false);
  const [queryText, setQueryText] = useState('');
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();

  const cat = CATEGORIES[claim.category] ?? { label: claim.category, emoji: '📋' };
  const currentOrder = claim.workflow?.current_step ?? 1;
  const steps: any[] = claim.workflow?.steps ?? [];
  const skipped: any[] = claim.workflow?.skipped_steps ?? [];
  const resolutionLog: string[] = claim.workflow?.resolution_log ?? [];
  const currentStep = steps[currentOrder - 1];
  const roleLabel = extractRoleLabel(resolutionLog, currentOrder);

  // Auto-dismiss after action animation
  useEffect(() => {
    if (actionState === 'approved' || actionState === 'queried' || actionState === 'rejected') {
      dismissTimer.current = setTimeout(() => {
        onDismiss(claim.id, actionState as any, claim.amount ?? 0);
      }, 1800);
    }
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, [actionState, claim.id, claim.amount, onDismiss]);

  const handleApprove = async () => {
    setActionState('loading-approve');
    try {
      const data = await apiFetch(
        `/expenses/${encodeURIComponent(claim.id)}/action`,
        { method: 'POST', body: JSON.stringify({ action: 'approve' }) },
        userId
      );
      const updatedWorkflow = data.data?.workflow;
      const nextPending = updatedWorkflow?.steps?.find((s: any) => s.status === 'pending');
      const isFinal = updatedWorkflow?.status === 'approved';
      setActionData({ nextApprover: nextPending?.approver_name, isFinal });
      setActionState('approved');
    } catch (e: any) {
      setActionState('idle');
    }
  };

  const handleQuery = async () => {
    const note = queryText.trim();
    if (!note) return;
    setActionState('loading-query');
    try {
      await apiFetch(
        `/expenses/${encodeURIComponent(claim.id)}/action`,
        { method: 'POST', body: JSON.stringify({ action: 'query', note }) },
        userId
      );
      setActionState('queried');
    } catch {
      setActionState('idle');
    }
  };

  const isDone = ['approved', 'queried', 'rejected'].includes(actionState);
  const isLoading = actionState.startsWith('loading-');

  return (
    <Card className="overflow-hidden border-gray-200 shadow-sm">
      <AnimatePresence mode="wait">
        {isDone ? (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PostActionState
              result={actionState as any}
              claim={claim}
              actionData={actionData}
            />
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="p-5 pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#000053] text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {claim.claimant_initials ?? '??'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#000053] leading-tight">{claim.claimant_name ?? '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{claim.claimant_job_title ?? ''}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-bold font-mono text-[#000053]">
                    £{(claim.amount ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">{claim.reference}</p>
                </div>
              </div>

              {/* Subtitle row */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 mb-4">
                <span className="text-base">{cat.emoji}</span>
                <span className="text-sm text-gray-700 font-medium truncate">
                  {claim.description || cat.label}
                </span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400">{fmtDate(claim.date)}</span>
                {claim.has_receipt ? (
                  <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                    📎 Receipt ✓
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    ⚠ No receipt
                  </span>
                )}
                {claim.exception_requested && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                    ⚠️ Exception Request
                  </span>
                )}
                {claim.partial_claim && (
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    Partial claim
                  </span>
                )}
              </div>

              {/* Exception justification banner */}
              {claim.exception_requested && claim.exception_justification && (
                <div className="mx-5 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">Exception Justification</p>
                  <p className="text-sm text-amber-800 italic">"{claim.exception_justification}"</p>
                </div>
              )}

              {/* Partial claim note */}
              {claim.partial_claim && (
                <div className="mx-5 mb-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-1">Partial Claim</p>
                  <p className="text-sm text-blue-800">
                    Claiming <span className="font-bold">£{(claim.claim_amount ?? claim.amount ?? 0).toFixed(2)}</span> of a{' '}
                    <span className="font-bold">£{(claim.receipt_amount ?? claim.amount ?? 0).toFixed(2)}</span> receipt
                    {claim.partial_reason && <span className="text-blue-600"> — {claim.partial_reason.replace(/_/g, ' ')}</span>}
                  </p>
                </div>
              )}
            </div>

            {/* ── Body sections ───────────────────────────────────── */}
            <div className="px-5 space-y-3 pb-4">

              {/* Policy validation */}
              <PolicyPanel result={claim.policy_result} />

              {/* Prior approvals */}
              {currentOrder > 1 && (
                <PriorApprovals
                  steps={steps}
                  currentOrder={currentOrder}
                  resolutionLog={resolutionLog}
                />
              )}

              {/* Approver routing context */}
              <ApproverContext
                currentStep={currentStep}
                roleLabel={roleLabel}
                resolutionLog={resolutionLog}
              />
            </div>

            {/* ── Action buttons ───────────────────────────────────── */}
            <div className="border-t border-gray-100 p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {/* Approve */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm shadow-green-600/20"
                >
                  {actionState === 'loading-approve' ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </>
                  )}
                </motion.button>

                {/* Query */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setQueryActive(v => !v)}
                  disabled={isLoading}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    queryActive
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  ❓ Query
                </motion.button>

                {/* Reject */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onRequestReject(claim)}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </motion.button>
              </div>

              {/* Query input (expandable) */}
              <AnimatePresence>
                {queryActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={queryText}
                        onChange={e => setQueryText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleQuery()}
                        placeholder="What do you need to know?"
                        className="flex-1 border border-purple-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 bg-white"
                        autoFocus
                      />
                      <button
                        onClick={handleQuery}
                        disabled={!queryText.trim() || actionState === 'loading-query'}
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        {actionState === 'loading-query' ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                        ) : 'Send Query'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

function RejectModal({
  claim,
  userId,
  onConfirm,
  onCancel,
}: {
  claim: any;
  userId: string;
  onConfirm: (claimId: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) { setError('A reason is required to reject a claim.'); return; }
    setLoading(true);
    try {
      await apiFetch(
        `/expenses/${encodeURIComponent(claim.id)}/action`,
        { method: 'POST', body: JSON.stringify({ action: 'reject', note: reason.trim() }) },
        userId
      );
      onConfirm(claim.id);
    } catch (e: any) {
      setError(e.message ?? 'Rejection failed');
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      />

      {/* Modal */}
      <motion.div
        className="fixed z-50 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[440px] bg-white rounded-2xl shadow-2xl p-6 space-y-4"
        initial={{ scale: 0.95, opacity: 0, y: '-48%' }}
        animate={{ scale: 1, opacity: 1, y: '-50%' }}
        exit={{ scale: 0.95, opacity: 0, y: '-48%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-[#000053]">Reject Claim</h3>
            <p className="text-sm text-gray-500">
              {claim.claimant_name} · £{(claim.amount ?? 0).toFixed(2)} · {claim.reference}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setError(''); }}
            placeholder="Explain why this claim is being rejected…"
            rows={3}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000053] focus:outline-none focus:border-red-400 resize-none transition-colors bg-white placeholder:text-gray-300"
            autoFocus
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
            ) : 'Confirm Rejection'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { user } = useAuth();
  const userId = user?.sub ?? 'person:sarah_chen';

  const [claims, setClaims]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // Claims being animated out (post-action)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Session approved stats (can't fetch from API — no approver history endpoint)
  const [sessionStats, setSessionStats] = useState({ count: 0, total: 0 });

  // Reject modal target
  const [rejectTarget, setRejectTarget] = useState<any>(null);

  // Batch approve state
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [toast, setToast]                 = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/expenses?role=approver', {}, userId);
      setClaims(data.data?.claims ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setClaims([]);
    setDismissedIds(new Set());
    fetchClaims();
  }, [fetchClaims]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDismiss = useCallback((
    id: string,
    result: 'approved' | 'queried' | 'rejected',
    amount: number
  ) => {
    setDismissedIds(prev => new Set([...prev, id]));
    if (result === 'approved') {
      setSessionStats(prev => ({ count: prev.count + 1, total: prev.total + amount }));
    }
  }, []);

  const handleRejectConfirmed = (claimId: string) => {
    setRejectTarget(null);
    setDismissedIds(prev => new Set([...prev, claimId]));
  };

  // ── Batch approve ─────────────────────────────────────────────────────────

  const pending = claims.filter(c => !dismissedIds.has(c.id));

  const handleBatchApprove = async () => {
    const targets = [...pending];
    if (!targets.length) return;

    setBatchProgress({ current: 0, total: targets.length });
    let approvedCount = 0;
    let approvedTotal = 0;

    for (let i = 0; i < targets.length; i++) {
      setBatchProgress({ current: i + 1, total: targets.length });
      try {
        await apiFetch(
          `/expenses/${encodeURIComponent(targets[i].id)}/action`,
          { method: 'POST', body: JSON.stringify({ action: 'approve' }) },
          userId
        );
        approvedCount++;
        approvedTotal += targets[i].amount ?? 0;
        setDismissedIds(prev => new Set([...prev, targets[i].id]));
      } catch { /* skip failed */ }
      // small delay so the visual progression is visible
      await new Promise(r => setTimeout(r, 400));
    }

    setBatchProgress(null);
    setSessionStats(prev => ({
      count: prev.count + approvedCount,
      total: prev.total + approvedTotal,
    }));
    setToast(`${approvedCount} claim${approvedCount !== 1 ? 's' : ''} approved — £${approvedTotal.toFixed(2)} total`);
    setTimeout(() => setToast(null), 4000);
  };

  // ─────────────────────────────────────────────────────────────────────────

  const visibleClaims = claims.filter(c => !dismissedIds.has(c.id));

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-56 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold text-[#000053] tracking-tight">Approvals</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {loading ? 'Loading…'
            : visibleClaims.length > 0
            ? `${visibleClaims.length} claim${visibleClaims.length !== 1 ? 's' : ''} awaiting your review`
            : 'All caught up'}
        </p>
      </div>

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 border-gray-200 shadow-sm">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Awaiting Review</p>
          <p className="text-2xl font-bold text-[#000053] font-mono">
            £{visibleClaims.reduce((s, c) => s + (c.amount ?? 0), 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{visibleClaims.length} claim{visibleClaims.length !== 1 ? 's' : ''}</p>
        </Card>
        <Card className="p-5 border-gray-200 shadow-sm">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Approved This Session</p>
          <p className="text-2xl font-bold text-green-600 font-mono">
            £{sessionStats.total.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{sessionStats.count} claim{sessionStats.count !== 1 ? 's' : ''}</p>
        </Card>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-72 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center border-gray-200">
          <p className="text-red-500 font-medium">{error}</p>
          <button onClick={fetchClaims} className="mt-3 text-sm font-semibold text-[#000053] hover:underline">
            Try again
          </button>
        </Card>
      ) : visibleClaims.length === 0 && !batchProgress ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-bold text-[#000053] text-lg">All caught up</p>
            <p className="text-sm text-gray-500 mt-1">No claims waiting for your approval.</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">

          {/* Batch approve */}
          {pending.length >= 3 && !batchProgress && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
            >
              <p className="text-sm font-semibold text-amber-800">
                {pending.length} claims pending — approve all routine claims at once?
              </p>
              <button
                onClick={handleBatchApprove}
                className="shrink-0 ml-3 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
              >
                Approve All ({pending.length})
              </button>
            </motion.div>
          )}

          {/* Batch progress */}
          {batchProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white border border-gray-200 rounded-xl p-4 space-y-2"
            >
              <div className="flex justify-between text-sm font-semibold text-[#000053]">
                <span>Approving {batchProgress.current} of {batchProgress.total}…</span>
                <span className="text-gray-400">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="bg-green-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}

          {/* Section heading */}
          {!batchProgress && (
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
              Pending Your Approval
            </h2>
          )}

          {/* Claim cards */}
          <div className="space-y-4">
            <AnimatePresence>
              {claims.map((claim, i) => {
                if (dismissedIds.has(claim.id)) return null;
                return (
                  <motion.div
                    key={claim.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, height: 0, marginBottom: 0 }}
                    transition={{
                      layout: { duration: 0.25 },
                      opacity: { duration: 0.2 },
                      delay: i * 0.06,
                    }}
                  >
                    <ApprovalCard
                      claim={claim}
                      userId={userId}
                      onDismiss={handleDismiss}
                      onRequestReject={setRejectTarget}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

        </div>
      )}

      {/* ── Reject modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {rejectTarget && (
          <RejectModal
            claim={rejectTarget}
            userId={userId}
            onConfirm={handleRejectConfirmed}
            onCancel={() => setRejectTarget(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#000053] text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg z-50 whitespace-nowrap"
          >
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
