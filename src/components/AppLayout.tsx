import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  X,
  Menu,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { menuItems } from '../app/navigation';

export default function AppLayout() {
  const { profile, roleName, signOut, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const visibleMenuItems = useMemo(() => {
  return menuItems.filter((item) => {
    if (!item.requiredPermission) {
      return true;
    }

    return hasPermission(item.requiredPermission);
  });
 }, [hasPermission]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <header className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-50 print:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">N</span>
          </div>
          <span className="font-bold text-gray-900">Nord Finanças</span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[60] w-64 bg-white border-r transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 print:hidden',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-3 px-6 py-8 border-b">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <span className="text-white font-bold text-2xl">N</span>
            </div>

            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">Nord Finanças</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gestão Odonto</p>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden ml-auto p-2 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {visibleMenuItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/dashboard' && location.pathname.startsWith(`${item.path}`));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <item.icon
                    size={20}
                    className={cn(
                      'transition-colors',
                      isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight size={16} className="text-blue-400" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t bg-gray-50/50">
            <div className="flex items-center gap-3 px-2 py-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border-2 border-white shadow-sm">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {profile?.full_name || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500">{roleName || 'Sem cargo definido'}</p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              <LogOut size={20} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        <header className="hidden md:flex h-16 bg-white border-b items-center justify-between px-8 shrink-0 print:hidden">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Nord Finanças</span>
            <ChevronRight size={14} />
            <span className="font-medium text-gray-900 capitalize">
              {visibleMenuItems.find((item) => location.pathname.startsWith(item.path))?.label || 'Início'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
              <p className="text-xs text-gray-500">{roleName || 'Sem cargo definido'}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[55] md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}