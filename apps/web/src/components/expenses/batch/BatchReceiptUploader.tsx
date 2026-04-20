"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BatchHeader } from './BatchClaimHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchOCRResult {
  index: number;
  status: 'extracted' | 'flagged';
  merchant: string;
  date: string;
  amount: number;
  currency: 'GBP';
  category: 'meals' | 'hotel' | 'travel' | 'fuel';
  inferredType: 'single' | 'group' | 'mileage';
  description: string;
  policyStatus: 'ok' | 'warning' | 'fail';
  policyMessage?: string | null;
  confidence: number;
  processingMs: number;
}

type CardState = 'queued' | 'scanning' | 'extracted' | 'flagged';

interface FileCard {
  file: File;
  index: number;
  state: CardState;
  result?: BatchOCRResult;
}

interface Props {
  header: BatchHeader;
  initialResults?: BatchOCRResult[]; // preserved when navigating back from review
  onReview: (results: BatchOCRResult[]) => void;
  onBack: () => void;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ReceiptStackIcon = () => (
  <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
    <rect x="4" y="6" width="14" height="16" rx="1.5" />
    <path d="M7 3h11a1 1 0 011 1v15" strokeLinecap="round" />
    <path d="M8 10h8M8 13h6M8 16h4" strokeLinecap="round" />
  </svg>
);

// ─── Per-receipt card ─────────────────────────────────────────────────────────

function ReceiptCard({ card }: { card: FileCard }) {
  const { state, file, result } = card;

  const categoryEmoji: Record<string, string> = {
    meals: '🍽️',
    hotel: '🏨',
    travel: '✈️',
    fuel: '⛽',
  };

  const policyIcon = result?.policyStatus === 'ok'
    ? <span className="text-green-600 font-bold text-base">✓</span>
    : result?.policyStatus === 'warning'
    ? <span className="text-amber-500 font-bold text-base">⚠</span>
    : <span className="text-red-500 font-bold text-base">✗</span>;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`rounded-xl border-2 overflow-hidden transition-all ${
        state === 'queued'
          ? 'border-gray-200 bg-gray-50'
          : state === 'scanning'
          ? 'border-[#6cffc6]/60 bg-[#f0fffb]'
          : state === 'extracted'
          ? 'border-green-200 bg-green-50'
          : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* State indicator */}
        <div className="shrink-0 w-8 h-8 flex items-center justify-center">
          {state === 'queued' && (
            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
          )}
          {state === 'scanning' && (
            <motion.div
              className="w-5 h-5 rounded-full border-2 border-[#6cffc6] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
            />
          )}
          {state === 'extracted' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 280 }}
              className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
          )}
          {state === 'flagged' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 280 }}
              className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </motion.div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {state === 'queued' && (
            <div>
              <p className="text-sm font-semibold text-gray-500 truncate">{file.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Waiting…</p>
            </div>
          )}
          {state === 'scanning' && (
            <div>
              <p className="text-sm font-semibold text-[#000053] truncate">{file.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-[#6cffc6]/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#6cffc6] rounded-full"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                    style={{ width: '50%' }}
                  />
                </div>
                <span className="text-xs text-[#000053] font-medium shrink-0">Reading receipt…</span>
              </div>
            </div>
          )}
          {(state === 'extracted' || state === 'flagged') && result && (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{categoryEmoji[result.category] ?? '📋'}</span>
                <p className="text-sm font-bold text-[#000053] truncate">{result.merchant}</p>
                <span className="ml-auto shrink-0">{policyIcon}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-mono font-bold text-[#000053]">£{result.amount.toFixed(2)}</span>
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="capitalize">{result.category}</span>
                <span className="mx-1.5 text-gray-300">·</span>
                <span>{result.date}</span>
              </p>
              {state === 'flagged' && result.policyMessage && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-xs text-amber-700 mt-1.5 leading-snug"
                >
                  {result.policyMessage}
                </motion.p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Auto-advance countdown button ───────────────────────────────────────────

function CountdownButton({ onAdvance, onCancel }: { onAdvance: () => void; onCancel: () => void }) {
  const [remaining, setRemaining] = useState(1.5);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 0.1) {
          clearInterval(interval);
          onAdvance();
          return 0;
        }
        return r - 0.1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onAdvance]);

  const pct = ((1.5 - remaining) / 1.5) * 100;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Progress fill */}
      <div
        className="absolute inset-0 bg-[#5ae8b0] transition-none"
        style={{ width: `${pct}%` }}
      />
      <div className="relative flex items-center justify-between px-5 py-3.5 bg-[#6cffc6] text-white">
        <span className="font-bold text-sm">All receipts clean — advancing in {remaining.toFixed(1)}s</span>
        <button
          onClick={onCancel}
          className="text-white/70 hover:text-white text-xs underline"
        >
          Stay
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BatchReceiptUploader({
  header,
  initialResults,
  onReview,
  onBack,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cards, setCards] = useState<FileCard[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [limitMsg, setLimitMsg] = useState('');
  const [allDone, setAllDone] = useState(!!initialResults?.length);
  const [autoAdvanceCancelled, setAutoAdvanceCancelled] = useState(false);
  const [backConfirm, setBackConfirm] = useState(false);
  const scanTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Restore from initial results if navigating back from review
  useEffect(() => {
    if (initialResults?.length) {
      setCards(
        initialResults.map((r, i) => ({
          file: new File([], `receipt-${i + 1}.jpg`),
          index: r.index,
          state: r.status === 'flagged' ? 'flagged' : 'extracted',
          result: r,
        }))
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const processFiles = useCallback(async (files: File[]) => {
    const existing = cards.length;
    const newFiles = files.slice(0, 10 - existing);

    if (files.length > 10 - existing) {
      setLimitMsg(
        `Maximum 10 receipts per batch claim. You can submit another batch afterwards.`
      );
    }

    if (!newFiles.length) return;

    // Create queued cards immediately
    const newCards: FileCard[] = newFiles.map((f, i) => ({
      file: f,
      index: existing + i,
      state: 'queued',
    }));
    setCards((prev) => [...prev, ...newCards]);

    // Fetch OCR results for all new files
    const filesMeta = newFiles.map((f, i) => ({
      name: f.name,
      size: f.size,
      index: existing + i,
    }));

    let ocrResults: BatchOCRResult[] = [];
    try {
      const res = await fetch('/api/expenses/ocr-scan-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesMeta }),
      });
      const data = await res.json();
      ocrResults = data.data ?? [];
    } catch {
      // Fall back to empty results — cards stay in scanning state briefly
    }

    // Stagger: card i starts scanning at i * 300ms
    newFiles.forEach((_, i) => {
      const cardIdx = existing + i;
      const result = ocrResults.find((r) => r.index === cardIdx);

      const startTimer = setTimeout(() => {
        // Begin scanning
        setCards((prev) =>
          prev.map((c) => (c.index === cardIdx ? { ...c, state: 'scanning' } : c))
        );

        const completeTimer = setTimeout(() => {
          // Complete
          setCards((prev) =>
            prev.map((c) =>
              c.index === cardIdx
                ? {
                    ...c,
                    state: result
                      ? result.status === 'flagged'
                        ? 'flagged'
                        : 'extracted'
                      : 'extracted',
                    result,
                  }
                : c
            )
          );
        }, result?.processingMs ?? 1600);

        scanTimers.current.push(completeTimer);
      }, i * 300);

      scanTimers.current.push(startTimer);
    });

    // Mark all done after the longest card completes
    const longestStart = (newFiles.length - 1) * 300;
    const longestProcess = Math.max(...ocrResults.map((r) => r.processingMs ?? 1600), 1600);
    const doneTimer = setTimeout(() => {
      setAllDone(true);
    }, longestStart + longestProcess + 100);
    scanTimers.current.push(doneTimer);
  }, [cards]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => scanTimers.current.forEach(clearTimeout);
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setLimitMsg('');
    const accepted = Array.from(files).filter((f) =>
      ['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)
    );
    processFiles(accepted);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const totalAmount = cards
    .filter((c) => c.result)
    .reduce((s, c) => s + (c.result?.amount ?? 0), 0);
  const flagCount = cards.filter((c) => c.state === 'flagged').length;
  const hasFlags = flagCount > 0;

  const allResults = cards.filter((c) => c.result).map((c) => c.result!);

  const handleReview = () => onReview(allResults);

  const handleBack = () => {
    if (cards.length > 0) {
      setBackConfirm(true);
    } else {
      onBack();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Back confirm dialog ── */}
      <AnimatePresence>
        {backConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <p className="font-bold text-[#000053] text-base mb-2">Clear uploaded receipts?</p>
              <p className="text-sm text-gray-500 mb-5">
                Going back will clear your uploaded receipts. You can re-upload them if you return.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setBackConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  Stay
                </button>
                <button
                  onClick={() => {
                    setBackConfirm(false);
                    scanTimers.current.forEach(clearTimeout);
                    setCards([]);
                    setAllDone(false);
                    onBack();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* ── Drop zone (visible when no cards, or cards but < 10) ── */}
        <AnimatePresence>
          {cards.length === 0 && (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-full flex flex-col items-center justify-center gap-5 py-14 px-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-[#6cffc6] bg-[#e8fff5] scale-[1.01]'
                    : 'border-gray-300 bg-gray-50 hover:border-[#6cffc6]/60 hover:bg-[#f0fffb]'
                }`}
                style={{
                  backgroundImage: isDragOver
                    ? 'none'
                    : 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.01) 10px, rgba(0,0,0,0.01) 20px)',
                }}
              >
                {isDragOver && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-[#6cffc6]"
                    animate={{
                      strokeDashoffset: [0, -20],
                    }}
                    style={{
                      animation: 'dash 0.5s linear infinite',
                    }}
                  />
                )}
                <ReceiptStackIcon />
                <div className="text-center">
                  <p className="font-bold text-[#000053] text-lg">Drop receipts here</p>
                  <p className="text-sm text-gray-400 mt-1">JPEG, PNG or PDF · Up to 10 files</p>
                  {isDragOver && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[#6cffc6] font-bold mt-2"
                    >
                      Release to upload
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Camera button for mobile */}
              <label className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-[#000053] hover:bg-gray-50 cursor-pointer transition-colors">
                <span>📷</span>
                Take Photos
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>

              <p className="text-center text-xs text-[#6cffc6] font-medium mt-3">
                Add at least 3 receipts to see the batch magic ✨
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Limit warning ── */}
        <AnimatePresence>
          {limitMsg && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700"
            >
              {limitMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Scan queue ── */}
        {cards.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Scan Queue
              </p>
              {cards.length < 10 && !allDone && (
                <label className="text-xs font-semibold text-[#6cffc6] cursor-pointer hover:text-[#5ae8b0]">
                  + Add more
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
            {cards.map((card) => (
              <ReceiptCard key={card.index} card={card} />
            ))}
          </div>
        )}

        {/* ── Summary bar ── */}
        <AnimatePresence>
          {allDone && cards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-[#000053] text-white rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
            >
              <span className="font-bold text-sm">
                {cards.length} receipt{cards.length !== 1 ? 's' : ''} scanned
              </span>
              <span className="text-white/30">·</span>
              <span className="font-mono font-bold text-sm">
                £{totalAmount.toFixed(2)} total
              </span>
              {flagCount > 0 && (
                <>
                  <span className="text-white/30">·</span>
                  <span className="text-amber-300 font-bold text-sm">
                    {flagCount} item{flagCount !== 1 ? 's' : ''} need attention
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Auto-advance (if no flags) ── */}
        <AnimatePresence>
          {allDone && !hasFlags && !autoAdvanceCancelled && cards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <CountdownButton
                onAdvance={handleReview}
                onCancel={() => setAutoAdvanceCancelled(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-4 border-t border-gray-100 bg-white shrink-0 flex gap-3">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <AnimatePresence>
          {allDone && cards.length > 0 && (
            <motion.button
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleReview}
              className="flex-1 h-12 rounded-xl text-sm font-bold bg-[#6cffc6] text-white hover:bg-[#5ae8b0] shadow-md shadow-[#6cffc6]/20 transition-colors flex items-center justify-center gap-2"
            >
              Review Line Items
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
