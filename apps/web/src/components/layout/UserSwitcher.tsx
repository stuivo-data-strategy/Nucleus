"use client";

import { useState } from 'react';
import { useAuth } from '../../lib/auth';

export default function UserSwitcher() {
  const { user, availableUsers, switchUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  if (!user || !availableUsers || availableUsers.length === 0) return null;

  const handleSwitch = async (id: string, name: string, title: string) => {
    setIsOpen(false);
    setToastMsg(`Switched to ${name} (${title})`);
    setTimeout(async () => {
        setToastMsg('');
        await switchUser(id);
    }, 1000);
  };

  return (
    <div className="relative inline-block text-left relative z-50">
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex w-full justify-center items-center gap-x-1.5 rounded-md bg-yellow-100 px-3 py-2 text-sm font-semibold text-yellow-800 shadow-sm ring-1 ring-inset ring-yellow-300 hover:bg-yellow-200"
      >
        <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1 animate-pulse"></div>
        Demo: viewing as {user.name} ▾
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-md bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
             <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Persona</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {availableUsers.map(u => (
              <button
                key={u.id}
                onClick={() => handleSwitch(u.id, u.name, u.title)}
                className={`block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 ${user.sub === u.id ? 'bg-navy-50 border-l-4 border-l-navy' : 'text-gray-700'}`}
              >
                <div className={user.sub === u.id ? 'font-bold text-navy' : 'font-medium'}>{u.name}</div>
                <span className="block text-xs text-gray-500">{u.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm flex items-center animate-fade-in z-50">
           {toastMsg}
        </div>
      )}
    </div>
  );
}
