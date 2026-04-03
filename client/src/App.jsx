import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import PublicLayout from './layouts/PublicLayout';
import Home from './pages/Home';
import Services from './pages/Services';
import About from './pages/About';
import Contact from './pages/Contact';
import RequestProject from './pages/RequestProject';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import ClientDashboard from './pages/ClientDashboard';
import ProjectDetail from './pages/ProjectDetail';
import ClientSettings from './pages/ClientSettings';
import AutoAnnotate from './pages/AutoAnnotate';

import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import RequestInbox from './pages/admin/RequestInbox';
import ProjectManagement from './pages/admin/ProjectManagement';
import ClientList from './pages/admin/ClientList';

function App() {
  console.log('App: Rendering Routes');
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/request" element={<RequestProject />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Route>

          {/* Protected Client Routes */}
          <Route element={<ProtectedRoute allowedRoles={['client', 'admin']} />}>
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<ClientDashboard />} />
              <Route path="project/:id" element={<ProjectDetail />} />
              <Route path="settings" element={<ClientSettings />} />
              <Route path="auto-annotate" element={<AutoAnnotate />} />
            </Route>
          </Route>

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="inbox" element={<RequestInbox />} />
              <Route path="projects" element={<ProjectManagement />} />
              <Route path="clients" element={<ClientList />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
