"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineItem, CLAIM_TYPE_LABELS, CLAIM_TYPE_CATEGORY } from './BatchLineItemReview';

interface Props {
  line: LineItem;
  lineNumber: number;
  onSave: (updated: LineItem) => void;
  onClose: () => void;
}

const PROJECT_CODES = [
  { code: 'P-4821', label: 'Project Orion' },
  { code: 'P-4822', label: 'Babcock Framework' },
  { code: 'P-4823', label: 'Manchester Client' },
  { code: 'P-4824', label: 'Infrastructure Review' },
  { code: 'P-4825', label: 'Training & Development' },
  { code: 'P-4826', label: 'Corporate Travel' },
];

export default function BatchLineEditDrawer({ line, lineNumber, onSave, onClose }: Props) {
  const [merchant, setMerchant] = useState(line.merchant);
  const [date, setDate] = useState(line.date);
  const [amount, setAmount] = useState(String(line.amount));
  const [description, setDescription] = useState(line.description);
  const [claimType, setClaimType] = useState(line.claimType);
  const [projectCode, setProjectCode] = useState(line.projectCode);
  const [attendeeCount, setAttendeeCount] = useState(String(line.attendeeCount ?? 1));
  const [projectOpen, setProjectOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSave = () => {
    const amtNum = parseFloat(amount) || line.amount;
    const attNum = parseInt(attendeeCount) || 1;

    onSave({
      ...line,
      merchant,
      date,
      amount: amtNum,
      description,
      claimType,
      category: CLAIM_TYPE_CATEGORY[claimType],
      projectCode,
      attendeeCount: attNum,
      // Re-derive effective status based on edit (simplified — policy stays same)
      effectivePolicyStatus: line.effectivePolicyStatus,
    });
    onClose();
  };

  const filteredCodes = PROJECT_CODES.filter(
    (p) => p.code.includes(projectCode) || p.label.toLowerCase().includes(projectCode.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer — right side on desktop, bottom sheet on mobile */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[460px] bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              Line {lineNumber}
            </p>
            <h3 className="font-bold text-[#000053] text-base leading-tight truncate max-w-[280px]">
              Edit — {line.merchant}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Claim type */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Claim Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(CLAIM_TYPE_LABELS) as Array<keyof typeof CLAIM_TYPE_LABELS>).map((type) => (
                <button
                  key={type}
                  onClick={() => setClaimType(type)}
                  className={`py-2 px-1 rounded-lg text-xs font-bold border-2 transition-all ${
                    claimType === type
                      ? 'border-[#6cffc6] bg-[#e8fff5] text-[#000053]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {CLAIM_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Merchant / Description
            </label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] bg-white"
            />
          </div>

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Amount (£)
              </label>
              <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-[#6cffc6] bg-white">
                <span className="pl-3 text-lg font-bold text-gray-300 font-mono">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 px-2 py-3 text-sm font-mono font-bold text-[#000053] bg-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Attendees (group) */}
          <AnimatePresence>
            {claimType === 'MEAL' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Number of Attendees
                </label>
                <input
                  type="number"
                  min="1"
                  value={attendeeCount}
                  onChange={(e) => setAttendeeCount(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] bg-white"
                />
                {parseInt(attendeeCount) > 1 && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Per head: £{(parseFloat(amount) / parseInt(attendeeCount) || 0).toFixed(2)}
                    {(parseFloat(amount) / parseInt(attendeeCount)) <= 75 && (
                      <span className="ml-1.5 text-green-600 font-bold">✓ within £75/head limit</span>
                    )}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] bg-white"
            />
          </div>

          {/* Project code override */}
          <div className="relative">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Project Code Override
            </label>
            <input
              type="text"
              value={projectCode}
              onChange={(e) => { setProjectCode(e.target.value); setProjectOpen(true); }}
              onFocus={() => setProjectOpen(true)}
              onBlur={() => setTimeout(() => setProjectOpen(false), 150)}
              placeholder="Search project code…"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm text-[#000053] focus:outline-none focus:border-[#6cffc6] bg-white font-mono"
            />
            <AnimatePresence>
              {projectOpen && filteredCodes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                >
                  {filteredCodes.map((p) => (
                    <button
                      key={p.code}
                      onMouseDown={() => { setProjectCode(p.code); setProjectOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#e8fff5]"
                    >
                      <span className="font-mono text-sm font-bold text-[#000053]">{p.code}</span>
                      <span className="text-sm text-gray-500">{p.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-[#6cffc6] text-white font-bold text-sm hover:bg-[#5ae8b0] shadow-sm shadow-[#6cffc6]/20 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </>
  );
}
