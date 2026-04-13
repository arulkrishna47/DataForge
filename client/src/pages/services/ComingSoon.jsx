import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Rocket, Mail, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ComingSoon = ({ title = "Neural Service" }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoinWaitlist = (e) => {
    e.preventDefault();
    if (!email) return;
    
    // Save to localStorage as requested
    const waitlist = JSON.parse(localStorage.getItem('cortexa_waitlist') || '[]');
    if (!waitlist.includes(email)) {
      waitlist.push(email);
      localStorage.setItem('cortexa_waitlist', JSON.stringify(waitlist));
    }
    
    setJoined(true);
  };

  return (
    <div className="bg-[#050508] min-h-screen text-white font-sans selection:bg-[#C17BFF]/30 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#C17BFF]/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full text-center relative z-10"
      >
        <button 
          onClick={() => navigate('/services')}
          className="flex items-center gap-2 text-slate-400 hover:text-[#C17BFF] transition-colors mb-12 mx-auto group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Services</span>
        </button>

        <div className="w-24 h-24 rounded-[2rem] bg-[#C17BFF]/10 flex items-center justify-center text-[#C17BFF] mb-8 mx-auto border border-[#C17BFF]/20 shadow-2xl shadow-[#C17BFF]/5">
          <Rocket className="w-10 h-10" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
          {title} <span className="text-[#C17BFF]">Coming Soon</span>
        </h1>
        
        <p className="text-slate-400 text-lg mb-12 leading-relaxed">
          This neural service is currently under development in our deep-learning lab. 
          Join our elite waitlist to be the first to gain access.
        </p>

        {!joined ? (
          <form onSubmit={handleJoinWaitlist} className="flex flex-col md:flex-row gap-4">
            <div className="flex-grow relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="w-full bg-[#0D0D15] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#C17BFF]/50 transition-all placeholder:text-slate-600"
              />
            </div>
            <button 
              type="submit"
              className="px-8 py-4 bg-[#C17BFF] text-white font-bold rounded-2xl hover:bg-[#A855F7] transition-all shadow-lg shadow-[#C17BFF]/20 whitespace-nowrap"
            >
              Join Waitlist
            </button>
          </form>
        ) : (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-6 rounded-2xl bg-[#C17BFF]/10 border border-[#C17BFF]/30 flex items-center justify-center gap-3 text-[#C17BFF] font-bold"
          >
            <CheckCircle2 className="w-6 h-6" />
            <span>Success! You're on the list.</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default ComingSoon;
