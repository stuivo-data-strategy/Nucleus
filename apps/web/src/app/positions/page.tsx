"use client";
import { useApi } from '../../hooks/useApi';
import { Badge, Skeleton } from '../../components/ui/System';

export default function PositionsPage() {
   const { data: positions, isLoading } = useApi('/api/v1/positions/vacancies');

   return (
     <div className="space-y-6 max-w-5xl animate-in fade-in duration-500">
       <div className="border-b border-gray-200 pb-6 mb-8">
           <h1 className="text-3xl font-bold text-[#000053] tracking-tight">Position Framework</h1>
           <p className="text-gray-500 text-sm mt-2 font-medium">Tracking and requisition management for organisational skeletal roles.</p>
       </div>
       
       <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
             <h2 className="text-xl font-bold text-gray-900">Active Open Requisitions</h2>
          </div>
          
          <div className="space-y-4">
             {isLoading && <Skeleton className="h-24 w-full rounded-xl"/>}
             {positions && positions.map((pos: any) => (
                <div key={pos.id} className="p-5 border-2 border-dashed border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 transition-colors rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                   <div>
                      <div className="flex items-center gap-3 mb-2">
                         <h3 className="font-bold text-lg text-[#000053]">{pos.title}</h3>
                         <Badge variant="status_vacant" className="bg-amber-100 text-amber-800 font-bold tracking-widest text-[10px]">VACANT</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600 font-mono font-medium">
                         <span className="bg-white px-2 py-1 rounded border border-amber-100 shadow-sm">ID: {pos.position_id}</span>
                         <span className="bg-white px-2 py-1 rounded border border-amber-100 shadow-sm">CC: {pos.cost_centre.replace('cost_centre:','')}</span>
                         <span className="bg-white px-2 py-1 rounded border border-amber-100 shadow-sm">FTE: {pos.fte_capacity}</span>
                      </div>
                   </div>
                   <button className="text-sm bg-white border shadow-sm border-gray-300 px-5 py-2.5 rounded-lg font-bold text-[#000053] hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95 whitespace-nowrap">
                       Create Requisition →
                   </button>
                </div>
             ))}
             {positions && positions.length === 0 && (
                 <div className="text-center py-10 text-gray-500">Fully staffed. No active vacancies.</div>
             )}
          </div>
       </div>
     </div>
   );
}
