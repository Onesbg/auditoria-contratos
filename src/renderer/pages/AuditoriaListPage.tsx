import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, statusLabel } from '@renderer/lib/format';

export function AuditoriaListPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { window.api.history({}).then(setRows); }, []);

  return <div><h2>Lista de auditorias</h2><table className="table"><thead><tr><th>Data</th><th>Vendedor</th><th>Pasta</th><th>Cliente</th><th>Status</th><th>Erros</th><th>Não conformidades</th><th>PDF</th><th>Detalhe</th></tr></thead>
  <tbody>{rows.map((r) => <tr key={r.id}><td>{fmtDate(r.dataAuditoria)}</td><td>{r.vendedor.nome}</td><td>{r.contrato.numeroPastaBitrix}</td><td>{r.contrato.nomeCliente}</td><td className={`status-${statusLabel(r.statusAuditoria)}`}>{statusLabel(r.statusAuditoria)}</td><td>{r.totalErrosDetectados}</td><td>{r.totalNaoConformes}</td><td>{r.pdfGerado ? 'Gerado' : '-'}</td><td><Link to={`/auditorias/${r.id}`}>Abrir</Link></td></tr>)}</tbody></table></div>;
}
