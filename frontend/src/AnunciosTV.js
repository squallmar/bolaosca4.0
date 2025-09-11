import React, { useEffect, useState, useRef } from 'react';
import { API_BASE } from './config';

function AnunciosTV() {
  const [anuncios, setAnuncios] = useState([]);
  const [atual, setAtual] = useState(0);
  const [slide, setSlide] = useState(true);
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

  return (
    <div className="tv-anuncios-card" style={{
      position: 'fixed',
      top: 110,
      right: 24,
      zIndex: 1000,
      width: 220,
      minHeight: 130,
      maxWidth: 220,
      borderRadius: 20,
      boxSizing: 'border-box',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      fontWeight: 'bold',
      fontSize: '0.92em',
      letterSpacing: '0.3px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0.7em 0.4em',
      boxShadow: '0 4px 24px 2px #2228',
      border: '4px solid #222',
      overflow: 'visible',
      background: 'linear-gradient(135deg,#222 0%,#444 100%)',
      color: '#fff',
      transition: 'box-shadow 0.2s',
    }}>
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
              src={`${API_BASE}${anuncio.imagem_url}`}
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
                e.currentTarget.src = 'https://via.placeholder.com/200x110?text=Imagem+Indisponível';
                e.currentTarget.style.opacity = 0.5;
                console.log('Erro ao carregar imagem:', e.currentTarget.src);
              }}
            />
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default AnunciosTV;
