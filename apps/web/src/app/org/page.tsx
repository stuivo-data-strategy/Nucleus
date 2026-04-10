"use client";
import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card, Avatar, Badge, Skeleton } from '../../components/ui/System';
import { motion, AnimatePresence } from 'framer-motion';

export default function OrgPage() {
  const [rootId, setRootId] = useState<string | null>(null);
  const { data: tree, isLoading } = useApi(`/api/v1/org/tree${rootId ? '?rootId='+rootId : ''}`);
  const { data: people } = useApi(rootId ? `/api/v1/org/${rootId}/people` : null);

  if (isLoading && !tree) return <div className="p-10 space-y-4"><Skeleton className="h-10 w-40"/><Skeleton className="h-64 w-full rounded-2xl"/></div>;
  if (!tree) return <div>Failed to load Org Tree — is the API running?</div>;

  return (
    <div className="flex flex-col xl:flex-row h-full gap-8 animate-in fade-in duration-500">
       <div className="flex-1 pb-10 min-w-0">
          <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-gray-200 pb-4">
             <div>
                <h1 className="text-3xl font-bold text-[#1B2A4A] mb-1 tracking-tight">Organisation Chart</h1>
                <p className="text-sm font-medium text-gray-500">Exploring: <span className="text-[#2E8B8B]">{tree.name}</span></p>
             </div>
             {rootId && <button onClick={() => setRootId(null)} className="text-sm font-medium text-[#2E8B8B] hover:text-[#1B2A4A] bg-teal-50/50 hover:bg-teal-50 px-4 py-2 rounded-full border border-teal-100 transition-all shadow-sm">↺ Reset to Company Root</button>}
          </div>

          <div className="flex justify-center border-t border-gray-100 pt-16 min-w-max pb-32">
             {/* Root Node */}
             <div className="flex flex-col items-center">
                <Card className="w-80 px-6 py-8 text-center relative z-10 border-t-[6px] border-t-[#1B2A4A] shadow-xl bg-white rounded-2xl ring-1 ring-black/5">
                   <div className="flex justify-center absolute -top-10 left-1/2 -translate-x-1/2 drop-shadow-xl ring-4 ring-white rounded-full">
                      <Avatar name={tree.head || tree.name} size="lg" />
                   </div>
                   <Badge variant="info" className="mb-3 uppercase text-[10px] tracking-wider font-bold mt-2">{tree.type.replace('_',' ')}</Badge>
                   <h2 className="text-2xl font-bold text-[#1B2A4A] leading-tight mb-2">{tree.name}</h2>
                   <p className="text-xs text-gray-400 font-mono font-medium tracking-widest bg-gray-50 inline-block px-2 py-1 rounded">{tree.code}</p>
                </Card>

                {tree.children && tree.children.length > 0 && (
                   <div className="relative mt-12 w-full flex justify-center">
                     <div className="absolute top-0 left-1/2 w-0.5 h-12 bg-gray-200 -mt-12 opacity-50"></div>
                     <div className="flex gap-8 relative items-start">
                       {/* Connector wrapper for flex spread */}
                       <div className="absolute top-0 left-[calc(50%/2)] right-[calc(50%/2)] h-0.5 bg-gray-200 opacity-50"></div>
                       
                       <AnimatePresence>
                       {tree.children.map((child: any, i: number) => (
                          <motion.div 
                             initial={{ opacity: 0, y: 15 }}
                             animate={{ opacity: 1, y: 0 }}
                             transition={{ delay: i * 0.05 + 0.1 }}
                             key={child.id} 
                             className="flex flex-col items-center relative pt-8 group"
                          >
                             <div className="absolute top-0 left-1/2 w-0.5 h-8 bg-gray-200 opacity-50"></div>
                             <Card 
                               interactive 
                               onClick={() => setRootId(child.id)}
                               className="w-64 p-5 text-center border-transparent hover:border-[#2E8B8B] shadow-md hover:shadow-xl transition-all duration-300 ring-1 ring-gray-100 rounded-xl"
                             >
                                <Badge variant="info" className="mb-3 text-[9px] uppercase tracking-widest font-bold opacity-80">{child.type.replace('_',' ')}</Badge>
                                <h3 className="font-bold text-[15px] leading-snug text-[#1B2A4A] truncate px-1 mb-1 group-hover:text-[#2E8B8B] transition-colors">{child.name}</h3>
                                <p className="text-xs text-gray-400 font-mono">{child.code}</p>
                                <div className="mt-5 pt-3 border-t border-gray-50 flex justify-center">
                                   <span className="text-[11px] uppercase tracking-wider font-bold text-gray-400 group-hover:text-[#2E8B8B] opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">Drill into structure →</span>
                                </div>
                             </Card>
                          </motion.div>
                       ))}
                       </AnimatePresence>
                     </div>
                   </div>
                )}
             </div>
          </div>
       </div>

       {/* Properties panel */}
       <div className="w-full xl:w-96 shrink-0 h-fit bg-white border border-gray-200 shadow-lg rounded-2xl p-6 sticky top-24">
          <h3 className="font-bold text-xl text-[#1B2A4A] border-b border-gray-100 pb-4 mb-5">Unit Detail</h3>
          <div className="space-y-5 text-sm text-gray-700">
             <div className="flex justify-between items-center"><span className="text-gray-400 font-medium">Code</span><span className="font-mono bg-gray-50 px-2 py-0.5 border border-gray-100 rounded">{tree.code}</span></div>
             <div className="flex justify-between items-center"><span className="text-gray-400 font-medium">Type</span><span className="capitalize font-medium">{tree.type.replace('_', ' ')}</span></div>
             <div className="flex justify-between items-center"><span className="text-gray-400 font-medium">Status</span><Badge variant="status_active">Active</Badge></div>
             
             {people && (
               <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[#1B2A4A] font-bold">Personnel</span>
                    <Badge variant="info">{people.length} total</Badge>
                  </div>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                     {people.slice(0, 8).map((p:any) => (
                        <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                          <Avatar size="sm" name={`${p.first_name} ${p.last_name}`} />
                          <div className="text-sm overflow-hidden grid">
                             <div className="font-semibold text-[#1B2A4A] truncate">{p.first_name} {p.last_name}</div>
                             <div className="text-xs text-gray-500 truncate">{p.job_title}</div>
                          </div>
                        </div>
                     ))}
                     {people.length > 8 && <div className="text-xs text-center border mt-2 py-2 rounded-lg text-[#2E8B8B] font-bold cursor-pointer hover:bg-teal-50 transition-colors">View all {people.length} employees</div>}
                  </div>
               </div>
             )}
          </div>
       </div>
    </div>
  );
}
