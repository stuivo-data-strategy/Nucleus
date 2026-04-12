"use client";
import { useState } from 'react';
import UserSwitcher from './UserSwitcher';
import NotificationCentre from './NotificationCentre';

export default function Header() {
  const [showNotif, setShowNotif] = useState(false);

  return (
    <header className="bg-white border-b border-[#E8ECF2] h-16 flex items-center justify-between px-6 z-10 sticky top-0 shadow-sm shadow-gray-100/50">
       <div className="flex items-center text-sm font-medium text-gray-500 gap-2">
         <span className="text-[#1B2A4A] cursor-pointer hover:underline font-semibold">Workspace</span>
         <span className="text-gray-300">/</span>
         <span className="text-gray-800">Directory</span>
       </div>
       <div className="flex items-center gap-4">
         <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm opacity-50">⌘K</span>
            <input type="text" placeholder="Search..." className="w-64 pl-10 pr-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors border max-w-full border-gray-200 rounded-full text-sm focus:bg-white focus:border-[#2E8B8B] focus:ring-1 focus:ring-[#2E8B8B] outline-none" readOnly suppressHydrationWarning />
         </div>
         <button onClick={() => setShowNotif(true)} className="relative text-gray-500 hover:text-[#1B2A4A] transition-colors p-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
           <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border border-white rounded-full"></span>
         </button>
         <NotificationCentre isOpen={showNotif} onClose={() => setShowNotif(false)} />
         <div className="h-6 w-px bg-gray-200 mx-1"></div>
         <UserSwitcher />
       </div>
    </header>
  );
}
