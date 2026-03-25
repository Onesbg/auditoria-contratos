import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@renderer/hooks/useAuthStore';
import { LoginPage } from './pages/LoginPage';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { NovaAuditoriaPage } from './pages/NovaAuditoriaPage';
import { AuditoriaListPage } from './pages/AuditoriaListPage';
import { AuditoriaDetailPage } from './pages/AuditoriaDetailPage';
import { ConfiguracoesPage, PerguntasPage, TiposErroPage, UsuariosPage, VendedoresPage } from './pages/SimplePages';

export function App() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <LoginPage />;

  return <Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/auditorias/nova" element={<NovaAuditoriaPage />} />
      <Route path="/auditorias" element={<AuditoriaListPage />} />
      <Route path="/auditorias/:id" element={<AuditoriaDetailPage />} />
      <Route path="/vendedores" element={<VendedoresPage />} />
      <Route path="/perguntas" element={<PerguntasPage />} />
      <Route path="/tipos-erro" element={<TiposErroPage />} />
      <Route path="/usuarios" element={<UsuariosPage />} />
      <Route path="/configuracoes" element={<ConfiguracoesPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>;
}
