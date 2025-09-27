import React, { useState } from 'react';
import api from './services/api';

export default function Feedback() {
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailInfo, setEmailInfo] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setOk(false); setErr(''); setEmailInfo(null);
    if (!mensagem || mensagem.trim().length < 5) {
      setErr('Escreva uma mensagem com pelo menos 5 caracteres.');
      return;
    }
    try {
      setLoading(true);
  // CSRF removido: agora só Bearer Token
      const resp = await api.post('/feedback', { nome, mensagem });
      setEmailInfo(resp?.data?.email || null);
      setOk(true);
      setNome('');
      setMensagem('');
    } catch (e) {
      setErr(e.message || 'Não foi possível enviar agora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <div className="hero-section" style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#2c3e50', marginBottom: 8 }}>Opine</h2>
        <p className="hero-subtitle">Deixe sua opinião e sugestões para melhorarmos o Bolão SCA.</p>
      </div>

      {ok ? (
        <div className="feature-card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h3 className="card-title">Obrigado!</h3>
          <p className="card-description">Seu feedback foi registrado com sucesso.</p>
          {emailInfo && emailInfo.sent && (
            <p style={{ color: '#2e7d32', fontWeight: 500 }}>Email enviado.</p>
          )}
          {emailInfo && emailInfo.sent === false && (
            <div style={{ marginTop: 12, color: '#b26a00', fontSize: 14 }}>
              Aviso: email não enviado agora ({emailInfo.reason || emailInfo.message || 'motivo desconhecido'}).
            </div>
          )}
          <a href="/" className="card-button" style={{ backgroundColor: '#4CAF50' }}>Voltar para a Home</a>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="feature-card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {err && (
              <div className="error-message" style={{ color: '#F44336', fontWeight: 600 }}>{err}</div>
            )}
            <label>
              <span className="card-description">Nome (opcional)</span>
              <input
                value={nome}
                onChange={e=>setNome(e.target.value)}
                placeholder="Seu nome"
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
              />
            </label>
            <label>
              <span className="card-description">Mensagem</span>
              <textarea
                value={mensagem}
                onChange={e=>setMensagem(e.target.value)}
                placeholder="Sua mensagem"
                rows={5}
                required
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', resize: 'vertical' }}
              />
            </label>
            <button type="submit" className="card-button" style={{ backgroundColor: '#03A9F4', opacity: loading ? 0.8 : 1 }} disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar opinião'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
