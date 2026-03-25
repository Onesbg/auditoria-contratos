import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { statusLabel } from '@renderer/lib/format';

export function AuditoriaDetailPage() {
  const { id = '' } = useParams();
  const [row, setRow] = useState<any>();
  useEffect(() => { window.api.getAuditoria(id).then(setRow); }, [id]);
  if (!row) return <div>Carregando...</div>;
  return <div className="grid" style={{ gap: 12 }}><h2>Detalhe da auditoria</h2>
    <div className="card"><p><b>Cliente:</b> {row.contrato.nomeCliente}</p><p><b>Status:</b> {statusLabel(row.statusAuditoria)}</p><p><b>Não conformidades:</b> {row.totalNaoConformes}</p></div>
    <div className="card"><h3>Respostas</h3>{row.respostas.map((r: any) => <p key={r.id}><b>{r.pergunta.codigo}</b> - {r.respostaTipo.replaceAll('_', ' ')}</p>)}</div>
    <div className="card"><h3>Evidências</h3>{row.evidencias.map((e: any) => <p key={e.id}>{e.nomeArquivo}</p>)}<button onClick={async () => { await window.api.uploadEvidencia({ auditoriaId: id }); setRow(await window.api.getAuditoria(id)); }}>Adicionar evidência</button></div>
    <button onClick={async () => { await window.api.generatePdf(id); setRow(await window.api.getAuditoria(id)); }}>Gerar PDF</button>
    {row.pdfGerado && <small>PDF: {row.pdfGerado.caminhoArquivo}</small>}
  </div>;
}
