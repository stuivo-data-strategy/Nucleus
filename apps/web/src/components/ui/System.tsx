"use client";
import React from 'react';
import { motion } from 'framer-motion';

export function Button({ variant='primary', size='md', isLoading=false, children, onClick, className='', ...props }: any) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 py-2 text-sm", lg: "h-12 px-8 text-base" };
  const variants = {
    primary: "bg-[#6cffc6] text-[#000053] hover:bg-[#5ae8b0] font-semibold",
    secondary: "border border-[#000053] text-[#000053] hover:bg-[#e8e8f5]",
    ghost: "hover:bg-[#e8fff5] text-[#000053]",
    destructive: "bg-red-500 text-white hover:bg-red-600"
  };
  return (
    <motion.button whileTap={{ scale: 0.98 }} className={`${base} ${sizes[size as keyof typeof sizes]} ${variants[variant as keyof typeof variants]} ${className}`} onClick={onClick} disabled={isLoading} {...props}>
      {isLoading ? <span className="animate-spin mr-2 border-2 border-white border-t-transparent rounded-full w-4 h-4" /> : null}
      {children}
    </motion.button>
  );
}

export function Card({ children, className='', interactive=false, onClick }: any) {
  const base = "bg-white border rounded-xl shadow-sm text-gray-900";
  const inter = interactive ? "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5" : "";
  return <div className={`${base} ${inter} ${className}`} onClick={onClick}>{children}</div>;
}

export function Badge({ children, variant='info', className='' }: any) {
  const v = {
    info: 'bg-blue-100 text-blue-800',
    status_active: 'bg-green-100 text-green-800',
    status_vacant: 'bg-amber-100 text-amber-800',
    count: 'bg-[#000053] text-[#6cffc6] rounded-full px-2'
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${v[variant as keyof typeof v] || v.info} ${className}`}>{children}</span>;
}

export function Avatar({ name, url, size='md', className='' }: any) {
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg'};
  const initials = name?.split(' ').map((n:string)=>n[0]).join('').substring(0,2) || 'XX';
  return (
    <div className={`rounded-full flex items-center justify-center bg-[#000053] text-[#6cffc6] font-semibold overflow-hidden ${sizes[size as keyof typeof sizes]} ${className}`}>
      {url ? <img src={url} alt={name} className="w-full h-full object-cover"/> : initials}
    </div>
  );
}

export function Skeleton({ className='' }: any) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`}></div>;
}
