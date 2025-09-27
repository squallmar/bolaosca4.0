import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './App.css';
import api from './services/api';


export default function Anuncie() {
  const [submitted, setSubmitted] = useState(false);
  const [emailInfo, setEmailInfo] = useState(null); // detalhes do envio
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nome: '', contato: '', mensagem: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setEmailInfo(null);
    try {
  // CSRF removido: agora só Bearer Token
      const { nome, contato, mensagem } = form;
      const resp = await api.post('/anuncios', { nome, contato, mensagem });
      const email = resp?.data?.email;
      setEmailInfo(email || null);
      // Considera submetido sempre (backend registra intenção mesmo sem envio real de email)
      setSubmitted(true);
      if (email && email.sent === false && email.reason) {
        // não marca como erro fatal, mas mostra aviso
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Falha ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      <Link 
        to="/" 
        title="Voltar à página principal"
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid rgb(221, 221, 221)',
          background: 'rgb(255, 255, 255)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontWeight: 500,
          color: '#333',
          marginBottom: '18px',
          textDecoration: 'none',
        }}
      >
        <span style={{fontSize: '1.2em'}}>←</span> Voltar
      </Link>
      <div className="hero-section" style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#2c3e50', marginBottom: 8 }}>Anuncie</h2>
        <p className="hero-subtitle">Divulgue seu serviço ou produto para os participantes do Bolão SCA.</p>
      </div>

      {submitted ? (
        <div className="feature-card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h3 className="card-title">Obrigado!</h3>
          <p className="card-description">Recebemos seu interesse. Em breve entraremos em contato.</p>
          {emailInfo && emailInfo.sent && (
            <p style={{ color: '#2e7d32', fontWeight: 500 }}>Email enviado com sucesso.</p>
          )}
          {emailInfo && emailInfo.sent === false && (
            <div style={{ marginTop: 12, color: '#b26a00', fontSize: 14 }}>
              Aviso: não foi possível enviar o email agora ({emailInfo.reason || emailInfo.message || 'motivo desconhecido'}).<br />
              Seus dados foram registrados. Ajuste a configuração de email e tente novamente se necessário.
            </div>
          )}
          <Link to="/" className="card-button" style={{ backgroundColor: '#4CAF50', marginTop: 16 }}>Voltar para a Home</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="feature-card" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            {error && (
              <div className="error-message" style={{ marginBottom: 8, color: '#F44336', fontWeight: 600 }}>
                {error}
              </div>
            )}
            <label>
              <span className="card-description">Nome ou Empresa</span>
              <input
                type="text"
                name="nome"
                value={form.nome}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
              />
            </label>
            <label>
              <span className="card-description">Contato (WhatsApp/Email)</span>
              <input
                type="text"
                name="contato"
                value={form.contato}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
              />
            </label>
            <label>
              <span className="card-description">Mensagem</span>
              <textarea
                name="mensagem"
                value={form.mensagem}
                onChange={handleChange}
                required
                rows={4}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', resize: 'vertical' }}
              />
            </label>
            <button type="submit" className="card-button" style={{ backgroundColor: '#FF9800', opacity: loading ? 0.8 : 1 }} disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
