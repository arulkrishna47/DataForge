import { motion } from 'framer-motion';
import { Target, Zap, Shield, Users, CheckCircle } from 'lucide-react';

const Services = () => {
  const tiers = [
    {
      name: 'Basic',
      price: '$2,500',
      desc: 'Ideal for small research teams and startups testing feasibility.',
      features: ['Up to 1M data points', 'Standard NLP/CV labeling', '1-week turnaround', 'Email support']
    },
    {
      name: 'Pro',
      price: '$12,000',
      desc: 'For scaling projects that require high-density, multi-layer annotation.',
      features: ['Unlimited scraping', 'Custom model fine-tuning', 'Priority status', 'Dedicated project lead', 'API integration support']
    },
    {
      name: 'Enterprise',
      price: 'Custom Quote',
      desc: 'Proprietary workflows and air-gapped security for sensitive enterprise data.',
      features: ['SLA-guaranteed accuracy', 'Retraining pipeline integration', 'On-site consultation', 'Quarterly data Audits', '24/7 technical assistance']
    }
  ];

  return (
    <div className="bg-navy min-h-screen pt-40 pb-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-24 max-w-3xl mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-extrabold text-white mb-8 tracking-tighter"
          >
            Surgical Data <span className="text-primary italic">Solutions</span>
          </motion.h1>
          <p className="text-slate-400 text-lg">Choose from our pre-defined tiers or contact us for a custom-built data solution for your specialized AI architecture.</p>
        </div>

        {/* Pricing Tiers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {tiers.map((tier, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-10 rounded-3xl border ${tier.name === 'Pro' ? 'bg-slate-900 border-primary relative' : 'bg-slate-900/50 border-slate-800'} transition-all hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]`}
            >
              {tier.name === 'Pro' && (
                <div className="absolute top-0 right-10 bg-primary text-white text-[10px] uppercase font-bold px-4 py-1 rounded-b-lg tracking-widest">
                  Most Popular
                </div>
              )}
              <h3 className="text-2xl font-bold text-white mb-2 tracking-tight uppercase">{tier.name}</h3>
              <div className="text-4xl font-extrabold text-white mb-6 tracking-tighter">{tier.price}</div>
              <p className="text-slate-500 text-sm mb-10 leading-relaxed">{tier.desc}</p>
              
              <ul className="space-y-4 mb-12">
                {tier.features.map((feat, fIdx) => (
                  <li key={fIdx} className="flex items-center space-x-3 text-slate-300 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <button className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${tier.name === 'Pro' ? 'btn-primary' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                {tier.name === 'Enterprise' ? 'Speak To Sales' : 'Get Started'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Services;
