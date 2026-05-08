import { useState, createContext, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  Home,
  Users,
  Database,
  Settings as SettingsIcon,
  Sun,
  Moon,
  PieChart,
  Bell,
  Search,
  Plus,
  Menu,
  X,
  Cloud,
  CloudOff,
  RefreshCw,
  LogOut,
  FileText,
  Download
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import ClientDetails from './components/ClientDetails';
import SectionDetails from './components/SectionDetails';
import PriceMaster from './components/PriceMaster';
import Settings from './components/Settings';
import Reports from './components/Reports';
import Auth from './components/Auth';
import Documents from './components/Documents';

// Supabase
import { supabase } from './utils/supabase';

export const AppContext = createContext();

const INITIAL_DB = {
  clients: [],
  documents: [], // For tracking generated PDFs/Exports
  priceMaster: {
    hardware: [
      { id: '1', name: 'Telescopic Channel', price: 150, unit: 'pair', updatedAt: new Date().toISOString() },
      { id: '2', name: 'Auto Hinge', price: 45, unit: 'pcs', updatedAt: new Date().toISOString() }
    ],
    materials: [
      { id: '3', name: '18mm Plywood (ISP)', price: 75, unit: 'sqft', updatedAt: new Date().toISOString() }
    ]
  },
  settings: {
    darkMode: false,
    currency: '₹'
  }
};

function App() {
  const [session, setSession] = useState(null);
  const [db, setDb] = useState(INITIAL_DB);
  const [syncStatus, setSyncStatus] = useState('local');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const searchInputRef = useRef(null);

  const [isRecovery, setIsRecovery] = useState(false);

  // 1. Auth Listener
  useEffect(() => {
    // Check hash for initial load
    if (window.location.hash && window.location.hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
      setSession(session);
      if (!session) {
        setIsDataLoaded(false);
        setDb(INITIAL_DB);
        setIsRecovery(false); // Reset recovery on sign out
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Initial Load from Supabase (user-specific)
  useEffect(() => {
    if (!session?.user) return;

    async function loadData() {
      setSyncStatus('syncing');
      try {
        const { data, error } = await supabase
          .from('app_state')
          .select('data')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (data && !error) {
          setDb(data.data);
          setSyncStatus('synced');
        } else {
          // Fallback to localStorage if cloud is empty
          const saved = localStorage.getItem(`fs_db_${session.user.id}`);
          if (saved) {
            setDb(JSON.parse(saved));
          } else {
            setDb(INITIAL_DB);
          }
          setSyncStatus('local');
        }
        setIsDataLoaded(true);
      } catch (err) {
        console.error('Initial load error:', err);
        setSyncStatus('error');
      }
    }
    loadData();
  }, [session]);

  // 3. Auto-save to Cloud (user-specific)
  useEffect(() => {
    // ONLY sync if data has been loaded and session exists
    if (!session?.user || !isDataLoaded) return;

    localStorage.setItem(`fs_db_${session.user.id}`, JSON.stringify(db));

    const syncToCloud = async () => {
      setSyncStatus('syncing');
      try {
        const { error } = await supabase
          .from('app_state')
          .upsert({
            user_id: session.user.id,
            data: db,
            updated_at: new Date().toISOString()
          }); // onConflict is default for Primary Key

        if (error) throw error;
        setSyncStatus('synced');
      } catch (err) {
        console.error('Cloud sync error:', err);
        setSyncStatus('error');
      }
    };

    const timeout = setTimeout(syncToCloud, 2000);
    return () => clearTimeout(timeout);
  }, [db, session, isDataLoaded]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', db.settings.darkMode ? 'dark' : 'light');
  }, [db.settings.darkMode]);

  const toggleTheme = () => {
    setDb({
      ...db,
      settings: { ...db.settings, darkMode: !db.settings.darkMode }
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setDb(INITIAL_DB);
  };

  const getSyncIcon = () => {
    switch (syncStatus) {
      case 'syncing': return <RefreshCw size={16} className="animate-spin text-blue-500" />;
      case 'synced': return <Cloud size={16} className="text-green-500" />;
      case 'error': return <CloudOff size={16} className="text-red-500" />;
      default: return <Cloud size={16} className="text-gray-400" />;
    }
  };

  if (!session || isRecovery) {
    return <Auth />;
  }

  return (
    <AppContext.Provider value={{ db, setDb, syncStatus, session }}>
      <Router>
        <div className="app-container">
          <div
            className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          />

          <aside className={`left-sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
            <div className="logo-section">
              <div className="logo-icon">FS</div>
              <div>
                <h1>Fine Space Interior</h1>
                <p>Interior Design Studio</p>
              </div>
            </div>

            <nav className="sidebar-nav">
              <span className="nav-label">Main Menu</span>
              <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={() => setIsSidebarOpen(false)}>
                <Home size={20} />
                <span>Dashboard</span>
              </NavLink>
              <NavLink to="/clients" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={() => setIsSidebarOpen(false)}>
                <Users size={20} />
                <span>Projects</span>
              </NavLink>
              <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={() => setIsSidebarOpen(false)}>
                <PieChart size={20} />
                <span>Analytics</span>
              </NavLink>
              <NavLink to="/documents" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={() => setIsSidebarOpen(false)}>
                <FileText size={20} />
                <span>Documents</span>
              </NavLink>

              <span className="nav-label nav-label-spaced">Administration</span>
              <NavLink to="/master" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={() => setIsSidebarOpen(false)}>
                <Database size={20} />
                <span>Price Master</span>
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={() => setIsSidebarOpen(false)}>
                <SettingsIcon size={20} />
                <span>Settings</span>
              </NavLink>
            </nav>

            <div className="sidebar-footer">
              <button 
                onClick={() => {
                  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `fs_direct_backup_${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }} 
                className="theme-toggle" 
                style={{ color: '#0ea5e9' }}
                title="Download full database backup locally"
              >
                <Download size={20} />
                <span>Direct Local Backup</span>
              </button>
              <button onClick={toggleTheme} className="theme-toggle">
                {db.settings.darkMode ? <Sun size={20} /> : <Moon size={20} />}
                <span>{db.settings.darkMode ? 'Light' : 'Dark'} Mode</span>
              </button>
              <button onClick={handleSignOut} className="theme-toggle" style={{ marginTop: '8px', color: '#ef4444' }}>
                <LogOut size={20} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>

          <main className="center-panel">
            <header className="main-header">
              <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
                <Menu size={20} />
              </button>

              <div className={`search-box ${isSearchVisible ? 'mobile-visible' : ''}`}>
                <Search size={16} className="search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search projects... (Ctrl + K)"
                  onBlur={() => {
                    if (window.innerWidth <= 768) setIsSearchVisible(false);
                  }}
                />
              </div>
              <div className="header-actions">
                <button 
                  className="icon-btn mobile-search-toggle" 
                  onClick={() => {
                    const nextVisible = !isSearchVisible;
                    setIsSearchVisible(nextVisible);
                    if (nextVisible) {
                      setTimeout(() => {
                        if (searchInputRef.current) searchInputRef.current.focus();
                      }, 100);
                    }
                  }}
                >
                  <Search size={18} />
                </button>
                <div className="sync-status-badge" title={`Status: ${syncStatus}`}>
                  {getSyncIcon()}
                  <span>{syncStatus}</span>
                </div>
                <button className="icon-btn" title="Notifications">
                  <Bell size={18} />
                  <span className="badge" />
                </button>
                <div className="user-profile">
                  <div className="avatar">
                    {session.user.email[0].toUpperCase()}
                  </div>
                  <div className="user-info">
                    <span className="name">{session.user.email.split('@')[0]}</span>
                    <span className="role">Verified Professional</span>
                  </div>
                </div>
              </div>
            </header>

            <div className="content-area">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/clients/:clientId" element={<ClientDetails />} />
                <Route path="/clients/:clientId/section/:sectionId" element={<SectionDetails />} />
                <Route path="/master" element={<PriceMaster />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </AppContext.Provider>
  );
}

export default App;
