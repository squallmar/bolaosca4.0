import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from './services/api';
import { useAuth } from './authContext';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const auth = useAuth() || {};

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get('/blog');
        if (mounted) setPosts(Array.isArray(data) ? data : []);
      } catch (e) {
        if (mounted) setError('Não foi possível carregar as postagens.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="home-container">
      <div style={{ marginBottom: 12 }}>
        <Link to="/" style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#f7f7f7', color: '#1976d2', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', boxShadow: '0 2px 8px #1976d222', transition: 'background 0.2s, color 0.2s', fontSize: 17 }} title="Voltar à página principal" aria-label="Voltar">⟵ Voltar</Link>
      </div>
      <div className="hero-section" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: '#2c3e50' }}>Blog da Comunidade</h2>
        {auth?.token && (
          <Link to="/blog/novo" className="card-button" style={{ backgroundColor: '#6C63FF' }}>
            Novo post
          </Link>
        )}
      </div>

      {loading ? (
        <div className="feature-card" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p className="card-description">Carregando...</p>
        </div>
      ) : error ? (
        <div className="feature-card" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p className="card-description" style={{ color: '#F44336' }}>{error}</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="feature-card" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p className="card-description">Ainda não há postagens.</p>
        </div>
      ) : (
        <div className="cards-grid" style={{ gridTemplateColumns: '1fr' }}>
          {posts.map((p) => (
            <div key={p.id} className="feature-card" style={{ textAlign: 'left' }}>
              <h3 className="card-title" style={{ marginBottom: 6 }}>
                <Link to={`/blog/${p.id}`} style={{ textDecoration: 'none', color: '#2c3e50' }}>{p.titulo}</Link>
              </h3>
              <p className="card-description" style={{ marginBottom: 8 }}>
                Por {p.autor_nome || 'Usuário'} · {new Date(p.criado_em).toLocaleString()}
              </p>
              <p style={{ whiteSpace: 'pre-wrap', color: '#333' }}>
                {String(p.conteudo || '').length > 400 ? `${p.conteudo.slice(0, 400)}...` : p.conteudo}
              </p>
              <div style={{ marginTop: 12 }}>
                <Link to={`/blog/${p.id}`} className="card-button" style={{ backgroundColor: '#03A9F4' }}>Ler mais</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
