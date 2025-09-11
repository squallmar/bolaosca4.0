import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from './services/api';

export default function BlogEdit() {
  const { id } = useParams();
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(`/blog/${id}`);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get(`/blog/${id}`);
        if (mounted) {
          setTitulo(data.titulo || '');
          setConteudo(data.conteudo || '');
        }
      } catch (e) {
        if (mounted) setError('Post não encontrado.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!titulo.trim() || !conteudo.trim()) {
      setError('Preencha título e conteúdo.');
      return;
    }
    try {
      setSaving(true);
      await api.put(`/blog/${id}`, { titulo, conteudo });
      navigate(`/blog/${id}`);
    } catch (e) {
      setError(e?.response?.data?.error || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="home-container">
      <div className="hero-section" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={handleBack} className="back-button" style={{ cursor: 'pointer', background: 'transparent', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}>← Voltar</button>
        <h2 style={{ color: '#2c3e50' }}>Editar Post</h2>
        <span style={{ width: 74 }} />
      </div>

      {loading ? (
        <div className="feature-card" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p className="card-description">Carregando...</p>
        </div>
      ) : error ? (
        <div className="feature-card" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p className="card-description" style={{ color: '#F44336' }}>{error}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="feature-card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {error && <div className="error-message" style={{ color: '#F44336', fontWeight: 600 }}>{error}</div>}
            <label>
              <span className="card-description">Título</span>
              <input
                value={titulo}
                onChange={e=>setTitulo(e.target.value)}
                placeholder="Digite um título"
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
              />
            </label>
            <label>
              <span className="card-description">Conteúdo</span>
              <textarea
                value={conteudo}
                onChange={e=>setConteudo(e.target.value)}
                placeholder="Escreva sua mensagem"
                rows={10}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', resize: 'vertical' }}
              />
            </label>
            <button type="submit" className="card-button" style={{ backgroundColor: '#6C63FF', opacity: saving ? 0.8 : 1 }} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
