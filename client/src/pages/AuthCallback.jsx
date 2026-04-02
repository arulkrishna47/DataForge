import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

// This page handles the redirect after Google/GitHub OAuth login
// Supabase redirects here, we check the role, then send to the right dashboard
const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Get the session after OAuth redirect
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        navigate('/login');
        return;
      }

      const role = session.user?.user_metadata?.role || 'client';

      if (role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0D0B1A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#C17BFF] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#C17BFF] text-sm font-medium tracking-widest uppercase">
          Signing you in...
        </span>
      </div>
    </div>
  );
};

export default AuthCallback;
