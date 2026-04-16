"use client";

import React, { useState, useEffect, useCallback } from 'react';
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

async function apiFetchRaw(endpoint: string, options: RequestInit = {}, userId?: string): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['x-user-id'] = userId;
  return fetch(`${BASE}${endpoint}`, { ...options, headers });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; emoji: string }> = {
  meals:           { label: 'Meals',      emoji: '🍽️' },
  travel:          { label: 'Travel',     emoji: '✈️' },
  accommodation:   { label: 'Hotel',      emoji: '🏨' },
  transport:       { label: 'Transport',  emoji: '🚕' },
  office_supplies: { label: 'Supplies',   emoji: '📦' },
  supplies:        { label: 'Supplies',   emoji: '📦' },
  training:        { label: 'Training',   emoji: '🎓' },
  mileage:         { label: 'Mileage',    emoji: '🚗' },
  other:           { label: 'Other',      emoji: '📋' },
};

type VatClassification = 'fully_reclaimable' | 'partially_reclaimable' | 'not_reclaimable' | 'zero_rated';

const CLASS_LABELS: Record<VatClassification, { label: string; color: string; badge: string }> = {
  fully_reclaimable:     { label: 'Fully Reclaimable',    color: 'text-green-700',  badge: 'bg-green-50 border-green-200 text-green-700' },
  partially_reclaimable: { label: 'Partially Reclaimable', color: 'text-blue-700',  badge: 'bg-blue-50 border-blue-200 text-blue-700' },
  not_reclaimable:       { label: 'Not Reclaimable',       color: 'text-red-600',   badge: 'bg-red-50 border-red-200 text-red-600' },
  zero_rated:            { label: 'Zero-Rated',            color: 'text-gray-500',  badge: 'bg-gray-50 border-gray-200 text-gray-500' },
};

const CLASS_OPTIONS: VatClassification[] = ['fully_reclaimable', 'partially_reclaimable', 'not_reclaimable', 'zero_rated'];

// ─── Quarter selector helpers ─────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

function periodOptions(): string[] {
  const year = new Date().getFullYear();
  const options: string[] = [];
  for (let y = year; y >= year - 1; y--) {
    for (let q = 4; q >= 1; q--) {
      options.push(`${y}-Q${q}`);
    }
  }
  return options;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return `£${n.toFixed(2)}`; }
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function vatFromGross(amount: number) { return Math.round((amount / 6) * 100) / 100; }
function reclaimableVat(amount: number, cls: VatClassification, businessPortion?: number): number {
  if (cls === 'zero_rated' || cls === 'not_reclaimable') return 0;
  const vat = vatFromGross(amount);
  if (cls === 'partially_reclaimable' && businessPortion != null) {
    return Math.round(vat * businessPortion) / 100;
  }
  return vat;
}

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

// ─── Classification card ──────────────────────────────────────────────────────

interface ClassCardProps {
  claim: any;
  userId: string;
  period: string;
  onClassified: (id: string) => void;
}

function ClassCard({ claim, userId, period, onClassified }: ClassCardProps) {
  const [classification, setClassification] = useState<VatClassification>(claim.auto_classification ?? 'fully_reclaimable');
  const [businessPortion, setBusinessPortion] = useState<number>(50);
  const [supplierVatNo, setSupplierVatNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const cat = CATEGORIES[claim.category] ?? { label: claim.category, emoji: '📋' };
  const effectiveAmount = claim.claim_amount ?? claim.amount;
  const vatAmt = vatFromGross(effectiveAmount);
  const reclaimAmt = reclaimableVat(effectiveAmount, classification, businessPortion);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/vat/${encodeURIComponent(claim.id)}/classify`, {
        method: 'POST',
        body: JSON.stringify({
          classification,
          period,
          business_portion: classification === 'partially_reclaimable' ? businessPortion : undefined,
          supplier_vat_number: supplierVatNo || undefined,
        }),
      }, userId);
      setDone(true);
      setTimeout(() => onClassified(claim.id), 600);
    } catch { setSaving(false); }
  };

  const isAutoMatch = classification === claim.auto_classification;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: done ? 0 : 1, y: done ? -8 : 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border bg-white shadow-sm border-gray-200"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="w-9 h-9 rounded-full bg-[#1B2A4A] text-white text-sm font-bold flex items-center justify-center shrink-0">
          {claim.claimant_initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#1B2A4A] text-sm">{claim.claimant_name}</span>
            <span className="text-xs font-mono text-gray-300">{claim.reference}</span>
            {claim.partial_claim && (
              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">Partial</span>
            )}
            {claim.exception_requested && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full">Exception</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {cat.emoji} {claim.description || cat.label} · {fmtDate(claim.date)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold font-mono text-[#1B2A4A]">{fmt(effectiveAmount)}</p>
          <p className="text-[10px] text-gray-400 font-mono">VAT: {fmt(vatAmt)}</p>
        </div>
      </div>

      {/* Auto-classification hint */}
      {claim.auto_classification && (
        <div className={`mx-4 mb-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${
          isAutoMatch ? 'bg-teal-50 border border-teal-100' : 'bg-gray-50 border border-gray-100'
        }`}>
          <span className={isAutoMatch ? 'text-teal-700' : 'text-gray-400'}>
            {isAutoMatch ? '✓ Auto-classified:' : '↻ Suggested:'}
          </span>
          <span className={`font-bold ${isAutoMatch ? 'text-teal-800' : 'text-gray-500'}`}>
            {CLASS_LABELS[claim.auto_classification].label}
          </span>
          {claim.auto_reason && (
            <span className={isAutoMatch ? 'text-teal-600' : 'text-gray-400'}>— {claim.auto_reason}</span>
          )}
        </div>
      )}

      {/* Classification radio buttons */}
      <div className="mx-4 mb-3 grid grid-cols-2 gap-2">
        {CLASS_OPTIONS.map(opt => {
          const meta = CLASS_LABELS[opt];
          const selected = classification === opt;
          return (
            <button
              key={opt}
              onClick={() => setClassification(opt)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                selected
                  ? 'border-[#2E8B8B] bg-[#eaf5f5] ring-1 ring-[#2E8B8B]/30'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                selected ? 'border-[#2E8B8B]' : 'border-gray-300'
              }`}>
                {selected && <div className="w-2 h-2 rounded-full bg-[#2E8B8B]" />}
              </div>
              <span className={`text-xs font-semibold ${selected ? 'text-[#1B2A4A]' : 'text-gray-600'}`}>
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Business portion slider (partial reclaimable) */}
      <AnimatePresence>
        {classification === 'partially_reclaimable' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden mx-4 mb-3"
          >
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-700">Business portion</p>
                <p className="text-sm font-bold font-mono text-blue-800">{businessPortion}%</p>
              </div>
              <input
                type="range"
                min={0} max={100} step={5}
                value={businessPortion}
                onChange={e => setBusinessPortion(Number(e.target.value))}
                className="w-full accent-[#2E8B8B]"
              />
              <p className="text-xs text-blue-600">
                Reclaimable VAT: <span className="font-bold font-mono">{fmt(reclaimableVat(effectiveAmount, 'partially_reclaimable', businessPortion))}</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Supplier VAT number + reclaimable preview */}
      <div className="mx-4 mb-3 flex gap-2 items-center">
        <input
          type="text"
          placeholder="Supplier VAT No. (optional)"
          value={supplierVatNo}
          onChange={e => setSupplierVatNo(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-[#1B2A4A] focus:outline-none focus:border-[#2E8B8B] placeholder:text-gray-300"
        />
        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono ${
          reclaimAmt > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-400 border border-gray-100'
        }`}>
          {fmt(reclaimAmt)} reclaimable
        </div>
      </div>

      {/* Save button */}
      <div className="px-4 pb-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving || done}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#2E8B8B] text-white hover:bg-[#257373] disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : done ? '✓ Classified' : 'Confirm Classification'}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── VAT Summary table ────────────────────────────────────────────────────────

function VatSummaryTable({ rows, onExport, exporting }: {
  rows: any[];
  onExport: () => void;
  exporting: boolean;
}) {
  const totalReclaimable = rows.reduce((s, r) => s + (r.reclaimable_vat ?? 0), 0);
  const totalVat         = rows.reduce((s, r) => s + (r.vat_amount ?? 0), 0);
  const totalGross       = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
        <p className="text-4xl mb-3">📊</p>
        <p className="font-bold text-[#1B2A4A]">No classified claims for this period</p>
        <p className="text-sm text-gray-500 mt-1">Classify claims in the queue to see the VAT summary</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Box 4 Summary</p>
          <p className="text-2xl font-bold font-mono text-green-700">{fmt(totalReclaimable)}</p>
          <p className="text-xs text-gray-500">total VAT to reclaim</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B2A4A] text-white rounded-xl text-sm font-bold hover:bg-[#2a3d63] disabled:opacity-60 transition-colors"
        >
          {exporting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV (Box 4)
            </>
          )}
        </motion.button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-center px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Claims</th>
              <th className="text-right px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Gross</th>
              <th className="text-right px-3 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">VAT (20%)</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reclaimable</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Classification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => {
              const cat = CATEGORIES[row.category] ?? { label: row.category, emoji: '📋' };
              const dominant = Object.entries(row.classification_breakdown ?? {})
                .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] as VatClassification | undefined;
              return (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1B2A4A]">
                    {cat.emoji} {cat.label}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-500">{row.claim_count}</td>
                  <td className="px-3 py-3 text-right font-mono text-gray-600">{fmt(row.total_amount ?? 0)}</td>
                  <td className="px-3 py-3 text-right font-mono text-gray-500">{fmt(row.vat_amount ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700">{fmt(row.reclaimable_vat ?? 0)}</td>
                  <td className="px-4 py-3 text-right">
                    {dominant && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CLASS_LABELS[dominant]?.badge ?? ''}`}>
                        {CLASS_LABELS[dominant]?.label ?? dominant}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              <td className="px-4 py-3 font-bold text-[#1B2A4A]">Total</td>
              <td className="px-3 py-3 text-center font-bold text-[#1B2A4A]">
                {rows.reduce((s, r) => s + r.claim_count, 0)}
              </td>
              <td className="px-3 py-3 text-right font-mono font-bold text-[#1B2A4A]">{fmt(totalGross)}</td>
              <td className="px-3 py-3 text-right font-mono font-bold text-[#1B2A4A]">{fmt(totalVat)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-green-700">{fmt(totalReclaimable)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VatPage() {
  const { user } = useAuth();
  const userId = user?.sub || 'person:daniel_frost';
  const isVatOfficer = user?.roles?.includes('vat_officer') || user?.roles?.includes('finance_approver') || user?.roles?.includes('system_admin');

  const [period, setPeriod] = useState(currentPeriod());
  const [tab, setTab] = useState<'queue' | 'summary'>('queue');
  const [queue, setQueue]     = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [stats, setStats]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classifiedCount, setClassifiedCount] = useState(0);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, sRes, stRes] = await Promise.all([
        apiFetch(`/vat/queue?period=${period}`, {}, userId),
        apiFetch(`/vat/summary?period=${period}`, {}, userId),
        apiFetch(`/vat/stats?period=${period}`, {}, userId),
      ]);
      setQueue(qRes.data?.claims ?? []);
      setSummary(sRes.data?.rows ?? []);
      setStats(stRes.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [userId, period]);

  useEffect(() => { load(); }, [load]);

  const handleClassified = (id: string) => {
    setQueue(q => q.filter(c => c.id !== id));
    setClassifiedCount(n => n + 1);
    setStats((s: any) => s ? {
      ...s,
      pending_classification: Math.max(0, s.pending_classification - 1),
      classified: s.classified + 1,
    } : s);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiFetchRaw(`/vat/export`, {
        method: 'POST',
        body: JSON.stringify({ period }),
      }, userId);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vat-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally {
      setExporting(false);
    }
  };

  if (!isVatOfficer) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🔒</p>
          <p className="font-bold text-[#1B2A4A] text-lg">VAT Officer access required</p>
          <p className="text-gray-500 text-sm mt-2">Switch to Daniel Frost (Management Accountant) to access VAT recovery.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* ── Page header ──────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2A4A]">VAT Recovery</h1>
            <p className="text-sm text-gray-500 mt-0.5">Classify expense claims and prepare VAT return data</p>
          </div>

          {/* Quarter selector */}
          <div className="flex items-center gap-2">
            {classifiedCount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-1.5 text-right"
              >
                <p className="text-xs text-teal-600 font-bold">{classifiedCount} classified</p>
              </motion.div>
            )}
            <select
              value={period}
              onChange={e => { setPeriod(e.target.value); setClassifiedCount(0); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-[#1B2A4A] bg-white focus:outline-none focus:border-[#2E8B8B] shadow-sm"
            >
              {periodOptions().map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
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
              label="Pending Classification"
              value={stats?.pending_classification ?? queue.length}
              sub="awaiting review"
              color="bg-white border-gray-200 text-[#1B2A4A]"
            />
            <StatCard
              label="Classified"
              value={stats?.classified ?? 0}
              sub={`for ${period}`}
              color="bg-[#eaf5f5] border-[#2E8B8B]/20 text-[#2E8B8B]"
            />
            <StatCard
              label="Total Reclaimable"
              value={stats?.total_reclaimable != null ? fmt(stats.total_reclaimable) : '—'}
              sub="Box 4 estimate"
              color="bg-green-50 border-green-200 text-green-800"
            />
            <StatCard
              label="Recovery Rate"
              value={stats?.recovery_rate != null ? `${stats.recovery_rate}%` : '—'}
              sub="of total VAT"
              color="bg-white border-gray-200 text-[#1B2A4A]"
            />
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {(['queue', 'summary'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
                tab === t
                  ? 'bg-white text-[#1B2A4A] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'queue' ? `Classification Queue${queue.length > 0 ? ` (${queue.length})` : ''}` : 'VAT Summary'}
            </button>
          ))}
        </div>

        {/* ── Tab content ──────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {tab === 'queue' ? (
            <motion.div
              key="queue"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="rounded-2xl border bg-white h-64 animate-pulse" />
                  ))}
                </div>
              ) : queue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="font-bold text-[#1B2A4A]">Queue is clear</p>
                  <p className="text-sm text-gray-500 mt-1">All cleared claims have been classified for {period}</p>
                  <button
                    onClick={() => setTab('summary')}
                    className="mt-4 px-4 py-2 bg-[#2E8B8B] text-white rounded-xl text-sm font-bold hover:bg-[#257373] transition-colors"
                  >
                    View VAT Summary →
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {queue.map(claim => (
                    <ClassCard
                      key={claim.id}
                      claim={claim}
                      userId={userId}
                      period={period}
                      onClassified={handleClassified}
                    />
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {loading ? (
                <div className="rounded-2xl border bg-white h-48 animate-pulse" />
              ) : (
                <VatSummaryTable rows={summary} onExport={handleExport} exporting={exporting} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
