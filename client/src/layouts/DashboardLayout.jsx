import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FolderKanban, Settings, LogOut, User, ArrowLeft, Scan } from 'lucide-react';
import { useState } from 'react';

// Avatar with fallback if Google/GitHub image fails to load
const AvatarIcon = ({ user }) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = user?.user_metadata?.avatar_url;

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt="avatar"
        onError={() => setImgError(true)}
        className="w-9 h-9 rounded-full border-2 border-[#C17BFF]/30 object-cover"
      />
    );
  }

  // Fallback: show first letter of name in a purple circle
  const initial = (
    user?.user_metadata?.first_name?.[0] ||
    user?.user_metadata?.full_name?.[0] ||
    user?.email?.[0] ||
    'U'
  ).toUpperCase();

  return (
    <div className="w-9 h-9 rounded-full bg-[#C17BFF]/20 border-2 border-[#C17BFF]/30 flex items-center justify-center">
      <span className="text-[#C17BFF] text-sm font-bold">{initial}</span>
    </div>
  );
};

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Get name from Supabase user — works for email/password AND Google/GitHub OAuth
  const firstName =
    user?.user_metadata?.first_name ||
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'User';

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Project Detail', path: '/dashboard/project/latest', icon: FolderKanban },
    { name: 'Auto Annotate', path: '/dashboard/auto-annotate', icon: Scan },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#0D0B1A]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 hidden md:flex bg-[#0D0B1A]">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-12">
          <img src="/logo.png" alt="Cortexa logo" style={{ height: '36px', width: 'auto' }} />
          <span style={{
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'white',
            fontSize: '16px'
          }}>
            CORTEXA
          </span>
        </Link>

        <nav className="flex-grow space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-white/5 p-3 rounded-xl transition-all"
            >
              <item.icon className="w-5 h-5 text-[#C17BFF]" />
              <span className="text-sm font-medium">{item.name}</span>
            </Link>
          ))}
          
          <Link
            to="/"
            className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-[#C17BFF]/10 p-3 rounded-xl transition-all mt-10 border-t border-white/5 pt-6"
          >
            <ArrowLeft className="w-5 h-5 text-[#C17BFF]" />
            <span className="text-sm font-medium">Exit Workspace</span>
          </Link>
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 text-red-400 hover:bg-red-900/10 p-3 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-grow flex flex-col overflow-hidden">
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between bg-[#0D0B1A]">
          <h2 className="text-white text-xl font-bold uppercase tracking-widest">
            {firstName}'s Workspace
          </h2>
          <div className="flex items-center gap-3">
            <AvatarIcon user={user} />
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-12 bg-[#0D0B1A]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
