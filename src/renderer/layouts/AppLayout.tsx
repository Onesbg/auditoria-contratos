import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@renderer/hooks/useAuthStore';

const links = [
  ['/', 'Dashboard geral'],
  ['/auditorias/nova', 'Nova auditoria'],
  ['/auditorias', 'Lista de auditorias'],
  ['/vendedores', 'Vendedores'],
  ['/perguntas', 'Perguntas'],
  ['/tipos-erro', 'Tipos de erro'],
  ['/usuarios', 'Usuários'],
  ['/configuracoes', 'Configurações']
];

export function AppLayout() {
  const { user, logout } = useAuthStore();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h3>Auditoria Pós-Venda</h3>
        <small>{user?.nome} ({user?.perfil})</small>
        <nav>{links.map(([to, lbl]) => <NavLink key={to} to={to}>{lbl}</NavLink>)}</nav>
        <button onClick={logout}>Sair</button>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
