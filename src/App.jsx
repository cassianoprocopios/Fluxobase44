import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { ConciliationProvider } from '@/lib/ConciliationContext';

import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Dashboard from '@/pages/Dashboard';
import Lancamentos from '@/pages/Lancamentos';
import DRE from '@/pages/DRE';
import FluxoCaixa from '@/pages/FluxoCaixa';
import Relatorios from '@/pages/Relatorios';
import Configuracoes from '@/pages/Configuracoes';
import Importar from '@/pages/Importar';
import Recorrentes from '@/pages/Recorrentes';
import Conciliacao from '@/pages/Conciliacao';
import RegrasCategorizacao from '@/pages/RegrasCategorizacao';
import DashboardUnidades from '@/pages/DashboardUnidades';
import Usuarios from '@/pages/Usuarios';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lancamentos" element={<Lancamentos />} />
        <Route path="/dashboard-unidades" element={<ProtectedRoute><DashboardUnidades /></ProtectedRoute>} />
        <Route path="/dre" element={<ProtectedRoute><DRE /></ProtectedRoute>} />
        <Route path="/fluxo-caixa" element={<ProtectedRoute><FluxoCaixa /></ProtectedRoute>} />
        <Route path="/relatorios" element={<ProtectedRoute><Relatorios /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
        <Route path="/importar" element={<ProtectedRoute><Importar /></ProtectedRoute>} />
        <Route path="/recorrentes" element={<ProtectedRoute><Recorrentes /></ProtectedRoute>} />
        <Route path="/conciliacao" element={<ProtectedRoute><Conciliacao /></ProtectedRoute>} />
        <Route path="/regras-categorizacao" element={<ProtectedRoute><RegrasCategorizacao /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ConciliationProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
        </ConciliationProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App