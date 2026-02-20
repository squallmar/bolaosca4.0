import React, { useEffect, useState, useCallback } from 'react';
import api from './services/api';
import DespesaForm from './DespesaForm';

const FREQUENCIA_LABEL = {
  diaria:     'Diária',
  semanal:    'Semanal',
  quinzenal:  'Quinzenal',
  mensal:     'Mensal',
  bimestral:  'Bimestral',
  trimestral: 'Trimestral',
  semestral:  'Semestral',
  anual:      'Anual',
};

function formatarMoeda(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data) {
  if (!data) return '';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function Despesas() {
  const [items,     setItems]     = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [erro,      setErro]      = useState('');
  const [exibirForm, setExibirForm] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const pageSize = 20;

  const carregar = useCallback(async (p = 1) => {
    setCarregando(true);
    setErro('');
    try {
      const res = await api.get('/despesas', { params: { page: p, pageSize } });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setPage(p);
    } catch (err) {
      setErro(err?.response?.data?.erro || 'Erro ao carregar despesas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(1); }, [carregar]);

  function handleSalvo(despesa) {
    setExibirForm(false);
    setEditando(null);
    carregar(page);
  }

  function handleEditar(item) {
    setEditando(item);
    setExibirForm(true);
  }

  function handleNova() {
    setEditando(null);
    setExibirForm(true);
  }

  async function handleExcluir(id) {
    try {
      await api.delete(`/despesas/${id}`);
      setConfirmId(null);
      carregar(page);
    } catch (err) {
      setErro(err?.response?.data?.erro || 'Erro ao excluir despesa.');
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div style={{ padding: '24px 16px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: '#1976d2' }}>💰 Despesas</h2>
        {!exibirForm && (
          <button
            onClick={handleNova}
            style={{ padding: '10px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            + Nova Despesa
          </button>
        )}
      </div>

      {erro && (
        <div style={{ color: '#c0392b', background: '#fdecea', padding: '10px 14px', borderRadius: 6, marginBottom: 16, border: '1px solid #f5c6cb' }}>
          {erro}
        </div>
      )}

      {exibirForm && (
        <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px #1976d222', border: '1px solid #e3eaf5' }}>
          <DespesaForm
            despesa={editando}
            onSave={handleSalvo}
            onCancel={() => { setExibirForm(false); setEditando(null); }}
          />
        </div>
      )}

      {carregando ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Carregando…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <p>Nenhuma despesa cadastrada.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => (
              <div key={item.id} style={{ background: '#fff', border: '1px solid #e3eaf5', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 4px #1976d211', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{item.descricao}</div>
                  <div style={{ color: '#555', fontSize: 13, marginTop: 2 }}>
                    📅 {formatarData(item.data)}
                    {item.usuario_nome && <span> · 👤 {item.usuario_nome}</span>}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#c0392b', minWidth: 100, textAlign: 'right' }}>
                  {formatarMoeda(item.valor)}
                </div>
                <div style={{ minWidth: 140, textAlign: 'center' }}>
                  {item.recorrente ? (
                    <span style={{ background: '#e3f0ff', color: '#1976d2', borderRadius: 20, padding: '4px 12px', fontWeight: 600, fontSize: 13 }}>
                      🔄 {FREQUENCIA_LABEL[item.frequencia] || item.frequencia || 'Recorrente'}
                    </span>
                  ) : (
                    <span style={{ background: '#f5f5f5', color: '#888', borderRadius: 20, padding: '4px 12px', fontSize: 13 }}>
                      Única
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleEditar(item)}
                    title="Editar"
                    style={{ padding: '6px 12px', background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  >
                    ✏️
                  </button>
                  {confirmId === item.id ? (
                    <>
                      <button
                        onClick={() => handleExcluir(item.id)}
                        style={{ padding: '6px 12px', background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        style={{ padding: '6px 12px', background: '#eee', color: '#333', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmId(item.id)}
                      title="Excluir"
                      style={{ padding: '6px 12px', background: '#fdecea', color: '#c0392b', border: '1px solid #f5c6cb', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
              <button
                disabled={page <= 1}
                onClick={() => carregar(page - 1)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: page <= 1 ? '#f5f5f5' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                ← Anterior
              </button>
              <span style={{ padding: '8px 0', color: '#555' }}>
                Página {page} de {totalPages} {'\u00A0'}|{'\u00A0'} {total} despesa{total !== 1 ? 's' : ''}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => carregar(page + 1)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: page >= totalPages ? '#f5f5f5' : '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Despesas;
