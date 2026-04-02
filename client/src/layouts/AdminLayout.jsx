import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Inbox, FolderKanban, Users, LogOut, User } from 'lucide-react';
import StatusTicker from '../components/StatusTicker';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const operatorName =
    user?.user_metadata?.first_name ||
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { name: 'Analytics', path: '/admin', icon: LayoutDashboard },
    { name: 'Request Inbox', path: '/admin/inbox', icon: Inbox },
    { name: 'Project List', path: '/admin/projects', icon: FolderKanban },
    { name: 'Client Directory', path: '/admin/clients', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-navy text-slate-300">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 flex flex-col p-6 hidden md:flex">
        <Link to="/" className="flex items-center gap-2 mb-12">
          <img src="/logo.png" alt="Cortexa logo" style={{ height: '36px', width: 'auto' }} />
          <span style={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'white', fontSize: '14px' }}>
            CORTEXA <span style={{ color: '#C17BFF' }}>ADMIN</span>
          </span>
        </Link>

        <nav className="flex-grow space-y-3">
          {menuItems.map((item) => (
            <Link 
              key={item.name} 
              to={item.path} 
              className="flex items-center space-x-3 text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-xl transition-all"
            >
              <item.icon className="w-5 h-5 text-primary" />
              <span className="text-sm font-bold uppercase tracking-widest">{item.name}</span>
            </Link>
          ))}
        </nav>

        <button 
          onClick={handleLogout}
          className="flex items-center space-x-3 text-red-500 hover:bg-red-900/10 p-3 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-bold uppercase tracking-widest">Logout</span>
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col overflow-hidden">
        <header className="h-20 border-b border-slate-800 px-10 flex items-center justify-between bg-navy/50 backdrop-blur-sm">
           <div className="flex flex-col">
             <h2 className="text-white text-md font-black uppercase tracking-[0.3em] mb-1">Command Center</h2>
             <p className="text-slate-500 text-[8px] font-bold uppercase tracking-[.25em]">Live Platform Control Node</p>
           </div>
           
           <div className="flex-grow max-w-lg mx-12 hidden lg:flex items-center justify-center">
              <StatusTicker />
           </div>

           <div className="flex items-center space-x-6">
              <div className="flex flex-col items-end">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest leading-none mb-1">Operator Console</span>
                <span className="text-white font-black text-[10px] uppercase tracking-tighter">{operatorName}</span>
              </div>
              <div className="w-10 h-10 bg-primary/20 border border-primary/30 rounded-2xl flex items-center justify-center text-primary shadow-lg shadow-primary/10 transition-transform hover:rotate-12">
                 <User className="w-5 h-5" />
              </div>
           </div>
        </header>

        <main className="flex-grow overflow-y-auto p-12 bg-navy">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

