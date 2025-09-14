import React, { useState, useEffect } from 'react';
import { API_BASE } from './config';
import ApostaTimer from './ApostaTimer';
import { useLocation, Link, Routes, Route, Navigate, BrowserRouter } from 'react-router-dom';
import { useAuth } from './authContext';
import './App.css';
import Register from './Register';
import AdminPanel from './AdminPanel';
import BolaoList from './BolaoList';
import LancarResultado from './LancarResultado';
import CampeonatoList from './CampeonatoList';
import RodadaList from './RodadaList';
import PartidaList from './PartidaList';
import PalpiteList from './PalpiteList';
import RankingList from './RankingList';
import AdminUsers from './AdminUsers';
import AdminUserEdit from './AdminUserEdit';
import AdminTeams from './AdminTeams';
import AdminBoloes from './AdminBoloes';
import Profile from './Profile';
import Chat from './Chat';
import Feedback from './Feedback';
import Anuncie from './Anuncie';
import BlogList from './BlogList';
import BlogNew from './BlogNew';
import BlogEdit from './BlogEdit';
import BlogDetail from './BlogDetail';
import Regras from './Regras';
import Login from './Login';
import { createRoot } from 'react-dom/client';
import AdminAnuncio from './AdminAnuncio';
import ApoioEdit from './ApoioEdit';
import ApoioUser from './ApoioUser';
import AnunciosTV from './AnunciosTV';
import ChatWindow from './ChatWindow';
import AdminBlockedIPs from './AdminBlockedIPs';
import AdminSubMenu from './AdminSubMenu';

// Removido: não utilizamos mais Authorization via localStorage; autenticação por cookie httpOnly


function Menu() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // pega dados do contexto com fallback seguro
  const auth = useAuth() || {};
  const { tipo, logout, nome, autorizado } = auth;
  const avatarFromCtx = auth.avatarUrl || null;

  let menuItems = [];
  let userInfo = null;

  const isLogged = !!(nome || tipo);
  if (!isLogged) {
    menuItems = [
      { to: '/login', label: 'Login', icon: '🔐' },
      { to: '/register', label: 'Cadastro', icon: '📝' }
    ];
  } else {
    const primeiroNome = (nome || '').trim().split(' ')[0] || '';
    // normaliza avatar: se vier relativo (ex: /uploads/arquivo.png), prefixa o backend
    const buildAvatar = (url) => {
      if (!url) return null;
      let u = String(url).trim();
      if (u.includes(';')) {
        const parts = u.split(';').map(s => s.trim()).filter(Boolean);
        u = parts[parts.length - 1];
      }
      // Prioriza Cloudinary
      if (/^https?:\/\/res\.cloudinary\.com\//i.test(u)) return u;
      // Normaliza caminho relativo começando por /uploads
      if (u.startsWith('/uploads/')) {
        const filename = u.split('/').pop();
        return `${API_BASE}/uploads/avatars/${filename}`;
      }
      // URL absoluta válida
      if (u.startsWith('http://') || u.startsWith('https://')) return u;
      // Qualquer outra coisa: tenta tratar como filename
      const filename = u.split('/').pop();
      return `${API_BASE}/uploads/avatars/${filename}`;
    };

  const preferred = buildAvatar(avatarFromCtx);
  const avatarSrc = preferred || 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757738470/avatar_default_lwtnzu.jpg';

    userInfo = (
      <Link to="/perfil" className="user-info" style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16, textDecoration: 'none' }}>
        <img
          src={avatarSrc}
          alt="avatar"
          style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => {
            // se falhar, cai para avatar padrão do Cloudinary
            e.currentTarget.onerror = null;
            e.currentTarget.src = 'https://res.cloudinary.com/dsmxqn0fa/image/upload/v1757738470/avatar_default_lwtnzu.jpg';
          }}
        />
        <span style={{ fontWeight: 'bold', color: 'white' }}>{primeiroNome}</span>
      </Link>
    );

  if (tipo === 'admin' && autorizado) {
      menuItems = [
        { to: '/admin', label: 'Administração', icon: '🛡️' },
        { to: '/bolao', label: 'Bolões', icon: '🏆' },
        { to: '/lancar-resultado', label: 'Resultados', icon: '✅' },
        { to: '/palpite', label: 'Apostar', icon: '⚽' },
        { to: '/ranking', label: 'Ranking', icon: '📊' },
        { to: '/blog', label: 'Blog', icon: '📝' },
        { to: '/', label: 'Sair', icon: '🚪', onClick: logout }
      ];
    } else {
      menuItems = [
        { to: '/', label: 'Home', icon: '🏠' },
        { to: '/bolao', label: 'Bolões', icon: '🏆' },
        { to: '/palpite', label: 'Apostar', icon: '⚽' },
        { to: '/ranking', label: 'Ranking', icon: '📊' },
        { to: '/blog', label: 'Blog', icon: '📝' },
  { to: '/apoio/user', label: 'Apoie o Site', icon: '💰' }
      ];
      // Adiciona Sair apenas uma vez, sem duplicar Home
      menuItems.push({ to: '/', label: 'Sair', icon: '🚪', onClick: logout });
    }
  }

  const toggleMobileMenu = () => setMobileMenuOpen(o => !o);

  // Fecha menu ao mudar rota
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  // ESC fecha menu / bloqueia scroll de fundo quando aberto
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') setMobileMenuOpen(false); }
    window.addEventListener('keydown', handleKey);
    if (mobileMenuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.classList.remove('no-scroll');
    };
  }, [mobileMenuOpen]);

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo-container">
          <img src={'/escudo.png'} onError={e => {e.target.onerror=null; e.target.src='https://ui-avatars.com/api/?name=Bolao+SCA';}} alt="Escudo Bolão" className="logo-image" />
          <span className="logo-text">Bolão SCA</span>
        </Link>
  <nav className="desktop-nav" aria-label="Menu principal">
    {menuItems.map(({ to, label, icon, onClick }) => {
      const isSair = label === 'Sair';
      const isActive = isSair
        ? false
        : to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(to) && to !== '/' && location.pathname !== '/';
      const key = isSair ? 'sair' : to;
      return (
        <Link
          key={key}
          to={to}
          className={`nav-link${isActive ? ' active' : ''}`}
          onClick={onClick}
        >
          <span className="nav-icon">{icon}</span>
          {label}
        </Link>
      );
    })}
  </nav>
  {userInfo}
        <button
          className={`mobile-menu-toggle ${mobileMenuOpen ? 'open' : ''}`}
          onClick={toggleMobileMenu}
          aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-mobile-nav"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
      <nav
        id="primary-mobile-nav"
        className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}
        aria-label="Menu principal móvel"
      >
        {menuItems.map(({ to, label, icon, onClick }) => {
          const isSair = label === 'Sair';
          const isActive = isSair
            ? false
            : to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to) && to !== '/' && location.pathname !== '/';
          const key = isSair ? 'sair' : to;
          return (
            <Link
              key={key}
              to={to}
              className={`mobile-nav-link${isActive ? ' active' : ''}`}
              onClick={() => {
                // fecha e executa ação
                setMobileMenuOpen(false);
                if (onClick) onClick();
              }}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function Home() {
  const cards = [
    {
      title: "Próximos Jogos",
      description: "Veja os jogos disponíveis para apostar e desafie seus amigos!",
      buttonText: "Ver jogos",
      link: "/partida",
      color: "#FFD700",
      icon: "📅"
    },
    {
      title: "Aposte e Ganhe",
      description: "Dê seus palpites, acumule pontos e suba no ranking!",
      buttonText: "Apostar agora",
      link: "/palpite",
      color: "#4CAF50",
      icon: "🎯"
    },
    {
      title: "Grupo WhatsApp",
      description: "Converse com o grupo sobre os jogos.",
      buttonText: " Acessar WhatsApp",
      link: "/chat",
      color: "#6C63FF",
      icon: "💬"
    },
    {
      title: "Anuncie",
      description: "Anuncie seu negócio para a galera do bolão.",
      buttonText: "Anunciar",
      link: "/anuncie",
      color: "#FF9800",
      icon: "📢"
    },
    {
      title: "Opine",
      description: "Deixe sua opinião e sugestões para melhorias.",
      buttonText: "Enviar opinião",
      link: "/feedback",
      color: "#03A9F4",
      icon: "💡"
    },
    {
      title: "Blog",
      description: "Leia e publique posts da comunidade.",
      buttonText: "Abrir Blog",
      link: "/blog",
      color: "#7E57C2",
      icon: "📝"
    },
    {
      title: "Regras",
      description: "Entenda como funciona o bolão e a pontuação.",
      buttonText: "Ver Regras",
      link: "/regras",
      color: "#607D8B",
      icon: "⚖️"
    },
    {
      title: "Ranking",
      description: "Veja quem está liderando e tente ser o campeão do bolão!",
      buttonText: "Ver ranking",
      link: "/ranking",
      color: "#F44336",
      icon: "🏅"
    }
  ];

  const auth = useAuth() || {};
  const { nome, autorizado } = auth;
  return (
    <div className="home-container">
      {/* TV de Anúncios para todos os usuários */}
      <AnunciosTV />
      {/* Chat flutuante */}
      <ChatWindow />
      {/* Mensagem de não autorizado */}
      {nome && autorizado === false && (
        <div style={{
          background: '#fff3e0',
          color: '#d35400',
          border: '2px solid #f39c12',
          borderRadius: 12,
          padding: '55px',
          margin: '-40px auto',
          maxWidth: 600,
          fontWeight: 600,
          fontSize: 18,
          textAlign: 'center',
          boxShadow: '0 2px 12px #f39c1233'
        }}>
          Você ainda não foi autorizado para jogar e fazer parte do time.<br />
          Procure a administração para liberação do acesso!
        </div>
      )}
      <div className="hero-section">
        <div className="hero-escudo">
          <img
            src="/escudo.png"
            alt="Escudo do Bolão"
            className="hero-escudo-img"
            onError={(e)=>{e.currentTarget.style.display='none';}}
          />
        </div>
        <p className="hero-subtitle">
          O seu site de apostas esportivas entre amigos! Cadastre-se, crie bolões, aposte nos jogos e dispute o ranking.
        </p>
      </div>

      <div className="cards-grid">
        {cards.map((card, index) => (
          <div key={index} className="feature-card">
            <div className="card-icon" style={{ color: card.color }}>
              {card.icon}
            </div>
            <h3 className="card-title">{card.title}</h3>
            <p className="card-description">{card.description}</p>
            <Link to={card.link} className="card-button" style={{ backgroundColor: card.color }}>
              {card.buttonText}
            </Link>
          </div>
        ))}
      </div>

      <footer className="footer-note" style={{ marginTop: 32, padding: '18px 0 8px 0', background: 'linear-gradient(90deg,#e3f0ff 0%,#f7f7f7 100%)', textAlign: 'center', borderRadius: 12, boxShadow: '0 2px 12px #1976d222' }}>
          <span style={{ color: '#1976d2', fontWeight: 700, fontSize: 18, letterSpacing: 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span role="img" aria-label="dev">💻</span>
            Desenvolvido por <a href="mailto:marcelmendes05@gmail.com" style={{ color: '#1976d2', textDecoration: 'underline', fontWeight: 700 }}>SquallDev</a>
          </span>
        <br />
        <span style={{ color: '#555', fontSize: 14, fontWeight: 500, marginTop: 6, display: 'block' }}>
          Bolão SCA &nbsp;|&nbsp; Todos os direitos reservados &copy; {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  );
}

function App() {
  // Captura mensagem de erro vinda do redirecionamento
  const location = useLocation();
  const erroMsg = location.state?.erro;

  // Protege rotas que exigem autenticação
  const RequireAuth = ({ children }) => {
    const auth = useAuth() || {};
    // Considera sessão ativa se temos nome (carregado via /auth/me) ou tipo definido
    if (!auth?.nome && !auth?.tipo) {
      return <Navigate to="/login" replace state={{ erro: 'Você precisa estar logado ou faça seu cadastro!' }} />;
    }
    return children;
  };

  const hideAdminSubMenu = /\/admin\/usuarios\/[0-9]+\/editar/.test(location.pathname);

  return (
    <div className="app">
      <Menu />
      <main className="main-content">
        {location.pathname === '/' && <ApostaTimer />}
        {erroMsg && (
          <div className="error-message" style={{ marginBottom: 16 }}>{erroMsg}</div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/anuncio" element={<AdminAnuncio />} />
            <Route path="/admin/apoio/edit" element={<ApoioEdit />} />
            <Route path="/apoio/user" element={<ApoioUser />} />
          <Route path="/bolao" element={<BolaoList />} />
          <Route path="/lancar-resultado" element={<LancarResultado />} />
          <Route path="/campeonato" element={<CampeonatoList />} />
          <Route path="/rodada" element={<RodadaList />} />
          <Route path="/partida" element={<PartidaList />} />
          <Route
            path="/palpite"
            element={
              <RequireAuth>
                <PalpiteList />
              </RequireAuth>
            }
          />
          <Route path="/ranking" element={<RankingList />} />
          <Route path="/perfil" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/anuncie" element={<Anuncie />} />
          <Route path="/admin/usuarios" element={<AdminUsers />} />
          <Route path="/admin/usuarios/:id/editar" element={<AdminUserEdit />} />
          <Route path="/admin/times" element={<AdminTeams />} />
          <Route path="/admin/boloes" element={<AdminBoloes />} />
          <Route path="/admin/blocked-ips" element={<AdminBlockedIPs />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/novo" element={<RequireAuth><BlogNew /></RequireAuth>} />
          <Route path="/blog/:id" element={<BlogDetail />} />
          <Route path="/blog/:id/editar" element={<RequireAuth><BlogEdit /></RequireAuth>} />
          <Route path="/regras" element={<Regras />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;