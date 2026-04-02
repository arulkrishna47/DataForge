import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Database, FileText, Send, CheckCircle } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';

const RequestProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    serviceType: 'Dataset Collection',
    scope: '',
    timeline: '',
    budget: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const services = [
    'Dataset Collection',
    'Model Training',
    'Dataset Annotation',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (!user) {
        // --- NEW GUEST FLOW (uses Supabase auth directly) ---
        // 1. Sign up through Supabase so they have a valid session
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
              full_name: `${formData.firstName} ${formData.lastName}`,
              role: 'client',
            }
          }
        });

        if (signUpError) throw new Error(signUpError.message);

        // 2. Get the session token from the newly created account
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          // Supabase requires email confirmation - tell user and redirect
          setIsSuccess(true);
          return;
        }

        // 3. Submit service request using the Supabase bearer token
        await api.post('/services', {
          serviceType: formData.serviceType,
          scope: formData.scope,
          timeline: formData.timeline,
          budget: formData.budget,
        });
        
        toast.success('Request submitted! Please check your email to confirm your account.');
        setIsSuccess(true);

      } else {
        // --- LOGGED-IN USER FLOW ---
        await api.post('/services', {
          serviceType: formData.serviceType,
          scope: formData.scope,
          timeline: formData.timeline,
          budget: formData.budget,
        });
        toast.success('Your requirement brief has been submitted!');
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Project Submission Error:', err);
      const msg = err.response?.data?.message || err.message || 'Submission failed. Try again.';
      setError(msg);
      toast.error(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-navy min-h-screen pt-40 flex items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="max-w-md bg-slate-900 border border-[#C17BFF] p-12 rounded-[2.5rem] shadow-2xl">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-8" />
          <h1 className="text-3xl font-bold text-white mb-4">Request Submitted</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Your project brief has been submitted. Check your email for a confirmation link to activate your account. Once verified, you can login to track your status.
          </p>
          <button onClick={() => navigate('/login')} className="bg-[#C17BFF] text-white py-4 px-10 rounded-xl text-sm uppercase tracking-widest font-extrabold hover:bg-[#C17BFF]/80 transition-all">Proceed To Login</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-navy min-h-screen pt-40 pb-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-1">
            <h1 className="text-4xl font-extrabold text-white mb-6 tracking-tighter uppercase">Power Your <br /><span className="text-primary italic">AI Pipeline</span></h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-10">Submit your requirement brief below. We'll analyze your project and assign a lead within 24 hours.</p>
            <div className="space-y-6">
               <div className="flex items-center space-x-3 text-white text-xs lowercase tracking-widest"><FileText className="w-5 h-5 text-primary"/><span>Spec_Document_V1.pdf</span></div>
               <div className="flex items-center space-x-3 text-white text-xs lowercase tracking-widest"><Database className="w-5 h-5 text-primary"/><span>Data_Mapping_Engine.bin</span></div>
            </div>
          </div>

          <motion.form 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleSubmit} 
            className="lg:col-span-2 space-y-8 bg-slate-900/50 border border-slate-800 p-10 rounded-[2rem] shadow-xl"
          >
            {error && <div className="p-4 bg-red-900/40 border border-red-500 text-red-100 text-sm rounded-lg">{error}</div>}

            {!user && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input 
                    type="text" 
                    placeholder="First Name *" 
                    required 
                    className="bg-navy border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder="Last Name *" 
                    required 
                    className="bg-navy border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>

                <input 
                  type="email" 
                  placeholder="Corporate Email Address *" 
                  required 
                  className="w-full bg-navy border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />

                <input 
                  type="password" 
                  placeholder="Set Dashboard Password *" 
                  required 
                  minLength={6}
                  className="w-full bg-navy border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </>
            )}

            <div className="space-y-4">
               <label className="text-white text-xs uppercase font-bold tracking-[0.2em]">Service Requirement</label>
               <select 
                 className="w-full bg-navy border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm"
                 value={formData.serviceType}
                 onChange={(e) => setFormData({...formData, serviceType: e.target.value})}
               >
                 {services.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>

            <textarea 
               placeholder="Brief Project Scope (e.g. 50k images for medical segmentation)" 
               required 
               rows="4" 
               className="w-full bg-navy border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm"
               value={formData.scope}
               onChange={(e) => setFormData({...formData, scope: e.target.value})}
            />

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input 
                type="text" 
                placeholder="Expected Timeline (e.g. 3 Months)" 
                required 
                className="bg-navy border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm"
                value={formData.timeline}
                onChange={(e) => setFormData({...formData, timeline: e.target.value})}
              />
              <input 
                type="text" 
                placeholder="Approximate Budget (Optional)" 
                className="bg-navy border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm"
                value={formData.budget}
                onChange={(e) => setFormData({...formData, budget: e.target.value})}
              />
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`w-full py-5 rounded-2xl font-bold uppercase tracking-[0.3em] flex items-center justify-center space-x-3 transition-all ${isSubmitting ? 'bg-slate-700 opacity-50' : 'btn-primary'}`}
            >
              <span>{isSubmitting ? 'Processing...' : 'Submit Request'}</span>
              <Send className="w-5 h-5" />
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  );
};

export default RequestProject;
