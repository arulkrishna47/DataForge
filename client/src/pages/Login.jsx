import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'sonner';

const GoogleSVG = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GitHubSVG = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" className="fill-white">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);

const Login = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const data = await login(email, password);
        toast.success('Welcome back to Cortexa!');
        // Check role from Supabase user_metadata or VITE_ADMIN_EMAIL
        const isAdminEmail = (email.toLowerCase() === (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase());
        const role = (isAdminEmail ? 'admin' : (data?.user?.user_metadata?.role || 'client')).toLowerCase();
        if (role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        await register(email, password, { first_name: firstName, last_name: lastName, role: 'client' });
        toast.success('Account created! Check your email to verify.');
        setIsLogin(true);
      }
    } catch (err) {
      const msg = err.message || 'Authentication failed.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err.message || `${provider} login failed.`);
      setOauthLoading('');
    }
  };

  return (
    <div className="bg-[#0D0B1A] min-h-screen flex items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at top, rgba(193,123,255,0.08) 0%, #0D0B1A 60%)' }}>
      <div className="max-w-md w-full bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-10 rounded-[2rem] shadow-2xl text-center">
        
        <img src="/logo.png" alt="Cortexa logo" style={{ height: '56px', width: 'auto' }} className="mx-auto mb-5" />
        <h1 className="text-2xl font-bold text-white mb-1 tracking-tight uppercase">
          {isLogin ? 'Login' : 'Sign Up'}
        </h1>
        <p className="text-slate-500 mb-7 text-sm">
          {isLogin ? 'Welcome back to Cortexa.' : 'Create your account to start building.'}
        </p>

        {/* OAuth Buttons */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={() => handleOAuth('google')}
            disabled={!!oauthLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            <GoogleSVG />
            <span className="flex-1 text-center">
              {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
            </span>
          </button>
          <button
            onClick={() => handleOAuth('github')}
            disabled={!!oauthLoading}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            <GitHubSVG />
            <span className="flex-1 text-center">
              {oauthLoading === 'github' ? 'Redirecting...' : 'Continue with GitHub'}
            </span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-slate-500 font-medium">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-500/30 text-red-400 text-xs rounded-lg mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          {!isLogin && (
            <div className="flex gap-3">
              <input
                type="text" placeholder="First Name" required
                className="w-full bg-black/30 border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-[#C17BFF] transition-all text-sm"
                value={firstName} onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                type="text" placeholder="Last Name" required
                className="w-full bg-black/30 border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-[#C17BFF] transition-all text-sm"
                value={lastName} onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          )}
          <input
            type="email" placeholder="Email Address" required
            className="w-full bg-black/30 border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-[#C17BFF] transition-all text-sm"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password" placeholder="Password" required
            className="w-full bg-black/30 border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-[#C17BFF] transition-all text-sm"
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <button
            disabled={loading}
            className="w-full bg-[#C17BFF] hover:bg-[#9B4FD4] text-white py-3.5 rounded-xl uppercase tracking-widest font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50 mt-2"
          >
            {loading ? 'Processing...' : (isLogin ? 'Authenticate' : 'Register Account')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          className="mt-7 text-sm text-slate-400 hover:text-white transition-colors"
        >
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
};

export default Login;
