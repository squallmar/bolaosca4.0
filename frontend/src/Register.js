import React, { useState } from 'react';
import api from './services/api';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';
import { useAuth } from './authContext';

const Register = () => {
  const auth = useAuth();
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    tipo: 'user',
    apelido: '',
    contato: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  // NOVO: handler para avatar
  const handleAvatarChange = (e) => {
    setAvatarFile(e.target.files[0]);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!formData.email.trim()) newErrors.email = 'Email é obrigatório';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email inválido';
    if (!formData.senha) newErrors.senha = 'Senha é obrigatória';
    else if (formData.senha.length < 4 || formData.senha.length > 8) newErrors.senha = 'Use de 4 a 8 caracteres (pode ter especiais)';
    if (formData.senha !== formData.confirmarSenha) newErrors.confirmarSenha = 'As senhas não coincidem';
    if (!formData.apelido.trim()) newErrors.apelido = 'Apelido é obrigatório';
    if (!formData.contato.trim()) newErrors.contato = 'Contato é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [successMsg, setSuccessMsg] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      // Busca o token CSRF antes de cadastrar
      let csrfToken = null;
      try {
        const resp = await api.get('/csrf-token');
        csrfToken = resp.data?.csrfToken;
      } catch {}

      // Cria um objeto FormData para enviar a foto e os dados
      const data = new FormData();
      data.append('nome', formData.nome);
      data.append('email', formData.email);
      data.append('senha', formData.senha);
      data.append('tipo', formData.tipo);
      data.append('apelido', formData.apelido);
      data.append('contato', formData.contato);
      if (avatarFile) {
        data.append('avatar', avatarFile); // Adiciona o arquivo da foto
      }

      const res = await api.post('/usuario/register', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        withCredentials: true // ✅ garante envio de cookies no mobile
      });

      setSuccessMsg('Cadastro realizado com sucesso! Você será redirecionado para o login.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      console.log('Cadastro bem-sucedido:', res.data);
    } catch (err) {
      const errorMsg = err.response?.data?.erro || 'Falha ao criar conta. Tente novamente mais tarde.';
      setErrors({ ...errors, submit: errorMsg });
      console.error('Erro de cadastro:', err.response?.data);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Criar Conta</h2>
          <p>Junte-se à nossa comunidade de apostas</p>
        </div>
        {successMsg && <div className="success-message" style={{marginBottom:12, color:'#00c853', fontWeight:'bold'}}>{successMsg}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="nome">Nome Completo</label>
            <input
              type="text"
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              className={errors.nome ? 'error' : ''}
              placeholder="Digite seu nome completo"
              autoComplete="name"
            />
            {errors.nome && <span className="error-text">{errors.nome}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
              placeholder="Digite seu e-mail"
              autoComplete="email"
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <div style={{position:'relative'}}>
            <input
              type={showPwd ? 'text' : 'password'}
              id="senha"
              name="senha"
              value={formData.senha}
              onChange={handleChange}
              className={errors.senha ? 'error' : ''}
              placeholder="Crie uma senha"
              autoComplete="new-password"
              maxLength={8}
            />
            <button type="button" onClick={()=>setShowPwd(v=>!v)}
              style={{position:'absolute', right:8, top:8, background:'transparent', border:'none', cursor:'pointer'}}
              aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}>
              {showPwd ? '🙈' : '👁️'}
            </button>
            </div>
            <small style={{display:'block', marginTop:4, color:'#666'}}>Use de 4 a 8 caracteres. Especiais são permitidos. ({formData.senha.length}/8)</small>
            {/* Medidor simples de força (informativo) */}
            <div style={{height:6, background:'#eee', borderRadius:4, overflow:'hidden', marginTop:6}} aria-hidden>
              {(()=>{
                const len = formData.senha.length;
                const pct = Math.min(100, Math.floor((len/8)*100));
                const color = len >= 6 ? '#4caf50' : len >= 4 ? '#ffc107' : '#f44336';
                return <div style={{width:`${pct}%`, height:'100%', background:color}} />;
              })()}
            </div>
            {errors.senha && <span className="error-text">{errors.senha}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="confirmarSenha">Confirmar Senha</label>
            <div style={{position:'relative'}}>
            <input
              type={showPwd2 ? 'text' : 'password'}
              id="confirmarSenha"
              name="confirmarSenha"
              value={formData.confirmarSenha}
              onChange={handleChange}
              className={errors.confirmarSenha ? 'error' : ''}
              placeholder="Confirme sua senha"
              autoComplete="new-password"
              maxLength={8}
            />
            <button type="button" onClick={()=>setShowPwd2(v=>!v)}
              style={{position:'absolute', right:8, top:8, background:'transparent', border:'none', cursor:'pointer'}}
              aria-label={showPwd2 ? 'Ocultar senha' : 'Mostrar senha'}>
              {showPwd2 ? '🙈' : '👁️'}
            </button>
            </div>
            <small style={{display:'block', marginTop:4, color:'#666'}}>Repita a senha (4 a 8 caracteres). ({formData.confirmarSenha.length}/8)</small>
            {errors.confirmarSenha && <span className="error-text">{errors.confirmarSenha}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="apelido">Apelido</label>
            <input
              type="text"
              id="apelido"
              name="apelido"
              value={formData.apelido || ''}
              onChange={handleChange}
              placeholder="Como você quer ser chamado?"
              autoComplete="nickname"
            />
            {errors.apelido && <span className="error-text">{errors.apelido}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="contato">Celular/Contato</label>
            <input
              type="text"
              id="contato"
              name="contato"
              value={formData.contato || ''}
              onChange={handleChange}
              placeholder="WhatsApp ou telefone para contato"
              autoComplete="tel"
            />
            {errors.contato && <span className="error-text">{errors.contato}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="tipo">Tipo de Conta</label>
            <select
              id="tipo"
              name="tipo"
              value={formData.tipo}
              onChange={handleChange}
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          {/*campo de upload de avatar */}
          <div className="form-group">
            <label htmlFor="avatar">Avatar</label>
            <input
              type="file"
              id="avatar"
              name="avatar"
              accept="image/*"
              onChange={handleAvatarChange}
            />
          </div>
          {errors.submit && <div className="error-message">{errors.submit}</div>}
          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Processando...' : 'Criar Conta'}
          </button>
        </form>
        <div className="auth-footer">
          <p>Já tem uma conta? <Link to="/login">Faça login</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;