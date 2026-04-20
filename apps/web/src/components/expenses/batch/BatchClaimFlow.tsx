"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BatchClaimHeader, { BatchHeader } from './BatchClaimHeader';
import BatchReceiptUploader, { BatchOCRResult } from './BatchReceiptUploader';
import BatchLineItemReview from './BatchLineItemReview';

// ─── Types ────────────────────────────────────────────────────────────────────

type BatchPhase = 'header' | 'upload' | 'review' | 'confirmed';

interface Props {
  onClose: () => void;
  onSuccess?: (data: any) => void;
  onBack: () => void; // navigate back to claim type selector
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ phase }: { phase: BatchPhase }) {
  const steps: BatchPhase[] = ['header', 'upload', 'review'];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s) => {
        const idx = steps.indexOf(s);
        const currentIdx = steps.indexOf(phase as any);
        const isPast = idx < currentIdx;
        const isCurrent = s === phase;
        return (
          <div
            key={s}
            className={`rounded-full transition-all duration-300 flex items-center justify-center ${
              isPast
                ? 'w-5 h-5 bg-[#6cffc6]'
                : isCurrent
                ? 'w-5 h-5 bg-[#000053]'
                : 'w-3 h-3 bg-gray-200'
            }`}
          >
            {isPast && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isCurrent && (
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Phase label ─────────────────────────────────────────────────────────────

const PHASE_TITLES: Record<BatchPhase, string> = {
  header: 'Step 1 of 3 — Claim Details',
  upload: 'Step 2 of 3 — Add Receipts',
  review: 'Step 3 of 3 — Review & Submit',
  confirmed: 'Submitted',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function BatchClaimFlow({ onClose, onSuccess, onBack }: Props) {
  const [phase, setPhase] = useState<BatchPhase>('header');
  const [direction, setDirection] = useState(1);
  const [header, setHeader] = useState<BatchHeader | null>(null);
  const [scannedResults, setScannedResults] = useState<BatchOCRResult[]>([]);
  const [confirmedRef, setConfirmedRef] = useState('');
  const [confirmedAmount, setConfirmedAmount] = useState(0);
  const [confirmedLineCount, setConfirmedLineCount] = useState(0);

  const goTo = (next: BatchPhase) => {
    const order: BatchPhase[] = ['header', 'upload', 'review', 'confirmed'];
    setDirection(order.indexOf(next) > order.indexOf(phase) ? 1 : -1);
    setPhase(next);
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir * -60, opacity: 0 }),
  };

  const handleHeaderContinue = (h: BatchHeader) => {
    setHeader(h);
    goTo('upload');
  };

  const handleReview = (results: BatchOCRResult[]) => {
    setScannedResults(results);
    goTo('review');
  };

  const handleSubmit = (reference: string, totalAmount: number) => {
    setConfirmedRef(reference);
    setConfirmedAmount(totalAmount);
    setConfirmedLineCount(scannedResults.length);
    goTo('confirmed');
    onSuccess?.({ reference, totalAmount });
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Header bar ── */}
      {phase !== 'confirmed' && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            {/* Back button */}
            {phase === 'header' && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-[#000053]">New Batch Claim</h2>
              <p className="text-xs text-gray-400 mt-0.5">{PHASE_TITLES[phase]}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <StepDots phase={phase} />
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Phase content ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait" custom={direction}>
          {/* Phase 1 — Header */}
          {phase === 'header' && (
            <motion.div
              key="header"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="absolute inset-0 flex flex-col"
            >
              <BatchClaimHeader onContinue={handleHeaderContinue} />
            </motion.div>
          )}

          {/* Phase 2 — Upload */}
          {phase === 'upload' && header && (
            <motion.div
              key="upload"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="absolute inset-0 flex flex-col"
            >
              <BatchReceiptUploader
                header={header}
                initialResults={scannedResults.length > 0 ? scannedResults : undefined}
                onReview={handleReview}
                onBack={() => goTo('header')}
              />
            </motion.div>
          )}

          {/* Phase 3 — Review */}
          {phase === 'review' && header && (
            <motion.div
              key="review"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="absolute inset-0 flex flex-col"
            >
              <BatchLineItemReview
                header={header}
                results={scannedResults}
                onSubmit={handleSubmit}
                onBack={() => goTo('upload')}
                onClose={onClose}
              />
            </motion.div>
          )}

          {/* Confirmed */}
          {phase === 'confirmed' && (
            <motion.div
              key="confirmed"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-6 text-center"
            >
              {/* Animated check */}
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
                  <motion.path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </motion.svg>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h3 className="text-2xl font-bold text-[#000053]">Batch claim submitted</h3>
                {header && (
                  <p className="text-gray-500 mt-2 text-sm">
                    {header.contextLabel ||
                      `${new Date(header.periodStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} Expenses`}
                  </p>
                )}
              </motion.div>

              {/* Summary */}
              <motion.div
                className="w-full max-w-sm bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Reference</span>
                  <span className="font-bold text-[#000053] font-mono">{confirmedRef}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Lines</span>
                  <span className="font-bold text-[#000053]">
                    {confirmedLineCount} expense{confirmedLineCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Total</span>
                  <span className="font-bold text-[#000053] font-mono">
                    £{confirmedAmount.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#000053] text-white text-xs font-bold flex items-center justify-center shrink-0">
                      AD
                    </div>
                    <p className="text-sm text-gray-600">
                      Sent to <span className="font-bold text-[#000053]">Alex Drummond</span> for approval
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                onClick={onClose}
                className="w-full max-w-sm h-12 rounded-xl text-base font-bold bg-[#000053] text-white hover:bg-[#000080] transition-colors"
              >
                View in dashboard →
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
