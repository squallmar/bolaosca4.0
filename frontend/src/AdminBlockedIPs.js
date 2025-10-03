import React, { useEffect, useState } from 'react';
import api from './services/api';
import './AdminBlockedIPs.css';
import AdminSubMenu from './AdminSubMenu';
import { useAuth } from './authContext';

function Modal({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <p>{message}</p>
        <button onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

export default function AdminBlockedIPs() {
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [modalMsg, setModalMsg] = useState('');

  useEffect(() => {
    fetchBlockedIPs();
  }, []);

  useEffect(() => {
    // Usa cookie httpOnly; alguns browsers exigem URL absoluta para credenciais
    const url = '/api/admin/blocked-ips-events';
    const eventSource = new EventSource(url, { withCredentials: true });
    eventSource.onmessage = (e) => {
      if (e.data) {
        setModalMsg(e.data);
        fetchBlockedIPs();
      }
    };
    return () => eventSource.close();
  }, []);

  async function fetchBlockedIPs() {
    setLoading(true);
    try {
      const res = await api.get('/admin/blocked-ips');
      // Backend agora pode retornar { items: [...], aviso: '...' } ou array puro
      const data = res.data;
      const arr = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
      if (!Array.isArray(data) && data?.aviso) {
        setMsg(data.aviso);
      }
      setBlockedIPs(arr);
    } catch (e) {
      setMsg('Erro ao buscar IPs bloqueados');
      setBlockedIPs([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnblock(ip) {
    if (!window.confirm(`Desbloquear o IP ${ip}?`)) return;
    try {
      await api.post('/admin/desbloquear-ip', { ip });
      setMsg(`IP ${ip} desbloqueado!`);
      fetchBlockedIPs();
    } catch {
      setMsg('Erro ao desbloquear IP');
    }
  }

  const { tipo, autorizado } = useAuth() || {};
  const isAdmin = tipo === 'admin' && autorizado;

  return (
    <>
    {isAdmin && <AdminSubMenu />}
    <div className="admin-blocked-ips">
      <Modal message={modalMsg} onClose={() => setModalMsg('')} />
      <h2>Desbloqueio de IPs</h2>
      <p style={{color:'#555',marginBottom:12}}>
        Os IPs listados abaixo foram bloqueados automaticamente pelo sistema após múltiplas tentativas de login suspeitas.<br/>
        Isso é uma medida de segurança contra ataques hackers e atividades maliciosas.<br/>
        Para liberar o acesso, clique em "Desbloquear" ao lado do IP desejado.
      </p>
      <input
        type="text"
        placeholder="Buscar por IP, email ou nome..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{marginBottom:12,padding:6,borderRadius:4,border:'1px solid #ccc',width:'100%'}}
      />
      {msg && <div className="msg">{msg}</div>}
      {loading ? <div>Carregando...</div> : (
        <table>
          <thead>
            <tr>
              <th>IP</th>
              <th>Email</th>
              <th>Nome</th>
              <th>Bloqueado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const list = Array.isArray(blockedIPs) ? blockedIPs : [];
              const term = search.toLowerCase();
              const filtered = list.filter(ip => (
                ip.ip?.toLowerCase().includes(term) ||
                (ip.email || '').toLowerCase().includes(term) ||
                (ip.nome_usuario || '').toLowerCase().includes(term)
              ));
              if (filtered.length === 0) {
                return <tr><td colSpan={5}>Nenhum IP bloqueado</td></tr>;
              }
              return filtered.map(ip => (
                <tr key={ip.ip}>
                  <td>{ip.ip}</td>
                  <td>{ip.email || '-'}</td>
                  <td>{ip.nome_usuario || '-'}</td>
                  <td>{ip.bloqueado_em ? new Date(ip.bloqueado_em).toLocaleString() : '-'}</td>
                  <td>
                    <button onClick={() => handleUnblock(ip.ip)}>Desbloquear</button>
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      )}
  </div>
  </>
  );
}
