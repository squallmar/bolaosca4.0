import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './services/api';
import { useAuth } from './authContext';
import AdminSubMenu from './AdminSubMenu';

export default function Regras() {
  const navigate = useNavigate();
  const { tipo } = useAuth() || {};
  const isAdmin = tipo === 'admin';

  const [texto, setTexto] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/regras');
        if (cancelado) return;
        setTexto(data.texto || '');
        setUpdatedAt(data.updatedAt || null);
      } catch (e) {
        if (!cancelado) setErro('Erro ao carregar regras');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1); else navigate('/');
  };

  const abrirEdicao = () => {
    setDraft(texto);
    setSaveMsg(null);
    setEditando(true);
  };

  const salvar = async () => {
    if (!draft.trim()) { setSaveMsg('Texto não pode ficar vazio.'); return; }
    if (draft.length > 20000) { setSaveMsg('Máximo de 20000 caracteres.'); return; }
    setSaving(true);
    setSaveMsg(null);
    try {
      const { data } = await api.put('/regras', { texto: draft });
      setTexto(draft);
      setUpdatedAt(data.updatedAt);
      setSaveMsg('Salvo com sucesso.');
      setTimeout(() => setEditando(false), 800);
    } catch (e) {
      setSaveMsg(e?.response?.data?.erro || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const formattedDate = updatedAt ? new Date(updatedAt).toLocaleString('pt-BR') : null;

  return (
    <>
    {isAdmin && <AdminSubMenu />}
    <div className="home-container" style={{ position: 'relative' }}>
      <div className="hero-section" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <div style={{ width: 90 }} />
  <h2 style={{ color: '#2c3e50', margin: 0 }}>Regras do Bolão</h2>
        {isAdmin ? (
          <button onClick={abrirEdicao} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 600 }}>
            ✏️ Editar
          </button>
        ) : <span style={{ width: 74 }} />}
      </div>

  <div className="feature-card" style={{ maxWidth: 950, margin: '0 auto', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
        {loading && <div>Carregando...</div>}
        {erro && <div style={{ color: 'red' }}>{erro}</div>}
        {!loading && !erro && (() => {
          let headerLine = null;
          let bodyText = texto || '';
          if (bodyText) {
            const lines = bodyText.split(/\r?\n/);
            const firstContentIdx = lines.findIndex(l => l.trim());
            if (firstContentIdx !== -1) {
              const candidate = lines[firstContentIdx].trim();
              if (candidate.toUpperCase() === 'REGULAMENTO BOLÃO SCA 2025') {
                headerLine = candidate;
                bodyText = lines.slice(firstContentIdx + 1).join('\n').replace(/^\n+/, '');
              }
            }
          }
          return (
            <>
              {headerLine && (
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 20, marginBottom: 16 }}>
                  {headerLine}
                </div>
              )}
              <div style={{ fontSize: 15, color: '#2c3e50', textAlign: 'left', whiteSpace: 'pre-wrap' }}>
                {bodyText.trim() || 'Nenhum texto cadastrado.'}
              </div>
              {formattedDate && <div style={{ marginTop: 18, fontSize: 12, color: '#666' }}>Última atualização: {formattedDate}</div>}
            </>
          );
        })()}
      </div>

      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: '#0008', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', width: 'min(1100px, 94%)', maxHeight: '90vh', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px #0005' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1976d2' }}>Editar Regras</h3>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ flex: 1, width: '100%', resize: 'vertical', minHeight: 300, fontFamily: 'monospace', fontSize: 14, padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
              maxLength={20000}
              disabled={saving}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: draft.length > 19000 ? '#d32f2f' : '#555' }}>{draft.length}/20000</span>
              {saveMsg && <span style={{ color: saveMsg.includes('sucesso') ? 'green' : 'red', fontSize: 13 }}>{saveMsg}</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setEditando(false)} disabled={saving} style={{ background: '#999', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={salvar} disabled={saving} style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
  </div>
  </>
  );
}
