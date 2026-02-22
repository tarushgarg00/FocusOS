import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Settings, Moon, Sun, LogOut } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS = [
  { to: '/today', label: 'Today' },
  { to: '/goals', label: 'Goals' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/patterns', label: 'Patterns' },
  { to: '/review', label: 'Review' },
];

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card" style={{ height: 56 }}>
      <div className="mx-auto flex h-14 max-w-content items-center justify-between px-8 md:px-8" style={{ paddingLeft: 32, paddingRight: 32 }}>
        <div className="flex items-center gap-8">
          <NavLink to="/today" className="text-lg font-semibold text-foreground hover:text-foreground">
            FocusOS
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative px-3 py-4 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md"
            aria-label="Toggle dark mode"
          >
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
            <Settings size={20} />
          </NavLink>
          {user && (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Sign out"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
