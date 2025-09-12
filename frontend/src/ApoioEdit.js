import React from 'react';
import { API_BASE } from './config';
import { Link } from 'react-router-dom';
import AdminSubMenu from './AdminSubMenu';
import { useAuth } from './authContext';
import api from './services/api';

export default function ApoioEdit() {
  const [pixImg, setPixImg] = React.useState(null);
  const [preview, setPreview] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    async function fetchApoio() {
      setLoading(true);
      try {
  const { data } = await api.get(`${API_BASE}/apoio/conteudo`);
        setPreview(data.imgUrl ? `${API_BASE}${data.imgUrl}` : '');
        setMsg(data.msg || '');
      } catch (e) {
        setError('Erro ao carregar conteúdo atual');
      } finally {
        setLoading(false);
      }
    }
    fetchApoio();
  }, []);

  function handlePixChange(e) {
    const file = e.target.files[0];
    if (file) {
      setPixImg(file);
      setPreview(URL.createObjectURL(file));
    }
  }

  function handleMsgChange(e) {
    setMsg(e.target.value);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      const formData = new FormData();
      if (pixImg) formData.append('file', pixImg);
      formData.append('msg', msg);
  const { data } = await api.post(`${API_BASE}/apoio/upload`, formData);
      setSuccess('Conteúdo salvo com sucesso!');
      setPreview(data.url ? `${API_BASE}${data.url}` : preview);
    } catch (e) {
      setError('Erro ao salvar conteúdo');
    } finally {
      setLoading(false);
    }
  }

  const { tipo, autorizado } = useAuth() || {};
  const isAdmin = tipo === 'admin' && autorizado;

  return (
    <>
      {isAdmin && <AdminSubMenu />}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '70vh', background: 'linear-gradient(135deg,#e3f0ff 0%,#f7f7f7 100%)', gap: '2em' }}>
      {/* Card do formulário */}
  <div style={{ background: 'white', padding: '1.6em 1.2em', borderRadius: 17, boxShadow: '0 6px 24px #1976d222', maxWidth: 520, minWidth: 320, width: '100%', border: '1.7px solid #1976d2', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.1em', fontSize: '18px' }}>
  <div style={{width:'100%', marginBottom: 8}}></div>
  <h2 style={{ textAlign: 'center', marginBottom: 10, color: '#1976d2', fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>Editar Apoio do Site</h2>
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'0.5em'}}>
          <div style={{ marginBottom: 0 }}>
            <label htmlFor="pix" style={{ display: 'block', marginBottom: 4, fontWeight: 700, color:'#185a9d', fontSize:17 }}>Imagem do PIX (QR Code):</label>
            <input type="file" id="pix" accept="image/*" onChange={handlePixChange} style={{ width: '100%', marginBottom: 5, padding:'7px', borderRadius:5, border:'1px solid #bbb', background:'#f7f7f7', fontSize:16 }} />
          </div>
          <div style={{ marginBottom: 0 }}>
            <label htmlFor="msg" style={{ display: 'block', marginBottom: 4, fontWeight: 700, color:'#185a9d', fontSize:17 }}>Mensagem de Apoio:</label>
            <textarea id="msg" value={msg} onChange={handleMsgChange} rows={1} style={{ width: '100%', padding: 9, borderRadius: 5, border: '1px solid #1976d2', resize: 'vertical', fontSize: 16, background:'#f7f7f7', color:'#222', fontWeight:500 }} />
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px 0', background: loading ? '#b0c4de' : 'linear-gradient(90deg,#1976d2 60%,#43cea2 100%)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 17, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, boxShadow:'0 2px 6px #1976d222', letterSpacing:0 }}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
          {success && <div style={{ color: '#00c853', marginTop: 6, textAlign: 'center', fontWeight: 600, fontSize:10 }}>{success}</div>}
          {error && <div style={{ color: '#d32f2f', marginTop: 6, textAlign: 'center', fontWeight: 600, fontSize:10 }}>{error}</div>}
        </form>
      </div>
      {/* Card da pré-visualização do QR Code */}
      {preview && (
        <div style={{ background: 'white', padding: '1.6em', borderRadius: 17, boxShadow: '0 6px 24px #1976d222', minWidth: 240, maxWidth: 420, border: '1.7px solid #1976d2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.1em' }}>
          <img src={preview} alt="PIX de apoio" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 15, boxShadow: '0 4px 16px #1976d222', border:'1.7px solid #1976d2' }} />
          <div style={{ marginTop: 10, color: '#1976d2', fontWeight: 700, fontSize:17, textAlign:'center' }}>Pré-visualização do QR Code</div>
        </div>
      )}
  </div>
  </>
  );
}
