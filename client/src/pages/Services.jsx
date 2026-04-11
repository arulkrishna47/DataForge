import React from 'react';
import { motion } from 'framer-motion';
import { 
  Database, Cpu, Globe, ShieldCheck, 
  Network, Settings, ArrowRight, Zap, 
  CheckCircle2, Mail 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Services = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleTryNow = () => {
    const destination = '/dashboard/auto-annotate';
    if (!user) {
      sessionStorage.setItem('redirectAfterLogin', destination);
      navigate('/login');
    } else {
      navigate(destination);
    }
  };

  const secondaryServices = [
    {
      title: 'Dataset Collection',
      desc: 'Curate high-fidelity multi-modal datasets from distributed global sources with automated privacy filtering.',
      icon: <Database className="w-5 h-5" />,
      link: '/services/datasets'
    },
    {
      title: 'ML Model Training',
      desc: 'End-to-end training pipelines for LLMs and Diffusion models on our proprietary compute fabric.',
      icon: <Cpu className="w-5 h-5" />,
      link: '/services/training'
    },
    {
      title: 'Synthetic Data',
      desc: 'Generate photorealistic synthetic training environments to bridge the reality gap for edge cases.',
      icon: <Globe className="w-5 h-5" />,
      link: '/services/synthetic'
    },
    {
      title: 'AI Safety & Bias',
      desc: 'Rigorous adversarial testing and bias mitigation protocols to ensure ethical deployment.',
      icon: <ShieldCheck className="w-5 h-5" />,
      link: '/services/safety'
    },
    {
      title: 'Neural API',
      desc: 'Seamlessly connect your existing stack to our inference engine via enterprise-grade REST APIs.',
      icon: <Network className="w-5 h-5" />,
      link: '/services/api'
    },
    {
      title: 'Custom Pipeline',
      desc: 'Need a bespoke architecture? Our specialists will design a custom intelligence pipeline for your niche.',
      icon: <Settings className="w-5 h-5" />,
      isQuote: true
    }
  ];

  return (
    <div className="bg-[#050508] min-h-screen pt-32 pb-20 text-white font-sans selection:bg-[#C17BFF]/30">
      <div className="container mx-auto px-6 max-w-7xl">
        
        {/* Header Section */}
        <header className="mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
          >
            Our <span className="italic font-medium text-[#C17BFF]">Intelligence</span> Portfolio
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-400 text-lg max-w-2xl leading-relaxed"
          >
            Advanced neural infrastructure designed for the next era of synthetic cognition. 
            Scale your data operations with ethereal precision.
          </motion.p>
        </header>

        {/* Flagship Hero Section */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative mb-12 p-8 md:p-16 rounded-[2.5rem] bg-[#0D0D15] border border-white/5 overflow-hidden group"
        >
          {/* Animated Sphere Background */}
          <div className="absolute top-1/2 -right-20 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] opacity-40 group-hover:opacity-60 transition-opacity">
            <div className="relative w-full h-full">
               <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#C17BFF]/20 to-transparent blur-3xl animate-pulse" />
               <div className="absolute inset-10 rounded-full border border-[#C17BFF]/20 border-dashed animate-[spin_20s_linear_infinite]" />
               <div className="absolute inset-20 rounded-full border border-[#C17BFF]/10 animate-[spin_15s_linear_infinite_reverse]" />
               <div className="absolute inset-40 rounded-full bg-[#C17BFF]/5 backdrop-blur-3xl shadow-[0_0_100px_rgba(193,123,255,0.1)]" />
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-[1px] w-8 bg-[#C17BFF]" />
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#C17BFF]">Flagship Service</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Auto-Annotation</h2>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              Eliminate manual bottlenecks with our zero-shot neural labeling engine. 
              Deploy production-ready datasets in hours, not months.
            </p>

            <ul className="space-y-4 mb-12">
              {[
                '99% Accuracy Guaranteed',
                'Instant Labelling Pipeline',
                'Supports Multiple Video & Image Formats'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-[#C17BFF]" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={handleTryNow}
                className="px-8 py-3.5 rounded-full bg-[#C17BFF] text-white font-bold hover:bg-[#A855F7] transition-all flex items-center gap-2 group/btn shadow-lg shadow-[#C17BFF]/20"
              >
                Try Now <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
              <button className="px-8 py-3.5 rounded-full bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all">
                Explore Documentation
              </button>
            </div>
          </div>
        </motion.section>

        {/* Secondary Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24">
          {secondaryServices.map((service, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-8 rounded-3xl bg-[#0D0D15] border border-white/5 hover:border-[#C17BFF]/30 transition-all group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#C17BFF]/10 flex items-center justify-center text-[#C17BFF] mb-8 group-hover:scale-110 transition-transform">
                {service.icon}
              </div>
              <h3 className="text-xl font-bold mb-4">{service.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                {service.desc}
              </p>
              
              <div className="flex items-center justify-between">
                {service.isQuote ? (
                  <button className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 group/link">
                    Request Quote <Mail className="w-4 h-4 text-[#C17BFF]" />
                  </button>
                ) : (
                  <button className="text-xs font-bold uppercase tracking-widest text-[#C17BFF] flex items-center gap-2 group/link">
                    Learn More <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="bg-[#0D0D15] rounded-[3rem] p-12 md:p-20 text-center border border-white/5 overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#C17BFF]/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Ready to evolve your data?</h2>
            <p className="text-slate-400 mb-12 max-w-xl mx-auto">
              Join over 500+ engineering teams accelerating their AI deployment cycles with EtherAI.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <Link to="/register" className="w-full md:w-auto px-10 py-4 rounded-2xl bg-[#C17BFF] text-white font-bold hover:bg-[#A855F7] transition-all shadow-xl shadow-[#C17BFF]/10">
                Get Started Free
              </Link>
              <button className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase text-white hover:text-[#C17BFF] transition-colors">
                Speak to a Specialist <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.section>

      </div>

      {/* Footer Minimal */}
      <footer className="mt-32 pt-16 border-t border-white/5 container mx-auto px-6 max-w-7xl flex flex-col md:flex-row items-center justify-between gap-8 pb-10">
        <div>
           <div className="text-xl font-bold mb-2">Cortexa</div>
           <p className="text-slate-500 text-xs">© 2026 Cortexa Intelligence. All rights reserved.</p>
        </div>
        <div className="flex items-center gap-8 text-xs font-medium text-slate-500">
           <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
           <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
           <a href="#" className="hover:text-white transition-colors">Documentation</a>
           <a href="#" className="hover:text-white transition-colors">API Status</a>
        </div>
      </footer>
    </div>
  );
};

export default Services;
