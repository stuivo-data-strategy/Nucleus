"use client";
import { useApi } from '../../hooks/useApi';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationCentre({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { data: notifications } = useApi('/api/v1/notifications'); // Uses stub or real endpoint

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40" onClick={onClose}
          />
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full md:w-[400px] bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
               <h2 className="text-lg font-bold text-[#000053] flex items-center gap-3">
                 Notifications
                 {notifications && notifications.length > 0 && <span className="bg-red-500 text-white font-bold text-xs px-2 py-0.5 rounded-full shadow-sm">{notifications.length}</span>}
               </h2>
               <div className="flex items-center gap-2">
                 <button className="text-xs font-semibold text-[#000053] hover:text-[#000053] transition-colors p-2">Mark all read</button>
                 <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-full transition-colors w-8 h-8 flex items-center justify-center">✕</button>
               </div>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex gap-4 px-6 border-b border-gray-100">
               <button className="text-[#000053] font-bold text-xs uppercase tracking-wider py-3 border-b-2 border-[#6cffc6]">All</button>
               <button className="text-gray-400 hover:text-gray-600 font-bold text-xs uppercase tracking-wider py-3">Approvals</button>
               <button className="text-gray-400 hover:text-gray-600 font-bold text-xs uppercase tracking-wider py-3">Info</button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 p-2 space-y-2">
               {(!notifications || notifications.length === 0) ? (
                 <div className="text-center text-gray-500 py-16 flex flex-col items-center">
                    <span className="text-4xl mb-4 opacity-50">✓</span>
                    <span className="font-bold text-gray-700">You're all caught up!</span>
                    <span className="text-xs mt-1">No new notifications.</span>
                 </div>
               ) : notifications.map((n:any) => (
                 <div key={n.id} className={`p-4 rounded-xl border ${n.read ? 'bg-white border-gray-100' : 'bg-white border-l-4 border-l-[#6cffc6] border-t-transparent border-r-transparent border-b-transparent'} shadow-sm relative group`}>
                    {!n.read && <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#6cffc6]"></div>}
                    <h4 className="font-bold text-[#000053] text-sm mb-1 pr-6">{n.title}</h4>
                    <p className="text-xs text-gray-500 mb-3">{n.body}</p>
                    {n.actions && n.actions.map((act:any) => (
                       <button key={act.action} className="mr-2 px-3 py-1.5 bg-white border border-[#6cffc6] text-[#000053] text-xs font-bold rounded-md hover:bg-teal-50 transition-colors">{act.label}</button>
                    ))}
                    <span className="text-[10px] text-gray-400 font-medium block mt-3 uppercase tracking-wider">Just now</span>
                 </div>
               ))}
               
               {/* Stub notifications to see if they render nicely */}
               <div className="p-4 rounded-xl bg-white border-l-4 border-l-purple-500 border-t-transparent border-r-transparent border-b-transparent shadow-sm relative group">
                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-purple-500"></div>
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-purple-500 text-xs">💬</span>
                       <h4 className="font-bold text-[#000053] text-sm">Query Requested</h4>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">James Morton has a query regarding your expense EXP-042: "Is this a client meal?"</p>
                    <button className="mr-2 px-3 py-1.5 bg-white border border-purple-500 text-purple-600 text-xs font-bold rounded-md hover:bg-purple-50 transition-colors">Respond to Query</button>
                    <span className="text-[10px] text-gray-400 font-medium block mt-3 uppercase tracking-wider">2 hrs ago</span>
               </div>
               
               <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm relative group">
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-green-500 text-xs">✓</span>
                       <h4 className="font-bold text-gray-600 text-sm">Action Complete</h4>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">Your expense claim for £42.00 was approved.</p>
                    <span className="text-[10px] text-gray-400 font-medium block mt-2 uppercase tracking-wider">Yesterday</span>
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
