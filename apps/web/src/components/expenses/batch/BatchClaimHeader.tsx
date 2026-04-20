"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchHeader {
  periodType: 'this-month' | 'custom';
  periodStart: string;
  periodEnd: string;
  contextLabel: string;
  defaultProjectCode: string;
}

interface Props {
  onContinue: (header: BatchHeader) => void;
}

// ─── Mock project codes ───────────────────────────────────────────────────────

const PROJECT_CODES = [
  { code: 'P-4821', label: 'Project Orion' },
  { code: 'P-4822', label: 'Babcock Framework' },
  { code: 'P-4823', label: 'Manchester Client' },
  { code: 'P-4824', label: 'Infrastructure Review' },
  { code: 'P-4825', label: 'Training & Development' },
  { code: 'P-4826', label: 'Corporate Travel' },
  { code: 'P-4827', label: 'Site Operations' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

function monthLabel(): string {
  return new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// ─── Project code search ──────────────────────────────────────────────────────

function ProjectCodeSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = PROJECT_CODES.filter(
    (p) =>
      p.code.toLowerCase().includes(query.toLowerCase()) ||
      p.label.toLowerCase().includes(query.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (code: string) => {
    setQuery(code);
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search project code…"
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] transition-colors bg-white placeholder:text-gray-300 font-mono"
      />
      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
          >
            {filtered.map((p) => (
              <button
                key={p.code}
                onClick={() => select(p.code)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#e8fff5] transition-colors"
              >
                <span className="font-mono text-sm font-bold text-[#000053]">
                  {p.code}
                </span>
                <span className="text-sm text-gray-500">{p.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BatchClaimHeader({ onContinue }: Props) {
  const bounds = monthBounds();

  const [periodType, setPeriodType] = useState<'this-month' | 'custom'>('this-month');
  const [customStart, setCustomStart] = useState(bounds.start);
  const [customEnd, setCustomEnd] = useState(bounds.end);
  const [contextLabel, setContextLabel] = useState('');
  const [projectCode, setProjectCode] = useState('');

  const periodStart = periodType === 'this-month' ? bounds.start : customStart;
  const periodEnd = periodType === 'this-month' ? bounds.end : customEnd;

  const handleContinue = () => {
    onContinue({
      periodType,
      periodStart,
      periodEnd,
      contextLabel,
      defaultProjectCode: projectCode,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-8">

        {/* ── Period selection ── */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Claim Period
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* This month */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setPeriodType('this-month')}
              className={`relative flex flex-col items-start p-5 rounded-2xl border-2 text-left transition-all ${
                periodType === 'this-month'
                  ? 'border-[#6cffc6] bg-[#e8fff5]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Teal left accent */}
              <div
                className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-all ${
                  periodType === 'this-month' ? 'bg-[#6cffc6]' : 'bg-transparent'
                }`}
              />
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-2xl">📅</span>
                {periodType === 'this-month' && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-[#6cffc6] flex items-center justify-center shrink-0"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.span>
                )}
              </div>
              <p className="font-bold text-[#000053] text-base leading-tight">This month</p>
              <p className="text-xs text-gray-500 mt-1">{monthLabel()}</p>
            </motion.button>

            {/* Custom range */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setPeriodType('custom')}
              className={`relative flex flex-col items-start p-5 rounded-2xl border-2 text-left transition-all ${
                periodType === 'custom'
                  ? 'border-[#6cffc6] bg-[#e8fff5]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-all ${
                  periodType === 'custom' ? 'bg-[#6cffc6]' : 'bg-transparent'
                }`}
              />
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-2xl">🗓️</span>
                {periodType === 'custom' && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 rounded-full bg-[#6cffc6] flex items-center justify-center shrink-0"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.span>
                )}
              </div>
              <p className="font-bold text-[#000053] text-base leading-tight">Custom range</p>
              <p className="text-xs text-gray-500 mt-1">Choose start & end dates</p>
            </motion.button>
          </div>

          {/* Custom date inputs — slide in */}
          <AnimatePresence>
            {periodType === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">From</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">To</label>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] bg-white"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Context label ── */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Context Label <span className="text-gray-300 font-normal normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={contextLabel}
            onChange={(e) => setContextLabel(e.target.value)}
            placeholder="e.g. Manchester client visit, April travel, Project Orion site work"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] transition-colors bg-white placeholder:text-gray-300"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            This becomes the title shown in dashboards and the approver's queue.
            {!contextLabel && (
              <span className="text-gray-300"> Defaults to "{monthLabel()} Expenses — Peter"</span>
            )}
          </p>
        </div>

        {/* ── Default project code ── */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Default Project Code <span className="text-gray-300 font-normal normal-case">(optional)</span>
          </label>
          <ProjectCodeSearch value={projectCode} onChange={setProjectCode} />
          <p className="text-xs text-gray-400 mt-1.5">
            Applies to all lines — you can override per line in the next step.
          </p>
        </div>
      </div>

      {/* ── Footer CTA ── */}
      <div className="px-6 py-5 border-t border-gray-100 bg-white shrink-0">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleContinue}
          className="w-full h-13 py-3.5 rounded-xl text-base font-bold bg-[#6cffc6] text-white hover:bg-[#5ae8b0] shadow-md shadow-[#6cffc6]/20 transition-colors flex items-center justify-center gap-2"
        >
          Add Receipts
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
}
