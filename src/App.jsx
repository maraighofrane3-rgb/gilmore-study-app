// TEST123
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Focus from './pages/Focus';
import Goals from './pages/Goals';
import Library from './pages/Library';
import Notebook from './pages/Notebook';
import Profile from './pages/Profile';
import RabbitHoles from './pages/RabbitHoles';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import ForgotPassword from './pages/ForgotPassword';
import Achievements from './pages/Achievements';
import StudyMaterials from './pages/StudyMaterials';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected App Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="library" element={<Library />} /> 
          <Route path="tasks" element={<Tasks />} />
          <Route path="focus" element={<Focus />} />          
          <Route path="goals" element={<Goals />} />          
          <Route path="notebook" element={<Notebook />} />  
          <Route path="profile" element={<Profile />} />
          <Route path="rabbit-holes" element={<RabbitHoles />} />
          <Route path="projects" element={<Projects />} />
          <Route path="settings" element={<Settings />} />
             <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="study-materials" element={<StudyMaterials />} />
          <Route path="/study-materials/:materialId" element={<StudyMaterials />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;