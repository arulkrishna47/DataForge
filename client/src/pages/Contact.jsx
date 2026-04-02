import { useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/axios';

const Contact = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      await api.post('/auth/contact', { message });
      toast.success('Message sent successfully! Our team will reach out soon.');
      setMessage('');
    } catch (err) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-navy text-white min-h-screen pt-40 pb-20">
      <div className="container mx-auto px-6 text-center max-w-2xl">
        <h1 className="text-5xl font-extrabold mb-10 tracking-tighter uppercase italic text-[#C17BFF]">Contact Us</h1>
        <p className="text-slate-400 mb-12">Reach out for enterprise partnerships, general inquiries, or technical support.</p>
        
        <form onSubmit={handleSubmit} className="bg-slate-900 p-10 border border-white/5 rounded-3xl text-left space-y-6 shadow-2xl">
            <div>
               <label className="text-xs uppercase font-bold text-slate-500 mb-2 block tracking-widest">Your Message</label>
               <textarea 
                 value={message}
                 onChange={(e) => setMessage(e.target.value)}
                 required
                 placeholder="Tell us about your project or inquiry..." 
                 className="w-full bg-navy border border-white/5 p-4 rounded-xl text-white outline-none focus:border-[#C17BFF] transition-colors text-sm placeholder:text-slate-600" 
                 rows="5" 
               />
            </div>
            
            <button 
              type="submit"
              disabled={loading}
              className={`w-full py-4 uppercase tracking-[0.2em] font-black rounded-xl transition-all ${loading ? 'bg-slate-700 opacity-50' : 'bg-[#C17BFF] text-white hover:bg-[#C17BFF]/80 shadow-[0_0_20px_rgba(193,123,255,0.2)]'}`}
            >
              {loading ? 'Sending Request...' : 'Send Message'}
            </button>
            
            <div className="pt-8 border-t border-white/5 space-y-4">
              <div className="flex items-center space-x-4">
                <div className="bg-[#C17BFF]/10 p-3 rounded-xl border border-[#C17BFF]/20">
                   <Mail className="w-5 h-5 text-[#C17BFF]" />
                </div>
                <div>
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Email</p>
                   <p className="text-white font-medium text-sm">cortexa.services@gmail.com</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="bg-[#C17BFF]/10 p-3 rounded-xl border border-[#C17BFF]/20">
                   <Phone className="w-5 h-5 text-[#C17BFF]" />
                </div>
                <div>
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Phone</p>
                   <p className="text-white font-medium text-sm">+91 93602 46565</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="bg-[#C17BFF]/10 p-3 rounded-xl border border-[#C17BFF]/20">
                   <MapPin className="w-5 h-5 text-[#C17BFF]" />
                </div>
                <div>
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Address</p>
                   <p className="text-white font-medium text-sm">Chennai, Tamil Nadu, India</p>
                </div>
              </div>
            </div>
        </form>
      </div>
    </div>
  );
};

export default Contact;
