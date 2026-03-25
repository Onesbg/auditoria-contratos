import { StatusAuditoria } from '@prisma/client';

export const respostaToDb = (v: string) => {
  if (v === 'Conforme') return 'Conforme';
  if (v === 'Não conforme') return 'Nao_conforme';
  return 'Nao_foram_sequer_passados';
};

export function calcularStatus(totalNaoConformes: number): StatusAuditoria {
  if (totalNaoConformes === 0) return 'OK';
  if (totalNaoConformes === 1) return 'Atencao';
  if (totalNaoConformes <= 3) return 'Critico';
  return 'Reuniao_com_a_gerencia';
}

export function normalizeStatus(status: string) {
  const map: Record<string, string> = {
    OK: 'OK',
    Atencao: 'Atenção',
    Critico: 'Crítico',
    Reuniao_com_a_gerencia: 'Reunião com a gerência'
  };
  return map[status] ?? status;
}
