import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-navy py-16 border-t border-slate-800">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <img src="/logo.png" alt="Cortexa logo" style={{ height: '32px', width: 'auto' }} />
              <span style={{
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'white',
                fontSize: '16px'
              }}>
                Cortex<span className="text-[#C17BFF]">a</span>
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Powering the future of AI with precision dataset curation and advanced model training services for the most demanding technical projects.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Platform</h4>
            <ul className="space-y-4">
              <li><Link to="/" className="text-slate-400 hover:text-white transition-colors text-sm">Dashboard</Link></li>
              <li><Link to="/services" className="text-slate-400 hover:text-white transition-colors text-sm">Services</Link></li>
              <li><Link to="/pricing" className="text-slate-400 hover:text-white transition-colors text-sm">Case Studies</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
             <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Company</h4>
            <ul className="space-y-4">
              <li><Link to="/about" className="text-slate-400 hover:text-white transition-colors text-sm">About Us</Link></li>
              <li><Link to="/contact" className="text-slate-400 hover:text-white transition-colors text-sm">Contact</Link></li>
              <li><Link to="/blog" className="text-slate-400 hover:text-white transition-colors text-sm">Resources</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-widest">Connect</h4>
            <ul className="space-y-4">
              <li className="flex items-center space-x-3 text-slate-400 text-sm">
                <Mail className="w-4 h-4 text-[#C17BFF]" />
                <a href="mailto:cortexa.services@gmail.com" className="hover:text-white transition-colors">cortexa.services@gmail.com</a>
              </li>
              <li className="flex items-center space-x-3 text-slate-400 text-sm">
                <Phone className="w-4 h-4 text-[#C17BFF]" />
                <a href="tel:+919360246565" className="hover:text-white transition-colors">+91 93602 46565</a>
              </li>
              <li className="flex items-center space-x-3 text-slate-400 text-sm">
                <MapPin className="w-4 h-4 text-[#C17BFF]" />
                <span>Chennai, Tamil Nadu, India</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-500 text-xs mb-4 md:mb-0">
            &copy; 2026 Cortexa AI Services. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <Link to="#" className="text-slate-500 hover:text-slate-300 text-xs">Privacy Policy</Link>
            <Link to="#" className="text-slate-500 hover:text-slate-300 text-xs">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
