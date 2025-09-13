import React, { useEffect, useState, useRef } from 'react';
import { API_BASE } from './config';

function AnunciosTV() {
  const [anuncios, setAnuncios] = useState([]);
  const [atual, setAtual] = useState(0);
  const [slide, setSlide] = useState(true);
  const [visivel, setVisivel] = useState(true);
  const intervalRef = useRef();

  useEffect(() => {
    const fetchAnuncios = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/anuncios`);
        if (response.ok) {
          const data = await response.json();
          setAnuncios(data);
          setAtual(0);
        }
      } catch (error) {}
    };
    fetchAnuncios();
    const interval = setInterval(fetchAnuncios, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (anuncios.length > 1) {
      intervalRef.current = setInterval(() => {
        setSlide(false);
        setTimeout(() => {
          setAtual((prev) => (prev + 1) % anuncios.length);
          setSlide(true);
        }, 400);
      }, 10000); // troca anúncio a cada 10s
      return () => clearInterval(intervalRef.current);
    }
  }, [anuncios]);

  const anuncio = anuncios[atual];

  // Resolve URL de imagem do anúncio (aceita absoluta, limpa ';', e prefixa API quando relativo)
  const resolveAnuncioSrc = (pathOrUrl) => {
    if (!pathOrUrl) return '';
    let u = String(pathOrUrl).trim();
    if (u.includes(';')) {
      const parts = u.split(';').map(s => s.trim()).filter(Boolean);
      u = parts[parts.length - 1];
    }
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (!u.startsWith('/')) u = '/' + u;
    return `${API_BASE}${u}`;
  };

  if (!visivel) return null;
  return (
    <div className="tv-anuncios-card" style={{position:'relative'}}>
      <style>{`
        .tv-anuncios-card {
          position: fixed;
          top: 110px;
          right: 24px;
          z-index: 1000;
          width: 220px;
          min-height: 130px;
          max-width: 220px;
          border-radius: 20px;
          box-sizing: border-box;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-weight: bold;
          font-size: 0.92em;
          letter-spacing: 0.3px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0.7em 0.4em;
          box-shadow: 0 4px 24px 2px #2228;
          border: 4px solid #222;
          overflow: visible;
          background: linear-gradient(135deg,#222 0%,#444 100%);
          color: #fff;
          transition: box-shadow 0.2s;
        }
        @media (max-width: 600px) {
          .tv-anuncios-card {
            right: 8px;
            top: 70px;
            width: 95vw;
            max-width: 98vw;
            min-width: 160px;
            padding: 0.25em 0.08em;
            font-size: 0.90em;
          }
          .tv-anuncios-close {
            top: 4px;
            right: 6px;
            width: 24px;
            height: 24px;
            font-size: 16px;
          }
        }
        .tv-anuncios-close {
          position: absolute;
          top: 8px;
          right: 12px;
          background: #222c;
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px 0px #2228;
          transition: background 0.2s;
        }
      `}</style>
      <button
        className="tv-anuncios-close"
        aria-label="Fechar anúncio"
        onClick={() => setVisivel(false)}
        tabIndex={0}
      >
        ×
      </button>
      {anuncio && anuncio.imagem_url ? (
        <div style={{
          width: '98%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg,#111 0%,#333 100%)',
          borderRadius: '16px',
          boxShadow: '0 2px 12px 1px #0008',
          padding: '8px',
        }}>
          <a href="/anuncie" target="_blank" rel="noopener noreferrer">
            <img 
              src={resolveAnuncioSrc(anuncio.imagem_url)}
              alt="Propaganda"
              style={{
                width: '100%',
                maxHeight: '110px',
                height: 'auto',
                objectFit: 'cover',
                borderRadius: '10px',
                boxShadow: '0 2px 8px 0px #2228',
                border: '2px solid #fff',
                transition: 'transform 0.25s, box-shadow 0.25s',
                cursor: 'pointer',
                background: 'transparent',
                outline: 'none',
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 8px 32px 2px #1976d288';
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px 0px #2228';
              }}
              onError={e => {
                // Fallback para imagem padrão de anúncio do Cloudinary
                if (!e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = '1';
                  e.currentTarget.src = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757737452/anuncios/hfhgkdbrh1odlgnvtnza.png';
                } else {
                  e.currentTarget.style.opacity = 0.5;
                  console.log('Erro ao carregar imagem:', e.currentTarget.src);
                }
              }}
            />
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default AnunciosTV;
