"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';
import { Avatar } from '../../components/ui/System';

// ─── API ─────────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

async function apiFetch(endpoint: string, asUserId?: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (asUserId) headers['x-user-id'] = asUserId;
  const res = await fetch(`${BASE}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function orgLabel(id: string) {
  return (id ?? '').replace(/^org_unit:/, '').replace(/_/g, ' ');
}

// ─── Person detail panel ──────────────────────────────────────────────────────

type DetailLevel = 'self' | 'report' | 'basic';

// ── Shared helpers ────────────────────────────────────────────────────────────

const CAT_ICONS: Record<string, string> = {
  meals: '🍽️', travel: '✈️', accommodation: '🏨', transport: '🚕',
  office_supplies: '📦', training: '🎓', mileage: '🚗', other: '📋',
};

const STATUS_STYLES: Record<string, string> = {
  approved:  'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  queried:   'bg-purple-100 text-purple-700',
  rejected:  'bg-red-100 text-red-700',
  submitted: 'bg-gray-100 text-gray-500',
};

function fmtCurrency(n: number) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShortDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Expenses section ──────────────────────────────────────────────────────────

function ExpensesSection({ personId }: { personId: string }) {
  const [claims, setClaims]   = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setClaims(null);
    // Pass personId as x-user-id so the API returns that person's claims
    apiFetch('/expenses?role=claimant', personId)
      .then((data: any) => {
        const list = data?.claims ?? data ?? [];
        setClaims(Array.isArray(list) ? list : []);
      })
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }, [personId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!claims || claims.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-3">No expense claims on record</p>
    );
  }

  // Summary stats
  const total      = claims.reduce((s, c) => s + (c.amount ?? 0), 0);
  const pending    = claims.filter(c => c.status === 'pending' || c.status === 'queried').length;
  const approved   = claims.filter(c => c.status === 'approved').length;
  const recent     = [...claims]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total spend', value: fmtCurrency(total), mono: true },
          { label: 'Pending',     value: String(pending),    mono: false },
          { label: 'Approved',    value: String(approved),   mono: false },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
            <p className={`text-sm font-bold text-[#1B2A4A] truncate ${s.mono ? 'font-mono text-xs' : ''}`}>
              {s.value}
            </p>
            <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Recent claims */}
      <div className="space-y-1">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-0.5">
          Recent claims
        </p>
        {recent.map((c, i) => {
          const icon   = CAT_ICONS[c.category] ?? '📋';
          const stCls  = STATUS_STYLES[c.status] ?? 'bg-gray-100 text-gray-500';
          const stLbl  = (c.status ?? '').charAt(0).toUpperCase() + (c.status ?? '').slice(1);
          return (
            <motion.div
              key={c.id ?? i}
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-base shrink-0 leading-none">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1B2A4A] truncate">
                  {c.description || c.category}
                </p>
                <p className="text-[10px] text-gray-400">{fmtShortDate(c.date)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-xs font-bold text-[#1B2A4A]">
                  {fmtCurrency(c.amount ?? 0)}
                </p>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${stCls}`}>
                  {stLbl}
                </span>
              </div>
            </motion.div>
          );
        })}
        {claims.length > 5 && (
          <p className="text-[10px] text-gray-400 text-center pt-1">
            +{claims.length - 5} more claim{claims.length - 5 !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Placeholder section (for not-yet-live data) ───────────────────────────────

function PlaceholderSection({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="border border-dashed border-gray-200 rounded-xl p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-gray-600">{title}</span>
        </div>
        <span className="text-[10px] font-bold text-gray-300 bg-gray-100 px-2 py-0.5 rounded-full">
          Coming soon
        </span>
      </div>
      <p className="text-[11px] text-gray-300 mt-1.5 pl-7">
        Data will appear here once integrated
      </p>
    </div>
  );
}

// ── Collapsible activity section ──────────────────────────────────────────────

function ActivitySection({
  title, icon, children, live = false,
}: {
  title: string; icon: string; children?: React.ReactNode; live?: boolean;
}) {
  const [open, setOpen] = useState(live); // live sections start open

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{icon}</span>
          <span className="text-xs font-bold text-[#1B2A4A]">{title}</span>
          {live && (
            <span className="text-[9px] font-bold text-[#2E8B8B] bg-[#eaf5f5] px-1.5 py-0.5 rounded-full">
              Live
            </span>
          )}
          {!live && (
            <span className="text-[9px] font-bold text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded-full">
              Soon
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100">
              {children ?? (
                <p className="text-[11px] text-gray-300 py-2 text-center">
                  Data will appear here once integrated
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

function PersonDetailPanel({
  personId,
  level,
  viewerId,
  onClose,
}: {
  personId: string;
  level: DetailLevel;
  viewerId: string;
  onClose: () => void;
}) {
  const [person, setPerson]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setPerson(null);
    apiFetch(`/people/${encodeURIComponent(personId)}`)
      .then(setPerson)
      .catch(() => setPerson(null))
      .finally(() => setLoading(false));
  }, [personId]);

  const name   = person ? `${person.first_name} ${person.last_name}` : '…';
  const dept   = person?.org_info?.name ?? orgLabel(person?.org_unit ?? '');
  const isSelf = personId === viewerId;

  return (
    <motion.div
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute top-0 right-0 bottom-0 w-[340px] bg-white border-l border-gray-200 shadow-2xl z-30 flex flex-col overflow-hidden rounded-r-2xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          {loading ? (
            <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse shrink-0" />
          ) : (
            <Avatar name={name} size="lg" />
          )}
          <div className="min-w-0">
            {loading ? (
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-[#1B2A4A] text-sm leading-tight">{name}</h3>
                  {isSelf && (
                    <span className="text-[10px] font-bold text-[#2E8B8B] bg-[#eaf5f5] px-2 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                  {level === 'report' && !isSelf && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      Reports to you
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{person?.job_title}</p>
                <p className="text-[10px] text-gray-400 capitalize truncate">{dept}</p>
              </>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors mt-0.5 shrink-0 ml-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Profile */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profile</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {[
                { label: 'Email',       value: person?.email,          icon: '✉️' },
                { label: 'Employee ID', value: person?.employee_id,    icon: '🪪' },
                { label: 'Employment',  value: person?.employment_type?.replace(/_/g, ' '), icon: '📋' },
                { label: 'Department',  value: dept,                   icon: '🏢' },
                { label: 'Cost Centre', value: person?.cc_info?.name ?? person?.cc_info?.code, icon: '💳' },
              ]
                .filter(row => row.value)
                .map(row => (
                  <div key={row.label} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-sm shrink-0">{row.icon}</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-400 uppercase leading-tight">{row.label}</p>
                      <p className="text-xs font-medium text-[#1B2A4A] truncate capitalize">{row.value}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Activity — self or direct report */}
        {(level === 'self' || level === 'report') && (
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {isSelf ? 'My Activity' : 'Activity & Records'}
            </p>

            {/* Expenses — live */}
            <ActivitySection title="Expenses" icon="💸" live>
              <ExpensesSection personId={personId} />
            </ActivitySection>

            {/* Placeholders */}
            <ActivitySection title="Timesheets"                icon="⏱️" />
            <ActivitySection title="Leave & Holidays"          icon="🏖️" />
            <ActivitySection title="Performance & Development" icon="📈" />
          </div>
        )}

        {/* Basic view hint */}
        {level === 'basic' && !loading && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-300 text-center">
              Detailed activity is only visible for your direct reports and below
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Zoom/Pan canvas ──────────────────────────────────────────────────────────

function ZoomPanCanvas({ children, onReset }: { children: React.ReactNode; onReset: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transform = useRef({ x: 0, y: 0, scale: 1 });
  const innerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(() => {
    if (!innerRef.current) return;
    const { x, y, scale } = transform.current;
    innerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const t = transform.current;
    const newScale = Math.max(0.25, Math.min(2.5, t.scale * factor));
    const ratio = newScale / t.scale;
    transform.current = {
      scale: newScale,
      x: cx - ratio * (cx - t.x),
      y: cy - ratio * (cy - t.y),
    };
    applyTransform();
  }, [applyTransform]);

  const onPointerDown = useCallback((e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    containerRef.current!.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    transform.current.x += e.clientX - lastPointer.current.x;
    transform.current.y += e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    applyTransform();
  }, [applyTransform]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    const el = containerRef.current!;
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onWheel, onPointerDown, onPointerMove, onPointerUp]);

  const resetView = useCallback(() => {
    transform.current = { x: 0, y: 0, scale: 1 };
    applyTransform();
    onReset();
  }, [applyTransform, onReset]);

  const zoom = useCallback((factor: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const t = transform.current;
    const newScale = Math.max(0.25, Math.min(2.5, t.scale * factor));
    const ratio = newScale / t.scale;
    transform.current = {
      scale: newScale,
      x: cx - ratio * (cx - t.x),
      y: cy - ratio * (cy - t.y),
    };
    applyTransform();
  }, [applyTransform]);

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        {[
          { label: '+', action: () => zoom(1.25) },
          { label: '−', action: () => zoom(0.8) },
          { label: '⌂', action: resetView },
        ].map(b => (
          <button
            key={b.label}
            onClick={b.action}
            className="w-8 h-8 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-bold text-gray-600 hover:bg-gray-50 hover:border-[#2E8B8B] hover:text-[#2E8B8B] transition-colors flex items-center justify-center"
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden bg-gray-50/60 rounded-2xl border border-gray-100 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none' }}
      >
        <div
          ref={innerRef}
          className="absolute"
          style={{ transformOrigin: '0 0', willChange: 'transform', top: 0, left: 0 }}
        >
          <div className="pt-16 px-16 pb-32 min-w-[600px]">
            {children}
          </div>
        </div>
      </div>

      <p className="absolute bottom-2 left-3 text-[10px] text-gray-300 pointer-events-none">
        Scroll to zoom · Drag to pan
      </p>
    </div>
  );
}

// ─── Connector lines ──────────────────────────────────────────────────────────

function VLine({ height = 32 }: { height?: number }) {
  return <div className="mx-auto w-px bg-gray-200" style={{ height }} />;
}

// ─── Person node card ─────────────────────────────────────────────────────────

const NODE_GAP = 24;

interface NodeCardProps {
  person: any;
  variant: 'focus' | 'manager' | 'report' | 'peer';
  expanded?: boolean;
  reportCount?: number;
  loading?: boolean;
  onExpand?: () => void;
  /** Navigate in the chart (avatar click) */
  onNavigate?: () => void;
  /** Open detail panel (name click) */
  onDetail?: () => void;
}

function NodeCard({
  person,
  variant,
  expanded,
  reportCount,
  loading,
  onExpand,
  onNavigate,
  onDetail,
}: NodeCardProps) {
  const isFocus   = variant === 'focus';
  const isManager = variant === 'manager';
  const isPeer    = variant === 'peer';

  return (
    <motion.div
      initial={{ opacity: 0, y: isFocus ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative flex flex-col items-center gap-2 w-32 ${isPeer ? 'opacity-50' : ''}`}
    >
      {/* Avatar — click navigates */}
      <button
        onClick={onNavigate}
        className={`rounded-full transition-all focus:outline-none ${
          isFocus
            ? 'ring-[3px] ring-[#2E8B8B] ring-offset-2 shadow-md cursor-default'
            : 'ring-2 ring-gray-200 hover:ring-[#2E8B8B] cursor-pointer shadow-sm'
        }`}
      >
        <Avatar
          name={`${person.first_name} ${person.last_name}`}
          size={isFocus ? 'lg' : 'md'}
        />
      </button>

      {/* Name + title — name click opens detail */}
      <div className="text-center px-1">
        <button
          onClick={onDetail}
          className={`block w-full text-xs font-bold leading-tight text-center transition-colors ${
            isFocus
              ? 'text-[#2E8B8B] cursor-pointer hover:text-[#257373]'
              : 'text-[#1B2A4A] cursor-pointer hover:text-[#2E8B8B]'
          }`}
          title="View profile"
        >
          {person.first_name} {person.last_name}
        </button>
        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
          {person.job_title}
        </p>
        {isFocus && (
          <p className="text-[9px] text-gray-300 mt-0.5 capitalize">
            {orgLabel(person.org_unit)}
          </p>
        )}
        {isManager && (
          <p className="text-[9px] text-[#2E8B8B] font-semibold mt-0.5">tap avatar ↑</p>
        )}
        {!isFocus && !isManager && (
          <p className="text-[9px] text-gray-300 mt-0.5">tap name for profile</p>
        )}
      </div>

      {/* Expand/collapse — direct reports */}
      {typeof reportCount === 'number' && reportCount > 0 && onExpand && (
        <button
          onClick={e => { e.stopPropagation(); onExpand(); }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold transition-all ${
            expanded
              ? 'bg-[#2E8B8B] text-white border-[#2E8B8B]'
              : 'bg-white text-[#2E8B8B] border-[#2E8B8B]/40 hover:bg-[#eaf5f5]'
          }`}
        >
          {loading ? (
            <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            <>
              <span>{reportCount}</span>
              <span>{expanded ? '▲' : '▼'}</span>
            </>
          )}
        </button>
      )}
    </motion.div>
  );
}

// ─── Expandable child node ────────────────────────────────────────────────────

function ExpandableNode({
  person,
  depth,
  onSetFocus,
  onOpenDetail,
}: {
  person: any;
  depth: number;
  onSetFocus: (id: string) => void;
  // Level is determined by the caller (viewer-relative); just pass the id through
  onOpenDetail: (personId: string) => void;
}) {
  const [children, setChildren] = useState<any[] | null>(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(async () => {
    if (!expanded && !children) {
      setLoading(true);
      try {
        const reports = await apiFetch(`/people/${encodeURIComponent(person.id)}/reports`);
        setChildren(Array.isArray(reports) ? reports : []);
      } catch {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(e => !e);
  }, [expanded, children, person.id]);

  const reportCount: number = person.reportCount ?? 0;

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        person={person}
        variant="report"
        reportCount={reportCount}
        expanded={expanded}
        loading={loading}
        onExpand={reportCount > 0 ? toggleExpand : undefined}
        onNavigate={() => onSetFocus(person.id)}
        onDetail={() => onOpenDetail(person.id)}
      />

      <AnimatePresence>
        {expanded && children && children.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col items-center overflow-hidden"
          >
            <VLine />
            {children.length > 1 && (
              <div
                className="relative h-px bg-gray-200"
                style={{ width: (children.length - 1) * (128 + NODE_GAP) + 128 }}
              />
            )}
            <div className="flex" style={{ gap: NODE_GAP }}>
              {children.map((child: any) => (
                <div key={child.id} className="flex flex-col items-center">
                  <VLine height={16} />
                  {depth < 4 ? (
                    <ExpandableNode
                      person={child}
                      depth={depth + 1}
                      onSetFocus={onSetFocus}
                      onOpenDetail={onOpenDetail}
                    />
                  ) : (
                    <NodeCard
                      person={child}
                      variant="report"
                      reportCount={child.reportCount ?? 0}
                      onNavigate={() => onSetFocus(child.id)}
                      onDetail={() => onOpenDetail(child.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── People chart ─────────────────────────────────────────────────────────────

function PeopleChart({
  viewerId,
  initialFocusId,
  onOpenDetail,
  onOrgUnitChange,
}: {
  viewerId: string;
  initialFocusId?: string;
  onOpenDetail: (personId: string, level: DetailLevel) => void;
  onOrgUnitChange: (orgUnit: string | null) => void;
}) {
  const [focusId, setFocusId]   = useState(initialFocusId ?? viewerId);
  const [context, setContext]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);

  // Viewer's own direct report IDs — fetched once, never changes on chart navigation.
  // This is the source of truth for access-level decisions regardless of who is focused.
  const viewerReportIds = useRef<Set<string>>(new Set());
  const viewerReportsFetched = useRef(false);

  useEffect(() => {
    if (viewerReportsFetched.current) return;
    viewerReportsFetched.current = true;
    apiFetch(`/people/${encodeURIComponent(viewerId)}/context`)
      .then(data => {
        const ids = new Set<string>(
          (data?.directReports ?? []).map((dr: any) => dr.id as string)
        );
        viewerReportIds.current = ids;
      })
      .catch(() => {});
  }, [viewerId]);

  // Detail level is always relative to the logged-in viewer, never to the chart focus.
  const getDetailLevel = useCallback((personId: string): DetailLevel => {
    if (personId === viewerId) return 'self';
    if (viewerReportIds.current.has(personId)) return 'report';
    return 'basic';
  }, [viewerId]);

  const loadContext = useCallback(async (id: string) => {
    setLoading(true);
    setContext(null);
    try {
      const data = await apiFetch(`/people/${encodeURIComponent(id)}/context`);
      setContext(data);
      onOrgUnitChange(data?.self?.org_unit ?? null);
    } catch {
      setContext(null);
      onOrgUnitChange(null);
    } finally {
      setLoading(false);
    }
  }, [onOrgUnitChange]);

  useEffect(() => { loadContext(focusId); }, [focusId, loadContext]);

  const navigateTo = useCallback((id: string) => { setFocusId(id); }, []);

  if (loading) return (
    <div className="flex flex-col items-center gap-6 pt-8 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-gray-200" />
      <div className="w-px h-8 bg-gray-200" />
      <div className="w-16 h-16 rounded-full bg-gray-200" />
      <div className="w-px h-8 bg-gray-200" />
      <div className="flex gap-6">
        {[1, 2, 3].map(i => <div key={i} className="w-12 h-12 rounded-full bg-gray-200" />)}
      </div>
    </div>
  );

  if (!context) return (
    <div className="text-center py-16 text-sm text-gray-400">Could not load chart data</div>
  );

  const { self, manager, peers, directReports } = context;
  const isOwnView = self.id === viewerId;

  return (
    <div className="flex flex-col items-center">

      {/* Manager above */}
      {manager ? (
        <div className="flex flex-col items-center">
          <NodeCard
            person={manager}
            variant="manager"
            onNavigate={() => navigateTo(manager.id)}
            onDetail={() => onOpenDetail(manager.id, getDetailLevel(manager.id))}
          />
          <VLine />
        </div>
      ) : (
        <div className="mb-2 text-[10px] text-gray-300 font-medium">Top of chain</div>
      )}

      {/* Self + peers row */}
      {peers.length > 0 ? (
        <div className="flex items-start" style={{ gap: NODE_GAP }}>
          {peers.slice(0, Math.ceil(peers.length / 2)).map((p: any) => (
            <div key={p.id} className="flex flex-col items-center mt-2">
              <NodeCard
                person={p}
                variant="peer"
                onNavigate={() => navigateTo(p.id)}
                onDetail={() => onOpenDetail(p.id, getDetailLevel(p.id))}
              />
            </div>
          ))}

          <NodeCard
            person={self}
            variant="focus"
            reportCount={self.reportCount}
            onDetail={() => onOpenDetail(self.id, getDetailLevel(self.id))}
          />

          {peers.slice(Math.ceil(peers.length / 2)).map((p: any) => (
            <div key={p.id} className="flex flex-col items-center mt-2">
              <NodeCard
                person={p}
                variant="peer"
                onNavigate={() => navigateTo(p.id)}
                onDetail={() => onOpenDetail(p.id, getDetailLevel(p.id))}
              />
            </div>
          ))}
        </div>
      ) : (
        <NodeCard
          person={self}
          variant="focus"
          reportCount={self.reportCount}
          onDetail={() => onOpenDetail(self.id, getDetailLevel(self.id))}
        />
      )}

      {/* Direct reports below */}
      {directReports.length > 0 && (
        <>
          <VLine />
          {directReports.length > 1 && (
            <div
              className="h-px bg-gray-200"
              style={{ width: (directReports.length - 1) * (128 + NODE_GAP) + 128 }}
            />
          )}
          <div className="flex" style={{ gap: NODE_GAP }}>
            {directReports.map((dr: any) => (
              <div key={dr.id} className="flex flex-col items-center">
                <VLine height={16} />
                <ExpandableNode
                  person={dr}
                  depth={1}
                  onSetFocus={navigateTo}
                  onOpenDetail={(id) => onOpenDetail(id, getDetailLevel(id))}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Return to self */}
      {!isOwnView && (
        <div className="mt-10">
          <button
            onClick={() => navigateTo(viewerId)}
            className="text-xs font-semibold text-[#2E8B8B] border border-[#2E8B8B]/30 px-3 py-1.5 rounded-full hover:bg-[#eaf5f5] transition-colors"
          >
            ← Return to my position
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Structure chart ──────────────────────────────────────────────────────────

function StructureChart({ initialRootId }: { initialRootId?: string | null }) {
  const [rootId, setRootId]   = useState<string | null>(initialRootId ?? null);
  // If we start at a specific node (from people toggle), pre-populate history so
  // the "← Up to Company" button is present immediately.
  const [history, setHistory] = useState<string[]>(initialRootId ? [''] : []);
  const [tree, setTree]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/org/tree${rootId ? '?rootId=' + rootId : ''}`)
      .then(data => {
        if (!data && rootId) {
          // rootId not found — fall back to top level
          setRootId(null);
          setHistory([]);
        } else {
          setTree(data);
        }
      })
      .catch(() => {
        if (rootId) {
          setRootId(null);
          setHistory([]);
        } else {
          setTree(null);
        }
      })
      .finally(() => setLoading(false));
  }, [rootId]);

  const drillInto = (id: string) => {
    setHistory(h => [...h, rootId ?? '']);
    setRootId(id);
  };

  const drillUp = () => {
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setRootId(prev || null);
  };

  if (loading) return (
    <div className="flex flex-col items-center pt-16 gap-4 animate-pulse">
      <div className="h-24 w-48 rounded-2xl bg-gray-200" />
      <div className="flex gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 w-36 rounded-xl bg-gray-200" />)}
      </div>
    </div>
  );

  if (!tree) return <div className="text-center pt-16 text-sm text-gray-400">Failed to load structure</div>;

  return (
    <div className="flex flex-col items-center">
      {history.length > 0 && (
        <button
          onClick={drillUp}
          className="mb-6 self-start text-sm font-semibold text-[#2E8B8B] hover:underline flex items-center gap-1.5"
        >
          ← Up to {history.length === 1 ? 'Company' : 'previous'}
        </button>
      )}

      {/* Root node */}
      <div className="bg-white border-t-4 border-[#1B2A4A] rounded-2xl px-6 py-5 text-center shadow-md min-w-[200px]">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          {tree.type?.replace('_', ' ')}
        </p>
        <p className="font-bold text-[#1B2A4A] text-lg">{tree.name}</p>
        <p className="text-xs font-mono text-gray-400 mt-1">{tree.code}</p>
      </div>

      {tree.children?.length > 0 && (
        <>
          <VLine />
          <div
            className="h-px bg-gray-200"
            style={{ width: tree.children.length > 1 ? (tree.children.length - 1) * 184 + 160 : 0 }}
          />
          <div className="flex" style={{ gap: 24 }}>
            {tree.children.map((child: any, i: number) => (
              <div key={child.id} className="flex flex-col items-center">
                <VLine height={16} />
                {/* Must be a <button> so ZoomPanCanvas skips pointer capture and click fires */}
                <button
                  type="button"
                  onClick={() => drillInto(child.id)}
                  className="group text-left bg-white border border-gray-200 hover:border-[#2E8B8B] rounded-xl px-4 py-3 text-center shadow-sm min-w-[152px] transition-all focus:outline-none"
                >
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                    {child.type?.replace('_', ' ')}
                  </p>
                  <p className="font-bold text-[#1B2A4A] text-sm group-hover:text-[#2E8B8B] transition-colors">
                    {child.name}
                  </p>
                  <p className="text-[10px] font-mono text-gray-400 mt-0.5">{child.code}</p>
                  {child.headcount != null && (
                    <p className="text-[9px] text-gray-300 mt-1">{child.headcount} people</p>
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Search ───────────────────────────────────────────────────────────────────

function SearchBox({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const ref   = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/people?q=${encodeURIComponent(q.trim())}`);
        setResults(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 280);
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (id: string) => { onNavigate(id); setQ(''); setOpen(false); };

  return (
    <div ref={ref} className="relative w-56">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </div>
      <input
        type="text"
        placeholder="Search name or role…"
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => q.trim() && setOpen(true)}
        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#2E8B8B] focus:ring-1 focus:ring-[#2E8B8B] bg-white"
      />
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-64 overflow-y-auto"
          >
            {loading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : results.length === 0 ? (
              <p className="p-3 text-sm text-gray-400 text-center">No results</p>
            ) : results.map(p => (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[#eaf5f5] text-left border-b border-gray-50 last:border-0 transition-colors"
              >
                <Avatar name={`${p.first_name} ${p.last_name}`} size="xs" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1B2A4A] truncate">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">{p.job_title}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgPage() {
  const { user } = useAuth();
  const viewerId = user?.sub ?? 'person:sarah_chen';

  const [view, setView]               = useState<'people' | 'structure'>('people');
  const [chartKey, setChartKey]       = useState(0);
  const [peopleFocusId, setPeopleFocusId] = useState<string | null>(null);

  // Tracks current focused person's org_unit for structure toggle coordination
  const [focusOrgUnit, setFocusOrgUnit] = useState<string | null>(null);

  // Detail panel state (lifted to page so it survives chart navigation)
  const [detailPersonId, setDetailPersonId] = useState<string | null>(null);
  const [detailLevel, setDetailLevel]       = useState<DetailLevel>('basic');

  const openDetail = useCallback((personId: string, level: DetailLevel) => {
    setDetailPersonId(personId);
    setDetailLevel(level);
  }, []);

  const closeDetail = useCallback(() => setDetailPersonId(null), []);

  const handleSearchNavigate = (id: string) => {
    setView('people');
    setPeopleFocusId(id);
    setChartKey(k => k + 1);
    closeDetail();
  };

  // When toggling from people → structure, carry focused person's org unit
  const handleToggleView = (newView: 'people' | 'structure') => {
    setView(newView);
    closeDetail();
    setChartKey(k => k + 1);
  };

  const effectiveFocusId = peopleFocusId ?? viewerId;

  // Key for StructureChart — changes when toggle fires, so it remounts with new initialRootId
  const structureKey = `${chartKey}-${focusOrgUnit ?? 'root'}`;

  return (
    <div className="max-w-6xl mx-auto pb-8 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-5 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2A4A] tracking-tight">Organisation & People</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {view === 'people'
              ? 'Click avatar to navigate · Click name to view profile · Expand ▼ for reports'
              : 'Click a unit to drill in · Use ← to go back up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === 'people' && (
            <SearchBox onNavigate={handleSearchNavigate} />
          )}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
            {(['people', 'structure'] as const).map(v => (
              <button
                key={v}
                onClick={() => handleToggleView(v)}
                className={`px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                  view === v ? 'bg-[#1B2A4A] text-white' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart + panel wrapper */}
      <div className="relative" style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
        <ZoomPanCanvas
          key={chartKey}
          onReset={() => { setPeopleFocusId(null); setChartKey(k => k + 1); closeDetail(); }}
        >
          {view === 'people' ? (
            <PeopleChart
              key={effectiveFocusId}
              viewerId={viewerId}
              initialFocusId={effectiveFocusId}
              onOpenDetail={openDetail}
              onOrgUnitChange={setFocusOrgUnit}
            />
          ) : (
            <StructureChart
              key={structureKey}
              initialRootId={focusOrgUnit}
            />
          )}
        </ZoomPanCanvas>

        {/* Sliding detail panel */}
        <AnimatePresence>
          {detailPersonId && (
            <PersonDetailPanel
              personId={detailPersonId}
              level={detailLevel}
              viewerId={viewerId}
              onClose={closeDetail}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
