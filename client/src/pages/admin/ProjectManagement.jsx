import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Upload, FileCheck, RefreshCw, Layers } from 'lucide-react';

const ProjectManagement = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (projectId, status) => {
    try {
      await api.put(`/projects/${projectId}`, { status });
      setProjects(projects.map(p => p.id === projectId ? { ...p, status } : p));
    } catch (err) {
      alert('Status update failed');
    }
  };

  const handleFileUpload = async (projectId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('deliverable', file);

    try {
      await api.post(`/projects/${projectId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Shipment Delivered To Client');
      fetchProjects(); // Reload for updated deliverables list
    } catch (err) {
      alert('Shipment failure');
    }
  };

  if (loading) return <div className="text-slate-400">Loading master project registry...</div>;

  return (
    <div className="space-y-12">
      <h1 className="text-4xl font-extrabold text-white tracking-tighter uppercase italic">Master Production Pipeline</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
              <tr className="bg-slate-950/50">
                <th className="p-6 text-slate-500 uppercase text-[10px] tracking-widest font-black">Project Description</th>
                <th className="p-6 text-slate-500 uppercase text-[10px] tracking-widest font-black">Client Identity</th>
                <th className="p-6 text-slate-500 uppercase text-[10px] tracking-widest font-black text-center">Pipeline State</th>
                <th className="p-6 text-slate-500 uppercase text-[10px] tracking-widest font-black text-right text-nowrap shrink-0">Deployment Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
               {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                     <td className="p-6">
                        <div className="text-white font-bold text-sm tracking-tight">{p.title}</div>
                        <div className="text-slate-500 text-[10px] font-mono mt-1 italic">{p.deliverables?.length || 0} Assets Loaded</div>
                     </td>
                     <td className="p-6">
                        <div className="text-white text-xs font-bold leading-none">{p.client?.firstName} {p.client?.lastName}</div>
                        <div className="text-slate-500 text-[10px] lowercase tracking-widest mt-1">{p.client?.email}</div>
                     </td>
                     <td className="p-6 text-center">
                        <select 
                           value={p.status}
                           onChange={(e) => handleUpdateStatus(p.id, e.target.value)}
                           className="bg-navy/80 border border-slate-700 text-primary text-[10px] uppercase font-bold py-2 px-4 rounded-lg outline-none focus:border-primary transition-all"
                        >
                           {['Submitted', 'In Review', 'In Progress', 'Delivered', 'Completed'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </td>
                     <td className="p-6 text-right">
                        <div className="flex items-center justify-end space-x-3">
                           <label className="bg-slate-800 hover:bg-white text-white hover:text-navy p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer">
                              <Upload className="w-4 h-4" />
                              <input type="file" className="hidden" onChange={(e) => handleFileUpload(p.id, e)} />
                           </label>
                           <button className="bg-slate-800 hover:bg-blue-900/50 text-slate-400 hover:text-blue-400 p-2 rounded-lg transition-all"><Layers className="w-4 h-4" /></button>
                        </div>
                     </td>
                  </tr>
               ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectManagement;
