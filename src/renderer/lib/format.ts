export const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR');
export const statusLabel = (s: string) => ({ OK: 'OK', Atencao: 'Atenção', Critico: 'Crítico', Reuniao_com_a_gerencia: 'Reunião com a gerência' }[s] ?? s);
