import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ClaimType = 'single' | 'batch' | 'group' | 'mileage';

export interface ClaimTypeSelectorProps {
  onSelect: (type: ClaimType) => void;
  onCancel: () => void;
}

const CLAIM_TYPES: { id: ClaimType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'single',
    label: 'Single Receipt',
    description: 'One receipt, one expense line.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'batch',
    label: 'Multiple Receipts',
    description: 'Several receipts, one claim — a trip or a week.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
      </svg>
    ),
  },
  {
    id: 'group',
    label: 'Group / Team Expense',
    description: 'One receipt covering multiple people (e.g. team lunch).',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: 'mileage',
    label: 'Mileage Claim',
    description: 'Own vehicle travel claiming at HMRC rate per mile.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        {/* Note: In a real app we might use a proper car icon from Phosphor or Heroicons. Here we use an electric bolt/car abstraction for speed or a standard map pin. Let's use a map pin / route. */}
      </svg>
    ),
  },
];

// Swapped mileage icon with a route icon:
const mileageIcon = (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);
CLAIM_TYPES[3].icon = mileageIcon;

export function ClaimTypeSelector({ onSelect, onCancel }: ClaimTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<ClaimType | null>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 24, stiffness: 200 } },
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-6 min-h-[420px]">
      <div className="text-center">
        <h3 className="font-bold text-[#1B2A4A] text-xl">What are you claiming?</h3>
        <p className="text-sm text-gray-500 mt-1">Select the type of expense to get started</p>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {CLAIM_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          return (
            <motion.div
              key={type.id}
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedType(type.id)}
              className={`
                relative p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col justify-center items-center text-center gap-3
                ${isSelected 
                  ? 'border-[#2E8B8B] bg-[#2E8B8B]/5 shadow-sm shadow-[#2E8B8B]/10' 
                  : 'border-gray-200 bg-white hover:border-[#2E8B8B]/50 hover:bg-gray-50'
                }
              `}
            >
              <div className={`p-3 rounded-full transition-colors ${isSelected ? 'bg-[#2E8B8B] text-white' : 'bg-[#eaf5f5] text-[#2E8B8B]'}`}>
                {type.icon}
              </div>
              <div>
                <p className={`font-bold text-base transition-colors ${isSelected ? 'text-[#1B2A4A]' : 'text-gray-700'}`}>
                  {type.label}
                </p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {type.description}
                </p>
              </div>
              
              {/* Selected Ring */}
              {isSelected && (
                <motion.div
                  layoutId="selected-ring"
                  className="absolute inset-[-2px] border-2 border-[#2E8B8B] rounded-xl pointer-events-none"
                  initial={false}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <div className="h-14 relative mt-2">
        <AnimatePresence>
          {selectedType && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={() => onSelect(selectedType)}
              className="absolute inset-0 w-full h-12 rounded-xl text-base font-bold bg-[#2E8B8B] text-white hover:bg-[#257373] shadow-md shadow-[#2E8B8B]/20 transition-all flex items-center justify-center gap-2"
            >
              Continue
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
