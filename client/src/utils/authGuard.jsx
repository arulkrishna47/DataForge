import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Hook to enforce authentication before accessing premium services.
 * Redirects to login with a specific message and saves the target path.
 */
export function useAuthGuard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const requireAuth = (redirectTo) => {
    if (!user) {
      // Save intended destination for post-login redirection
      localStorage.setItem('redirectAfterLogin', redirectTo);
      
      navigate('/login', { 
        state: { 
          message: 'Please sign in to access this service',
          from: redirectTo 
        } 
      });
      return false;
    }
    return true;
  };
  
  return { requireAuth };
}
