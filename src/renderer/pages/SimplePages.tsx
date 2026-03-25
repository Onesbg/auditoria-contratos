import { CrudTablePage } from '@renderer/components/CrudTablePage';

export const VendedoresPage = () => <CrudTablePage title="Vendedores" entity="vendedores" fields={[{ key: 'nome', label: 'Nome' }, { key: 'sigla', label: 'Sigla' }, { key: 'ordemExibicao', label: 'Ordem', type: 'number' }]} />;
export const PerguntasPage = () => <CrudTablePage title="Perguntas" entity="perguntas" fields={[{ key: 'codigo', label: 'Código' }, { key: 'titulo', label: 'Título' }, { key: 'categoria', label: 'Categoria' }, { key: 'ordem', label: 'Ordem', type: 'number' }]} />;
export const TiposErroPage = () => <CrudTablePage title="Tipos de erro" entity="tiposErro" fields={[{ key: 'nome', label: 'Nome' }, { key: 'descricao', label: 'Descrição' }]} />;
export const UsuariosPage = () => <CrudTablePage title="Usuários" entity="usuarios" fields={[{ key: 'nome', label: 'Nome' }, { key: 'email', label: 'Email' }, { key: 'senha', label: 'Senha' }, { key: 'perfil', label: 'Perfil' }]} />;
export const ConfiguracoesPage = () => <div className="card"><h2>Configurações</h2><p>Centralize parâmetros do sistema aqui.</p></div>;
