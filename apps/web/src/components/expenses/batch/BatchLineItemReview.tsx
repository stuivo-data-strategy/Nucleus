"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BatchOCRResult } from './BatchReceiptUploader';
import { BatchHeader } from './BatchClaimHeader';

// ─── Exported types & constants (used by BatchLineEditDrawer) ─────────────────

export type ClaimType = 'MEAL' | 'HOTEL' | 'TRAVEL' | 'FUEL';

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  MEAL: 'MEAL',
  HOTEL: 'HOTEL',
  TRAVEL: 'TRAVEL',
  FUEL: 'FUEL',
};

export const CLAIM_TYPE_CATEGORY: Record<ClaimType, string> = {
  MEAL: 'meals',
  HOTEL: 'accommodation',
  TRAVEL: 'travel',
  FUEL: 'transport',
};

export interface LineItem {
  id: string;
  index: number;
  merchant: string;
  date: string;
  amount: number;
  currency: 'GBP';
  category: string;
  claimType: ClaimType;
  inferredType: 'single' | 'group' | 'mileage';
  description: string;
  policyStatus: 'ok' | 'warning' | 'fail';
  policyMessage?: string | null;
  confidence: number;
  projectCode: string;
  attendeeCount?: number;
  policyOverrideReason?: string;
  effectivePolicyStatus: 'ok' | 'warning' | 'fail';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  header: BatchHeader;
  results: BatchOCRResult[];
  onSubmit: (reference: string, totalAmount: number) => void;
  onBack: () => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function categoryToClaimType(cat: string): ClaimType {
  if (cat === 'hotel') return 'HOTEL';
  if (cat === 'travel') return 'TRAVEL';
  if (cat === 'fuel') return 'FUEL';
  return 'MEAL';
}

function initLineItems(results: BatchOCRResult[], header: BatchHeader): LineItem[] {
  return results.map((r, i) => ({
    id: `line-${i}`,
    index: r.index,
    merchant: r.merchant,
    date: r.date,
    amount: r.amount,
    currency: r.currency,
    category: CLAIM_TYPE_CATEGORY[categoryToClaimType(r.category)],
    claimType: categoryToClaimType(r.category),
    inferredType: r.inferredType,
    description: r.description,
    policyStatus: r.policyStatus,
    policyMessage: r.policyMessage,
    confidence: r.confidence,
    projectCode: header.defaultProjectCode,
    effectivePolicyStatus: r.policyStatus,
  }));
}

function fmtPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return s.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// ─── Project code search ──────────────────────────────────────────────────────

const PROJECT_CODES = [
  { code: 'P-4821', label: 'Project Orion' },
  { code: 'P-4822', label: 'Babcock Framework' },
  { code: 'P-4823', label: 'Manchester Client' },
  { code: 'P-4824', label: 'Infrastructure Review' },
  { code: 'P-4825', label: 'Training & Development' },
  { code: 'P-4826', label: 'Corporate Travel' },
];

function InlineProjectSearch({
  value,
  onChange,
  onClose: onDone,
}: {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const filtered = PROJECT_CODES.filter(
    (p) => p.code.toLowerCase().includes(query.toLowerCase()) || p.label.toLowerCase().includes(query.toLowerCase())
  );

  const select = (code: string) => { onChange(code); onDone(); };

  return (
    <div className="relative min-w-[160px]">
      <input
        ref={ref}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && filtered[0]) select(filtered[0].code); if (e.key === 'Escape') onDone(); }}
        className="w-full border border-[#6cffc6] rounded-lg px-2 py-1 text-xs font-mono text-[#000053] outline-none bg-white"
      />
      {filtered.length > 0 && (
        <div className="absolute z-30 top-full mt-0.5 left-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
          {filtered.slice(0, 5).map((p) => (
            <button
              key={p.code}
              onMouseDown={() => select(p.code)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#e8fff5]"
            >
              <span className="font-mono text-xs font-bold text-[#000053]">{p.code}</span>
              <span className="text-xs text-gray-500">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Policy status badge ──────────────────────────────────────────────────────

function PolicyBadge({
  status,
  onClick,
  active,
}: {
  status: 'ok' | 'warning' | 'fail';
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title="Click to see policy details"
      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2 ${
        active ? 'scale-110 shadow-md' : 'hover:scale-105'
      } ${
        status === 'ok'
          ? 'bg-green-100 text-green-600 border-green-200'
          : status === 'warning'
          ? 'bg-amber-100 text-amber-600 border-amber-200'
          : 'bg-red-100 text-red-600 border-red-200'
      }`}
    >
      {status === 'ok' ? '✓' : status === 'warning' ? '⚠' : '✗'}
    </button>
  );
}

// ─── Type pill ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<ClaimType, string> = {
  MEAL: 'bg-orange-100 text-orange-700',
  HOTEL: 'bg-blue-100 text-blue-700',
  TRAVEL: 'bg-purple-100 text-purple-700',
  FUEL: 'bg-gray-100 text-gray-700',
};

function TypePill({
  type,
  open,
  onOpen,
  onChange,
}: {
  type: ClaimType;
  open: boolean;
  onOpen: () => void;
  onChange: (t: ClaimType) => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onOpen}
        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${TYPE_COLORS[type]} hover:opacity-80 transition-opacity`}
      >
        {type}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-30 top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          >
            {(Object.keys(CLAIM_TYPE_LABELS) as ClaimType[]).map((t) => (
              <button
                key={t}
                onClick={() => onChange(t)}
                className={`w-full px-4 py-2 text-left text-xs font-bold hover:bg-gray-50 ${
                  t === type ? 'bg-[#e8fff5]' : ''
                }`}
              >
                {t}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Inline editable cell ─────────────────────────────────────────────────────

function EditableCell({
  value,
  type = 'text',
  align = 'left',
  className = '',
  onSave,
}: {
  value: string;
  type?: 'text' | 'number' | 'date';
  align?: 'left' | 'right';
  className?: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => { onSave(draft); setEditing(false); };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        className={`w-full border border-[#6cffc6] rounded-lg px-2 py-1 text-xs outline-none bg-white ${
          align === 'right' ? 'text-right font-mono' : ''
        } ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text hover:bg-[#e8fff5] rounded px-1 py-0.5 text-xs transition-colors block ${
        align === 'right' ? 'text-right font-mono' : ''
      } ${className}`}
      title="Click to edit"
    >
      {value}
    </span>
  );
}

// ─── Policy expansion panel ───────────────────────────────────────────────────

function PolicyPanel({
  line,
  onConvertToGroup,
  onOverride,
  onRemove,
  onKeep,
}: {
  line: LineItem;
  onConvertToGroup: () => void;
  onOverride: (reason: string) => void;
  onRemove: () => void;
  onKeep: () => void;
}) {
  const [overrideText, setOverrideText] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  const isGroupSuggestion =
    line.inferredType === 'group' && line.effectivePolicyStatus === 'warning';
  const isHardFail = line.effectivePolicyStatus === 'fail';
  const isOverridePending = !!line.policyOverrideReason;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className={`overflow-hidden border-t ${
        isHardFail ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-start gap-2">
          <span className={`text-base shrink-0 ${isHardFail ? 'text-red-500' : 'text-amber-500'}`}>
            {isHardFail ? '✗' : '⚠'}
          </span>
          <div>
            <p className={`text-sm font-bold ${isHardFail ? 'text-red-800' : 'text-amber-800'}`}>
              {isGroupSuggestion ? `${line.merchant} — Group Expense Flag` : `${line.merchant} — Policy Issue`}
            </p>
            <p className={`text-xs mt-0.5 ${isHardFail ? 'text-red-600' : 'text-amber-700'}`}>
              {line.policyMessage}
            </p>
          </div>
        </div>

        {/* Group suggestion */}
        {isGroupSuggestion && !isOverridePending && (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={onConvertToGroup}
              className="px-3 py-1.5 bg-[#000053] text-white text-xs font-bold rounded-lg hover:bg-[#000080] transition-colors"
            >
              Convert to Group →
            </button>
            <button
              onClick={onKeep}
              className="px-3 py-1.5 border border-amber-300 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors"
            >
              Keep as Meals
            </button>
          </div>
        )}

        {/* Hard fail options */}
        {isHardFail && !isOverridePending && !showOverrideInput && (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => setShowOverrideInput(true)}
              className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
            >
              Request policy override
            </button>
            <button
              onClick={onRemove}
              className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors"
            >
              Remove line
            </button>
          </div>
        )}

        {/* Override input */}
        <AnimatePresence>
          {showOverrideInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-2"
            >
              <textarea
                value={overrideText}
                onChange={(e) => setOverrideText(e.target.value)}
                placeholder="Business justification — e.g. client-nominated hotel, no alternative available at short notice…"
                rows={2}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-xs text-[#000053] bg-white focus:outline-none focus:border-amber-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  disabled={!overrideText.trim()}
                  onClick={() => { onOverride(overrideText.trim()); setShowOverrideInput(false); }}
                  className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Confirm Override Request
                </button>
                <button
                  onClick={() => setShowOverrideInput(false)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Override pending */}
        {isOverridePending && (
          <div className="bg-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
            <span className="font-bold">Override requested</span> — pending approval.{' '}
            <em>"{line.policyOverrideReason}"</em>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Approval route preview ───────────────────────────────────────────────────

interface RouteStep {
  first_name: string;
  last_name: string;
  avatar_initials: string;
  job_title: string;
  role_label?: string;
}

function ApprovalRoute({ highestAmount, category }: { highestAmount: number; category: string }) {
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/expenses/preview-route', {
      method: 'POST',
      body: JSON.stringify({ amount: highestAmount, category }),
    })
      .then((data) => { if (!cancelled) setSteps(data.data?.steps ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [highestAmount, category]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left hover:bg-gray-100 transition-colors"
      >
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Approval Route</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            For highest-value line (£{highestAmount.toFixed(2)}) — all lines follow the same chain
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3">
              {loading ? (
                <div className="flex gap-2 items-center">
                  <div className="w-4 h-4 border-2 border-[#6cffc6] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-400">Loading route…</span>
                </div>
              ) : steps.length === 0 ? (
                <p className="text-xs text-gray-400">No approval route found</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {steps.map((step, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#000053] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {step.avatar_initials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#000053] leading-tight">
                            {step.first_name} {step.last_name}
                          </p>
                          {step.role_label && (
                            <p className="text-[10px] text-gray-400">{step.role_label}</p>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BatchLineItemReview({
  header,
  results,
  onSubmit,
  onBack,
  onClose,
}: Props) {
  const [lineItems, setLineItems] = useState<LineItem[]>(() =>
    initLineItems(results, header)
  );
  const [expandedPolicyRow, setExpandedPolicyRow] = useState<string | null>(null);
  const [openTypeDropdown, setOpenTypeDropdown] = useState<string | null>(null);
  const [editingProjectRow, setEditingProjectRow] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkProjectMode, setBulkProjectMode] = useState(false);
  const [bulkProjectQuery, setBulkProjectQuery] = useState('');
  const [editDrawerLine, setEditDrawerLine] = useState<LineItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Close type dropdowns on outside click
  useEffect(() => {
    const handler = () => setOpenTypeDropdown(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── Derived ──

  const totalAmount = lineItems.reduce((s, l) => s + l.amount, 0);
  const attentionCount = lineItems.filter(
    (l) => l.effectivePolicyStatus === 'warning' || l.effectivePolicyStatus === 'fail'
  ).length;
  const failCount = lineItems.filter((l) => l.effectivePolicyStatus === 'fail').length;
  const canSubmit = failCount === 0 && !submitting;
  const highestLine = lineItems.reduce(
    (max, l) => (l.amount > max.amount ? l : max),
    lineItems[0]
  );

  // ── Mutations ──

  const updateLine = useCallback((id: string, patch: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((l) => l.id !== id));
    setExpandedPolicyRow((r) => (r === id ? null : r));
  }, []);

  const convertToGroup = useCallback((id: string) => {
    setLineItems((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              inferredType: 'group',
              attendeeCount: 4,
              // If amount/4 <= 75, this is now ok
              effectivePolicyStatus: (l.amount / 4) <= 75 ? 'ok' : 'warning',
              policyMessage:
                (l.amount / 4) <= 75
                  ? undefined
                  : `£${(l.amount / 4).toFixed(2)}/head exceeds £75/head limit`,
            }
          : l
      )
    );
    setExpandedPolicyRow(null);
  }, []);

  const requestOverride = useCallback((id: string, reason: string) => {
    setLineItems((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, policyOverrideReason: reason, effectivePolicyStatus: 'warning' }
          : l
      )
    );
    setExpandedPolicyRow(null);
  }, []);

  // ── Submit / draft ──

  const handleDraft = async () => {
    setDraftSaving(true);
    try {
      const res = await fetch('/api/expenses/batch/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ header, lineItems }),
      });
      const data = await res.json();
      // Persist to localStorage so dashboard can show it
      const drafts = JSON.parse(localStorage.getItem('nucleus_batch_drafts') || '[]');
      drafts.unshift({
        id: data.data?.id,
        title: header.contextLabel || `${fmtPeriod(header.periodStart, header.periodEnd)} Expenses`,
        totalAmount,
        lineCount: lineItems.length,
        savedAt: new Date().toISOString(),
        header,
        lineItems,
      });
      localStorage.setItem('nucleus_batch_drafts', JSON.stringify(drafts.slice(0, 10)));
      onClose();
    } catch {
      // Silent — not blocking
    } finally {
      setDraftSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/expenses/batch/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ header, lineItems }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Submission failed');
      }
      const data = await res.json();
      // Persist submitted batch to localStorage for dashboard
      const submitted = JSON.parse(localStorage.getItem('nucleus_batch_submitted') || '[]');
      submitted.unshift({
        ...data.data,
        header,
        lineItems,
      });
      localStorage.setItem('nucleus_batch_submitted', JSON.stringify(submitted.slice(0, 20)));
      onSubmit(data.data.reference, totalAmount);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky header summary ── */}
      <div className="shrink-0 px-5 py-3 border-b border-gray-100 bg-[#000053]/[0.02]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-gray-600">
            <span className="font-bold text-[#000053]">Period:</span>{' '}
            {fmtPeriod(header.periodStart, header.periodEnd)}
          </span>
          {header.contextLabel && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-600">
                <span className="font-bold text-[#000053]">Context:</span> {header.contextLabel}
              </span>
            </>
          )}
          {header.defaultProjectCode && (
            <>
              <span className="text-gray-300">·</span>
              <span className="font-mono text-gray-600">
                <span className="font-bold text-[#000053]">Project:</span> {header.defaultProjectCode}
              </span>
            </>
          )}
          <span className="text-gray-300">·</span>
          <span className="font-bold text-[#000053]">{lineItems.length} lines</span>
          <span className="text-gray-300">·</span>
          <span className="font-mono font-bold text-[#000053]">£{totalAmount.toFixed(2)}</span>
          {attentionCount > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-amber-600 font-bold">{attentionCount} need attention</span>
            </>
          )}
        </div>
      </div>

      {/* ── Multi-select bar ── */}
      <AnimatePresence>
        {selectedRows.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-5 py-2.5 bg-[#e8fff5] border-b border-[#6cffc6]/30 flex items-center gap-3">
              <span className="text-xs font-bold text-[#000053]">
                {selectedRows.size} line{selectedRows.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setBulkProjectMode(true)}
                className="text-xs font-bold text-[#000053] underline hover:text-[#5ae8b0]"
              >
                Edit project code
              </button>
              <button
                onClick={() => {
                  selectedRows.forEach((id) => removeLine(id));
                  setSelectedRows(new Set());
                }}
                className="text-xs font-bold text-red-500 underline hover:text-red-700"
              >
                Delete selected
              </button>
              <button
                onClick={() => setSelectedRows(new Set())}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            </div>

            {/* Bulk project code edit */}
            <AnimatePresence>
              {bulkProjectMode && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3"
                >
                  <span className="text-xs font-bold text-gray-500 shrink-0">Set project code:</span>
                  <input
                    type="text"
                    value={bulkProjectQuery}
                    onChange={(e) => setBulkProjectQuery(e.target.value)}
                    placeholder="e.g. P-4821"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-[#000053] focus:outline-none focus:border-[#6cffc6]"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (!bulkProjectQuery) return;
                      selectedRows.forEach((id) =>
                        updateLine(id, { projectCode: bulkProjectQuery })
                      );
                      setBulkProjectMode(false);
                      setBulkProjectQuery('');
                      setSelectedRows(new Set());
                    }}
                    className="px-3 py-1.5 bg-[#000053] text-white text-xs font-bold rounded-lg"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setBulkProjectMode(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grid / list ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
                <th className="py-2.5 px-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === lineItems.length && lineItems.length > 0}
                    onChange={(e) => {
                      setSelectedRows(e.target.checked ? new Set(lineItems.map((l) => l.id)) : new Set());
                    }}
                    className="w-3.5 h-3.5 accent-[#6cffc6]"
                  />
                </th>
                <th className="py-2.5 px-2 text-left text-gray-400 font-bold uppercase tracking-wider w-8">#</th>
                <th className="py-2.5 px-2 text-left text-gray-400 font-bold uppercase tracking-wider w-16">Type</th>
                <th className="py-2.5 px-3 text-left text-gray-400 font-bold uppercase tracking-wider">Merchant</th>
                <th className="py-2.5 px-2 text-left text-gray-400 font-bold uppercase tracking-wider w-28">Date</th>
                <th className="py-2.5 px-2 text-right text-gray-400 font-bold uppercase tracking-wider w-24">Amount</th>
                <th className="py-2.5 px-2 text-left text-gray-400 font-bold uppercase tracking-wider w-24">Project</th>
                <th className="py-2.5 px-2 text-center text-gray-400 font-bold uppercase tracking-wider w-12">Policy</th>
                <th className="py-2.5 px-2 text-center text-gray-400 font-bold uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line, i) => (
                <React.Fragment key={line.id}>
                  <tr
                    className={`border-b border-gray-100 transition-colors ${
                      selectedRows.has(line.id) ? 'bg-[#e8fff5]' : 'hover:bg-gray-50/50'
                    } ${expandedPolicyRow === line.id ? 'bg-amber-50/30' : ''}`}
                  >
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(line.id)}
                        onChange={(e) => {
                          const next = new Set(selectedRows);
                          if (e.target.checked) next.add(line.id); else next.delete(line.id);
                          setSelectedRows(next);
                        }}
                        className="w-3.5 h-3.5 accent-[#6cffc6]"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-gray-400 font-bold">{i + 1}</td>
                    <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      <TypePill
                        type={line.claimType}
                        open={openTypeDropdown === line.id}
                        onOpen={() => setOpenTypeDropdown(openTypeDropdown === line.id ? null : line.id)}
                        onChange={(t) => {
                          updateLine(line.id, {
                            claimType: t,
                            category: CLAIM_TYPE_CATEGORY[t],
                          });
                          setOpenTypeDropdown(null);
                        }}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <EditableCell
                        value={line.merchant}
                        className="font-semibold text-[#000053] max-w-[200px] truncate"
                        onSave={(v) => updateLine(line.id, { merchant: v })}
                      />
                      {line.inferredType === 'group' && line.attendeeCount && (
                        <p className="text-[10px] text-purple-600 pl-1">
                          Group · {line.attendeeCount} people · £{(line.amount / line.attendeeCount).toFixed(2)}/head
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <EditableCell
                        value={line.date}
                        type="date"
                        className="text-gray-500 w-28"
                        onSave={(v) => updateLine(line.id, { date: v })}
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <EditableCell
                        value={line.amount.toFixed(2)}
                        type="number"
                        align="right"
                        className="font-bold text-[#000053] w-20"
                        onSave={(v) => updateLine(line.id, { amount: parseFloat(v) || line.amount })}
                      />
                    </td>
                    <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      {editingProjectRow === line.id ? (
                        <InlineProjectSearch
                          value={line.projectCode}
                          onChange={(v) => updateLine(line.id, { projectCode: v })}
                          onClose={() => setEditingProjectRow(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingProjectRow(line.id)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border transition-colors ${
                            line.projectCode
                              ? 'bg-[#000053]/5 border-[#000053]/10 text-[#000053] hover:bg-[#e8fff5] hover:border-[#6cffc6]/40'
                              : 'border-dashed border-gray-300 text-gray-400 hover:border-[#6cffc6]/40'
                          }`}
                        >
                          {line.projectCode || '+ Code'}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <PolicyBadge
                        status={line.effectivePolicyStatus}
                        onClick={() =>
                          setExpandedPolicyRow(
                            expandedPolicyRow === line.id ? null : line.id
                          )
                        }
                        active={expandedPolicyRow === line.id}
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditDrawerLine(line)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#000053] transition-colors"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            const copy: LineItem = {
                              ...line,
                              id: `line-${Date.now()}`,
                              merchant: `${line.merchant} (copy)`,
                            };
                            setLineItems((prev) => [...prev, copy]);
                          }}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#000053] transition-colors"
                          title="Duplicate"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove "${line.merchant}"?`)) removeLine(line.id);
                          }}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Policy expansion panel */}
                  <AnimatePresence>
                    {expandedPolicyRow === line.id && line.effectivePolicyStatus !== 'ok' && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <PolicyPanel
                            line={line}
                            onConvertToGroup={() => convertToGroup(line.id)}
                            onOverride={(reason) => requestOverride(line.id, reason)}
                            onRemove={() => removeLine(line.id)}
                            onKeep={() => setExpandedPolicyRow(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile accordion cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {lineItems.map((line, i) => (
            <div key={line.id} className="p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs text-gray-400 font-bold shrink-0">{i + 1}</span>
                  <TypePill
                    type={line.claimType}
                    open={openTypeDropdown === line.id}
                    onOpen={() => setOpenTypeDropdown(openTypeDropdown === line.id ? null : line.id)}
                    onChange={(t) => {
                      updateLine(line.id, { claimType: t, category: CLAIM_TYPE_CATEGORY[t] });
                      setOpenTypeDropdown(null);
                    }}
                  />
                  <p className="font-bold text-[#000053] text-sm truncate">{line.merchant}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-[#000053] text-sm">£{line.amount.toFixed(2)}</span>
                  <PolicyBadge
                    status={line.effectivePolicyStatus}
                    onClick={() => setExpandedPolicyRow(expandedPolicyRow === line.id ? null : line.id)}
                    active={expandedPolicyRow === line.id}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 pl-5">
                <span>{line.date}</span>
                {line.projectCode && (
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{line.projectCode}</span>
                )}
              </div>

              {/* Mobile policy panel */}
              <AnimatePresence>
                {expandedPolicyRow === line.id && line.effectivePolicyStatus !== 'ok' && (
                  <PolicyPanel
                    line={line}
                    onConvertToGroup={() => convertToGroup(line.id)}
                    onOverride={(reason) => requestOverride(line.id, reason)}
                    onRemove={() => removeLine(line.id)}
                    onKeep={() => setExpandedPolicyRow(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Add line manually */}
        <div className="px-4 py-3 border-t border-dashed border-gray-200">
          <button
            onClick={() => {
              const newLine: LineItem = {
                id: `line-manual-${Date.now()}`,
                index: lineItems.length,
                merchant: 'New expense',
                date: new Date().toISOString().split('T')[0],
                amount: 0,
                currency: 'GBP',
                category: 'meals',
                claimType: 'MEAL',
                inferredType: 'single',
                description: '',
                policyStatus: 'ok',
                confidence: 1,
                projectCode: header.defaultProjectCode,
                effectivePolicyStatus: 'ok',
              };
              setLineItems((prev) => [...prev, newLine]);
              setEditDrawerLine(newLine);
            }}
            className="flex items-center gap-2 text-xs font-bold text-[#6cffc6] hover:text-[#5ae8b0] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add line manually
          </button>
        </div>
      </div>

      {/* ── Approval route ── */}
      {highestLine && (
        <div className="shrink-0 px-5 py-3 border-t border-gray-100">
          <ApprovalRoute
            highestAmount={highestLine.amount}
            category={highestLine.category}
          />
        </div>
      )}

      {/* ── Submit error ── */}
      <AnimatePresence>
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="shrink-0 mx-5 mb-1 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700"
          >
            {submitError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sticky footer ── */}
      <div className="shrink-0 px-5 py-4 border-t border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back to scan</span>
          </button>

          <button
            onClick={handleDraft}
            disabled={draftSaving}
            className="px-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0"
          >
            {draftSaving ? 'Saving…' : 'Save as draft'}
          </button>

          <motion.button
            whileTap={{ scale: canSubmit ? 0.97 : 1 }}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              canSubmit
                ? 'bg-[#6cffc6] text-white hover:bg-[#5ae8b0] shadow-md shadow-[#6cffc6]/20'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                Submit batch claim
                <span className="font-mono opacity-80">· £{totalAmount.toFixed(2)}</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </motion.button>
        </div>
        {!canSubmit && failCount > 0 && (
          <p className="text-xs text-red-500 font-medium mt-2 text-center">
            {failCount} line{failCount !== 1 ? 's' : ''} with unresolved policy failures — resolve before submitting
          </p>
        )}
      </div>

      {/* ── Edit drawer ── */}
      <AnimatePresence>
        {editDrawerLine && (
          <React.Suspense fallback={null}>
            <EditDrawerLazy
              line={editDrawerLine}
              lineNumber={(lineItems.findIndex((l) => l.id === editDrawerLine.id) ?? 0) + 1}
              onSave={(updated) => {
                setLineItems((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
                setEditDrawerLine(null);
              }}
              onClose={() => setEditDrawerLine(null)}
            />
          </React.Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}

// Lazy-ish wrapper to avoid circular dep issues with BatchLineEditDrawer
import BatchLineEditDrawer from './BatchLineEditDrawer';

function EditDrawerLazy(props: Parameters<typeof BatchLineEditDrawer>[0]) {
  return <BatchLineEditDrawer {...props} />;
}
