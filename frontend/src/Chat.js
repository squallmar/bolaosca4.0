import React from 'react';
import { useNavigate } from 'react-router-dom';
import ChatRealtime from './ChatRealtime';

export default function Chat() {
  const navigate = useNavigate();
  // Link do grupo via env (se disponível) com fallback direto ao grupo informado
  const WHATSAPP_GROUP_URL = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_WHATSAPP_GROUP_URL)
    ? process.env.REACT_APP_WHATSAPP_GROUP_URL
    : 'https://chat.whatsapp.com/BRbzNKmQJEQLW363NpMJTZ?mode=ac_t';
  const fallbackMsg = encodeURIComponent('Olá galera do Bolão SCA!');
  const fallbackWa = `https://wa.me/?text=${fallbackMsg}`;
  const waLink = WHATSAPP_GROUP_URL || fallbackWa;
  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  // Username não persistido localmente (pode vir do contexto futuramente)
  const username = 'Anônimo';

  return (
    <div className="home-container" style={{ background: '#f7f7f7', minHeight: '100vh', paddingTop: 32 }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <button type="button" title="Voltar à página principal" aria-label="Voltar" onClick={handleBack}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgb(224, 224, 224)', background: '#fff', color: '#2c3e50', fontWeight: 600, cursor: 'pointer', marginBottom: 18 }}>
          ← Voltar
        </button>
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 16px #25d36622', padding: '2em 1.2em', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: 26, color: '#25D366', fontWeight: 800, marginBottom: 10, letterSpacing: 1 }}>Grupo WhatsApp</h2>
          <p style={{ fontSize: 16, color: '#444', marginBottom: 18 }}>Participe do grupo oficial do Bolão SCA para conversar sobre jogos, palpites e resultados com a comunidade!</p>
          <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: 18, borderRadius: 12, padding: '12px 32px', marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px #25d36644', textDecoration: 'none', transition: 'background 0.2s' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="11" fill="#1ebe5b"/>
              <path d="M16.5 14.5c-1 .7-1.8 1-2.5 1-.9 0-2.2-.6-3.8-2.2S8 9.4 8 8.5c0-.7.3-1.5 1-2.5l.3-.4c.2-.3.7-.4 1-.2l1.8 1c.3.2.5.6.4 1l-.3 1.1c-.1.3-.3.6-.6.8l-.4.3c.5.8 1.2 1.6 2 2.3.7.7 1.5 1.3 2.3 1.8l.3-.4c.2-.3.5-.5.8-.6l1.1-.3c.4-.1.8.1 1 .4l1 1.8c.2.3.1.8-.2 1l-.4.3z" fill="#fff"/>
            </svg>
            Entrar no Grupo
          </a>
        </div>
      </div>
    </div>
  );
}
