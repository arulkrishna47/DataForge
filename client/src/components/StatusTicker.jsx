import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Activity, ChevronRight, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

const StatusTicker = () => {
  const [tickerItems, setTickerItems] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for new service requests from any client
    const channel = supabase
      .channel('admin_status_ticker')
      .on(
        'postgres_changes',
        { event: 'INSERT', table: 'ServiceRequest', schema: 'public' },
        (payload) => {
          console.log('⚡ Real-Time Ticker Event:', payload);
          const newItem = {
             id: payload.new.id,
             type: payload.new.serviceType,
             timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
             budget: payload.new.budget
          };
          
          setTickerItems(prev => [newItem, ...prev].slice(0, 3));
          setIsVisible(true);
          
          // Auto-fade after 12 seconds
          setTimeout(() => setIsVisible(false), 12000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && tickerItems.length > 0 && (
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: -20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: -20 }}
           className="w-full max-w-md"
        >
          <Link to="/admin/inbox" className="block group">
            <div className="bg-[#C17BFF]/5 hover:bg-[#C17BFF]/10 backdrop-blur-md border border-[#C17BFF]/20 px-6 py-3 rounded-2xl flex items-center justify-between transition-all duration-300">
               <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 bg-[#C17BFF] rounded-xl flex items-center justify-center shadow-lg shadow-[#C17BFF]/20 relative z-10">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute inset-0 bg-[#C17BFF] rounded-xl animate-ping opacity-20 scale-150" />
                  </div>

                  <div>
                     <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-black uppercase tracking-[0.15em] text-[9px]">Live Intel</span>
                        <div className="w-1 h-1 bg-[#C17BFF] rounded-full" />
                        <span className="text-slate-500 font-bold text-[9px] uppercase tracking-widest">{tickerItems[0].timestamp}</span>
                     </div>
                     <div className="text-white font-bold text-xs tracking-tight group-hover:text-[#C17BFF] transition-colors">
                        New <span className="uppercase">{tickerItems[0].type}</span> incoming
                     </div>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[8px] uppercase font-bold text-slate-500 tracking-widest">Pipeline Value</div>
                    <div className="text-white font-mono text-[10px] font-black">{tickerItems[0].budget}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
               </div>
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StatusTicker;
