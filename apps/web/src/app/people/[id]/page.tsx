"use client";
import { useParams } from 'next/navigation';
import { useApi } from '../../../hooks/useApi';
import { Card, Avatar, Badge, Skeleton } from '../../../components/ui/System';

export default function PersonDetail() {
   const params = useParams();
   const { data: person, isLoading } = useApi(`/api/v1/people/person:${params.id}`);

   if (isLoading) return <div className="p-10 space-y-4 max-w-5xl mx-auto"><Skeleton className="h-64 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;
   if (!person) return <div className="p-10 text-center text-gray-500 mt-20">Person profile not found.</div>;

   return (
     <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
           <div className="absolute top-0 left-0 right-0 h-32 bg-[#1B2A4A] overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20px 20px, white 2px, transparent 0)', backgroundSize: '40px 40px' }}></div>
           </div>
           <div className="relative pt-12 px-8 pb-8 flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start text-center md:text-left border-b border-gray-100">
              <Avatar name={`${person.first_name} ${person.last_name}`} size="lg" className="w-36 h-36 text-4xl ring-8 ring-white shadow-xl bg-white text-[#1B2A4A] font-bold shrink-0 -mt-6" />
              <div className="flex-1 pt-2 md:pt-4">
                 <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">{person.first_name} {person.last_name}</h1>
                    <Badge variant="status_active" className="bg-green-100 text-green-700 font-bold px-3 py-1 shadow-sm">Active</Badge>
                 </div>
                 <p className="text-xl text-gray-600 font-medium">{person.job_title}</p>
                 <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 mt-6 text-sm text-gray-500">
                    <span className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z"/></svg> {person.email}</span>
                    <span className="font-mono bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 font-bold shadow-sm flex items-center gap-2"><span>ID</span><span className="text-[#1B2A4A]">{person.employee_id}</span></span>
                 </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
           <div className="lg:col-span-2 space-y-6">
              <Card className="p-8 border-gray-200 shadow-sm">
                 <h2 className="text-xl font-bold text-[#1B2A4A] mb-6 flex items-center gap-3">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                   Employment Profile
                 </h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-8">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <dt className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Department</dt>
                       <dd className="font-bold text-[#1B2A4A] capitalize text-lg">{(person.org_unit||'').replace('org_unit:','').replace('_',' ')}</dd>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <dt className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Cost Centre</dt>
                       <dd className="font-mono font-bold text-gray-700 text-lg">{(person.cost_centre||'').replace('cost_centre:','')}</dd>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <dt className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Line Manager</dt>
                       <dd className="font-bold text-[#2E8B8B] hover:underline cursor-pointer text-lg">{person.manager_info ? `${person.manager_info.first_name} ${person.manager_info.last_name}` : 'CEO / Board'}</dd>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <dt className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Start Date</dt>
                       <dd className="font-bold text-gray-700 text-lg">{new Date(person.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'})}</dd>
                    </div>
                 </div>
              </Card>
           </div>
           
           <div className="space-y-6">
              <Card className="p-6 border-t-[6px] border-t-[#2E8B8B] shadow-sm">
                 <h2 className="text-lg font-bold text-[#1B2A4A] mb-5 border-b border-gray-100 pb-3">Line Management</h2>
                 {person.direct_reports && person.direct_reports.length > 0 ? (
                    <div className="space-y-4">
                       <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">{person.direct_reports.length} Direct Reports</span>
                       <div className="space-y-3 mt-2">
                       {person.direct_reports.map((dr:any) => (
                           <div key={dr.id} className="flex items-center gap-4 p-2 hover:bg-teal-50 rounded-lg group transition-colors cursor-pointer border border-transparent hover:border-teal-100">
                              <Avatar name={`${dr.first_name} ${dr.last_name}`} size="xs" />
                              <div>
                                 <div className="text-sm font-bold text-gray-700 group-hover:text-[#2E8B8B] transition-colors">{dr.first_name} {dr.last_name}</div>
                                 <div className="text-[11px] text-gray-400 font-medium truncate w-40">{dr.job_title}</div>
                              </div>
                           </div>
                       ))}
                       </div>
                    </div>
                 ) : (
                    <div className="py-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                       <p className="text-sm font-medium">Individual Contributor</p>
                       <p className="text-xs mt-1">No direct reports.</p>
                    </div>
                 )}
              </Card>
           </div>
        </div>
     </div>
   );
}
