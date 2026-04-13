"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';

// ─── API helper ─────────────────────────────────────────────────────────────

const BASE = 'http://localhost:3001/api/v1';

async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  userId?: string
) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
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
    err.body = body;
    throw err;
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface OcrResult {
  vendor: string;
  date: string;
  amount: number;
  currency: string;
  category_suggestion: string;
  confidence: number;
}

interface PolicyCheck {
  rule_name: string;
  passed: boolean;
  severity: 'pass' | 'warn' | 'fail';
  message: string;
}

interface PolicyResult {
  passed: boolean;
  checks: PolicyCheck[];
  summary: { total: number; passed: number; warnings: number; failures: number };
}

interface ApproverStep {
  person_id: string;
  first_name: string;
  last_name: string;
  avatar_initials: string;
  job_title: string;
  role_label: string;
  resolution_path: string;
}

interface RoutePreview {
  steps: ApproverStep[];
  resolution_log: string[];
  skipped_steps: { step: number; label: string; reason: string }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'meals', label: 'Meals', emoji: '🍽️' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'accommodation', label: 'Hotel', emoji: '🏨' },
  { key: 'transport', label: 'Transport', emoji: '🚕' },
  { key: 'office_supplies', label: 'Supplies', emoji: '📦' },
  { key: 'training', label: 'Training', emoji: '🎓' },
  { key: 'mileage', label: 'Mileage', emoji: '🚗' },
  { key: 'other', label: 'Other', emoji: '📋' },
];

// ─── Severity icon ────────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: 'pass' | 'warn' | 'fail' }) {
  if (severity === 'pass') {
    return (
      <svg className="w-4 h-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (severity === 'warn') {
    return (
      <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSuccess?: (claim: any) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewClaimModal({ onClose, onSuccess }: Props) {
  const { user } = useAuth();
  const userId = user?.sub || 'person:sarah_chen';

  // Stage: 1 = scan, 2 = form, 3 = confirm
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [direction, setDirection] = useState(1); // 1 = forward

  // Stage 1 state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [ocr, setOcr] = useState<OcrResult | null>(null);

  // Stage 2 form state
  const [category, setCategory] = useState('meals');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hasReceipt, setHasReceipt] = useState(false);

  // Partial claim state
  const [partialReason, setPartialReason] = useState('');
  const [partialReasonOther, setPartialReasonOther] = useState('');

  // Exception state
  const [exceptionRequested, setExceptionRequested] = useState(false);
  const [exceptionJustification, setExceptionJustification] = useState('');
  const [exceptionConfirmed, setExceptionConfirmed] = useState(false);

  // Policy state
  const [policyResult, setPolicyResult] = useState<PolicyResult | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const policyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Route preview state
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showResolutionLog, setShowResolutionLog] = useState(false);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedClaim, setConfirmedClaim] = useState<any>(null);

  // ── Transition helper ────────────────────────────────────────────────────

  const goTo = useCallback((next: 1 | 2 | 3) => {
    setDirection(next > stage ? 1 : -1);
    setStage(next);
  }, [stage]);

  // ── OCR ──────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setScanning(true);
    try {
      const data = await apiFetch('/expenses/ocr-scan', { method: 'POST' }, userId);
      const result: OcrResult = data.data;
      setOcr(result);
      setReceiptAmount(result.amount.toFixed(2));
      setClaimAmount(result.amount.toFixed(2));
      setCategory(result.category_suggestion || 'other');
      setDate(result.date);
      setDescription(`Expense at ${result.vendor}`);
      setHasReceipt(true);
    } catch {
      // Fall through to manual even on error
    } finally {
      setScanning(false);
      goTo(2);
    }
  };

  // ── Live policy validation — validates against claim amount (debounced 300 ms) ──

  useEffect(() => {
    if (stage !== 2) return;
    if (policyTimerRef.current) clearTimeout(policyTimerRef.current);
    const num = parseFloat(claimAmount);
    if (!claimAmount || isNaN(num) || num <= 0) {
      setPolicyResult(null);
      setExceptionRequested(false);
      return;
    }
    setPolicyLoading(true);
    policyTimerRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(
          '/policies/validate',
          {
            method: 'POST',
            body: JSON.stringify({ category, amount: num, has_receipt: hasReceipt, date }),
          },
          userId
        );
        const result = data.data as PolicyResult;
        setPolicyResult(result);
        // Reset exception state when policy now passes
        if (result.passed) setExceptionRequested(false);
      } catch {
        setPolicyResult(null);
      } finally {
        setPolicyLoading(false);
      }
    }, 300);
    return () => { if (policyTimerRef.current) clearTimeout(policyTimerRef.current); };
  }, [claimAmount, category, hasReceipt, date, stage, userId]);

  // ── Live route preview (debounced 400 ms) ────────────────────────────────

  useEffect(() => {
    if (stage !== 2) return;
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    const num = parseFloat(claimAmount);
    if (!claimAmount || isNaN(num) || num <= 0) {
      setRoutePreview(null);
      return;
    }
    setRouteLoading(true);
    routeTimerRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(
          '/expenses/preview-route',
          {
            method: 'POST',
            body: JSON.stringify({ amount: num, category }),
          },
          userId
        );
        setRoutePreview(data.data as RoutePreview);
      } catch {
        setRoutePreview(null);
      } finally {
        setRouteLoading(false);
      }
    }, 400);
    return () => { if (routeTimerRef.current) clearTimeout(routeTimerRef.current); };
  }, [claimAmount, category, stage, userId]);

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const claimNum  = parseFloat(claimAmount);
    const receiptNum = parseFloat(receiptAmount) || claimNum;
    const isPartial = receiptNum > 0 && claimNum > 0 && claimNum < receiptNum;
    try {
      const payload: Record<string, any> = {
        category,
        amount: claimNum,
        date,
        has_receipt: hasReceipt,
        description,
        currency: 'GBP',
        receipt_amount: receiptNum,
        claim_amount: claimNum,
      };
      if (isPartial) {
        payload.partial_claim = true;
        payload.partial_reason = partialReason === 'other' ? partialReasonOther.trim() : partialReason;
      }
      if (exceptionRequested) {
        payload.exception_requested = true;
        payload.exception_justification = exceptionJustification.trim();
      }
      const data = await apiFetch('/expenses', { method: 'POST', body: JSON.stringify(payload) }, userId);
      setConfirmedClaim(data.data);
      goTo(3);
      onSuccess?.(data.data);
    } catch (err: any) {
      setSubmitError(err.body?.message || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const claimNum   = parseFloat(claimAmount) || 0;
  const receiptNum = parseFloat(receiptAmount) || 0;
  const isPartialClaim = ocr !== null && receiptNum > 0 && claimNum > 0 && claimNum < receiptNum;
  const hasFail    = policyResult?.checks.some(c => c.severity === 'fail') ?? false;

  const partialReasonValid = !isPartialClaim
    || (partialReason !== '' && (partialReason !== 'other' || partialReasonOther.trim() !== ''));
  const exceptionValid = !exceptionRequested
    || (exceptionJustification.trim() !== '' && exceptionConfirmed);

  const canSubmit = claimNum > 0
    && partialReasonValid
    && (!hasFail || exceptionValid)
    && !submitting;

  // ── Animation variants ───────────────────────────────────────────────────

  const slideVariants = {
    enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir * -60, opacity: 0 }),
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Dark overlay */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal panel */}
        <motion.div
          className="relative z-10 w-full sm:max-w-[540px] max-h-[100dvh] sm:max-h-[90vh] flex flex-col bg-white sm:rounded-2xl shadow-2xl overflow-hidden"
          initial={{ y: 80, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white shrink-0">
            <div className="flex items-center gap-3">
              {stage === 2 && (
                <button
                  onClick={() => goTo(1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <div>
                <h2 className="text-base font-bold text-[#1B2A4A]">
                  {stage === 1 && 'New Expense Claim'}
                  {stage === 2 && 'Review & Submit'}
                  {stage === 3 && 'Claim Submitted'}
                </h2>
                <div className="flex gap-1.5 mt-1">
                  {[1, 2, 3].map(s => (
                    <div
                      key={s}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        s === stage ? 'w-6 bg-[#2E8B8B]' : s < stage ? 'w-3 bg-[#2E8B8B]/40' : 'w-3 bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stage content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" custom={direction}>
              {/* ── STAGE 1: Scan ─────────────────────────────────────── */}
              {stage === 1 && (
                <motion.div
                  key="stage1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="flex flex-col items-center justify-center min-h-[420px] p-8 gap-6"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {scanning ? (
                    /* Scanning animation */
                    <motion.div
                      className="flex flex-col items-center gap-5"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <motion.div
                          className="absolute inset-0 rounded-full border-4 border-[#2E8B8B]/30"
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                        />
                        <motion.div
                          className="absolute inset-2 rounded-full border-4 border-[#2E8B8B]/20"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ repeat: Infinity, duration: 1.4, delay: 0.2, ease: 'easeInOut' }}
                        />
                        <span className="text-5xl">🔍</span>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-[#1B2A4A] text-lg">Reading receipt…</p>
                        <p className="text-sm text-gray-500 mt-1">AI extracting vendor, date & amount</p>
                      </div>
                      <motion.div
                        className="flex gap-1"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                      >
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-[#2E8B8B]"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </motion.div>
                    </motion.div>
                  ) : (
                    /* Tap-to-scan area */
                    <motion.div
                      className="flex flex-col items-center gap-6 w-full"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full max-w-xs aspect-[3/2] flex flex-col items-center justify-center gap-4 border-2 border-dashed border-[#2E8B8B]/40 rounded-2xl bg-[#eaf5f5] hover:bg-[#d5eeee] hover:border-[#2E8B8B] transition-all cursor-pointer"
                      >
                        <div className="w-16 h-16 rounded-full bg-[#2E8B8B]/10 flex items-center justify-center">
                          <svg className="w-8 h-8 text-[#2E8B8B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="text-center px-4">
                          <p className="font-bold text-[#1B2A4A] text-base">Tap to scan receipt</p>
                          <p className="text-xs text-gray-500 mt-1">We'll extract vendor, date, and amount automatically</p>
                        </div>
                      </motion.button>

                      <div className="flex items-center gap-3 w-full max-w-xs">
                        <div className="h-px flex-1 bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">or</span>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>

                      <button
                        onClick={() => goTo(2)}
                        className="text-sm font-semibold text-[#2E8B8B] hover:text-[#257373] underline underline-offset-2 transition-colors"
                      >
                        Enter manually
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ── STAGE 2: Form ─────────────────────────────────────── */}
              {stage === 2 && (
                <motion.div
                  key="stage2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="p-5 space-y-5"
                >
                  {/* OCR result card */}
                  {ocr && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 260 }}
                      className="bg-[#eaf5f5] border border-[#2E8B8B]/20 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1.5 bg-[#2E8B8B] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          AI Extracted
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          {Math.round(ocr.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Vendor</p>
                          <p className="font-semibold text-[#1B2A4A]">{ocr.vendor}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Amount</p>
                          <p className="font-semibold text-[#1B2A4A]">£{ocr.amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Date</p>
                          <p className="font-semibold text-[#1B2A4A]">{ocr.date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Category</p>
                          <p className="font-semibold text-[#1B2A4A] capitalize">{ocr.category_suggestion}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-3 italic">Tap any field below to edit</p>
                    </motion.div>
                  )}

                  {/* Category selector */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.key}
                          onClick={() => setCategory(cat.key)}
                          className={`flex-none flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all whitespace-nowrap ${
                            category === cat.key
                              ? 'bg-[#2E8B8B] text-white border-[#2E8B8B] shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-[#2E8B8B]/50 hover:text-[#2E8B8B]'
                          }`}
                        >
                          <span>{cat.emoji}</span>
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount — two fields when OCR detected, single field otherwise */}
                  {ocr ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Receipt Amount</label>
                        <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                          <span className="pl-4 text-xl font-bold text-gray-300 font-mono select-none">£</span>
                          <input
                            type="number" step="0.01" min="0"
                            value={receiptAmount}
                            onChange={e => setReceiptAmount(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-2 py-3 text-xl font-bold font-mono text-gray-400 bg-transparent outline-none placeholder:text-gray-300"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Claim Amount</label>
                        <div className={`flex items-center border-2 rounded-xl overflow-hidden transition-colors ${
                          hasFail && !exceptionRequested && claimAmount ? 'border-red-400 bg-red-50' : isPartialClaim ? 'border-amber-300 bg-amber-50 focus-within:border-amber-400' : 'border-gray-200 bg-white focus-within:border-[#2E8B8B]'
                        }`}>
                          <span className="pl-3 text-xl font-bold text-gray-400 font-mono select-none">£</span>
                          <input
                            type="number" step="0.01" min="0"
                            value={claimAmount}
                            onChange={e => setClaimAmount(e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-2 py-3 text-xl font-bold font-mono text-[#1B2A4A] bg-transparent outline-none placeholder:text-gray-300"
                          />
                          {policyLoading && (
                            <span className="pr-3 animate-spin border-2 border-[#2E8B8B] border-t-transparent rounded-full w-4 h-4 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount</label>
                      <div className={`flex items-center border-2 rounded-xl overflow-hidden transition-colors ${
                        hasFail && !exceptionRequested && claimAmount ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus-within:border-[#2E8B8B]'
                      }`}>
                        <span className="pl-4 text-2xl font-bold text-gray-400 font-mono select-none">£</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={claimAmount}
                          onChange={e => { setClaimAmount(e.target.value); setReceiptAmount(e.target.value); }}
                          placeholder="0.00"
                          className="flex-1 px-2 py-4 text-2xl font-bold font-mono text-[#1B2A4A] bg-transparent outline-none placeholder:text-gray-300"
                        />
                        {policyLoading && (
                          <span className="pr-4 animate-spin border-2 border-[#2E8B8B] border-t-transparent rounded-full w-4 h-4 shrink-0" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Partial claim info panel */}
                  <AnimatePresence>
                    {isPartialClaim && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                          <p className="text-sm font-semibold text-amber-800">
                            ℹ️ You are claiming <span className="font-bold">£{claimNum.toFixed(2)}</span> of a <span className="font-bold">£{receiptNum.toFixed(2)}</span> receipt
                          </p>
                          <div>
                            <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5">Reason for partial claim <span className="text-red-500">*</span></label>
                            <select
                              value={partialReason}
                              onChange={e => setPartialReason(e.target.value)}
                              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-[#1B2A4A] bg-white focus:outline-none focus:border-amber-500"
                            >
                              <option value="">Select a reason…</option>
                              <option value="personal_guest">Personal guest included</option>
                              <option value="shared_bill">Shared bill — claiming my portion</option>
                              <option value="partial_business">Partial business use</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          {partialReason === 'other' && (
                            <input
                              type="text"
                              value={partialReasonOther}
                              onChange={e => setPartialReasonOther(e.target.value)}
                              placeholder="Please describe the reason…"
                              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-[#1B2A4A] bg-white focus:outline-none focus:border-amber-500 placeholder:text-amber-400"
                            />
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Live policy checks */}
                  <AnimatePresence mode="wait">
                    {policyResult && (
                      <motion.div
                        key="policy"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-1.5 overflow-hidden"
                      >
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Policy Checks</p>
                        {policyResult.checks.map((check, i) => (
                          <motion.div
                            key={check.rule_name}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className={`flex items-start gap-2.5 text-sm px-3 py-2.5 rounded-lg ${
                              check.severity === 'pass'
                                ? 'bg-green-50 text-green-700'
                                : check.severity === 'warn'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            <SeverityIcon severity={check.severity} />
                            <span className="leading-snug">{check.message}</span>
                          </motion.div>
                        ))}

                        {/* Exception request option when policy fails */}
                        {hasFail && (
                          <AnimatePresence>
                            {!exceptionRequested ? (
                              <motion.div
                                key="exception-offer"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="pt-1 space-y-2"
                              >
                                <p className="text-xs text-red-500 font-semibold text-center">
                                  This claim exceeds policy limits
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setExceptionRequested(true)}
                                  className="w-full py-2.5 rounded-xl text-sm font-bold border-2 border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                                >
                                  Request policy exception instead →
                                </button>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="exception-form"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-amber-800">⚠️ Policy Exception Request</p>
                                    <button
                                      type="button"
                                      onClick={() => { setExceptionRequested(false); setExceptionConfirmed(false); setExceptionJustification(''); }}
                                      className="text-xs text-amber-600 hover:text-amber-800 underline"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  <p className="text-xs text-amber-700">Your claim will be routed to a senior manager for exception approval. Provide a clear business justification.</p>
                                  <textarea
                                    value={exceptionJustification}
                                    onChange={e => setExceptionJustification(e.target.value)}
                                    placeholder="Business justification — e.g. client lunch ran over budget due to extended meeting…"
                                    rows={3}
                                    className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-[#1B2A4A] bg-white focus:outline-none focus:border-amber-500 resize-none placeholder:text-amber-400"
                                  />
                                  <label className="flex items-start gap-2.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={exceptionConfirmed}
                                      onChange={e => setExceptionConfirmed(e.target.checked)}
                                      className="mt-0.5 w-4 h-4 accent-amber-500 shrink-0"
                                    />
                                    <span className="text-xs text-amber-800 font-medium leading-snug">
                                      I confirm this is a legitimate business expense and understand it requires senior manager approval
                                    </span>
                                  </label>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="What was this expense for?"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1B2A4A] focus:outline-none focus:border-[#2E8B8B] transition-colors bg-white placeholder:text-gray-300"
                    />
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Date</label>
                    <input
                      type="date"
                      value={date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={e => setDate(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1B2A4A] focus:outline-none focus:border-[#2E8B8B] transition-colors bg-white"
                    />
                  </div>

                  {/* Receipt indicator */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                      hasReceipt
                        ? 'border-green-300 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}
                    onClick={() => setHasReceipt(v => !v)}
                  >
                    <svg className={`w-5 h-5 shrink-0 ${hasReceipt ? 'text-green-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-semibold flex-1">
                      {hasReceipt ? '📷 Receipt captured ✓' : 'Receipt not attached — tap to mark'}
                    </span>
                    {hasReceipt && (
                      <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Approval route preview */}
                  <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Approval Route</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Resolved from organisation structure</p>
                      </div>
                      {routeLoading && (
                        <span className="animate-spin border-2 border-[#2E8B8B] border-t-transparent rounded-full w-4 h-4" />
                      )}
                    </div>

                    <div className="p-4">
                      {!routePreview && !routeLoading && (
                        <p className="text-sm text-gray-400 text-center py-4">Enter an amount to see the approval route</p>
                      )}

                      {routePreview && (
                        <div className="space-y-3">
                          {/* Active steps */}
                          {routePreview.steps.map((step, i) => (
                            <motion.div
                              key={step.person_id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.08 }}
                              className="flex items-center gap-3"
                            >
                              <div className="w-7 h-7 rounded-full bg-[#2E8B8B] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                                {i + 1}
                              </div>
                              <div className="w-9 h-9 rounded-full bg-[#1B2A4A] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {step.avatar_initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-[#1B2A4A] leading-tight">
                                  {step.first_name} {step.last_name}
                                  {step.role_label && (
                                    <span className="ml-1.5 font-normal text-gray-500">— {step.role_label}</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-400">{step.job_title}</p>
                              </div>
                            </motion.div>
                          ))}

                          {/* Skipped steps */}
                          {routePreview.skipped_steps.map(skip => (
                            <motion.div
                              key={skip.step}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center gap-3 opacity-40"
                            >
                              <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">
                                {skip.step}
                              </div>
                              <p className="text-xs text-gray-400 italic">
                                {skip.label && <span className="font-medium not-italic text-gray-500">{skip.label}</span>}
                                {skip.label && ' — '}
                                not required {skip.min_amount && `(below £${skip.min_amount})`}
                              </p>
                            </motion.div>
                          ))}

                          {/* Resolution log toggle */}
                          {routePreview.resolution_log.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <button
                                onClick={() => setShowResolutionLog(v => !v)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-[#2E8B8B] hover:text-[#257373] transition-colors"
                              >
                                <svg
                                  className={`w-3.5 h-3.5 transition-transform ${showResolutionLog ? 'rotate-90' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                How was this route determined?
                              </button>

                              <AnimatePresence>
                                {showResolutionLog && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-2 bg-[#1B2A4A]/3 rounded-lg p-3 space-y-1">
                                      {routePreview.resolution_log.map((line, i) => (
                                        <p
                                          key={i}
                                          className={`text-[11px] font-mono leading-relaxed ${
                                            line === '---'
                                              ? 'border-t border-gray-200 my-1'
                                              : line.startsWith('  ')
                                              ? 'text-[#2E8B8B] pl-3'
                                              : 'text-gray-600'
                                          }`}
                                        >
                                          {line === '---' ? null : line}
                                        </p>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit error */}
                  {submitError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
                    >
                      {submitError}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ── STAGE 3: Confirmation ──────────────────────────────── */}
              {stage === 3 && (
                <motion.div
                  key="stage3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="flex flex-col items-center justify-center min-h-[420px] p-8 gap-6"
                >
                  {/* Checkmark animation */}
                  <motion.div
                    className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 260, delay: 0.1 }}
                  >
                    <motion.svg
                      className="w-12 h-12 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.35 }}
                    >
                      <motion.path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </motion.svg>
                  </motion.div>

                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                  >
                    <h3 className="text-2xl font-bold text-[#1B2A4A]">Claim Submitted</h3>
                    <p className="text-gray-500 mt-2">
                      {confirmedClaim?.workflow?.steps?.[0]
                        ? `Routed to ${confirmedClaim.workflow.steps[0].approver_name} for approval`
                        : 'Your expense claim is now in review'}
                    </p>
                  </motion.div>

                  {/* Summary card */}
                  {confirmedClaim && (
                    <motion.div
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.55 }}
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Reference</span>
                        <span className="font-bold text-[#1B2A4A] font-mono">
                          {confirmedClaim.claim?.reference || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Amount</span>
                        <span className="font-bold text-[#1B2A4A]">
                          £{claimNum.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-medium">Category</span>
                        <span className="font-bold text-[#1B2A4A] capitalize">{category}</span>
                      </div>
                      {confirmedClaim.workflow?.steps?.length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Approval Steps</p>
                          <div className="space-y-1.5">
                            {confirmedClaim.workflow.steps.map((s: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <div className="w-5 h-5 rounded-full bg-[#2E8B8B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {i + 1}
                                </div>
                                <span className="text-gray-700 font-medium">{s.approver_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer CTA */}
          <div className="px-5 py-4 border-t border-gray-100 bg-white shrink-0">
            {stage === 2 && (
              <motion.button
                whileTap={{ scale: canSubmit ? 0.98 : 1 }}
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full h-12 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all ${
                  canSubmit
                    ? exceptionRequested
                      ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md shadow-amber-500/20'
                      : 'bg-[#2E8B8B] text-white hover:bg-[#257373] shadow-md shadow-[#2E8B8B]/20'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5" />
                    Submitting…
                  </>
                ) : exceptionRequested ? (
                  <>
                    ⚠️ Submit with Exception Request
                    {claimNum > 0 && <span className="opacity-80">· £{claimNum.toFixed(2)}</span>}
                  </>
                ) : (
                  <>
                    Submit Claim
                    {claimNum > 0 && <span className="opacity-80">· £{claimNum.toFixed(2)}</span>}
                  </>
                )}
              </motion.button>
            )}

            {stage === 3 && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={onClose}
                className="w-full h-12 rounded-xl text-base font-bold bg-[#1B2A4A] text-white hover:bg-[#253966] transition-colors"
              >
                Done
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
