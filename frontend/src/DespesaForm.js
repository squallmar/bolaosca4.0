import React, { useState, useEffect } from 'react';
import api from './services/api';

const FREQUENCIAS = [
  { value: 'diaria',     label: 'Diária' },
  { value: 'semanal',    label: 'Semanal' },
  { value: 'quinzenal',  label: 'Quinzenal' },
  { value: 'mensal',     label: 'Mensal' },
  { value: 'bimestral',  label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral',  label: 'Semestral' },
  { value: 'anual',      label: 'Anual' },
];

function DespesaForm({ despesa, onSave, onCancel }) {
  const editando = !!despesa?.id;

  const [descricao, setDescricao]     = useState(despesa?.descricao || '');
  const [valor,     setValor]         = useState(despesa?.valor != null ? String(despesa.valor) : '');
  const [data,      setData]          = useState(despesa?.data ? despesa.data.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [recorrente, setRecorrente]   = useState(despesa?.recorrente === true || despesa?.recorrente === 'true');
  const [frequencia,  setFrequencia]  = useState(despesa?.frequencia || 'mensal');
  const [erro,      setErro]          = useState('');
  const [salvando,  setSalvando]      = useState(false);

  // Quando o item muda (edição) sincroniza campos
  useEffect(() => {
    if (despesa) {
      setDescricao(despesa.descricao || '');
      setValor(despesa.valor != null ? String(despesa.valor) : '');
      setData(despesa.data ? despesa.data.slice(0, 10) : new Date().toISOString().slice(0, 10));
      setRecorrente(despesa.recorrente === true || despesa.recorrente === 'true');
      setFrequencia(despesa.frequencia || 'mensal');
    }
  }, [despesa]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');

    if (!descricao.trim()) { setErro('Informe a descrição.'); return; }
    const valorNum = parseFloat(valor.replace(',', '.'));
    if (isNaN(valorNum) || valorNum < 0) { setErro('Valor inválido.'); return; }
    if (!data) { setErro('Informe a data.'); return; }
    if (recorrente && !frequencia) { setErro('Selecione a frequência.'); return; }

    const payload = {
      descricao: descricao.trim(),
      valor: valorNum,
      data,
      recorrente,
      frequencia: recorrente ? frequencia : null,
    };

    setSalvando(true);
    try {
      let res;
      if (editando) {
        res = await api.put(`/despesas/${despesa.id}`, payload);
      } else {
        res = await api.post('/despesas', payload);
      }
      onSave && onSave(res.data);
    } catch (err) {
      setErro(err?.response?.data?.erro || 'Erro ao salvar despesa.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
      <h3 style={{ margin: 0 }}>{editando ? 'Editar Despesa' : 'Nova Despesa'}</h3>

      {erro && (
        <div style={{ color: '#c0392b', background: '#fdecea', padding: '8px 12px', borderRadius: 6, border: '1px solid #f5c6cb' }}>
          {erro}
        </div>
      )}

      <label>
        <span style={{ fontWeight: 600 }}>Descrição *</span>
        <input
          type="text"
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          maxLength={255}
          required
          style={{ display: 'block', width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4, boxSizing: 'border-box' }}
        />
      </label>

      <label>
        <span style={{ fontWeight: 600 }}>Valor (R$) *</span>
        <input
          type="number"
          value={valor}
          onChange={e => setValor(e.target.value)}
          min="0"
          step="0.01"
          required
          style={{ display: 'block', width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4, boxSizing: 'border-box' }}
        />
      </label>

      <label>
        <span style={{ fontWeight: 600 }}>Data *</span>
        <input
          type="date"
          value={data}
          onChange={e => setData(e.target.value)}
          required
          style={{ display: 'block', width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4, boxSizing: 'border-box' }}
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={recorrente}
          onChange={e => setRecorrente(e.target.checked)}
          style={{ width: 18, height: 18 }}
        />
        <span style={{ fontWeight: 600 }}>Despesa recorrente</span>
      </label>

      {recorrente && (
        <label>
          <span style={{ fontWeight: 600 }}>Frequência *</span>
          <select
            value={frequencia}
            onChange={e => setFrequencia(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4, boxSizing: 'border-box' }}
          >
            {FREQUENCIAS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          type="submit"
          disabled={salvando}
          style={{ flex: 1, padding: '10px 0', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 15, cursor: salvando ? 'not-allowed' : 'pointer' }}
        >
          {salvando ? 'Salvando…' : editando ? 'Salvar Alterações' : 'Adicionar Despesa'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ flex: 1, padding: '10px 0', background: '#eee', color: '#333', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export default DespesaForm;
