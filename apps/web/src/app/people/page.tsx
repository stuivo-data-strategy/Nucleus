"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '../../hooks/useApi';
import { Avatar, Badge, Button, Card, Skeleton } from '../../components/ui/System';

export default function PeopleDirectory() {
  const [search, setSearch] = useState('');
  const { data: people, isLoading } = useApi(search ? `/api/v1/people?q=${search}` : `/api/v1/people`);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1B2A4A] tracking-tight">Global Directory</h1>
            <p className="text-sm text-gray-500 mt-2 font-medium">Search the entire Meridian Engineering network.</p>
          </div>
          <div className="flex gap-3 w-full lg:w-auto relative">
             <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
             </div>
             <input 
               type="text" 
               placeholder="Search names, emails, roles..." 
               className="pl-11 pr-4 py-3 bg-white border border-gray-300 shadow-sm rounded-xl text-sm w-full lg:w-80 focus:ring-2 focus:ring-[#2E8B8B] focus:border-[#2E8B8B] outline-none transition-all placeholder:text-gray-400"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
             <Button className="rounded-xl shadow-sm px-6 h-[46px]">Filters</Button>
          </div>
       </div>

       {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             {[1,2,3,4,5,6,7,8].map(i => <Card key={i} className="p-6 flex items-center gap-4 border-gray-100/50"><Skeleton className="w-16 h-16 rounded-full" /> <div className="flex-1 space-y-3"><Skeleton className="h-4 w-3/4"/><Skeleton className="h-3 w-1/2"/></div></Card>)}
          </div>
       ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-2">
             {people && people.map((p: any) => (
                <Link key={p.id} href={`/people/${p.id.split(':')[1]}`}>
                   <Card interactive className="p-6 flex flex-col h-full border-gray-200 hover:border-[#2E8B8B]/50 hover:shadow-lg shadow-sm group cursor-pointer transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
                       <div className="flex justify-between items-start mb-5">
                          <Avatar size="lg" name={`${p.first_name} ${p.last_name}`} url={p.avatar_url} className="ring-4 ring-gray-50 shadow-sm" />
                          <Badge variant="info" className="bg-[#eaf5f5] text-[#2E8B8B] capitalize text-[10px] font-bold tracking-widest">{p.employment_type || 'fte'}</Badge>
                       </div>
                       <h3 className="font-bold text-lg text-[#1B2A4A] group-hover:text-[#2E8B8B] transition-colors leading-tight mb-1">{p.first_name} {p.last_name}</h3>
                       <p className="text-sm font-medium text-gray-500 line-clamp-1">{p.job_title}</p>
                       <p className="text-xs text-gray-400 truncate mt-1">{p.email}</p>
                       
                       <div className="mt-auto pt-5 mt-6 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-[10px] p-1.5 px-2 bg-gray-50 rounded-md font-bold text-gray-500 max-w-[120px] truncate border border-gray-100">
                             {(p.org_unit || '').replace('org_unit:','').replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-xs font-mono font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded">{p.employee_id}</span>
                       </div>
                   </Card>
                </Link>
             ))}
          </div>
       )}
    </div>
  );
}
