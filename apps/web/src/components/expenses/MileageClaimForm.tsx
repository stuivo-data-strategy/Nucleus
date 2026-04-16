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

interface MileageClaimFormProps {
  onSuccess?: (claim: any) => void;
  onCancel: () => void;
}

export function MileageClaimForm({ onSuccess, onCancel }: MileageClaimFormProps) {
  const { user } = useAuth();
  const userId = user?.sub || 'person:sarah_chen';

  // Core fields
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [returnJourney, setReturnJourney] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Vehicles and Journeys
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [totalMilesYtd, setTotalMilesYtd] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  // Calculation
  const [calculating, setCalculating] = useState(false);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  const [rateApplied, setRateApplied] = useState<string>('');

  // Policy & Route
  const [policyResult, setPolicyResult] = useState<any>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [routePreview, setRoutePreview] = useState<any>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showResolutionLog, setShowResolutionLog] = useState(false);

  // Exceptions
  const [exceptionRequested, setExceptionRequested] = useState(false);
  const [exceptionJustification, setExceptionJustification] = useState('');
  const [exceptionConfirmed, setExceptionConfirmed] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load profile data (mocked or real)
  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await apiFetch('/expenses/mileage-profile', {}, userId);
        setVehicles(data.data.vehicles || []);
        setJourneys(data.data.saved_journeys || []);
        setTotalMilesYtd(data.data.total_miles || 0);
        if (data.data.vehicles?.length > 0) {
          setSelectedVehicle(data.data.vehicles[0].id);
        }
      } catch (err) {
        // Mock fallback if endpoint not ready
        setVehicles([
          { id: 'v1', registration: 'LD68 XBY', make: 'Volkswagen Golf', fuel_type: 'petrol', engine_cc: 1400 },
          { id: 'v2', registration: 'EA71 KWT', make: 'Tesla Model 3', fuel_type: 'electric', engine_cc: 0 }
        ]);
        setJourneys([
          { id: 'j1', label: 'Home to Manchester Office', from_address: 'WA14 2DT', to_address: 'M2 3AW' }
        ]);
        setTotalMilesYtd(8750);
        setSelectedVehicle('v1');
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, [userId]);

  // Recalculate amount whenever distance/return toggle/ytd miles change
  useEffect(() => {
    if (distanceMiles === null) {
      setCalculatedAmount(0);
      return;
    }
    const finalDistance = returnJourney ? distanceMiles * 2 : distanceMiles;
    
    // HMRC Logic
    const availableAt45 = Math.max(0, 10000 - totalMilesYtd);
    let amount = 0;
    if (finalDistance <= availableAt45) {
      amount = finalDistance * 0.45;
      setRateApplied('45p');
    } else {
      const at45 = availableAt45;
      const at25 = finalDistance - availableAt45;
      amount = (at45 * 0.45) + (at25 * 0.25);
      if (at45 > 0) {
        setRateApplied('Split (45p / 25p)');
      } else {
        setRateApplied('25p');
      }
    }
    setCalculatedAmount(Math.round(amount * 100) / 100);
  }, [distanceMiles, returnJourney, totalMilesYtd]);

  const handleCalculate = async () => {
    if (!fromAddress || !toAddress) return;
    setCalculating(true);
    try {
      const data = await apiFetch('/calculate-distance', {
        method: 'POST',
        body: JSON.stringify({ from: fromAddress, to: toAddress })
      }, userId);
      setDistanceMiles(data.data.distanceMiles);
    } catch (err) {
      console.error(err);
    } finally {
      setCalculating(false);
    }
  };

  const selectJourney = (j: any) => {
    setFromAddress(j.from_address);
    setToAddress(j.to_address);
    // Auto calculate
    setTimeout(handleCalculate, 100);
  };

  // Live checks
  useEffect(() => {
    if (calculatedAmount <= 0) return;
    
    // Policy
    setPolicyLoading(true);
    apiFetch('/policies/validate', {
      method: 'POST',
      body: JSON.stringify({ category: 'mileage', amount: calculatedAmount, has_receipt: false, date })
    }, userId)
      .then(d => setPolicyResult(d.data))
      .catch(() => setPolicyResult(null))
      .finally(() => setPolicyLoading(false));

    // Route
    setRouteLoading(true);
    apiFetch('/expenses/preview-route', {
      method: 'POST',
      body: JSON.stringify({ amount: calculatedAmount, category: 'mileage' })
    }, userId)
      .then(d => setRoutePreview(d.data))
      .catch(() => setRoutePreview(null))
      .finally(() => setRouteLoading(false));

  }, [calculatedAmount, date, userId]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: any = {
        category: 'mileage',
        claim_type: 'mileage',
        amount: calculatedAmount,
        claim_amount: calculatedAmount,
        receipt_amount: calculatedAmount,
        date,
        has_receipt: false,
        description,
        currency: 'GBP',
        journey_from: fromAddress,
        journey_to: toAddress,
        distance_miles: returnJourney ? (distanceMiles || 0) * 2 : distanceMiles,
        return_journey: returnJourney,
        vehicle: selectedVehicle,
        mileage_rate: rateApplied === '25p' ? 0.25 : 0.45,
      };
      if (exceptionRequested) {
        payload.exception_requested = true;
        payload.exception_justification = exceptionJustification;
      }
      const data = await apiFetch('/expenses', { method: 'POST', body: JSON.stringify(payload) }, userId);
      onSuccess?.(data.data);
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const hasAmountFail  = policyResult?.checks.some((c: any) => c.rule_name === 'Category Limit' && c.severity === 'fail') ?? false;
  const exceptionFilled = exceptionRequested && exceptionJustification.trim() !== '' && exceptionConfirmed;
  const canSubmit = calculatedAmount > 0 && selectedVehicle !== '' && distanceMiles !== null && (!hasAmountFail || exceptionFilled) && !submitting;

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">
        
        {/* Frequent Journeys */}
        {journeys.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Saved Journeys</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {journeys.map(j => (
                <button
                  key={j.id}
                  onClick={() => selectJourney(j)}
                  className="flex-none bg-gray-50 border border-gray-200 hover:border-[#2E8B8B]/50 hover:bg-[#2E8B8B]/5 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 transition-colors"
                >
                  {j.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Journey Fields */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">From</label>
            <input
              type="text"
              value={fromAddress}
              onChange={e => { setFromAddress(e.target.value); setDistanceMiles(null); }}
              placeholder="Postcode or Address"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2E8B8B] bg-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">To</label>
            <input
              type="text"
              value={toAddress}
              onChange={e => { setToAddress(e.target.value); setDistanceMiles(null); }}
              placeholder="Postcode or Address"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#2E8B8B] bg-white transition-colors"
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={returnJourney}
                onChange={e => setReturnJourney(e.target.checked)}
                className="w-4 h-4 accent-[#2E8B8B]"
              />
              <span className="text-sm font-semibold text-gray-700">Return journey</span>
            </label>

            <button
              onClick={handleCalculate}
              disabled={!fromAddress || !toAddress || calculating}
              className="px-4 py-2 bg-[#2E8B8B] text-white rounded-lg text-xs font-bold hover:bg-[#257373] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {calculating ? 'Calculating...' : 'Calculate Distance'}
            </button>
          </div>

          {/* Distance Result */}
          <AnimatePresence>
            {distanceMiles !== null && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden pt-2"
              >
                <div className="bg-[#eaf5f5] text-[#2E8B8B] p-3 rounded-lg flex items-center justify-between border border-[#2E8B8B]/20">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#2E8B8B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="font-bold text-sm">
                      {returnJourney ? distanceMiles * 2 : distanceMiles} miles
                    </span>
                    {returnJourney && <span className="text-xs opacity-70">({distanceMiles} miles each way)</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Total calculation & Warning */}
        {distanceMiles !== null && (
          <div className="space-y-4">
            {totalMilesYtd > 9500 && totalMilesYtd < 10000 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm flex gap-2">
                <span>⚠️</span>
                <div>
                  <p className="font-semibold">HMRC Threshold Approaching</p>
                  <p className="text-xs opacity-80 mt-0.5">You have {10000 - totalMilesYtd} miles remaining at the 45p rate.</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between bg-white border-2 border-gray-100 p-4 rounded-xl shadow-sm relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2E8B8B]"></div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Claim Value</p>
                <p className="text-sm font-medium text-gray-600 mt-0.5">
                  {(returnJourney ? distanceMiles * 2 : distanceMiles)} miles × {rateApplied}
                </p>
              </div>
              <div className="text-2xl font-black text-[#1B2A4A] font-mono">
                £{calculatedAmount.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Vehicles */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Vehicle</label>
            <button className="text-[11px] font-bold text-[#2E8B8B] hover:underline">Add Vehicle</button>
          </div>
          <div className="flex flex-col gap-2">
            {vehicles.map(v => (
              <div
                key={v.id}
                onClick={() => setSelectedVehicle(v.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedVehicle === v.id ? 'border-[#2E8B8B] bg-[#2E8B8B]/5' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-400">
                  {v.fuel_type === 'electric' ? '⚡' : '⛽'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#1B2A4A] leading-tight">{v.registration}</p>
                  <p className="text-[11px] text-gray-500">{v.make} • {v.engine_cc ? `${v.engine_cc}cc` : ''} {v.fuel_type}</p>
                </div>
                {selectedVehicle === v.id && (
                  <svg className="w-5 h-5 text-[#2E8B8B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Description & Date */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Reason for travel..."
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2E8B8B]"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Date Filter</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2E8B8B]"
          />
        </div>

        {/* Policy / Route Previews */}
        {calculatedAmount > 0 && (
          <>
            {/* Live policy checks */}
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

            {/* Approval Route */}
            <div className="border-2 border-gray-100 rounded-xl overflow-hidden mt-4">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Approval Route</p>
                </div>
              </div>
              <div className="p-4">
                {routePreview && (
                  <div className="space-y-3">
                    {routePreview.steps.map((step: any, i: number) => (
                      <div key={step.person_id} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#2E8B8B] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">{i + 1}</div>
                        <div className="w-9 h-9 rounded-full bg-[#1B2A4A] text-white text-xs font-bold flex items-center justify-center shrink-0">{step.avatar_initials}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[#1B2A4A] leading-tight">{step.first_name} {step.last_name}</p>
                          <p className="text-xs text-gray-400">{step.job_title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
      
      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full h-12 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all ${
            canSubmit
              ? 'bg-[#2E8B8B] text-white hover:bg-[#257373] shadow-md shadow-[#2E8B8B]/20'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting...' : `Submit · £${calculatedAmount.toFixed(2)}`}
        </button>
      </div>

    </div>
  );
}
