import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Rocket, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Avatar with fallback if image fails to load
const AvatarIcon = ({ user }) => {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = user?.user_metadata?.avatar_url;

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt="avatar"
        onError={() => setImgError(true)}
        className="w-8 h-8 rounded-full border border-[#C17BFF]/30 object-cover"
      />
    );
  }

  const initial = (
    user?.user_metadata?.first_name?.[0] ||
    user?.user_metadata?.full_name?.[0] ||
    user?.email?.[0] ||
    'U'
  ).toUpperCase();

  return (
    <div className="w-8 h-8 rounded-full bg-[#C17BFF]/20 border border-[#C17BFF]/30 flex items-center justify-center">
      <span className="text-[#C17BFF] text-xs font-bold">{initial}</span>
    </div>
  );
};

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-navy/90 backdrop-blur-md shadow-lg shadow-black/20 py-3' : 'bg-transparent py-5'}`}>
      <div className="container mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center space-x-2">
          <img src="/logo.png" alt="Cortexa logo" height={36} width={36} />
          <span style={{ fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'white', fontSize: '16px' }}>
            CORTEXA
          </span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={link.path} 
              className={`text-[11px] font-black uppercase tracking-[0.2em] transition-colors hover:text-[#C17BFF] ${location.pathname === link.path ? 'text-[#C17BFF]' : 'text-slate-300'}`}
            >
              {link.name}
            </Link>
          ))}
          
          {user ? (
             <div className="flex items-center gap-6 border-l border-white/10 pl-8">
                <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-3 group">
                   <AvatarIcon user={user} />
                   <span className="text-[10px] text-white font-black uppercase tracking-widest group-hover:text-[#C17BFF] transition-colors">Workspace</span>
                </Link>
                <button 
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-red-400 transition-colors p-1"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
             </div>
          ) : (
            <>
              <Link to="/login" className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-[#C17BFF] transition-colors">SignIn</Link>
              <Link to="/request" className="bg-[#C17BFF] text-white py-2.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#C17BFF]/80 transition-all shadow-lg shadow-[#C17BFF]/20">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-navy absolute top-0 w-full h-screen p-10 flex flex-col space-y-8 animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-8">
             <Link to="/" className="flex items-center space-x-2" onClick={() => setIsMenuOpen(false)}>
              <img src="/logo.png" alt="Cortexa logo" height={36} width={36} />
              <span style={{ fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'white', fontSize: '16px' }}>
                CORTEXA
              </span>
            </Link>
            <button className="text-white" onClick={() => setIsMenuOpen(false)}><X /></button>
          </div>
          {navLinks.map((link) => (
            <Link key={link.name} to={link.path} className="text-2xl font-black uppercase tracking-widest text-white" onClick={() => setIsMenuOpen(false)}>
              {link.name}
            </Link>
          ))}
          {user ? (
             <div className="pt-10 space-y-6">
                <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="flex items-center gap-4 text-white" onClick={() => setIsMenuOpen(false)}>
                   <AvatarIcon user={user} />
                   <span className="text-xl font-black uppercase tracking-widest">Go To Dashboard</span>
                </Link>
                <button 
                  onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  className="flex items-center gap-4 text-red-400 text-xl font-black uppercase tracking-widest"
                >
                  <LogOut className="w-6 h-6" />
                  <span>Logout</span>
                </button>
             </div>
          ) : (
            <>
              <Link to="/login" className="text-2xl font-black uppercase tracking-widest text-white" onClick={() => setIsMenuOpen(false)}>SignIn</Link>
              <Link to="/request" className="bg-[#C17BFF] text-white py-5 text-center text-xl font-black uppercase tracking-widest rounded-2xl" onClick={() => setIsMenuOpen(false)}>Request Demo</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
