"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList,
  PieChart, Pie,
  AreaChart, Area,
} from 'recharts';
import {
  runQuery,
  WELCOME_SUGGESTIONS,
  CHART_SUGGESTIONS,
  ReportResult,
} from '../../lib/reports-engine';

// ─── Design tokens ────────────────────────────────────────────────────────────

const TEAL    = '#6cffc6';
const NAVY    = '#000053';
const TEAL_10 = '#e8fff5';

const CATEGORY_META: Record<string, { label: string; icon: string; fill: string }> = {
  meals:           { label: 'Meals',          icon: '🍽️', fill: '#f97316' },
  travel:          { label: 'Travel',         icon: '✈️',  fill: '#3b82f6' },
  accommodation:   { label: 'Hotel',          icon: '🏨', fill: '#8b5cf6' },
  transport:       { label: 'Transport',      icon: '🚕', fill: '#eab308' },
  office_supplies: { label: 'Supplies',       icon: '📦', fill: '#6b7280' },
  training:        { label: 'Training',       icon: '🎓', fill: '#22c55e' },
  mileage:         { label: 'Mileage',        icon: '🚗', fill: TEAL },
  other:           { label: 'Other',          icon: '📋', fill: '#9ca3af' },
};

const STATUS_FILL: Record<string, string> = {
  approved:  '#22c55e',
  pending:   '#f59e0b',
  queried:   '#8b5cf6',
  rejected:  '#ef4444',
  submitted: '#6b7280',
};

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: 'Pending',   bg: 'bg-amber-100',  text: 'text-amber-700' },
  approved:  { label: 'Approved',  bg: 'bg-green-100',  text: 'text-green-700' },
  rejected:  { label: 'Rejected',  bg: 'bg-red-100',    text: 'text-red-700' },
  queried:   { label: 'Queried',   bg: 'bg-purple-100', text: 'text-purple-700' },
  submitted: { label: 'Submitted', bg: 'bg-gray-100',   text: 'text-gray-600' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d?: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function catLabel(c: string): string {
  return CATEGORY_META[c]?.label ?? c.replace(/_/g, ' ');
}
function catIcon(c: string): string {
  return CATEGORY_META[c]?.icon ?? '📋';
}
function formatPersonId(id: string): string {
  return id.replace(/^person:/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ─── Shared tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, mode = 'amount' }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      {label && <p className="font-bold text-[#000053] mb-1">{label}</p>}
      <p className="font-mono font-semibold text-[#000053]">
        {mode === 'amount' ? fmtAmount(val ?? 0) : val}
      </p>
      {payload[0]?.payload?.claims != null && (
        <p className="text-gray-400 mt-0.5">{payload[0].payload.claims} claim{payload[0].payload.claims !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

/** Horizontal bar chart — spend by category or top spenders */
function HBarChart({ data, meta, mode }: { data: any[]; meta: any; mode: 'category' | 'person' }) {
  if (!data.length) return <Empty />;

  const nameKey = mode === 'category' ? 'category' : 'name';
  const displayData = data.map(r => ({
    ...r,
    displayName: mode === 'category'
      ? `${catIcon(r.category)} ${catLabel(r.category)}`
      : r.name,
  }));

  // Dynamic height: min 200, 44px per bar
  const chartH = Math.max(200, displayData.length * 44);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {meta?.grandTotal != null && (
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xs text-gray-500">Total:</span>
          <span className="font-mono font-bold text-lg text-[#000053]">{fmtAmount(meta.grandTotal)}</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={displayData} layout="vertical" margin={{ top: 0, right: 90, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis
            type="number"
            tickFormatter={v => `£${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            width={mode === 'category' ? 100 : 120}
            tick={{ fontSize: 11, fill: NAVY, fontWeight: 600 }}
            axisLine={false} tickLine={false}
          />
          <Tooltip content={<ChartTooltip mode="amount" />} cursor={{ fill: TEAL_10 }} />
          <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={28} isAnimationActive animationDuration={600}>
            {displayData.map((entry: any, i: number) => (
              <Cell
                key={i}
                fill={mode === 'category' ? (CATEGORY_META[entry.category]?.fill ?? TEAL) : TEAL}
                opacity={0.85 + (i === 0 ? 0.15 : 0)}
              />
            ))}
            <LabelList
              dataKey="total"
              position="right"
              formatter={(v: number) => fmtAmount(v)}
              style={{ fontSize: 10, fill: NAVY, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

/** Donut chart — claims by status */
function DonutChart({ data, meta }: { data: any[]; meta: any }) {
  if (!data.length) return <Empty />;

  const total = meta?.total ?? data.reduce((s: number, r: any) => s + r.count, 0);

  const RADIAN = Math.PI / 180;
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    if (percent < 0.06) return null;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
          <PieChart width={200} height={200}>
            <Pie
              data={data}
              cx={100} cy={100}
              innerRadius={60} outerRadius={90}
              dataKey="count"
              nameKey="status"
              labelLine={false}
              label={renderCustomLabel}
              isAnimationActive animationDuration={600}
            >
              {data.map((entry: any, i: number) => (
                <Cell key={i} fill={STATUS_FILL[entry.status] ?? '#9ca3af'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val: any, name: any) => [val, name]}
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
          </PieChart>
          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-mono font-black text-2xl text-[#000053]">{total}</span>
            <span className="text-[10px] text-gray-400 font-semibold">CLAIMS</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 flex-1">
          {data.map((r: any) => {
            const sm = STATUS_META[r.status] ?? { label: r.status, bg: 'bg-gray-100', text: 'text-gray-600' };
            const pct = total > 0 ? ((r.count / total) * 100).toFixed(1) : '0.0';
            return (
              <div key={r.status} className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: STATUS_FILL[r.status] ?? '#9ca3af' }} />
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sm.bg} ${sm.text}`}>{sm.label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: STATUS_FILL[r.status] ?? '#9ca3af' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                </div>
                <span className="font-mono text-xs font-semibold text-[#000053] w-6 text-right">{r.count}</span>
                <span className="text-[10px] text-gray-400 w-10 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/** Area / line chart — spend over time */
function TrendChart({ data, meta }: { data: any[]; meta: any }) {
  if (!data.length) return <Empty />;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {meta?.totalAmount != null && (
        <div className="flex items-baseline gap-4 mb-3">
          <div>
            <span className="text-xs text-gray-500">Total spend: </span>
            <span className="font-mono font-bold text-[#000053]">{fmtAmount(meta.totalAmount)}</span>
          </div>
          {meta.totalClaims != null && (
            <div>
              <span className="text-xs text-gray-500">Claims: </span>
              <span className="font-mono font-bold text-[#000053]">{meta.totalClaims}</span>
            </div>
          )}
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={TEAL} stopOpacity={0.25} />
              <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tickFormatter={v => `£${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false} tickLine={false} width={44}
          />
          <Tooltip content={<ChartTooltip mode="amount" />} />
          <Area
            type="monotone" dataKey="total"
            stroke={TEAL} strokeWidth={2.5}
            fill="url(#tealGrad)"
            dot={{ r: 3, fill: TEAL, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: TEAL, stroke: 'white', strokeWidth: 2 }}
            isAnimationActive animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

/** Single-value summary card */
function SummaryCard({ meta }: { meta: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center py-6 px-8 text-center"
    >
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
        {meta?.valueLabel ?? 'Value'}
      </p>
      <p className="font-mono font-black text-4xl text-[#000053] tracking-tight">
        {fmtAmount(meta?.value ?? 0)}
      </p>
      <div className="flex items-center gap-4 mt-4">
        {meta?.claims != null && (
          <div className="text-center">
            <p className="font-mono font-bold text-xl text-[#000053]">{meta.claims}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Claims</p>
          </div>
        )}
        {meta?.total != null && meta.total !== meta.value && (
          <div className="text-center">
            <p className="font-mono font-bold text-xl text-[#000053]">{fmtAmount(meta.total)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total spend</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Sortable claims table */
type SortKey = 'date' | 'amount' | 'category' | 'status' | 'claimant';
type SortDir = 'asc' | 'desc';

function ClaimsTable({ data, meta }: { data: any[]; meta: any }) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  if (!data.length) return <Empty />;

  const sort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...data].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'amount') { av = Number(av); bv = Number(bv); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const ColHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      onClick={() => sort(k)}
      className={`py-2.5 px-3 text-[10px] font-bold uppercase tracking-widest cursor-pointer select-none whitespace-nowrap transition-colors ${
        k === 'amount' ? 'text-right' : 'text-left'
      } ${sortKey === k ? 'text-[#000053]' : 'text-gray-400 hover:text-gray-600'}`}
    >
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {/* Summary strip */}
      {meta?.total != null && (
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
          <span className="font-semibold text-[#000053]">{meta.total}</span>
          claim{meta.total !== 1 ? 's' : ''}
          {meta.totalAmount != null && (
            <>
              <span className="text-gray-300">·</span>
              <span className="font-mono font-semibold text-[#000053]">{fmtAmount(meta.totalAmount)}</span>
              total
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs min-w-[580px]">
          <thead>
            <tr className="bg-[#000053]">
              <ColHeader label="Date"        k="date" />
              <ColHeader label="Description" k="category" />
              <ColHeader label="Category"    k="category" />
              <ColHeader label="Amount"      k="amount" />
              <ColHeader label="Claimant"    k="claimant" />
              <ColHeader label="Status"      k="status" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const sm = STATUS_META[row.status] ?? { label: row.status, bg: 'bg-gray-100', text: 'text-gray-500' };
              return (
                <tr
                  key={row.id ?? i}
                  className={`border-b border-gray-50 hover:bg-[#e8fff5]/40 transition-colors ${
                    i % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="py-2.5 px-3 text-[#000053] max-w-[160px] truncate" title={row.description}>{row.description || '—'}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      {catIcon(row.category)} {catLabel(row.category)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#000053] whitespace-nowrap">
                    {fmtAmount(row.amount)}
                    {!row.policy_passed && <span className="ml-1 text-red-400" title="Policy concern">⚠</span>}
                  </td>
                  <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{row.claimant || '—'}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sm.bg} ${sm.text}`}>
                      {sm.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/** Policy change timeline */
function PolicyTimeline({ data }: { data: any[] }) {
  if (!data.length) return <Empty text="No policy changes found" />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-0">
      {data.map((entry, i) => {
        const changes = entry.changes ?? {};
        const prev    = entry.previous ?? {};
        const updated = entry.updated ?? {};
        const cat     = updated.category ?? prev.category ?? '';
        const actor   = entry.evaluated_by ? formatPersonId(entry.evaluated_by) : 'System';
        const changeLines = Object.entries(changes).map(([field, newVal]) => ({
          label:  field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          oldVal: prev[field],
          newVal,
        }));

        return (
          <motion.div
            key={entry.id ?? i}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex gap-3"
          >
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-[#000053]/8 border border-[#000053]/15 flex items-center justify-center shrink-0 text-sm">⚙️</div>
              {i < data.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#000053]">{catIcon(cat)} {catLabel(cat)} policy updated</span>
                <span className="text-[10px] text-gray-400 font-mono">{fmtDateTime(entry.created_at)}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">By {actor}</p>
              {changeLines.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {changeLines.map(({ label, oldVal, newVal }, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500">{label}:</span>
                      {oldVal != null ? (
                        <>
                          <span className="font-mono text-red-500 line-through">{typeof oldVal === 'number' ? fmtAmount(oldVal as number) : String(oldVal)}</span>
                          <span className="text-gray-300">→</span>
                          <span className="font-mono font-bold text-green-600">{typeof newVal === 'number' ? fmtAmount(newVal as number) : String(newVal)}</span>
                        </>
                      ) : (
                        <span className="font-mono font-bold text-[#000053]">{typeof newVal === 'number' ? fmtAmount(newVal as number) : String(newVal)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function Empty({ text = 'No data found' }: { text?: string }) {
  return <p className="text-sm text-gray-400 py-4 text-center">{text}</p>;
}

// ─── Result dispatcher ────────────────────────────────────────────────────────

function ResultRenderer({ result }: { result: ReportResult }) {
  switch (result.responseType) {
    case 'table':
      return <ClaimsTable data={result.data} meta={result.meta} />;
    case 'bar_chart':
      return (
        <HBarChart
          data={result.data}
          meta={result.meta}
          mode={result.intent === 'top_spenders' ? 'person' : 'category'}
        />
      );
    case 'donut_chart':
      return <DonutChart data={result.data} meta={result.meta} />;
    case 'line_chart':
      return <TrendChart data={result.data} meta={result.meta} />;
    case 'summary_card':
      return <SummaryCard meta={result.meta} />;
    case 'timeline':
      return result.intent === 'duplicates'
        ? <DuplicateTimeline data={result.data} />
        : <PolicyTimeline data={result.data} />;
    default:
      return null;
  }
}

function DuplicateTimeline({ data }: { data: any[] }) {
  if (!data.length) return <Empty text="No potential duplicates detected" />;
  return (
    <div className="space-y-2">
      {data.map((entry, i) => (
        <motion.div key={entry.id ?? i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex gap-3 py-2.5 px-3 bg-amber-50 border border-amber-100 rounded-xl">
          <span className="text-base">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-amber-800">{entry.message}</p>
            <p className="text-[10px] text-amber-600 font-mono mt-0.5">{fmtDateTime(entry.created_at)}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <NucleusAvatar />
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NucleusAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#000053] flex items-center justify-center text-white text-sm font-bold shrink-0 mb-0.5">
      N
    </div>
  );
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

function SuggestionChips({ items, onSelect, compact = false }: {
  items: string[]; onSelect: (s: string) => void; compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'justify-center'}`}>
      {items.map(s => (
        <button key={s} onClick={() => onSelect(s)}
          className="px-3 py-1.5 text-xs font-semibold text-[#000053] bg-[#e8fff5] border border-[#6cffc6]/20 rounded-xl hover:bg-[#d4eded] hover:border-[#6cffc6]/40 transition-colors whitespace-nowrap">
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── Chat message types ───────────────────────────────────────────────────────

type Message =
  | { id: string; from: 'user'; text: string }
  | { id: string; from: 'system'; result: ReportResult; label: string }
  | { id: string; from: 'system'; text: string; showSuggestions?: boolean };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages([{
      id: 'welcome', from: 'system',
      text: 'Hello! Ask me about expenses, spend by category, policy changes, and more. Try one of the suggestions below, or type your own question.',
      showSuggestions: true,
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const submit = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q || isTyping) return;

    setMessages(prev => [...prev, { id: `u-${Date.now()}`, from: 'user', text: q }]);
    setInput('');
    setIsTyping(true);

    const [settled] = await Promise.allSettled([
      runQuery(q),
      new Promise(r => setTimeout(r, 500)),
    ]);

    setIsTyping(false);

    const sysId = `s-${Date.now()}`;
    if (settled.status === 'fulfilled' && settled.value.responseType !== 'unknown') {
      const r = settled.value;
      setMessages(prev => [...prev, { id: sysId, from: 'system', result: r, label: r.label }]);
    } else {
      setMessages(prev => [...prev, {
        id: sysId, from: 'system',
        text: "I can help with expenses queries like spend by category, claims by status, policy changes, trends, and more. Try one of the suggestions below.",
        showSuggestions: true,
      }]);
    }
  }, [isTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); }
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto" style={{ height: 'calc(100vh - 128px)', minHeight: 480 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-1 py-4 border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#000053] tracking-tight">Expense Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">Query your expense data in plain English</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live · SurrealDB
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-1 py-4 space-y-1">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div key={msg.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>

              {msg.from === 'user' ? (
                <div className="flex justify-end mb-4">
                  <div className="max-w-[70%] bg-[#000053] text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm">
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-end gap-2 mb-4">
                  <NucleusAvatar />
                  <div className="flex-1 min-w-0">
                    {'text' in msg ? (
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm inline-block max-w-lg">
                        <p className="text-sm text-[#000053] leading-relaxed">{msg.text}</p>
                        {msg.showSuggestions && (
                          <div className="mt-3 space-y-2">
                            <SuggestionChips items={WELCOME_SUGGESTIONS} onSelect={s => submit(s)} compact />
                            <div className="flex items-center gap-2 my-1">
                              <div className="flex-1 h-px bg-gray-100" />
                              <span className="text-[10px] text-gray-400 font-semibold">CHARTS</span>
                              <div className="flex-1 h-px bg-gray-100" />
                            </div>
                            <SuggestionChips items={CHART_SUGGESTIONS} onSelect={s => submit(s)} compact />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm shadow-sm overflow-hidden max-w-full">
                        {/* Card header */}
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100" style={{ background: '#f8fafc' }}>
                          <svg className="w-3.5 h-3.5 text-[#000053] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs font-bold text-[#000053] truncate">{msg.label}</span>
                          <div className="ml-auto flex items-center gap-2 shrink-0">
                            {/* Response type badge */}
                            <ResponseTypeBadge type={msg.result.responseType} />
                            {msg.result.meta?.total != null && msg.result.responseType === 'table' && (
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                {msg.result.meta.total} row{msg.result.meta.total !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Card body */}
                        <div className="p-4">
                          <ResultRenderer result={msg.result} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {isTyping && (
            <motion.div key="typing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-1 py-4">
        {messages.length <= 1 && (
          <div className="mb-3 space-y-2">
            <SuggestionChips items={WELCOME_SUGGESTIONS} onSelect={s => submit(s)} />
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-400 font-semibold">CHARTS</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <SuggestionChips items={CHART_SUGGESTIONS} onSelect={s => submit(s)} />
          </div>
        )}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about expenses, spend totals, policy changes…"
              rows={1}
              disabled={isTyping}
              className="w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm text-[#000053] placeholder-gray-400 focus:outline-none focus:border-[#6cffc6] focus:ring-1 focus:ring-[#6cffc6] transition-colors disabled:opacity-50 leading-relaxed"
              style={{ minHeight: 44, maxHeight: 120 }}
            />
          </div>
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 rounded-2xl bg-[#000053] hover:bg-[#2E3F5C] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-gray-300 mt-2 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ─── Response type badge ──────────────────────────────────────────────────────

function ResponseTypeBadge({ type }: { type: string }) {
  const meta: Record<string, { icon: string; label: string; cls: string }> = {
    table:        { icon: '⊞',  label: 'Table',    cls: 'bg-[#000053]/8 text-[#000053]' },
    bar_chart:    { icon: '▬',  label: 'Bar',      cls: 'bg-[#6cffc6]/10 text-[#000053]' },
    donut_chart:  { icon: '◯',  label: 'Donut',    cls: 'bg-purple-50 text-purple-600' },
    line_chart:   { icon: '∿',  label: 'Trend',    cls: 'bg-blue-50 text-blue-600' },
    summary_card: { icon: '#',  label: 'Summary',  cls: 'bg-amber-50 text-amber-600' },
    timeline:     { icon: '│',  label: 'Timeline', cls: 'bg-gray-100 text-gray-500' },
  };
  const m = meta[type];
  if (!m) return null;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>
      <span>{m.icon}</span>{m.label}
    </span>
  );
}
