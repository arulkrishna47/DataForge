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

  // We hardcode the designated admin email check to avoid environmental issues in this troubleshooting phase
  const designatedAdminEmail = 'cortexa.services@gmail.com';
  const isAdminEmail = (user.email?.toLowerCase() === designatedAdminEmail.toLowerCase());
  const userRole = (isAdminEmail ? 'admin' : (user.user_metadata?.role || user.app_metadata?.role || 'client').toLowerCase());
  
  if (allowedRoles.length > 0 && !allowedRoles.map(r => r.toLowerCase()).includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
