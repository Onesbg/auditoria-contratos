import { useEffect, useState } from 'react';

export function CrudTablePage({ title, entity, fields }: { title: string; entity: string; fields: { key: string; label: string; type?: string }[] }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});

  async function load() { setItems(await window.api.list(entity)); }
  useEffect(() => { load(); }, [entity]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <h2>{title}</h2>
      <div className="card">
        <div className="row">
          {fields.map((f) => (
            <label key={f.key}>
              {f.label}
              <input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} />
            </label>
          ))}
        </div>
        <button onClick={async () => { await window.api.save(entity, form); setForm({}); load(); }}>Salvar</button>
      </div>
      <table className="table"><thead><tr>{fields.map((f) => <th key={f.key}>{f.label}</th>)}<th>Ações</th></tr></thead>
      <tbody>{items.map((it) => <tr key={it.id}>{fields.map((f) => <td key={f.key}>{String(it[f.key] ?? '')}</td>)}<td><button onClick={() => setForm(it)}>Editar</button> <button onClick={async () => { await window.api.remove(entity, it.id); load(); }}>Excluir</button></td></tr>)}</tbody></table>
    </div>
  );
}
