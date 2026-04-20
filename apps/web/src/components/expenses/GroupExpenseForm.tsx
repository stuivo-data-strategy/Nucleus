"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../lib/auth';

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
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

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

interface GroupExpenseFormProps {
  onSuccess?: (claim: any) => void;
  onCancel: () => void;
}

export function GroupExpenseForm({ onSuccess, onCancel }: GroupExpenseFormProps) {
  const { user } = useAuth();
  const userId = user?.sub || 'person:sarah_chen';

  const [receiptAmount, setReceiptAmount] = useState<string>('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // People Picker
  const [attendees, setAttendees] = useState<any[]>([{ id: userId, name: "Sarah Chen (You)", isClaimant: true }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Split Logic
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Policy & Route
  const [policyResult, setPolicyResult] = useState<any>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [routePreview, setRoutePreview] = useState<any>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Derive Total
  const totalAmount = parseFloat(receiptAmount) || 0;

  // Search people mock
  useEffect(() => {
    if (searchQuery.length > 2) {
      // Mock search results
      setSearchResults([
        { id: 'person:james_morton', name: 'James Morton' },
        { id: 'person:amara_okafor', name: 'Amara Okafor' },
        { id: 'person:peter_blackwell', name: 'Peter Blackwell' },
      ].filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !attendees.some(a => a.id === p.id)));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, attendees]);

  const addAttendee = (person: any) => {
    setAttendees([...attendees, person]);
    setSearchQuery('');
  };

  const removeAttendee = (id: string) => {
    setAttendees(attendees.filter(a => a.id !== id));
  };

  // Live checks
  useEffect(() => {
    if (totalAmount <= 0) return;
    
    // Policy
    setPolicyLoading(true);
    apiFetch('/policies/validate', {
      method: 'POST',
      body: JSON.stringify({ category: 'meals', amount: totalAmount, has_receipt: true, date, attendees_count: attendees.length })
    }, userId)
      .then(d => setPolicyResult(d.data))
      .catch(() => setPolicyResult(null))
      .finally(() => setPolicyLoading(false));

    // Route
    apiFetch('/expenses/preview-route', {
      method: 'POST',
      body: JSON.stringify({ amount: totalAmount, category: 'meals' })
    }, userId)
      .then(d => setRoutePreview(d.data))
      .catch(() => setRoutePreview(null));

  }, [totalAmount, date, userId, attendees.length]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: any = {
        category: 'meals',
        claim_type: 'group',
        amount: totalAmount,
        receipt_amount: totalAmount,
        claim_amount: totalAmount,
        date,
        has_receipt: true,
        description,
        currency: 'GBP',
        attendees: attendees.map(a => a.id),
        cost_split: splitMode,
        attendee_amounts: attendees.map(a => ({
          person_id: a.id,
          amount: splitMode === 'equal' ? totalAmount / attendees.length : parseFloat(customAmounts[a.id] || '0')
        }))
      };
      
      const data = await apiFetch('/expenses', { method: 'POST', body: JSON.stringify(payload) }, userId);
      onSuccess?.(data.data);
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const customTotal = Object.values(customAmounts).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
  const isCustomValid = splitMode === 'equal' || Math.abs(customTotal - totalAmount) < 0.01;
  const canSubmit = totalAmount > 0 && attendees.length > 1 && isCustomValid && !submitting && !(policyResult?.checks.some((c:any) => c.severity === 'fail'));

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">
        
        {/* Receipt Amount */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Receipt Amount</label>
          <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-[#6cffc6] transition-colors">
            <span className="pl-4 text-2xl font-bold text-gray-400 font-mono select-none">£</span>
            <input
              type="number" step="0.01" min="0"
              value={receiptAmount}
              onChange={e => setReceiptAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 px-2 py-4 text-2xl font-bold font-mono text-[#000053] bg-transparent outline-none placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Attendees */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Attendees ({attendees.length} people including you)</label>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {attendees.map(a => (
              <div key={a.id} className="flex items-center gap-1.5 bg-[#e8fff5] text-[#000053] px-3 py-1.5 rounded-full text-sm font-semibold border border-[#6cffc6]/20">
                {a.name}
                {!a.isClaimant ? (
                  <button onClick={() => removeAttendee(a.id)} className="text-[#000053] hover:text-[#1e6161]">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  </button>
                ) : (
                  <svg className="w-3.5 h-3.5 text-[#000053]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search colleagues to add..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#6cffc6]"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 p-1">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addAttendee(p)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 rounded-lg"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cost Split */}
        {attendees.length > 1 && totalAmount > 0 && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cost Split</label>
              <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setSplitMode('equal')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${splitMode === 'equal' ? 'bg-white shadow-sm text-[#000053]' : 'text-gray-500 hover:text-gray-700'}`}>Equally</button>
                <button onClick={() => setSplitMode('custom')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${splitMode === 'custom' ? 'bg-white shadow-sm text-[#000053]' : 'text-gray-500 hover:text-gray-700'}`}>Custom</button>
              </div>
            </div>

            {splitMode === 'equal' ? (
              <div className="text-sm font-semibold text-gray-700">
                £{(totalAmount / attendees.length).toFixed(2)} per person
              </div>
            ) : (
              <div className="space-y-3">
                {attendees.map(a => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{a.name}</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                      <input
                        type="number"
                        min="0" step="0.01"
                        value={customAmounts[a.id] || ''}
                        onChange={e => setCustomAmounts({ ...customAmounts, [a.id]: e.target.value })}
                        className="w-24 border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-sm text-right focus:outline-none focus:border-[#6cffc6]"
                      />
                    </div>
                  </div>
                ))}
                {!isCustomValid && (
                  <p className="text-xs text-red-500 font-semibold text-right">
                    Total must be exactly £{totalAmount.toFixed(2)} (currently £{customTotal.toFixed(2)})
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Description & Date */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Reason for meeting/expense..."
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#6cffc6]"
          />
        </div>

        {/* Live validation */}
        {policyResult && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Policy Checks</p>
            {policyResult.checks.map((check: any, i: number) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 text-sm px-3 py-2.5 rounded-lg ${
                  check.severity === 'pass' ? 'bg-green-50 text-green-700' : check.severity === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                }`}
              >
                <SeverityIcon severity={check.severity} />
                <span className="leading-snug">{check.message}</span>
              </div>
            ))}
          </div>
        )}

      </div>
      
      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full h-12 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all ${
            canSubmit
              ? 'bg-[#6cffc6] text-white hover:bg-[#5ae8b0] shadow-md shadow-[#6cffc6]/20'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting...' : `Submit · £${totalAmount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
