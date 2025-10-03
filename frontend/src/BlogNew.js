import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './services/api';

export default function BlogNew() {
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/blog');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!titulo.trim() || !conteudo.trim()) {
      setError('Preencha título e conteúdo.');
      return;
    }
    try {
      setLoading(true);
      await api.post('/blog', { titulo, conteudo });
      navigate('/blog');
    } catch (e) {
      setError(e?.response?.data?.error || 'Falha ao publicar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="hero-section" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={handleBack} className="back-button" style={{ cursor: 'pointer', background: 'transparent', border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}>← Voltar</button>
        <h2 style={{ color: '#2c3e50' }}>Novo Post</h2>
        <span style={{ width: 74 }} />
      </div>

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
          <button type="submit" className="card-button" style={{ backgroundColor: '#6C63FF', opacity: loading ? 0.8 : 1 }} disabled={loading}>
            {loading ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </form>
    </div>
  );
}
