import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { User, Mail, Calendar, ShieldCheck } from 'lucide-react';

const ClientList = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get('/admin/clients');
        setClients(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  if (loading) return <div className="text-slate-400">Fetching corporate client registry...</div>;

  return (
    <div className="space-y-12">
      <h1 className="text-4xl font-extrabold text-white tracking-tighter uppercase italic text-nowrap shrink-0">Global Client Directory</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {clients.map((c) => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl hover:shadow-[0_0_30px_rgba(59,130,246,0.05)] transition-all">
            <div className="flex items-center space-x-5 mb-8">
              <div className="p-4 bg-navy rounded-2xl"><User className="w-8 h-8 text-primary" /></div>
              <div>
                <h3 className="text-white font-bold tracking-tight uppercase">{c.firstName} {c.lastName}</h3>
                <p className="text-slate-500 text-xs font-mono lowercase tracking-tighter">member_id_{c.id.slice(0, 8)}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
               <div className="flex items-center space-x-3 text-slate-400 text-xs"><Mail className="w-4 h-4 text-primary" /><span>{c.email}</span></div>
               <div className="flex items-center space-x-3 text-slate-400 text-xs"><Calendar className="w-4 h-4 text-primary" /><span>Joined {new Date(c.createdAt).toLocaleDateString()}</span></div>
            </div>

            <div className="flex items-center space-x-2 text-[10px] uppercase font-black text-slate-600 bg-slate-950 p-3 rounded-xl border border-slate-800">
               <ShieldCheck className="w-3 h-3 text-green-500" />
               <span>Authenticated Enterprise Member</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientList;
