import React from 'react';
import { API_BASE } from './config';
import axios from 'axios';

export default function ApoioUser() {
  const [pixImgUrl, setPixImgUrl] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchApoio() {
      setLoading(true);
      try {
        const { data } = await axios.get(`${API_BASE}/apoio/conteudo`);
        setPixImgUrl(data.imgUrl ? `${API_BASE}${data.imgUrl}` : '');
        setMsg(data.msg || '');
      } catch (e) {
        setPixImgUrl('');
        setMsg('');
      } finally {
        setLoading(false);
      }
    }
    fetchApoio();
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', background: 'linear-gradient(135deg,#e3f0ff 0%,#f7f7f7 100%)' }}>
  <div style={{ background: 'white', padding: 20, borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', maxWidth: 420, width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 12, color: '#1976d2', fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>Apoie o Bolão SCA!</h2>
        <p style={{ textAlign: 'center', marginBottom: 16, fontSize: 14, color: '#444', fontWeight: 500 }}>
          Ajude o site a continuar crescendo!<br />
          Copie o PIX abaixo e contribua com qualquer valor.<br />
          Sua colaboração é muito importante!
        </p>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {pixImgUrl && (
            <img src={pixImgUrl} alt="PIX de apoio" style={{ maxWidth: 140, maxHeight: 140, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }} />
          )}
          <div style={{ marginTop: 10 }}>
            <span style={{ fontWeight: 600, color: '#1976d2', fontSize: 15 }}>Chave PIX:</span>
            <span style={{ marginLeft: 8, fontWeight: 500, fontSize: 15, background: '#e3f0ff', padding: '4px 10px', borderRadius: 6 }}>bolaosca@gmail.com</span>
            <button
              type="button"
              style={{ marginLeft: 8, padding: '2px 10px', fontSize: 13, borderRadius: 6, border: 'none', background: '#1976d2', color: 'white', cursor: 'pointer' }}
              onClick={() => navigator.clipboard.writeText('bolaosca@gmail.com')}
            >Copiar</button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, color: '#555', fontSize: 13 }}>
          <span style={{ background: '#e3f0ff', padding: '6px 12px', borderRadius: 6, fontWeight: 500 }}>
            {msg ? msg : 'Apoie o site para que ele continue gratuito e cada vez melhor para todos! Obrigado pelo seu apoio. 💙'}
          </span>
        </div>
      </div>
    </div>
  );
}
