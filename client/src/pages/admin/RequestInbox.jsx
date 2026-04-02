import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { supabase } from '../../utils/supabaseClient';
import { Send, CheckCircle, XCircle, Zap, BellRing } from 'lucide-react';
import { toast } from 'sonner';

const RequestInbox = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await api.get('/services');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // ⚡ Real-Time Subscription
    const channel = supabase
      .channel('service_requests_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', table: 'ServiceRequest', schema: 'public' },
        async (payload) => {
          console.log('New real-time request:', payload);
          toast.success('NEW SERVICE REQUEST RECEIVED!', {
             icon: <BellRing className="text-[#C17BFF]" />,
             description: `A new request for ${payload.new.serviceType} just landed.`
          });
          // Refresh list to get joined client data
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateProject = async (reqId, title, desc, clientId) => {
    if (!window.confirm(`Initialize project '${title}' for production?`)) return;
    try {
      await api.post('/projects', { title, description: desc, clientId });
      await api.put(`/services/${reqId}`, { status: 'Accepted' });
      toast.success('Project Spawned Successfully');
      setRequests(requests.map(r => r.id === reqId ? { ...r, status: 'Accepted' } : r));
    } catch (err) {
      toast.error('Initialization failed');
    }
  }

  const handleDeclineRequest = async (reqId) => {
    if (!window.confirm('Are you sure you want to decline this request?')) return;
    try {
      await api.put(`/services/${reqId}`, { status: 'Declined' });
      toast.info('Request has been declined');
      setRequests(requests.map(r => r.id === reqId ? { ...r, status: 'Declined' } : r));
    } catch (err) {
      toast.error('Decline action failed');
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0B1A]">
      <div className="flex flex-col items-center gap-4">
        <Zap className="w-12 h-12 text-[#C17BFF] animate-pulse" />
        <span className="text-slate-500 uppercase tracking-[0.3em] font-black text-xs">Scanning platform incoming requests...</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold text-white tracking-tighter uppercase italic mb-2">Incoming Projects Inbox</h1>
          <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Manage and initialize production pipelines</p>
        </div>
        <div className="flex items-center gap-2 bg-[#C17BFF]/10 px-4 py-2 rounded-xl border border-[#C17BFF]/20">
          <div className="w-2 h-2 bg-[#C17BFF] rounded-full animate-ping" />
          <span className="text-[#C17BFF] text-[10px] font-black uppercase tracking-widest">Live Monitoring</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50">
                <th className="p-8 text-slate-500 uppercase text-[10px] tracking-widest font-black">Client & Brief</th>
                <th className="p-8 text-slate-500 uppercase text-[10px] tracking-widest font-black text-center">Resources Requested</th>
                <th className="p-8 text-slate-500 uppercase text-[10px] tracking-widest font-black text-center">Status</th>
                <th className="p-8 text-slate-500 uppercase text-[10px] tracking-widest font-black text-right">Admin Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-8">
                    <div className="text-white font-bold text-base tracking-tight mb-1">{req.client?.name || 'Anonymous User'}</div>
                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-4">{req.client?.email}</div>
                    <div className="text-slate-400 text-sm leading-relaxed bg-[#0D0B1A] p-5 rounded-2xl border border-white/5 group-hover:border-[#C17BFF]/20 transition-all">{req.scope}</div>
                  </td>
                  <td className="p-8 text-center">
                    <div className="text-[#C17BFF] text-[10px] font-black uppercase tracking-widest bg-[#C17BFF]/10 px-5 py-2 rounded-xl border border-[#C17BFF]/20 inline-block mb-3">{req.serviceType}</div>
                    <div className="text-slate-400 text-xs font-mono bg-slate-950/50 py-1 px-3 rounded-lg inline-block border border-white/5">{req.budget} | {req.timeline}</div>
                  </td>
                  <td className="p-8 text-center text-sm">
                    <span className={`text-[10px] uppercase font-black tracking-widest py-2 px-5 rounded-xl border-2 ${
                      req.status === 'Accepted' ? 'border-green-500/30 text-green-400 bg-green-500/5' : 
                      req.status === 'Declined' ? 'border-red-500/30 text-red-400 bg-red-500/5' :
                      'border-slate-800 text-slate-500'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="p-8 text-right">
                    {req.status === 'Pending' ? (
                      <div className="flex justify-end space-x-3">
                        <button 
                          onClick={() => handleCreateProject(req.id, req.serviceType, req.scope, req.clientId)}
                          className="bg-green-600 hover:bg-green-500 p-4 rounded-2xl text-white shadow-lg shadow-green-500/20 transition-all transform hover:scale-110"
                          title="Accept & Initialize Project"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeclineRequest(req.id)}
                          className="bg-red-600 hover:bg-red-500 p-4 rounded-2xl text-white shadow-lg shadow-red-500/20 transition-all transform hover:scale-110"
                          title="Decline Request"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ) : req.status === 'Accepted' ? (
                      <div className="flex justify-end">
                        <div className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20">
                          <XCircle className="w-5 h-5 text-red-400" />
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-20 text-center">
                     <Clock className="w-12 h-12 text-slate-700 mx-auto mb-6" />
                     <p className="text-slate-500 uppercase tracking-[0.3em] font-black text-xs">No pending requests in queue</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RequestInbox;
