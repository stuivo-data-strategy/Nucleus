"use client";
import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { Card, Avatar, Button, Badge, Skeleton } from '../components/ui/System';

export default function Dashboard() {
  const { user } = useAuth();
  
  if (!user) return <div className="p-10 max-w-7xl mx-auto space-y-6"><div className="flex justify-between"><Skeleton className="h-10 w-64"/><Skeleton className="h-10 w-32"/></div><Skeleton className="h-40 w-full rounded-2xl" /><div className="grid grid-cols-3 gap-6"><Skeleton className="h-64 col-span-2 rounded-2xl"/><Skeleton className="h-96 rounded-2xl"/></div></div>;

  const isManager = user.roles?.includes('manager') || user.permissions?.includes('people:read:team');
  const isHR = user.roles?.includes('hr_admin');

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
       {/* Greeting Section */}
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1B2A4A] tracking-tight">
               Good afternoon, {(user.name || 'Demo').split(' ')[0]}
            </h1>
            <p className="text-gray-500 mt-2 font-medium">
               {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}
            </p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-3">
             <div className="text-sm font-semibold text-gray-700">Quick Stats:</div>
             <Badge variant="count" className="bg-amber-500 text-white shadow-sm px-2.5 py-1">2 Pending Approvals</Badge>
             <Badge variant="info" className="bg-purple-100 text-purple-700 shadow-sm px-2.5 py-1">1 Query</Badge>
          </div>
       </div>

       {/* Pending Actions Card */}
       <Card className="p-0 border-gray-200 shadow-md ring-1 ring-black/5 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-4 px-6 flex justify-between items-center text-white">
             <h2 className="text-lg font-bold flex items-center gap-2">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Action Required
             </h2>
             <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-lg">2 Items</span>
          </div>
          <div className="divide-y divide-gray-100 bg-white">
             {isManager ? (
               <div className="p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex gap-4 items-start w-full">
                     <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 shadow-inner shrink-0 text-xl">💳</div>
                     <div className="min-w-0 flex-1">
                         <div className="flex flex-wrap gap-2 items-center mb-1">
                           <h4 className="font-bold text-[#1B2A4A] truncate">Approve expense claim EXP-044 for £189.00</h4>
                           <Badge variant="info" className="bg-teal-50 text-teal-700 border border-teal-100 text-[10px]">Expenses</Badge>
                         </div>
                         <p className="text-sm text-gray-600 truncate">Submitted by Sarah Chen • Client dinner at Hawksmoor</p>
                         <p className="text-[11px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Received 2 hours ago</p>
                     </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-0 border-gray-100">
                     <Button variant="destructive" className="flex-1 md:flex-none">Reject</Button>
                     <Button variant="secondary" className="flex-1 md:flex-none">Query</Button>
                     <Button className="flex-1 md:flex-none bg-[#2E8B8B]">Approve</Button>
                  </div>
               </div>
             ) : (
               <div className="p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex gap-4 items-start w-full">
                     <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shadow-inner shrink-0 text-xl">💬</div>
                     <div className="min-w-0 flex-1">
                         <div className="flex flex-wrap gap-2 items-center mb-1">
                           <h4 className="font-bold text-[#1B2A4A] truncate">Respond to query on EXP-042</h4>
                           <Badge variant="info" className="bg-purple-50 text-purple-700 border border-purple-100 text-[10px]">Query</Badge>
                         </div>
                         <p className="text-sm text-gray-600 truncate">From James Morton: "Can you confirm if this client meal was pre-approved?"</p>
                         <p className="text-[11px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Received yesterday</p>
                     </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-0 border-gray-100">
                     <Button className="w-full md:w-auto">Respond</Button>
                  </div>
               </div>
             )}
             
             {isManager && (
                 <div className="p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50 transition-colors">
                    <div className="flex gap-4 items-start w-full">
                       <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner shrink-0 text-xl">🏖</div>
                       <div className="min-w-0 flex-1">
                           <div className="flex flex-wrap gap-2 items-center mb-1">
                             <h4 className="font-bold text-[#1B2A4A] truncate">Approve leave request</h4>
                             <Badge variant="info" className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px]">Absence</Badge>
                           </div>
                           <p className="text-sm text-gray-600 truncate">From Priya Sharma for 3 days • 14-16 April (Annual)</p>
                           <p className="text-[11px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Received 1 hour ago</p>
                       </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-0 border-gray-100">
                       <Button variant="secondary" className="flex-1 md:flex-none">Query</Button>
                       <Button className="flex-1 md:flex-none bg-[#2E8B8B]">Approve</Button>
                    </div>
                 </div>
             )}

             {isHR && (
                 <div className="p-4 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-gray-50 transition-colors">
                    <div className="flex gap-4 items-start w-full">
                       <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 shadow-inner shrink-0 text-xl">📄</div>
                       <div className="min-w-0 flex-1">
                           <div className="flex flex-wrap gap-2 items-center mb-1">
                             <h4 className="font-bold text-[#1B2A4A] truncate">Review Timesheet Anomalies</h4>
                             <Badge variant="info" className="bg-red-50 text-red-700 border border-red-100 text-[10px]">Compliance</Badge>
                           </div>
                           <p className="text-sm text-gray-600 truncate">2 flagged entries from Operations division</p>
                           <p className="text-[11px] text-gray-400 mt-2 font-bold uppercase tracking-wider">System AI flag</p>
                       </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-0 border-gray-100">
                       <Button className="w-full md:w-auto">Review</Button>
                    </div>
                 </div>
             )}
          </div>
       </Card>

       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
             {/* Quick Actions Grid */}
             <div>
                <h2 className="text-xl font-bold text-[#1B2A4A] mb-5">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <Card interactive className="p-6 flex flex-col items-center justify-center text-center hover:bg-[#eaf5f5] hover:border-[#2E8B8B]/50 group transition-all">
                      <span className="text-4xl mb-3 drop-shadow-sm group-hover:-translate-y-1 transition-transform">📸</span>
                      <span className="text-sm font-bold text-[#1B2A4A] group-hover:text-[#2E8B8B]">Submit Expense</span>
                   </Card>
                   <Card interactive className="p-6 flex flex-col items-center justify-center text-center hover:bg-blue-50 hover:border-blue-300 group transition-all">
                      <span className="text-4xl mb-3 drop-shadow-sm group-hover:-translate-y-1 transition-transform">🏖</span>
                      <span className="text-sm font-bold text-[#1B2A4A] group-hover:text-blue-600">Request Leave</span>
                   </Card>
                   <Card interactive className="p-6 flex flex-col items-center justify-center text-center hover:bg-amber-50 hover:border-amber-300 group transition-all">
                      <span className="text-4xl mb-3 drop-shadow-sm group-hover:-translate-y-1 transition-transform">⏱</span>
                      <span className="text-sm font-bold text-[#1B2A4A] group-hover:text-amber-600">Log Time</span>
                   </Card>
                   <Card interactive className="p-6 flex flex-col items-center justify-center text-center hover:bg-purple-50 hover:border-purple-300 group transition-all">
                      <span className="text-4xl mb-3 drop-shadow-sm group-hover:-translate-y-1 transition-transform">🎯</span>
                      <span className="text-sm font-bold text-[#1B2A4A] group-hover:text-purple-600">Update Goals</span>
                   </Card>
                </div>
             </div>

             {/* Recent Activity Feed */}
             <div>
                <h2 className="text-xl font-bold text-[#1B2A4A] mb-5">Activity Feed</h2>
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3">
                   <div className="p-4 flex gap-4 hover:bg-gray-50 transition-colors rounded-lg group cursor-pointer border border-transparent hover:border-gray-200">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0 shadow-sm">
                         <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="text-sm text-gray-800 truncate"><span className="font-bold text-gray-900">Your expense EXP-041</span> was approved</p>
                         <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">2 hours ago</p>
                      </div>
                   </div>
                   
                   <div className="p-4 flex gap-4 hover:bg-gray-50 transition-colors rounded-lg group cursor-pointer border border-transparent hover:border-gray-200">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
                         <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="text-sm text-gray-800 truncate"><span className="font-bold text-gray-900">Sarah Chen</span> submitted a leave request</p>
                         <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">Yesterday</p>
                      </div>
                   </div>

                   <div className="p-4 flex gap-4 hover:bg-gray-50 transition-colors rounded-lg group cursor-pointer border border-transparent hover:border-gray-200">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                         <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="text-sm text-gray-800"><span className="font-bold text-gray-900">New requisition opened</span>: BI Developer</p>
                         <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-bold">3 days ago</p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
             {/* My Team Card */}
             {isManager && (
                <Card className="p-6 sticky top-24 border-gray-200 shadow-sm">
                   <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                      <h2 className="text-xl font-bold text-[#1B2A4A] flex items-center gap-2">
                         <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                         My Team
                      </h2>
                      <Link href="/people"><Badge variant="info" className="cursor-pointer hover:bg-blue-200 font-bold tracking-widest uppercase text-[10px]">View Detail</Badge></Link>
                   </div>
                   
                   <div className="space-y-4">
                      <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors border border-transparent hover:border-gray-200 -mx-2">
                         <div className="flex items-center gap-3">
                            <Avatar name="Sarah Chen" size="md" className="ring-4 ring-white shadow-sm" />
                            <div><p className="text-sm font-bold text-gray-900 group-hover:text-[#2E8B8B] transition-colors line-clamp-1">Sarah Chen</p><p className="text-xs text-gray-500 font-medium">Senior Analyst</p></div>
                         </div>
                         <Badge variant="status_active" className="text-[10px] uppercase font-bold tracking-widest bg-green-50 text-green-700">Office</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors border border-transparent hover:border-gray-200 -mx-2">
                         <div className="flex items-center gap-3">
                            <Avatar name="Priya Sharma" size="md" className="ring-4 ring-white shadow-sm" />
                            <div><p className="text-sm font-bold text-gray-900 group-hover:text-[#2E8B8B] transition-colors line-clamp-1">Priya Sharma</p><p className="text-xs text-gray-500 font-medium">BI Developer</p></div>
                         </div>
                         <Badge variant="status_vacant" className="text-[9px] uppercase font-bold tracking-widest bg-amber-50 text-amber-700">Remote</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors border border-transparent hover:border-gray-200 -mx-2">
                         <div className="flex items-center gap-3">
                            <Avatar name="Tom Bradley" size="md" className="ring-4 ring-white shadow-sm" />
                            <div><p className="text-sm font-bold text-gray-900 flex items-center gap-2 group-hover:text-[#2E8B8B] transition-colors line-clamp-1">Tom Br.. <span className="text-[9px] bg-red-100 text-red-600 px-1 rounded font-black tracking-tighter shadow-sm">OOF</span></p><p className="text-xs text-gray-500 font-medium">Data Eng</p></div>
                         </div>
                         <Badge variant="info" className="text-[9px] uppercase font-bold tracking-widest bg-red-50 text-red-700">Leave</Badge>
                      </div>
                   </div>

                   <div className="mt-6 pt-5 border-t border-gray-100 space-y-4 bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-xl border-t-2 border-t-[#1B2A4A]/5">
                      <div className="flex justify-between items-center mb-1">
                         <h3 className="font-bold text-sm text-[#1B2A4A] tracking-tight">Capacity Fill</h3>
                         <span className="text-xs font-mono font-bold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">12 / 14</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                         <div className="bg-gradient-to-r from-[#1B2A4A] to-[#2E8B8B] h-3 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                      <button className="w-full mt-5 flex items-center justify-center gap-2 text-sm font-bold text-white shadow-sm bg-[#1B2A4A] hover:bg-[#253966] rounded-xl py-2.5 transition-colors">
                         Open Requisition +
                      </button>
                   </div>
                </Card>
             )}

             {isManager && (
                 <Card className="p-6 border-gray-200 mt-6 shadow-md overflow-hidden relative group cursor-pointer ring-1 ring-black/5 hover:ring-[#2E8B8B]/30 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#1B2A4A] via-[#2E8B8B] to-[#2E8B8B] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity"></div>
                    <div className="flex justify-between items-center relative z-10">
                       <div>
                          <h2 className="text-lg font-bold text-[#1B2A4A] mb-1">Org Tree Snapshot</h2>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Data & Analytics</p>
                       </div>
                       <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#2E8B8B] group-hover:bg-[#2E8B8B] group-hover:text-white transition-colors border border-gray-100 group-hover:border-transparent">
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                       </div>
                    </div>
                 </Card>
             )}
          </div>
       </div>
    </div>
  );
}
