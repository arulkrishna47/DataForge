import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-[#0D0B1A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-[#C17BFF] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#C17BFF] text-sm font-medium tracking-widest uppercase">Authenticating...</span>
      </div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  // Define roles more robustly from metadata
  const userMetadata = user?.user_metadata || {};
  const appMetadata = user?.app_metadata || {};
  
  const designatedAdminEmail = 'cortexa.services@gmail.com';
  const isAdminEmail = (user.email?.toLowerCase() === designatedAdminEmail.toLowerCase());
  
  // Check role in multiple possible locations
  const userRole = (
    isAdminEmail ? 'admin' : 
    (userMetadata.role || appMetadata.role || userMetadata.user_role || 'client')
  ).toLowerCase();
  
  const isAllowed = allowedRoles.length === 0 || allowedRoles.some(role => role.toLowerCase() === userRole);

  if (!isAllowed) {
    console.warn(`Access denied for role: ${userRole}. Redirecting to Home.`);
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
