export type Perfil = 'administrador' | 'auditor' | 'gerente';

export type RespostaTipoUI = 'Conforme' | 'Não conforme' | 'Não foram sequer passados';

export type StatusAuditoriaUI = 'OK' | 'Atenção' | 'Crítico' | 'Reunião com a gerência';

export interface DashboardFilters {
  dataInicial?: string;
  dataFinal?: string;
  mes?: number;
  ano?: number;
  vendedorId?: string;
  auditorId?: string;
  status?: StatusAuditoriaUI;
  contratoComErro?: boolean;
  tipoErroId?: string;
}
