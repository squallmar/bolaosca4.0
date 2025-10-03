import React from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from './config';

function AnuncioCardResumo({ anuncio }) {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'fixed',
      top: 90,
      left: 24,
      width: 220,
      minHeight: 120,
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 2px 12px #185a9d22',
      border: '2px solid #43cea2',
      padding: '1em',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      cursor: 'pointer',
      zIndex: 1000
    }} onClick={() => navigate('/admin/anuncio-gerenciar')}>
      <h4 style={{marginBottom:'0.5em',color:'#185a9d',fontWeight:900}}>Cadastro de Anúncio</h4>
      <div style={{width:'100%',textAlign:'center'}}>
        {anuncio?.imagem_url ? (
          <img src={`${API_BASE}${anuncio.imagem_url}`} alt="" style={{maxWidth:80,maxHeight:80,borderRadius:8,boxShadow:'0 2px 8px #185a9d22',border:'2px solid #43cea2'}} />
        ) : (
          <span style={{color:'#bbb'}}>Sem imagem</span>
        )}
      </div>
      <div style={{marginTop:'0.5em',fontWeight:700,fontSize:'1em',color:'#1976d2'}}>{anuncio?.titulo || 'Sem título'}</div>
      <div style={{fontSize:'0.95em',color:'#333',marginBottom:'0.7em'}}>{anuncio?.descricao || 'Sem descrição'}</div>
      <button style={{background:'#1976d2',color:'#fff',border:'none',borderRadius:8,padding:'0.4em 1em',fontWeight:700,cursor:'pointer',boxShadow:'0 2px 8px #1976d222'}}>Cadastrar</button>
    </div>
  );
}

export default AnuncioCardResumo;
