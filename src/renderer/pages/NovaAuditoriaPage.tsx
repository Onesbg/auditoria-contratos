import { useEffect, useState } from 'react';
import { useAuthStore } from '@renderer/hooks/useAuthStore';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';

export function NovaAuditoriaPage() {
  const user = useAuthStore((s) => s.user);
  const [contratos, setContratos] = useState<any[]>([]);
  const [perguntas, setPerguntas] = useState<any[]>([]);
  const [tiposErro, setTiposErro] = useState<any[]>([]);
  const { register, handleSubmit } = useForm<any>();

  useEffect(() => { window.api.list('contratos').then(setContratos); window.api.list('perguntas').then(setPerguntas); window.api.list('tiposErro').then(setTiposErro); }, []);

  return <form className="grid" onSubmit={handleSubmit(async (v) => {
    const contrato = contratos.find((c) => c.id === v.contratoId);
    const respostas = perguntas.map((p) => ({ perguntaId: p.id, respostaTipo: v[`resp_${p.id}`], observacao: v[`obs_${p.id}`] }));
    const errosDetectados = (v.tipoErroId ? [v.tipoErroId] : []).map((id: string) => ({ tipoErroId: id, descricaoLivre: v.descricaoErro }));
    await window.api.createAuditoria({
      contratoId: v.contratoId,
      auditorId: user.id,
      vendedorId: contrato.vendedorId,
      dataAuditoria: v.dataAuditoria,
      mesReferencia: Number(format(new Date(v.dataAuditoria), 'M')),
      anoReferencia: Number(format(new Date(v.dataAuditoria), 'yyyy')),
      observacoesGerais: v.observacoesGerais,
      respostas,
      errosDetectados
    });
    alert('Auditoria criada!');
  })}>
    <h2>Nova auditoria</h2>
    <div className="card row"><label>Contrato<select {...register('contratoId')}>{contratos.map((c) => <option value={c.id} key={c.id}>{c.numeroPastaBitrix} - {c.nomeCliente}</option>)}</select></label><label>Data<input type="date" {...register('dataAuditoria')} defaultValue={format(new Date(), 'yyyy-MM-dd')} /></label></div>
    <div className="card">{perguntas.map((p) => <div className="row" key={p.id}><label>{p.codigo} - {p.titulo}<select {...register(`resp_${p.id}`)} defaultValue="Conforme"><option>Conforme</option><option>Não conforme</option><option>Não foram sequer passados</option></select></label><label>Observação<textarea {...register(`obs_${p.id}`)} /></label></div>)}</div>
    <div className="card row"><label>Tipo de erro<select {...register('tipoErroId')}><option value="">Sem erro adicional</option>{tiposErro.map((t) => <option value={t.id} key={t.id}>{t.nome}</option>)}</select></label><label>Descrição erro<textarea {...register('descricaoErro')} /></label></div>
    <label>Observações gerais<textarea {...register('observacoesGerais')} /></label>
    <button type="submit">Salvar auditoria</button>
  </form>;
}
