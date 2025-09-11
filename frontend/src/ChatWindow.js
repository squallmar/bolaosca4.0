import React, { useState } from 'react';
import ChatRealtime from './ChatRealtime';
import { useAuth } from './authContext';

export default function ChatWindow() {
  const [open, setOpen] = useState(false);
  const auth = useAuth() || {};
  // Usa apelido e tipo do usuário logado
  const userObj = {
    apelido: auth.apelido || 'Anônimo',
    tipo: auth.tipo || ''
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {open ? (
        <div style={{ width: 340, background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px #0004', padding: 0, overflow: 'hidden', border: '1px solid #ddd' }}>
          <div style={{ background: '#2c3e50', color: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 'bold' }}>Chat em tempo real</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer' }} title="Minimizar">_</button>
          </div>
          <div style={{ padding: 12 }}>
            <ChatRealtime userObj={userObj} />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{ background: '#2c3e50', color: '#fff', borderRadius: '50%', width: 56, height: 56, boxShadow: '0 2px 8px #0003', border: 'none', fontSize: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Abrir chat"
        >
          💬
        </button>
      )}
    </div>
  );
}
