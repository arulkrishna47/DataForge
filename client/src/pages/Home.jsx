import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Database, Cpu, Layout, FileTerminal, Target, Zap, Shield, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();
  const services = [
    {
      title: 'Dataset Collection',
      desc: 'High-quality web scraping, file ingestion, and multi-source API integration tailored to your ML requirements.',
      icon: Database,
    },
    {
      title: 'Model Training',
      desc: 'Expert fine-tuning and transfer learning for LLMs, Computer Vision, and Predictive Analytics models.',
      icon: Cpu,
    },
    {
      title: 'Dataset Annotation',
      desc: 'Accurate image labeling, text categorization, and multi-round quality review workflows for training data.',
      icon: FileTerminal,
    },
  ];

  return (
    <div className="bg-navy overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center pt-24">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/20 blur-[120px] rounded-full -translate-x-1/2" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full translate-x-1/2" />

        <div className="container mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex-1 text-center md:text-left"
          >
            <span className="text-primary font-bold tracking-widest text-sm uppercase mb-6 inline-block">
              Powering The AI Revolution
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-8 leading-[1.1]">
              Build Better AI <br /> <span className="text-primary italic">with Cortexa</span>
            </h1>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto md:mx-0 leading-relaxed">
              The self-serve platform for dataset collection, data annotation, and ML model training — built for startups.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Link to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/request'} className="bg-[#C17BFF] text-white py-4 px-10 rounded-xl text-lg font-black uppercase tracking-wider text-center hover:bg-[#C17BFF]/80 transition-all shadow-xl shadow-[#C17BFF]/20">
                {user ? 'Enter Workspace' : 'Start for free'}
              </Link>
              <Link to="/services" className="border border-white/10 hover:border-[#C17BFF] text-white py-4 px-10 rounded-xl transition-all text-lg font-black uppercase tracking-wider text-center">
                Explore Services
              </Link>
            </div>
          </motion.div>

          <motion.div 
             initial={{ opacity: 0, scale: 0.8 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ duration: 1.2, delay: 0.2 }}
             className="flex-1 relative"
          >
             <div className="relative w-full aspect-square max-w-[500px] mx-auto overflow-hidden rounded-[2.5rem]">
                {/* Simulated Neural Network Illustration */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-navy p-1">
                  <div className="w-full h-full bg-navy/80 rounded-[2.4rem] p-10 flex items-center justify-center">
                     <div className="grid grid-cols-3 gap-6 opacity-30">
                        {Array.from({ length: 9 }).map((_, i) => (
                           <motion.div 
                              key={i} 
                              animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.5, 0.1] }}
                              transition={{ duration: 3, delay: i * 0.2, repeat: Infinity }}
                              className="w-16 h-16 bg-primary rounded-full blur-md" 
                           />
                        ))}
                     </div>
                  </div>
                  {/* Floating abstract cards */}
                  <div className="absolute top-10 right-10 p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl">
                    <div className="flex items-center space-x-3 text-white text-xs lowercase tracking-widest">
                       <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                       <span>training_data.status_ok</span>
                    </div>
                  </div>
                </div>
             </div>
          </motion.div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20 max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold text-white mb-6">Our Capabilities</h2>
            <p className="text-slate-400">Our suite of specialized services manages the entire data lifecycle for ML teams, ensuring high-quality outputs at scale.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {services.map((item, index) => (
              <motion.div
                key={index}
                whileHover={{ y: -10 }}
                className="p-8 bg-slate-900 border border-slate-800 rounded-2xl transition-all hover:border-primary relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 group-hover:bg-primary/20 transition-all duration-500" />
                <item.icon className="w-12 h-12 text-primary mb-6" />
                <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-tighter">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Stats Section */}
      <section className="py-24 bg-slate-900/50">
         <div className="container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            {[
              { val: '500M+', label: 'Data Points Collected' },
              { val: '1.2K', label: 'Models Optimized' },
              { val: '99.9%', label: 'Annotation Accuracy' },
              { val: '50+', label: 'Enterprise Clients' }
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-4xl font-bold text-white mb-2">{stat.val}</div>
                <div className="text-slate-500 text-sm uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
         </div>
      </section>

      {/* Call To Action */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/10 blur-[150px] rounded-full rotate-45" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl font-bold text-white mb-8">Ready To Scale Your AI Pipeline?</h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed text-lg">
            Join the ranks of leading Silicon Valley research labs and Fortune 500 tech companies powering their models with Cortexa.
          </p>
          <Link to="/request" className="btn-primary py-5 px-16 text-xl uppercase tracking-[0.2em]">
            Submit Project Brief
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
