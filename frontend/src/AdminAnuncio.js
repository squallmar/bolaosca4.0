import React, { useState, useEffect } from 'react';
import { API_BASE } from './config';
import api from './services/api';
import './AdminAnuncio.css';
import { useNavigate, Link } from 'react-router-dom';
import AdminSubMenu from './AdminSubMenu';
import { useAuth } from './authContext';

function AdminAnuncio() {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [imagem, setImagem] = useState(null);
  const [preview, setPreview] = useState('');
  const [editId, setEditId] = useState(null);
  const [anuncios, setAnuncios] = useState([]);
  const navigate = useNavigate();
  const { tipo, autorizado } = useAuth() || {};
  const isAdmin = tipo === 'admin' && autorizado;

  // Carregar anúncios
  useEffect(() => {
    carregarAnuncios();
  }, []);

  const carregarAnuncios = async () => {
    try {
      const res = await api.get('/admin/anuncios');
      setAnuncios(res.data);
    } catch {
      setMsg('Erro ao carregar anúncios.');
      setAnuncios([]);
    }
  };

  // Função para excluir anúncio
  const handleDelete = async (id) => {
    if (!window.confirm('Deseja realmente excluir este anúncio?')) return;
    try {
      await api.delete(`/admin/anuncio/${id}`);
      setAnuncios(anuncios => anuncios.filter(a => a.id !== id));
      setMsg('Anúncio excluído com sucesso!');
    } catch {
      setMsg('Erro ao excluir anúncio.');
    }
  };

  function handleImagem(file) {
    setMsg('');
    if (!file) {
      setImagem(null);
      setPreview('');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setImagem(null);
      setPreview('');
      setMsg('Formato não suportado. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setImagem(null);
      setPreview('');
      setMsg('Imagem muito grande (máx. 3 MB).');
      return;
    }
    setImagem(file);
    setPreview(URL.createObjectURL(file));
  }

  function toImageSrc(pathOrUrl) {
    if (!pathOrUrl) return '';
    let u = String(pathOrUrl).trim();
    if (u.includes(';')) {
      const parts = u.split(';').map(s=>s.trim()).filter(Boolean);
      u = parts[parts.length-1];
    }
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    if (!u.startsWith('/')) u = '/' + u;
    return `${API_BASE}${u}`;
  }

  function handleEdit(anuncio) {
    setEditId(anuncio.id);
    setTitulo(anuncio.titulo);
    setDescricao(anuncio.descricao);
    setPreview(toImageSrc(anuncio.imagem_url));
    setImagem(null);
    setMsg('Editando anúncio...');
  }

  function cancelarEdicao() {
    setEditId(null);
    setTitulo('');
    setDescricao('');
    setImagem(null);
    setPreview('');
    setMsg('');
  }

  async function cadastrar(e) {
    e.preventDefault();
    setMsg('');
    if (!titulo || !descricao) {
      setMsg('Preencha título e descrição.');
      return;
    }
    try {
      setLoading(true);
      const form = new FormData();
      form.append('titulo', titulo);
      form.append('descricao', descricao);
      if (imagem) form.append('imagem', imagem);
      
      if (editId) {
        // Atualizar anúncio existente
        await api.put(`/admin/anuncios/${editId}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setMsg('Anúncio atualizado com sucesso!');
      } else {
        // Cadastrar novo anúncio
        await api.post('/admin/anuncio', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setMsg('Anúncio cadastrado com sucesso!');
      }
      
      // Limpar formulário e recarregar lista
      setTitulo('');
      setDescricao('');
      setImagem(null);
      setPreview('');
      setEditId(null);
      await carregarAnuncios();
    } catch {
      setMsg(editId ? 'Erro ao atualizar anúncio.' : 'Erro ao cadastrar anúncio.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {isAdmin && <AdminSubMenu />}
      <div style={{display:'flex',gap:'2em',alignItems:'flex-start',padding:'2em', flexWrap: 'wrap'}}>
      <div style={{width:'100%'}}>
        <h2 style={{ marginBottom: 18 }}>Gerenciar Anúncios</h2>
      </div>
      <div style={{minWidth:320,maxWidth:340,background:'#fff',borderRadius:16,boxShadow:'0 4px 24px #185a9d22',padding:'1.5em',transition:'box-shadow 0.2s',border:'2px solid #43cea2'}}>
        <h3 style={{textAlign:'center',color:'#185a9d',fontWeight:900,letterSpacing:'1px',marginBottom:'1em'}}>
          {editId ? 'Editar Anúncio' : 'Cadastrar Anúncio'}
        </h3>
        
        {msg && <div style={{
          padding: '0.5em',
          marginBottom: '1em',
          borderRadius: '8px',
          backgroundColor: msg.includes('sucesso') ? '#d4edda' : '#f8d7da',
          color: msg.includes('sucesso') ? '#155724' : '#721c24',
          textAlign: 'center'
        }}>{msg}</div>}
        
        <form onSubmit={cadastrar}>
          <div style={{marginBottom:'1em'}}>
            <label style={{fontWeight:700}}>Título</label><br />
            <input 
              type="text" 
              value={titulo} 
              onChange={e=>setTitulo(e.target.value)} 
              style={{width:'100%',padding:'0.5em',borderRadius:8,border:'1px solid #bbb',fontSize:'1em'}} 
            />
          </div>
          <div style={{marginBottom:'1em'}}>
            <label style={{fontWeight:700}}>Descrição</label><br />
            <textarea 
              value={descricao} 
              onChange={e=>setDescricao(e.target.value)} 
              rows={3} 
              style={{width:'100%',padding:'0.5em',borderRadius:8,border:'1px solid #bbb',fontSize:'1em'}} 
            />
          </div>
          <div style={{marginBottom:'1em'}}>
            <label style={{fontWeight:700}}>Imagem (opcional)</label><br />
            <input 
              type="file" 
              accept="image/jpeg,image/png,image/webp" 
              style={{marginTop:'0.3em'}} 
              onChange={e=>handleImagem(e.target.files[0])} 
            />
            {preview && (
              <div style={{marginTop:'0.5em',textAlign:'center'}}>
                <img src={preview} alt="preview" style={{maxWidth:180, borderRadius:12, boxShadow:'0 2px 12px #185a9d22',border:'2px solid #43cea2'}} />
              </div>
            )}
          </div>
          <div style={{display: 'flex', gap: '0.5em'}}>
            <button 
              type="submit" 
              disabled={loading}
              style={{
                background: loading ? '#ccc' : '#1976d2',
                color:'#fff',
                border:'none',
                borderRadius:8,
                padding:'0.6em 1.2em',
                fontWeight:700,
                fontSize:'1em',
                boxShadow:'0 2px 8px #1976d222',
                cursor: loading ? 'not-allowed' : 'pointer',
                flex: 1
              }}
            >
              {loading ? 'Processando...' : (editId ? 'Atualizar' : 'Cadastrar')}
            </button>
            
            {editId && (
              <button 
                type="button" 
                onClick={cancelarEdicao}
                style={{
                  background: '#6c757d',
                  color:'#fff',
                  border:'none',
                  borderRadius:8,
                  padding:'0.6em 1.2em',
                  fontWeight:700,
                  fontSize:'1em',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
      
      {/* Listagem de anúncios */}
      <div style={{flex:1, minWidth: '300px', background:'#fff',borderRadius:16,boxShadow:'0 4px 24px #185a9d22',padding:'1.5em',border:'2px solid #43cea2'}}>
        <h3 style={{textAlign:'center',color:'#185a9d',fontWeight:900,letterSpacing:'1px',marginBottom:'1em'}}>Lista de Anúncios</h3>
        {anuncios.length === 0 ? (
          <div style={{textAlign:'center',color:'#888'}}>Nenhum anúncio cadastrado.</div>
        ) : (
          <ul style={{listStyle:'none',padding:0}}>
            {anuncios.map(anuncio => (
              <li key={anuncio.id} style={{marginBottom:'1.5em',borderBottom:'1px solid #eee',paddingBottom:'1em'}}>
                <div style={{display:'flex',alignItems:'center',gap:'1em'}}>
          {anuncio.imagem_url && (
                    <img 
            src={toImageSrc(anuncio.imagem_url)}
                      alt={anuncio.titulo} 
                      style={{width:64,height:64,objectFit:'cover',borderRadius:8,border:'1px solid #43cea2'}} 
                    />
                  )}
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:'1.1em'}}>{anuncio.titulo}</div>
                    <div style={{color:'#555'}}>{anuncio.descricao}</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:'0.5em'}}>
                    <button 
                      onClick={()=>handleEdit(anuncio)} 
                      style={{background:'#43cea2',color:'#fff',border:'none',borderRadius:6,padding:'0.3em 0.8em',fontWeight:700,cursor:'pointer'}}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={()=>handleDelete(anuncio.id)} 
                      style={{background:'#d32f2f',color:'#fff',border:'none',borderRadius:6,padding:'0.3em 0.8em',fontWeight:700,cursor:'pointer'}}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
  </div>
  </>
  );
}

export default AdminAnuncio;