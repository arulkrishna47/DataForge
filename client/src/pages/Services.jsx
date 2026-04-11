import { motion } from 'framer-motion';
import { Target, Zap, Shield, Users, CheckCircle, Database, Brain, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const Services = () => {
  const capabilities = [
    {
      title: 'High-Density Annotation',
      icon: <Database className="w-8 h-8" />,
      desc: 'Specialized labeling for complex surgical datasets, medical imaging, and high-velocity NLP requirements.',
      features: ['99.9% Label Accuracy', 'Multi-layer Segmentation', 'Temporal Tracking']
    },
    {
      title: 'Custom Model Evolution',
      icon: <Brain className="w-8 h-8" />,
      desc: 'We don\'t just label; we integrate. Our pipeline feeds directly into your retraining architecture.',
      features: ['Automated Feedback Loops', 'Edge-Case Identification', 'Domain Adaptation']
    },
    {
      title: 'Enterprise-Grade Security',
      icon: <Lock className="w-8 h-8" />,
      desc: 'Proprietary workflows designed for sensitive PII and HIPAA-regulated data environments.',
      features: ['Air-Gapped Infrastructure', 'Biometric Access Control', 'Full Audit Trail']
    }
  ];

  return (
    <div className="bg-[#0D0B1A] min-h-screen pt-40 pb-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-extrabold text-white mb-8 tracking-tighter"
          >
            Surgical Data <span className="bg-gradient-to-r from-[#C17BFF] to-[#9D4EDD] bg-clip-text text-transparent italic">Solutions</span>
          </motion.h1>
          <p className="text-slate-400 text-lg">We provide specialized AI data architecture for mission-critical applications. Our enterprise workflows are designed to scale with your breakthroughs.</p>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {capabilities.map((cap, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-10 rounded-[2rem] border border-[#2A2740] bg-[#131127]/50 transition-all hover:bg-[#1A1733] hover:border-[#C17BFF]/30 group shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#C17BFF]/10 flex items-center justify-center text-[#C17BFF] mb-8 group-hover:scale-110 transition-transform">
                {cap.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">{cap.title}</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">{cap.desc}</p>
              
              <ul className="space-y-4 mb-10">
                {cap.features.map((feat, fIdx) => (
                  <li key={fIdx} className="flex items-center space-x-3 text-slate-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-[#C17BFF]" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-20 p-12 rounded-[3rem] bg-gradient-to-r from-[#131127] to-[#1A1733] border border-[#2A2740] text-center"
        >
          <h2 className="text-3xl font-bold text-white mb-4">Request a Proprietary Workflow</h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">Have a specialized data requirement? Our architects are ready to build your custom pipeline.</p>
          <Link to="/request" className="inline-block px-10 py-4 rounded-xl bg-[#C17BFF] text-white font-bold hover:bg-[#9D4EDD] transition-all shadow-lg shadow-[#C17BFF]/20">
            Consult With An Architect
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default Services;
