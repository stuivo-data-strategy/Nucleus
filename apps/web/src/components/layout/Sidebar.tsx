"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Avatar, Badge } from '../ui/System';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);

  useEffect(() => {
    if (!user?.sub) { setPendingApprovals(0); return; }
    const token = typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
    const headers: Record<string, string> = { 'x-user-id': user.sub };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('http://localhost:3001/api/v1/expenses?role=approver', { headers })
      .then(r => r.json())
      .then(d => setPendingApprovals(d.data?.claims?.length ?? 0))
      .catch(() => setPendingApprovals(0));
  }, [user?.sub]);

  const isFinance  = user?.roles?.includes('finance_approver');
  const isAuditor  = user?.roles?.includes('expenses_auditor') || user?.roles?.includes('system_admin');
  const isVat      = user?.roles?.includes('vat_officer') || user?.roles?.includes('finance_approver') || user?.roles?.includes('system_admin');

  const nav = [
    { title: 'Foundation', items: [
      { name: 'Home', href: '/' },
      { name: 'Organisation & People', href: '/org' },
      { name: 'Positions', href: '/positions' },
    ]},
    { title: 'Daily Ops', items: [
      { name: 'Expenses', href: '/expenses' },
      { name: 'Approvals', href: '/approvals', count: pendingApprovals || undefined },
      { name: 'Timesheets', href: '/timesheets' },
      { name: 'Absence Booking', href: '/absence', placeholder: true },
      { name: 'Training', href: '/training', placeholder: true },
      { name: 'Personnel Development', href: '/development', placeholder: true },
      { name: 'Team', href: '/team', placeholder: true },
      ...(isFinance  ? [{ name: 'Finance Export', href: '/finance' }] : []),
      ...(isAuditor  ? [{ name: '🔍 Audit', href: '/audit' }] : []),
      ...(isVat      ? [{ name: '🧾 VAT Recovery', href: '/vat' }] : []),
    ]},
    { title: 'Admin', items: [
      { name: 'Policy Rules', href: '/policy' },
      { name: '💬 Reports', href: '/reports' },
    ]},
  ];

  return (
    <div className="w-64 bg-white border-r border-[#E8ECF2] h-screen flex flex-col hidden lg:flex shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-[#E8ECF2]">
         <div className="w-8 h-8 rounded-full bg-[#2E8B8B] text-white flex items-center justify-center font-bold mr-3">N</div>
         <span className="font-bold text-[#1B2A4A] text-xl tracking-tight">Nucleus</span>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {nav.map((section, i) => (
          <div key={i} className="mb-6 pb-2">
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">{section.title}</h3>
            {section.items.map(item => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              if ((item as any).placeholder) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-2 py-2 rounded-lg mb-1 text-gray-300 cursor-default"
                    title="Coming soon"
                  >
                    <span className="font-medium text-sm">{item.name}</span>
                    <span className="text-[10px] font-bold text-gray-200 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-full">
                      Soon
                    </span>
                  </div>
                );
              }
              return (
                <Link key={item.name} href={item.href} className={`flex items-center justify-between px-2 py-2 rounded-lg transition-colors mb-1 ${active ? 'bg-[#eaf5f5] text-[#2E8B8B] font-bold border-l-[3px] border-[#2E8B8B]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'}`}>
                   <span>{item.name}</span>
                   {item.count && <Badge variant="count">{item.count}</Badge>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {user && (
        <div className="p-4 border-t border-[#E8ECF2] cursor-pointer hover:bg-gray-50 flex items-center gap-3 transition-colors m-2 rounded-lg">
          <Avatar name={user.name} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1B2A4A] truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate capitalize">{user.roles[0]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
