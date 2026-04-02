import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Lock, User, Save, Bell } from 'lucide-react';

const ClientSettings = () => {
   const { user } = useAuth();
   const [formData, setFormData] = useState({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      password: '',
      confirmPassword: '',
      notifications: true
   });

   return (
      <div className="max-w-4xl mx-auto space-y-12">
         <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-center relative overflow-hidden group">
               <User className="w-10 h-10 text-primary transition-all group-hover:scale-110" />
               <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-[10px] uppercase font-bold text-white cursor-pointer select-none">Edit</div>
            </div>
            <div>
               <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tighter uppercase">{user?.firstName} {user?.lastName}</h1>
               <div className="flex items-center space-x-2 text-slate-500 text-xs tracking-widest uppercase font-bold"><Shield className="w-3 h-3" /><span>Workspace_Member_ID_{user?.id.slice(0, 8)}</span></div>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Account Settings */}
            <form className="bg-slate-900 border border-slate-800 p-10 rounded-3xl shadow-2xl space-y-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-900 to-slate-900">
               <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-4">Credentials & Bio</h3>
               
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2 block">First Name</label>
                    <input type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} className="w-full bg-navy border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2 block">Last Name</label>
                    <input type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} className="w-full bg-navy border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm" />
                  </div>
               </div>

               <div>
                 <label className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2 block">Email Profile</label>
                 <div className="relative">
                   <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                   <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-navy border border-slate-700 p-3 pl-12 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm" />
                 </div>
               </div>

               <div>
                 <label className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2 block">Change Secure Key (Password)</label>
                 <div className="relative">
                   <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                   <input type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-navy border border-slate-700 p-3 pl-12 rounded-xl text-white outline-none focus:border-primary transition-colors text-sm" />
                 </div>
               </div>

               <button className="btn-primary w-full py-4 uppercase font-bold tracking-widest text-sm flex items-center justify-center space-x-3 group">
                  <Save className="w-4 h-4 transition-transform group-hover:scale-125" />
                  <span>Update Profile</span>
               </button>
            </form>

            {/* Notification & Security Settings */}
            <div className="space-y-8">
               <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl shadow-xl">
                  <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-6 flex items-center space-x-3">
                    <Bell className="w-4 h-4 text-primary" />
                    <span>Notification Engine</span>
                  </h3>
                   <div className="flex items-center justify-between p-4 bg-navy border border-slate-700 rounded-2xl group cursor-pointer transition-all hover:border-primary" onClick={() => setFormData({...formData, notifications: !formData.notifications})}>
                      <div>
                        <div className="text-white text-xs font-bold uppercase mb-1">Pipeline Alerts</div>
                        <div className="text-slate-500 text-[10px] uppercase tracking-widest">Get emails on project status changes.</div>
                      </div>
                      <div className={`w-12 h-6 rounded-full p-1 transition-all ${formData.notifications ? 'bg-primary' : 'bg-slate-700'}`}>
                         <div className={`w-4 h-4 bg-white rounded-full transition-all ${formData.notifications ? 'translate-x-6' : 'translate-x-0'}`} />
                      </div>
                   </div>
               </div>

               <div className="bg-slate-900 border border-slate-800 p-10 rounded-3xl shadow-xl">
                  <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-6 flex items-center space-x-3">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>Security Vault</span>
                  </h3>
                   <p className="text-slate-500 text-xs mb-8">Access to your workspace is secured via biometric-equivalent JWT authentication tokens stored in specialized httpOnly cookies.</p>
                   <button className="text-white text-xs bg-slate-800 hover:bg-red-900/30 hover:text-red-400 p-4 rounded-xl w-full border border-slate-700 hover:border-red-500/50 transition-all uppercase tracking-widest font-black">Revoke All Active Sessions</button>
               </div>
            </div>
         </div>
      </div>
   );
};

export default ClientSettings;
