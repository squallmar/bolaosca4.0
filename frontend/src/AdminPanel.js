import React, { useEffect, useState } from 'react';
import api from './services/api';
import { useNavigate } from 'react-router-dom';
import './AdminPanel.css'; // Mantenha o CSS se existir
import AdminSubMenu from './AdminSubMenu';
import { API_BASE } from './config';

function AdminPanel() {
  const navigate = useNavigate();
  const [pendentes, setPendentes] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchPendentes() {
    try {
      setLoading(true);
  const res = await api.get('/admin/usuarios-pendentes');
      setPendentes(res.data);
      setError('');
    } catch (err) {
      setError('Erro ao buscar usuários pendentes');
      console.error('Erro ao buscar pendentes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function autorizar(id) {
    try {
  await api.post(`/admin/autorizar/${id}`, {});
      setMsg('Usuário autorizado com sucesso!');
      setTimeout(() => setMsg(''), 3000);
      fetchPendentes();
    } catch (err) {
      setError('Erro ao autorizar usuário');
      console.error('Erro ao autorizar:', err);
    }
  }

  useEffect(() => {
    fetchPendentes();
  // ...apenas fetchPendentes...
  }, []);

  // Sanitiza e resolve a URL do avatar para sempre usar o domínio da API
  function getAvatarSrc(user) {
    const raw = user?.avatarUrl || user?.avatar_url || user?.foto_url || '';
    let u = String(raw || '').trim();
    if (!u) return `${API_BASE}/uploads/avatars/avatar_default.jpg`;
    if (u.includes(';')) {
      const parts = u.split(';').map(s => s.trim()).filter(Boolean);
      u = parts[parts.length - 1];
    }
    // Se já é uma URL absoluta, retorna como está
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    // Caso venha um caminho, usamos apenas o filename
    const filename = u.split('/').pop();
    return `${API_BASE}/uploads/avatars/${filename || 'avatar_default.jpg'}`;
  }

  return (
    <>
      <AdminSubMenu />
      <div className="bolao-panel-container">
      <div className="bolao-panel-header">
        <h1>Painel de Administração</h1>
        <p>Gerencie usuários, campeonatos, rodadas e partidas</p>
      </div>

      <div className="bolao-panel-content">
        {/* Usuários pendentes */}
        <div className="bolao-panel-card">
          <div className="bolao-panel-card-header">
            <h2>Usuários Pendentes de Autorização</h2>
            <button 
              onClick={fetchPendentes} 
              className="bolao-panel-refresh-btn"
              title="Atualizar lista"
            >
              🔄
            </button>
          </div>
          {loading ? (
            <div className="bolao-panel-loading">
              <div className="bolao-panel-spinner"></div>
              <p>Carregando usuários...</p>
            </div>
          ) : error ? (
            <div className="bolao-panel-error-message">
              <span>❌</span>
              <p>{error}</p>
              <button onClick={fetchPendentes} className="bolao-panel-retry-btn">
                Tentar Novamente
              </button>
            </div>
          ) : pendentes.length === 0 ? (
            <div className="bolao-panel-empty-state">
              <div className="bolao-panel-empty-icon">🎉</div>
              <h3>Nenhum usuário pendente</h3>
              <p>Todos os usuários estão devidamente autorizados</p>
            </div>
          ) : (
            <div className="bolao-panel-users-list">
              {pendentes.map(u => (
                <div key={u.id} className="bolao-panel-user-card">
                  <div className="bolao-panel-user-info">
                    <div className="bolao-panel-user-avatar">
                      <img
                        src={getAvatarSrc(u)}
                        alt={u.nome}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        onError={(e) => {
                          // Fallback sólido para o default do backend
                          if (!e.currentTarget.dataset.fallback) {
                            e.currentTarget.dataset.fallback = '1';
                            e.currentTarget.src = `${API_BASE}/uploads/avatars/avatar_default.jpg`;
                          } else {
                            // Se até o fallback falhar, mostra a inicial
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentNode.textContent = (u.nome || '?').charAt(0).toUpperCase();
                          }
                        }}
                      />
                    </div>
                    <div className="bolao-panel-user-details" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div>
                        <h4 style={{ margin: 0 }}>{u.nome}</h4>
                        <p style={{ margin: 0 }}>{u.email}</p>
                        <span className={`bolao-panel-user-type bolao-panel-${u.tipo}`}>{u.tipo === 'admin' ? 'Administrador' : 'Usuário'}</span>
                      </div>
                      <button 
                        onClick={() => autorizar(u.id)} 
                        className="bolao-panel-authorize-btn"
                        title="Autorizar usuário"
                        style={{ marginLeft: 'auto' }}
                      >
                        ✅ Autorizar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Estatísticas */}
        <div className="admin-stats">
          <div className="stat-card" onClick={() => navigate('/admin/usuarios')} style={{ cursor: 'pointer' }}>
            <div className="stat-icon">📋</div>
            <div className="stat-info">
              <h3>Lista de Usuários</h3>
              <p>Gerenciar (editar, excluir, banir)</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-info">
              <h3>{pendentes.length}</h3>
              <p>Pendentes</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <h3>0</h3>
              <p>Autorizados</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👑</div>
            <div className="stat-info">
              <h3>{pendentes.filter(u => u.tipo === 'admin').length}</h3>
              <p>Administradores</p>
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div className="success-message">
          <span>✅</span>
          <p>{msg}</p>
        </div>
      )}
      </div>
    </>
  );
}

export default AdminPanel;