import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from './services/api';
import { useAuth } from './authContext';

export default function BlogDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const auth = useAuth() || {};

  // Back header removido conforme solicitação

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await api.get(`/blog/${id}`);
        if (mounted) setPost(data);
      } catch (e) {
        if (mounted) setError('Post não encontrado.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const canEdit = auth?.token && (auth?.tipo === 'admin' || String(auth?.id) === String(post?.autor_id));

  const handleDelete = async () => {
    if (!post) return;
    const ok = window.confirm('Tem certeza que deseja excluir este post? Esta ação não pode ser desfeita.');
    if (!ok) return;
    try {
      await api.delete(`/blog/${post.id}`);
      navigate('/blog');
    } catch (e) {
      alert(e?.response?.data?.error || 'Falha ao excluir.');
    }
  };

  return (
    <div className="home-container">
  {/* Header removido */}

      {loading ? (
        <div className="feature-card" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p className="card-description">Carregando...</p>
        </div>
      ) : error ? (
        <div className="feature-card" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p className="card-description" style={{ color: '#F44336' }}>{error}</p>
        </div>
      ) : (
        <div className="feature-card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <h3 className="card-title" style={{ marginBottom: 6 }}>{post.titulo}</h3>
          <p className="card-description" style={{ marginBottom: 12 }}>
            Por {post.autor_nome || 'Usuário'} · {new Date(post.criado_em).toLocaleString()}
          </p>
          <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{post.conteudo}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Link to="/blog" className="card-button" style={{ backgroundColor: '#9E9E9E' }}>Voltar ao Blog</Link>
            {canEdit && (
              <>
                <Link to={`/blog/${post.id}/editar`} className="card-button" style={{ backgroundColor: '#6C63FF' }}>Editar</Link>
                <button onClick={handleDelete} className="card-button" style={{ backgroundColor: '#F44336' }}>Excluir</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
