import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'sonner';
import { 
  Lock, Mail, Eye, EyeOff, Github, 
  Chrome, ArrowRight, UserPlus, LogIn,
  AlertCircle, Shield
} from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  // Get message from navigation state (used by AuthGuard)
  const message = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const data = await login(email, password);
        toast.success('Welcome back to Cortexa!');
        
        // Handle post-login redirection from localStorage
        const redirectTo = localStorage.getItem('redirectAfterLogin');
        if (redirectTo) {
          localStorage.removeItem('redirectAfterLogin');
          navigate(redirectTo);
        } else {
          // Default role-based routing
          const isAdminEmail = (email.toLowerCase() === (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase());
          const role = (isAdminEmail ? 'admin' : (data?.user?.user_metadata?.role || 'client')).toLowerCase();
          navigate(role === 'admin' ? '/admin' : '/dashboard');
        }
      } else {
        await register(email, password, { 
          first_name: firstName, 
          last_name: lastName, 
          role: 'client' 
        });
        toast.success('Account created! Check your email to verify.');
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    try {
      setOauthLoading(provider);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOauthLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-6 selection:bg-[#C17BFF]/30 font-sans">
      {/* Background Orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C17BFF]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#C17BFF] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-[#C17BFF]/20">
                <Shield className="w-6 h-6 text-white" />
             </div>
             <span className="text-2xl font-bold tracking-tight">Cortexa</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {isLogin ? 'Neural Access' : 'Create Identity'}
          </h1>
          <p className="text-slate-500 mt-2">
            {isLogin ? 'Enter your credentials to continue' : 'Join the next era of synthetic cognition'}
          </p>
        </div>

        {/* Auth Guard Message Banner */}
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-[#C17BFF]/10 border border-[#C17BFF]/30 flex items-center gap-3 text-[#C17BFF] text-sm font-medium"
          >
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>{message}</span>
          </motion.div>
        )}

        <div className="bg-[#0D0D15] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#C17BFF]/40 to-transparent" />
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                  <input 
                    type="text" required
                    className="w-full bg-[#08080C] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-[#C17BFF]/40 transition-all text-sm"
                    value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                  <input 
                    type="text" required
                    className="w-full bg-[#08080C] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-[#C17BFF]/40 transition-all text-sm"
                    value={lastName} onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Neural ID (Email)</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input 
                  type="email" required
                  className="w-full bg-[#08080C] border border-white/5 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#C17BFF]/40 transition-all text-sm"
                  placeholder="name@cortexa.ai"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Passkey</label>
                {isLogin && <button type="button" className="text-[10px] text-[#C17BFF] hover:underline">Forgot?</button>}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input 
                  type={showPassword ? 'text' : 'password'} required
                  className="w-full bg-[#08080C] border border-white/5 rounded-xl py-3 pl-12 pr-12 focus:outline-none focus:border-[#C17BFF]/40 transition-all text-sm"
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-[#C17BFF] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit" disabled={loading}
              className="w-full bg-[#C17BFF] hover:bg-[#A855F7] disabled:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#C17BFF]/20 flex items-center justify-center gap-2 group/btn mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Initialize Uplink' : 'Activate Identity'}
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold text-slate-600">
              <span className="bg-[#0D0D15] px-4 italic">Social Sync</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== ''}
              className="flex items-center justify-center gap-3 bg-white/5 border border-white/5 hover:border-white/10 py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {oauthLoading === 'google' ? <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" /> : <Chrome className="w-4 h-4" />}
              Google
            </button>
            <button 
              onClick={() => handleOAuth('github')}
              disabled={oauthLoading !== ''}
              className="flex items-center justify-center gap-3 bg-white/5 border border-white/5 hover:border-white/10 py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {oauthLoading === 'github' ? <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" /> : <Github className="w-4 h-4" />}
              GitHub
            </button>
          </div>
        </div>

        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-8 text-slate-500 hover:text-white transition-colors text-sm font-medium flex items-center justify-center gap-2 group"
        >
          {isLogin ? (
            <>New to Cortexa? <span className="text-[#C17BFF] font-bold group-hover:underline">Create Identity <UserPlus className="inline w-3 h-3 ml-1" /></span></>
          ) : (
            <>Already have an ID? <span className="text-[#C17BFF] font-bold group-hover:underline">Access Uplink <LogIn className="inline w-3 h-3 ml-1" /></span></>
          )}
        </button>
      </div>
    </div>
  );
};

export default Login;
