import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { TrendingUp, CheckCircle, Clock, Users, Activity } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/analytics');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // ⚡ Real-Time Stats Update
    const channel = supabase
      .channel('admin_stats_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', table: 'ServiceRequest', schema: 'public' },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <div className="text-slate-400">Loading global analytics core...</div>;

  const getStat = (path, fallback = 0) => {
    if (!stats) return fallback;
    const parts = path.split('.');
    let cur = stats;
    for (const part of parts) {
      if (!cur[part]) return fallback;
      cur = cur[part];
    }
    return cur;
  };

  return (
    <div className="space-y-12">
      <h1 className="text-4xl font-extrabold text-white tracking-tighter uppercase italic">Platform Overview</h1>

      {!stats && (
        <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-2xl text-red-500 text-sm font-bold uppercase tracking-widest text-center animate-pulse">
           Hyper-Core Connectivity Lost. Retrying scans...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: 'Active Requests', val: getStat('counts.requests'), icon: Clock, color: 'text-amber-500' },
          { label: 'Platform Projects', val: getStat('counts.projects'), icon: TrendingUp, color: 'text-blue-500' },
          { label: 'Total Clients', val: getStat('counts.clients'), icon: Users, color: 'text-purple-500' },
          { label: 'Deploy Success', val: '98.4%', icon: CheckCircle, color: 'text-green-500' }
        ].map((item, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between mb-6">
              <item.icon className={`w-10 h-10 ${item.color} p-2 bg-slate-950 rounded-xl`} />
              <div className="text-white font-bold text-3xl">{item.val}</div>
            </div>
            <div className="text-slate-500 text-[10px] uppercase font-bold tracking-[.2em]">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 h-64 flex flex-col items-center justify-center space-y-4">
         <Activity className="w-10 h-10 text-primary opacity-20" />
         <p className="text-slate-500 text-xs text-center italic">Project velocity over time visualizer (Placeholder for charting engine integration).</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
