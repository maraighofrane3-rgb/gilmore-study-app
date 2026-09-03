import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FocusTimerProvider } from './context/FocusTimerContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// ⚡ Imports immédiats (auth flow + layout — critiques au démarrage)
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';

// ⚡ Lazy imports — chaque page devient son propre bundle, chargé à la demande
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Library        = lazy(() => import('./pages/Library'));
const Tasks          = lazy(() => import('./pages/Tasks'));
const TaskDay        = lazy(() => import('./pages/TaskDay'));
const Focus          = lazy(() => import('./pages/Focus'));
const Goals          = lazy(() => import('./pages/Goals'));
const Notebook       = lazy(() => import('./pages/Notebook'));
const Profile        = lazy(() => import('./pages/Profile'));
const RabbitHoles    = lazy(() => import('./pages/RabbitHoles'));
const Projects       = lazy(() => import('./pages/Projects'));
const Settings       = lazy(() => import('./pages/Settings'));
const Achievements   = lazy(() => import('./pages/Achievements'));
const StudyMaterials = lazy(() => import('./pages/StudyMaterials'));
const ChapterDetail  = lazy(() => import('./pages/ChapterDetail'));
const History        = lazy(() => import('./pages/History'));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-maple-rust border-t-transparent animate-spin" />
      <p className="font-body italic text-sm text-coffee-cream">Turning the page...</p>
    </div>
  );
}

function App() {
  return (
    <FocusTimerProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

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
              <Route path="tasks/:date" element={<TaskDay />} />
              <Route path="focus" element={<Focus />} />
              <Route path="goals" element={<Goals />} />
              <Route path="notebook" element={<Notebook />} />
              <Route path="profile" element={<Profile />} />
              <Route path="rabbit-holes" element={<RabbitHoles />} />
              <Route path="projects" element={<Projects />} />
              <Route path="settings" element={<Settings />} />
              <Route path="achievements" element={<Achievements />} />
              <Route path="study-materials" element={<StudyMaterials />} />
              <Route path="study-materials/:materialId" element={<StudyMaterials />} />
              <Route path="study-materials/:materialId/chapter/:chapterId" element={<ChapterDetail />} />
              <Route path="history" element={<History />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </FocusTimerProvider>
  );
}

export default App;