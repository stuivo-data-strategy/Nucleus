"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { Card } from '../../components/ui/System';

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
  meals:           { label: 'Meals',         emoji: '🍽️' },
  travel:          { label: 'Travel',        emoji: '✈️' },
  accommodation:   { label: 'Hotel',         emoji: '🏨' },
  transport:       { label: 'Transport',     emoji: '🚕' },
  office_supplies: { label: 'Supplies',      emoji: '📦' },
  training:        { label: 'Training',      emoji: '🎓' },
  mileage:         { label: 'Mileage',       emoji: '🚗' },
  other:           { label: 'Other',         emoji: '📋' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateTime(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

function formatPersonId(id: string): string {
  if (!id || id === 'system') return 'System';
  return id
    .replace(/^person:/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function describeChange(entry: any): string {
  const r = entry.result;
  if (!r || typeof r !== 'object') return 'Policy updated';

  const { previous, updated, changes } = r;
  const raw = updated?.category || previous?.category || '';
  const cat = CATEGORIES[raw]?.label ?? (raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' '));

  const parts: string[] = [];

  if (changes?.max_amount !== undefined) {
    const from = previous?.max_amount;
    const to   = Number(changes.max_amount);
    parts.push(
      from != null
        ? `${cat} spending limit changed from £${Number(from).toFixed(2)} to £${to.toFixed(2)}`
        : `${cat} spending limit set to £${to.toFixed(2)}`
    );
  }
  if (changes?.receipt_threshold !== undefined) {
    const from = previous?.receipt_threshold;
    const to   = Number(changes.receipt_threshold);
    parts.push(
      from != null
        ? `${cat} receipt threshold changed from £${Number(from).toFixed(2)} to £${to.toFixed(2)}`
        : `${cat} receipt threshold set to £${to.toFixed(2)}`
    );
  }
  if (changes?.per_diem_rate !== undefined) {
    const from = previous?.per_diem_rate;
    const to   = Number(changes.per_diem_rate);
    parts.push(
      from != null
        ? `${cat} per diem changed from £${Number(from).toFixed(2)} to £${to.toFixed(2)}`
        : `${cat} per diem set to £${to.toFixed(2)}`
    );
  }

  return parts.length > 0 ? parts.join('; ') : `${cat} policy updated`;
}

// ─── Editable cell ────────────────────────────────────────────────────────────

type FlashState = 'idle' | 'saving' | 'saved' | 'error';

function EditableCell({
  value,
  onSave,
  nullable = false,
}: {
  value: number | undefined;
  onSave: (v: number) => Promise<void>;
  nullable?: boolean;
}) {
  const [editing, setEditing]     = useState(false);
  const [localVal, setLocalVal]   = useState(value != null ? value.toFixed(2) : '');
  const [flash, setFlash]         = useState<FlashState>('idle');
  const inputRef                  = useRef<HTMLInputElement>(null);
  const flashTimer                = useRef<ReturnType<typeof setTimeout>>();

  // Keep local value in sync when parent updates rule after save
  useEffect(() => {
    if (!editing) setLocalVal(value != null ? value.toFixed(2) : '');
  }, [value, editing]);

  const save = useCallback(async () => {
    const num = parseFloat(localVal);
    if (isNaN(num)) {
      setEditing(false);
      setLocalVal(value != null ? value.toFixed(2) : '');
      return;
    }
    if (num === value) { setEditing(false); return; }

    setEditing(false);
    setFlash('saving');
    try {
      await onSave(num);
      setFlash('saved');
    } catch {
      setFlash('error');
      setLocalVal(value != null ? value.toFixed(2) : '');
    }
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash('idle'), 2200);
  }, [localVal, value, onSave]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="1"
        min="0"
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter')  save();
          if (e.key === 'Escape') { setEditing(false); setLocalVal(value != null ? value.toFixed(2) : ''); }
        }}
        className="w-24 text-right font-mono text-sm px-2 py-1.5 border-2 border-[#2E8B8B] rounded-lg outline-none bg-[#eaf5f5] text-[#1B2A4A] focus:ring-0"
        autoFocus
      />
    );
  }

  const display =
    flash === 'saving' ? '…'
    : flash === 'saved'  ? `£${parseFloat(localVal || '0').toFixed(2)}`
    : flash === 'error'  ? 'Error'
    : value != null      ? `£${value.toFixed(2)}`
    : '—';

  return (
    <button
      onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      title="Click to edit"
      className={`font-mono text-sm px-2 py-1.5 rounded-lg border transition-all duration-200 min-w-[5rem] text-right ${
        flash === 'saved'
          ? 'border-green-300 bg-green-50 text-green-700 font-bold'
          : flash === 'error'
          ? 'border-red-300 bg-red-50 text-red-600'
          : flash === 'saving'
          ? 'border-gray-200 text-gray-400 animate-pulse'
          : value != null
          ? 'border-dashed border-gray-300 hover:border-[#2E8B8B]/60 hover:bg-[#eaf5f5]/60 text-[#1B2A4A] cursor-text'
          : 'border-dashed border-gray-200 text-gray-300 hover:border-gray-300 cursor-text'
      }`}
    >
      {display}
      {flash === 'saved' && (
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          className="ml-1 text-green-600"
        >
          ✓
        </motion.span>
      )}
    </button>
  );
}

// ─── Policy rules table ───────────────────────────────────────────────────────

function PolicyTable({
  rules,
  onUpdate,
}: {
  rules: any[];
  onUpdate: (ruleId: string, field: string, value: number) => Promise<void>;
}) {
  if (!rules.length) {
    return <p className="text-sm text-gray-400 text-center py-8">No policy rules found</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="border-b-2 border-gray-100">
            {['Category', 'Spending Limit', 'Receipt Required Above', 'Per Diem', 'GL Code', 'VAT'].map(col => (
              <th
                key={col}
                className={`py-3 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest ${
                  col === 'Category' ? 'text-left' : 'text-right'
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, i) => {
            const cat = CATEGORIES[rule.category] ?? { label: rule.category, emoji: '📋' };
            return (
              <motion.tr
                key={rule.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group"
              >
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg leading-none">{cat.emoji}</span>
                    <span className="font-semibold text-[#1B2A4A]">{cat.label}</span>
                    {rule.description && (
                      <span className="text-xs text-gray-400 hidden group-hover:inline">{rule.description}</span>
                    )}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <EditableCell
                    value={rule.max_amount}
                    onSave={v => onUpdate(rule.category, 'max_amount', v)}
                  />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <EditableCell
                    value={rule.receipt_threshold}
                    onSave={v => onUpdate(rule.category, 'receipt_threshold', v)}
                  />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <EditableCell
                    value={rule.per_diem_rate}
                    onSave={v => onUpdate(rule.category, 'per_diem_rate', v)}
                    nullable
                  />
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-xs text-gray-500">
                  {rule.gl_code ?? '—'}
                </td>
                <td className="py-3.5 px-4 text-right text-gray-500">
                  {rule.vat_rate != null ? `${(rule.vat_rate * 100).toFixed(0)}%` : '—'}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Approval chain diagram ───────────────────────────────────────────────────

function ApprovalChainDiagram({ thresholds }: { thresholds: any }) {
  const ccAbove      = thresholds?.cc_owner_above  ?? 100;
  const financeAbove = thresholds?.finance_above   ?? 500;

  const tiers = [
    {
      range:    'Under £25 (with receipt)',
      rangeNote:'receipt_threshold',
      steps:    [{ label: 'Auto-Approved', icon: '✓', cls: 'bg-gray-100 text-gray-500 border-gray-200' }],
      dimmed:   true,
    },
    {
      range:    `£25 – £${ccAbove - 1}`,
      steps:    [{ label: 'Line Manager', icon: '①', cls: 'bg-[#2E8B8B]/10 text-[#2E8B8B] border-[#2E8B8B]/30' }],
    },
    {
      range:    `£${ccAbove} – £${financeAbove - 1}`,
      steps:    [
        { label: 'Line Manager',      icon: '①', cls: 'bg-[#2E8B8B]/10 text-[#2E8B8B] border-[#2E8B8B]/30' },
        { label: 'Cost Centre Owner', icon: '②', cls: 'bg-[#1B2A4A]/10 text-[#1B2A4A] border-[#1B2A4A]/20' },
      ],
    },
    {
      range:    `£${financeAbove}+`,
      steps:    [
        { label: 'Line Manager',      icon: '①', cls: 'bg-[#2E8B8B]/10 text-[#2E8B8B] border-[#2E8B8B]/30' },
        { label: 'Cost Centre Owner', icon: '②', cls: 'bg-[#1B2A4A]/10 text-[#1B2A4A] border-[#1B2A4A]/20' },
        { label: 'Finance',           icon: '③', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Diagram rows */}
      <div className="space-y-3">
        {tiers.map((tier, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`flex items-center gap-4 ${tier.dimmed ? 'opacity-60' : ''}`}
          >
            {/* Amount range */}
            <div className="w-36 shrink-0 text-right">
              <span className={`text-xs font-mono font-bold ${tier.dimmed ? 'text-gray-400' : 'text-[#1B2A4A]'}`}>
                {tier.range}
              </span>
            </div>

            {/* Arrow from range to chain */}
            <svg className="w-5 h-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 20 16">
              <path d="M0 8h16M10 2l8 6-8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            {/* Step boxes */}
            <div className="flex items-center gap-2 flex-wrap">
              {tier.steps.map((step, j) => (
                <React.Fragment key={j}>
                  {j > 0 && (
                    <svg className="w-5 h-4 shrink-0 text-gray-300" fill="none" viewBox="0 0 20 16">
                      <path d="M0 8h16M10 2l8 6-8 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap ${step.cls}`}>
                    <span>{step.icon}</span>
                    {step.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Graph routing note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-[#1B2A4A]/3 border border-[#1B2A4A]/10 rounded-xl p-4 mt-2"
      >
        <p className="text-sm text-[#1B2A4A]/80 leading-relaxed">
          <span className="font-bold text-[#1B2A4A]">Graph-based routing</span> — Approvers are resolved from the organisation hierarchy at submission time, not configured here.
          When an employee's reporting line or cost centre changes, routing updates automatically.
          The resolution path (e.g. <span className="font-mono text-xs bg-white/60 px-1 py-0.5 rounded">Sarah Chen →[reports_to]→ Alex Drummond</span>) is recorded on every workflow instance for full auditability.
        </p>
      </motion.div>
    </div>
  );
}

// ─── Audit log ────────────────────────────────────────────────────────────────

function AuditLog({ entries }: { entries: any[] }) {
  if (!entries.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No policy changes recorded yet. Edit a rule above to create the first entry.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-50">
      {entries.map((entry, i) => {
        const description = describeChange(entry);
        const person      = formatPersonId(entry.evaluated_by);
        const timestamp   = fmtDateTime(entry.created_at);

        return (
          <motion.div
            key={entry.id ?? i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-start gap-3 py-3.5"
          >
            <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-sm">
              ⚙️
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1B2A4A] leading-snug">{description}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                By <span className="font-medium text-gray-500">{person}</span>
                <span className="mx-1.5 text-gray-200">·</span>
                <span className="font-mono">{timestamp}</span>
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Demo tip ─────────────────────────────────────────────────────────────────

function DemoTip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#eaf5f5] border border-[#2E8B8B]/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="text-sm font-bold text-[#2E8B8B]">Demo Script — "Change a Rule, See It Enforced"</span>
        </div>
        <svg
          className={`w-4 h-4 text-[#2E8B8B] transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ol className="px-5 pb-4 space-y-2 text-sm text-[#1B2A4A]/80">
              {[
                'Note that the Meals spending limit is £75.00.',
                'Go to Expenses → New Claim → select Meals → type £80 → see red "Exceeds limit" and submit disabled.',
                'Come back here → change the Meals limit to £100 → see "Updated ✓".',
                'Go to Expenses → New Claim → select Meals → type £80 → see green "Within limit" → submit enabled.',
                'Change it back to £75 → the £80 claim is blocked again. Policy is live data.',
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#2E8B8B] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PolicyPage() {
  const { user } = useAuth();
  const userId = user?.sub ?? 'person:sarah_chen';

  const [rules,      setRules]      = useState<any[]>([]);
  const [auditLog,   setAuditLog]   = useState<any[]>([]);
  const [thresholds, setThresholds] = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesData, auditData, threshData] = await Promise.all([
        apiFetch('/policies/rules',               {}, userId),
        apiFetch('/policies/audit/POLICY_CHANGE', {}, userId),
        apiFetch('/policies/thresholds',          {}, userId),
      ]);
      setRules(rulesData.data ?? []);
      // Newest first
      setAuditLog([...(auditData.data ?? [])].reverse());
      setThresholds(threshData.data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load policy data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUpdate = async (category: string, field: string, value: number) => {
    try {
      const data = await apiFetch(
        `/policies/rules/category/${encodeURIComponent(category)}`,
        { method: 'PATCH', body: JSON.stringify({ [field]: value }) },
        userId
      );
      // Update local state immediately — no full re-fetch for the table
      setRules(prev => prev.map(r => r.category === category ? { ...r, ...data.data } : r));
      // Refresh audit log to show new entry
      const auditData = await apiFetch('/policies/audit/POLICY_CHANGE', {}, userId);
      setAuditLog([...(auditData.data ?? [])].reverse());
    } catch (e: any) {
      setError(`Update failed: ${e.message}`);
      throw e;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-in fade-in duration-300">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2A4A] tracking-tight">Policy Administration</h1>
          <p className="text-gray-500 mt-1.5 text-sm max-w-xl">
            Spending limits and receipt rules are live data in SurrealDB. Changes take effect immediately —
            no deploy, no restart. The policy engine reads these values on every claim validation.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-xl shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live · SurrealDB
        </div>
      </div>

      {/* ── Demo tip ──────────────────────────────────────────────────── */}
      <DemoTip />

      {/* ── Policy Rules Table ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center border-gray-200">
          <p className="text-red-500 font-medium">{error}</p>
          <button onClick={fetchAll} className="mt-3 text-sm font-semibold text-[#2E8B8B] hover:underline">
            Retry
          </button>
        </Card>
      ) : (
        <Card className="border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#1B2A4A]">Spending Limits & Receipt Rules</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Click any dashed value to edit — changes are written to SurrealDB instantly
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block w-4 border-b border-dashed border-gray-400" />
              = editable
            </div>
          </div>
          <div className="p-4">
            <PolicyTable rules={rules} onUpdate={handleUpdate} />
          </div>
        </Card>
      )}

      {/* ── Approval chain diagram ─────────────────────────────────────── */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <p className="text-sm font-bold text-[#1B2A4A]">Approval Routing — Amount Thresholds</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Claim amount determines how many approvers are required
          </p>
        </div>
        <div className="p-5">
          <ApprovalChainDiagram thresholds={thresholds} />
        </div>
      </Card>

      {/* ── Delegation placeholder ─────────────────────────────────────── */}
      <Card className="border-gray-200 shadow-sm overflow-hidden opacity-75">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <p className="text-sm font-bold text-[#1B2A4A]">Delegated Approval Routing</p>
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                Future development
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Route approvals to a designated delegate when the primary approver is unavailable
            </p>
          </div>
          {/* Disabled toggle */}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <span className="text-xs text-gray-400">Off</span>
            <div className="w-10 h-5 rounded-full bg-gray-200 relative cursor-not-allowed" title="Not yet available">
              <div className="w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 left-0.5 transition-all" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="space-y-3">
            {[
              { label: 'Delegate Assignment', desc: 'Assign a named delegate per approver role' },
              { label: 'Delegation Period',   desc: 'Set start and end dates for active delegation' },
              { label: 'Delegation Scope',    desc: 'Limit delegation to specific claim categories or amounts' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3 px-3 py-2.5 bg-gray-50 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">{item.label}</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── SLA-based routing placeholder ──────────────────────────────── */}
      <Card className="border-gray-200 shadow-sm overflow-hidden opacity-75">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <p className="text-sm font-bold text-[#1B2A4A]">SLA-based Escalation Routing</p>
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                Future development
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Automatically escalate to the next approver if not actioned within a defined SLA period
            </p>
          </div>
          {/* Disabled toggle */}
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <span className="text-xs text-gray-400">Off</span>
            <div className="w-10 h-5 rounded-full bg-gray-200 relative cursor-not-allowed" title="Not yet available">
              <div className="w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 left-0.5 transition-all" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="space-y-3">
            {[
              { label: 'SLA Period',         desc: 'Hours before an unanswered approval triggers escalation' },
              { label: 'Escalation Target',  desc: 'Who receives the claim when SLA is breached (e.g. skip-level)' },
              { label: 'Reminder Cadence',   desc: 'Notify the original approver before SLA expires' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3 px-3 py-2.5 bg-gray-50 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-400">{item.label}</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Policy change audit log ─────────────────────────────────────── */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#1B2A4A]">Recent Policy Changes</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Every rule change is written to the audit log with before/after values
            </p>
          </div>
          {auditLog.length > 0 && (
            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
              {auditLog.length} {auditLog.length === 1 ? 'change' : 'changes'}
            </span>
          )}
        </div>
        <div className="px-5">
          <AuditLog entries={auditLog} />
        </div>
      </Card>

    </div>
  );
}
