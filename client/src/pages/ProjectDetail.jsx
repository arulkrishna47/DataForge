import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { Download, CheckCircle, Clock, FileText, ChevronRight, Activity } from 'lucide-react';

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await api.get(`/projects`);
        // In a real app, find project by id or specific endpoint
        const found = res.data.find(p => p.id === id) || res.data[0];
        setProject(found);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  if (loading) return <div className="text-slate-400">Fetching project timeline...</div>;
  if (!project) return <div className="text-slate-400">Project blueprint not found.</div>;

  const steps = [
    { name: 'Submitted', status: 'completed' },
    { name: 'In Review', status: project.status === 'Submitted' ? 'current' : 'completed' },
    { name: 'In Progress', status: ['In Progress', 'Delivered', 'Completed'].includes(project.status) ? 'completed' : 'pending' },
    { name: 'Delivered', status: ['Delivered', 'Completed'].includes(project.status) ? 'completed' : 'pending' },
    { name: 'Completed', status: project.status === 'Completed' ? 'completed' : 'pending' },
  ];

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-start">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold text-white mb-4 tracking-tighter uppercase italic">{project.title}</h1>
          <p className="text-slate-400 leading-relaxed text-sm">
            {project.description || 'Comprehensive project brief being finalized by our engineering team.'}
          </p>
        </div>
        <div className="text-right">
           <div className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1">Project ID</div>
           <div className="text-white text-xs font-mono bg-slate-800 py-1 px-3 rounded-md">{project.id.slice(0, 8)}...</div>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="bg-slate-900 border border-slate-800 p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <Activity className="absolute -top-10 -right-10 w-40 h-40 text-primary opacity-5" />
        <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-12">Production Pipeline</h3>
        <div className="grid grid-cols-5 gap-4 relative">
          <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-800 z-0" />
          {steps.map((step, i) => (
             <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${step.status === 'completed' ? 'bg-primary border-primary text-white' : step.status === 'current' ? 'bg-navy border-primary text-primary animate-pulse' : 'bg-navy border-slate-700 text-slate-700'}`}>
                   {step.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className={`mt-4 text-[10px] uppercase font-bold tracking-widest ${step.status === 'completed' || step.status === 'current' ? 'text-white' : 'text-slate-700'}`}>
                   {step.name}
                </div>
             </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Deliverables */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10">
          <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-8 flex items-center space-x-2">
            <Download className="w-4 h-4 text-primary" />
            <span>Project Deliverables</span>
          </h3>
          <div className="space-y-4">
            {project.deliverables && project.deliverables.length > 0 ? project.deliverables.map((d, i) => (
              <a 
                key={i} 
                href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/${d}`} 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center justify-between p-5 bg-slate-950/50 hover:bg-slate-800 border border-slate-800 rounded-2xl transition-all group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-900/20 rounded-xl group-hover:bg-primary transition-all"><FileText className="w-5 h-5 text-primary group-hover:text-white" /></div>
                  <div className="text-xs text-slate-300 font-mono italic">deliverable-{i+1}.zip</div>
                </div>
                <button className="text-slate-500 group-hover:text-white transition-colors"><Download className="w-4 h-4" /></button>
              </a>
            )) : (
              <div className="p-12 text-center bg-slate-950/20 border-2 border-dashed border-slate-800 rounded-3xl">
                 <p className="text-slate-600 text-xs italic">Production in progress. Deliverables will appear here once finalized.</p>
              </div>
            )}
          </div>
        </div>

        {/* Messaging / Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10">
           <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-8">Pipeline Logs</h3>
           <div className="space-y-6">
              {[
                { time: '2h ago', msg: 'System check complete. Finalizing annotations.' },
                { time: '1d ago', msg: 'Batch 4 processing initialized.' },
                { time: '3d ago', msg: 'Infrastructure assigned to project.' }
              ].map((log, i) => (
                <div key={i} className="flex space-x-4">
                   <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                   <div>
                      <div className="text-white text-xs font-bold mb-1 uppercase tracking-tighter">{log.msg}</div>
                      <div className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">{log.time}</div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
