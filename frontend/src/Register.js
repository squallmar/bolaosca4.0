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
    else if (formData.senha.length < 10) newErrors.senha = 'Mínimo 10 caracteres';
    else if (!/[A-Z]/.test(formData.senha) || !/[a-z]/.test(formData.senha) || !/[0-9]/.test(formData.senha)) {
      newErrors.senha = 'Use maiúscula, minúscula e número';
    }
    if (formData.senha !== formData.confirmarSenha) newErrors.confirmarSenha = 'As senhas não coincidem';
    if (!formData.apelido.trim()) newErrors.apelido = 'Apelido é obrigatório';
    if (!formData.contato.trim()) newErrors.contato = 'Contato é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      let foto_url = '';
      if (avatarFile) {
        // Primeiro faz upload do avatar para Cloudinary
        const fdAvatar = new FormData();
        fdAvatar.append('file', avatarFile);
        const { data } = await api.post('/upload/avatar', fdAvatar);
        foto_url = data.url;
      }
      // Envia dados do usuário com foto_url
      const resp = await api.post('/auth/register', {
        ...formData,
        foto_url
      });
      // login automático após cadastro
      const user = resp.data?.usuario;
      if (user) {
    await auth.login(null, user.tipo, user.nome, user.autorizado, user.avatar_url || user.foto_url, user.apelido);
    window.location.href = 'https://bolaosca4-0.vercel.app/';
      } else {
        alert('Cadastro realizado! Você já pode fazer login.');
        navigate('/login');
      }
    } catch (error) {
      const resp = error?.response;
      if (resp) {
        if (resp.status === 400) {
          const msg = resp.data?.erro || resp.data?.error || '';
          if (/Senha fraca/i.test(msg)) {
            setErrors({ senha: 'Senha fraca: mínimo 10, maiúscula, minúscula e número.' });
          } else if (/Email já cadastrado/i.test(msg)) {
            setErrors({ email: 'Email já cadastrado.' });
          } else {
            setErrors({ submit: msg || 'Dados inválidos. Verifique as informações.' });
          }
        } else if (resp.status === 409) {
          setErrors({ email: 'Email já cadastrado.' });
        } else {
          setErrors({ submit: 'Erro no servidor. Tente novamente.' });
        }
      } else if (error?.request) {
        setErrors({ submit: 'Sem resposta do servidor.' });
      } else {
        setErrors({ submit: 'Erro inesperado.' });
      }
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
            <input
              type="password"
              id="senha"
              name="senha"
              value={formData.senha}
              onChange={handleChange}
              className={errors.senha ? 'error' : ''}
              placeholder="Crie uma senha"
              autoComplete="new-password"
            />
            {errors.senha && <span className="error-text">{errors.senha}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="confirmarSenha">Confirmar Senha</label>
            <input
              type="password"
              id="confirmarSenha"
              name="confirmarSenha"
              value={formData.confirmarSenha}
              onChange={handleChange}
              className={errors.confirmarSenha ? 'error' : ''}
              placeholder="Confirme sua senha"
              autoComplete="new-password"
            />
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