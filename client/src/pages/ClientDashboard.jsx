import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Clock, CheckCircle, FileText, ChevronRight } from 'lucide-react';

const ClientDashboard = () => {
  const [data, setData] = useState({
    projects: [],
    requests: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, requestsRes] = await Promise.all([
          api.get('/projects'),
          api.get('/services')
        ]);
        setData({
          projects: projectsRes.data,
          requests: requestsRes.data
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Accepted':
      case 'Completed': return <span className="bg-green-900/30 text-green-400 text-[10px] uppercase font-bold py-1 px-3 rounded-full border border-green-500/50 flex flex-nowrap shrink-0">{status}</span>;
      case 'Delivered': return <span className="bg-blue-900/30 text-blue-400 text-[10px] uppercase font-bold py-1 px-3 rounded-full border border-blue-500/50 flex flex-nowrap shrink-0">{status}</span>;
      case 'In Progress': return <span className="bg-amber-900/30 text-amber-400 text-[10px] uppercase font-bold py-1 px-3 rounded-full border border-amber-500/50 flex flex-nowrap shrink-0">{status}</span>;
      case 'Declined': return <span className="bg-red-900/30 text-red-400 text-[10px] uppercase font-bold py-1 px-3 rounded-full border border-red-500/50 flex flex-nowrap shrink-0">{status}</span>;
      default: return <span className="bg-slate-800 text-slate-400 text-[10px] uppercase font-bold py-1 px-3 rounded-full border border-slate-600 flex flex-nowrap shrink-0">{status}</span>;
    }
  };

  if (loading) return <div className="text-slate-400">Synchronizing workspace...</div>;

  const totalActive = data.projects.filter(p => !['Completed', 'Delivered'].includes(p.status)).length;
  const totalRequests = data.requests.length;
  const totalReady = data.projects.filter(p => p.status === 'Delivered').length;

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Active Projects', val: totalActive, icon: Clock, color: 'text-[#C17BFF]' },
          { label: 'Files Ready', val: totalReady, icon: CheckCircle, color: 'text-blue-500' },
          { label: 'Request History', val: totalRequests, icon: FileText, color: 'text-slate-500' }
        ].map((item, i) => (
          <div key={i} className="bg-slate-900 border border-white/5 p-8 rounded-3xl shadow-xl flex items-center justify-between">
            <div>
              <div className="text-slate-500 text-xs uppercase tracking-widest mb-2 font-bold">{item.label}</div>
              <div className="text-4xl font-extrabold text-white">{item.val}</div>
            </div>
            <item.icon className={`w-12 h-12 ${item.color} opacity-20`} />
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="text-white font-bold uppercase tracking-widest text-sm">Action Stream & History</h3>
             <Link to="/request" className="text-[#C17BFF] text-xs hover:underline uppercase tracking-widest font-bold">Submit New Request</Link>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/20">
                <th className="p-6 text-slate-500 uppercase text-[10px] tracking-[0.2em] font-black">Project / Service type</th>
                <th className="p-6 text-slate-500 uppercase text-[10px] tracking-[0.2em] font-black">Timestamp</th>
                <th className="p-6 text-slate-500 uppercase text-[10px] tracking-[0.2em] font-black">Status</th>
                <th className="p-6 text-slate-500 uppercase text-[10px] tracking-[0.2em] font-black text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {/* Combine projects and requests for a full view */}
              {[...data.requests, ...data.projects]
                .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-6">
                    <div className="text-white font-bold text-sm tracking-tight">
                      {item.serviceType || item.title}
                    </div>
                    <div className="text-slate-500 text-[10px] mt-1 truncate max-w-xs uppercase tracking-widest font-bold">
                       {item.scope ? item.scope : `Active Production Pipeline | ${item.deliverables?.length || 0} Assets`}
                    </div>
                  </td>
                  <td className="p-6 text-slate-400 text-xs font-mono">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-6">{getStatusBadge(item.status)}</td>
                  <td className="p-6 text-right">
                    <Link 
                      to={item.scope ? `/dashboard` : `/dashboard/project/${item.id}`}
                      className="text-white bg-white/5 hover:bg-[#C17BFF] p-2 rounded-lg transition-all inline-flex items-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {data.requests.length === 0 && data.projects.length === 0 && (
                <tr>
                   <td colSpan="4" className="p-12 text-center text-slate-500 italic text-sm font-medium">No activity found. Initiate your first service request to begin.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
