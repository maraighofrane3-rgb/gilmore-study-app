import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Feather,
  Clock,
  Target,
  User,
  CheckCircle,
  Home,
  Compass,
  FlaskConical,
  Settings,
  Trophy,
  GraduationCap,
  BarChart3,
  History as HistoryIcon,
  Map, // utilisé pour le bouton Guide
  Download, // 📱 PWA install
  X,        // 📱 PWA install
} from 'lucide-react';
import AutumnLeaves from './AutumnLeaves';
import OnboardingTour from './OnboardingTour';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

// ============================================
// 📱 PWA INSTALL BUTTON (Android / Chrome)
// ============================================
function InstallPwaButton() {
  const { canInstall, install } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <button
      onClick={install}
      className="fixed bottom-24 right-6 z-50 flex items-center gap-2 bg-maple-rust text-page-cream px-5 py-3 rounded-sm shadow-cozy font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all animate-fade-in-up"
      title="Install as app"
    >
      <Download size={16} />
      Install App
    </button>
  );
}

// ============================================
// 📱 iOS INSTALL HINT (Safari / iPhone)
// ============================================
function IosInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true;
    const dismissed = localStorage.getItem('ios-install-dismissed');

    if (isIos && !isStandalone && !dismissed) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-parchment border border-coffee-cream/30 text-library-ink px-5 py-3 rounded-sm shadow-cozy flex items-center gap-3 max-w-xs animate-fade-in-up">
      <div className="flex-1 text-xs font-body leading-relaxed">
        Tap the <strong>Share</strong> button, then{' '}
        <strong>"Add to Home Screen"</strong> to install as an app.
      </div>
      <button
        onClick={() => {
          setShow(false);
          localStorage.setItem('ios-install-dismissed', '1');
        }}
        className="text-coffee-cream hover:text-maple-rust"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ============================================
// MAIN LAYOUT
// ============================================
export default function Layout() {
  const location = useLocation();
  const { user } = useAuth(); // ✅ Récupération de l'utilisateur

  const [showTour, setShowTour] = useState(false);

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Welcome' },
    { to: '/library', icon: BookOpen, label: 'Library' },
    { to: '/study-materials', icon: GraduationCap, label: 'Study Materials' },
    { to: '/tasks', icon: CheckCircle, label: 'Tasks' },
    { to: '/focus', icon: Clock, label: 'Focus' },
    { to: '/notebook', icon: Feather, label: 'Notebook' },
    { to: '/rabbit-holes', icon: Compass, label: 'Rabbit Holes' },
    { to: '/projects', icon: FlaskConical, label: 'The Lab' },
    { to: '/goals', icon: Target, label: 'Goals' },
    { to: '/achievements', icon: Trophy, label: 'Achievements' },
    { to: '/weekly-report', icon: BarChart3, label: 'Weekly Report' },
    { to: '/history', icon: HistoryIcon, label: 'History' }, // ✅ icône distincte
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  // ✅ Vérifie si le tour doit s'afficher (première visite)
  useEffect(() => {
    const checkTour = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      if (data && data.onboarding_completed === false) {
        setShowTour(true);
      }
    };

    checkTour();
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-page-cream">
      <AutumnLeaves />

      {/* Sidebar */}
      <nav className="relative z-50 flex flex-col bg-sidebar-bg text-sidebar-text md:w-72 md:h-screen md:fixed md:left-0 md:top-0 bottom-0 w-full border-t md:border-t-0 md:border-r border-sidebar-text/15">
        <div className="p-8 hidden md:block shrink-0">
          <h1 className="font-display text-3xl font-bold leading-tight text-sidebar-accent">
            Gilmore <span className="italic text-sidebar-text">Academia</span>
          </h1>
          <p className="font-label text-xs uppercase tracking-wider-label text-sidebar-muted mt-3">
            Stars Hollow, Connecticut
          </p>
          <div className="mt-6 h-px w-16 bg-sidebar-accent/50" />
        </div>

        <ul className="flex md:flex-col justify-around md:justify-start md:px-6 md:space-y-2 py-4 md:py-0 overflow-x-auto md:overflow-y-auto scrollbar-hide flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <li key={item.to} className="shrink-0">
                <Link
                  to={item.to}
                  className={`flex flex-col md:flex-row items-center md:space-x-4 p-3 rounded-sm transition-all duration-300 ease-out group relative border-l-4 ${
                    isActive
                      ? 'bg-sidebar-text/10 text-sidebar-text border-maple-rust'
                      : 'text-sidebar-text/70 hover:bg-sidebar-text/5 hover:text-sidebar-text border-transparent hover:border-sidebar-accent/60'
                  }`}
                >
                  <div
                    className={`relative transition-all duration-300 ${
                      isActive
                        ? 'scale-110'
                        : 'group-hover:scale-110 group-hover:-translate-x-1'
                    }`}
                  >
                    <Icon size={20} />
                    {isActive && (
                      <span className="absolute -right-1 -top-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-maple-rust opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-maple-rust" />
                      </span>
                    )}
                  </div>
                  <span className="md:ml-4 mt-1 md:mt-0 font-body text-sm font-medium transition-all duration-300 text-current">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* ✅ Bas de sidebar : Guide + Luke's Diner */}
        <div className="hidden md:block shrink-0 p-6 space-y-3">
          {/* Bouton "Guide" pour rejouer le tour */}
          <button
            onClick={() => setShowTour(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-sm border border-sidebar-accent/30 bg-sidebar-accent/5 hover:bg-sidebar-accent/15 transition-colors text-left"
            title="Replay the guided tour"
          >
            <Map size={16} className="text-sidebar-accent shrink-0" />
            <span className="font-label text-xs uppercase tracking-wider-label text-sidebar-text/80">
              Replay Guide
            </span>
          </button>

          {/* Carte Luke's Diner */}
          <div className="bg-sidebar-text/5 rounded-sm p-4 border border-sidebar-text/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-sidebar-accent/20 rounded-full flex items-center justify-center shrink-0">
                <span className="text-sidebar-accent text-lg">☕</span>
              </div>
              <div>
                <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-sidebar-muted">
                  Luke's Diner
                </p>
                <p className="font-body text-xs text-sidebar-text/70 italic">
                  "Coffee's on. The rest can wait."
                </p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 md:ml-72 p-6 md:p-12 pb-24 md:pb-12 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

      {/* ✅ Le tour s'affiche par-dessus tout quand showTour est vrai */}
      {showTour && <OnboardingTour onClose={() => setShowTour(false)} />}

      {/* 📱 PWA install helpers */}
      <InstallPwaButton />
      <IosInstallHint />
    </div>
  );
}