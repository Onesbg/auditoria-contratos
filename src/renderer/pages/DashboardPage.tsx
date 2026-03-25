import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { fmtPct } from '@renderer/lib/format';

export function DashboardPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { window.api.dashboard({}).then(setData); }, []);
  if (!data) return <div>Carregando...</div>;
  return <div className="grid" style={{ gap: 16 }}>
    <h2>Dashboard geral</h2>
    <div className="grid cards">
      <Card t="Total auditorias" v={data.totalAuditorias} /><Card t="Contratos com erro" v={data.contratosComErro} /><Card t="Contratos OK" v={data.contratosOk} />
      <Card t="Taxa erro contrato" v={fmtPct(data.taxaErroContrato)} /><Card t="Taxa erro item" v={fmtPct(data.taxaErroItem)} /><Card t="Aproveitamento" v={fmtPct(data.aproveitamento)} />
      <Card t="Vendedores auditados" v={data.totalVendedoresAuditados} />
    </div>
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <ChartCard title="Auditorias e erros por vendedor"><ResponsiveContainer width="100%" height={250}><BarChart data={data.byVendedor}><XAxis dataKey="vendedor"/><YAxis/><Tooltip/><Bar dataKey="auditorias" fill="#2563eb"/><Bar dataKey="erros" fill="#dc2626"/></BarChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Evolução mensal"><ResponsiveContainer width="100%" height={250}><LineChart data={data.monthly}><XAxis dataKey="periodo"/><YAxis/><Tooltip/><Line dataKey="auditorias" stroke="#2563eb"/><Line dataKey="contratosComErro" stroke="#dc2626"/></LineChart></ResponsiveContainer></ChartCard>
    </div>
    <div className="card"><h3>Top 3 erros</h3>{data.topErros.map((e: any) => <p key={e.nome}>{e.nome}: {e.total}</p>)}</div>
  </div>;
}
const Card = ({ t, v }: any) => <div className="card"><small>{t}</small><h3>{v}</h3></div>;
const ChartCard = ({ title, children }: any) => <div className="card"><h3>{title}</h3>{children}</div>;
