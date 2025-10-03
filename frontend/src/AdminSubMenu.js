import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './AdminSubMenu.css';

export default function AdminSubMenu() {
  const [open, setOpen] = useState(false);

  function closeMenu() { setOpen(false); }

  const linkClass = ({ isActive }) => isActive ? 'active' : '';
  return (
    <nav className={`admin-submenu ${open ? 'open' : ''}`} aria-label="Submenu administrativo">
      <button
        type="button"
        className="admin-submenu-toggle"
        aria-expanded={open}
        aria-controls="admin-submenu-list"
        onClick={() => setOpen(o => !o)}
      >
        <span className="toggle-icon" aria-hidden="true">☰</span>
        <span className="toggle-text">Menu Admin</span>
      </button>
      <ul id="admin-submenu-list" role="menubar">
        <li role="none"><NavLink role="menuitem" to="/admin/usuarios" end className={linkClass} onClick={closeMenu}>Usuários</NavLink></li>
        <li role="none"><NavLink role="menuitem" to="/admin/times" end className={linkClass} onClick={closeMenu}>Times</NavLink></li>
        <li role="none"><NavLink role="menuitem" to="/admin/boloes" end className={linkClass} onClick={closeMenu}>Rodadas/Partidas</NavLink></li>
        <li role="none"><NavLink role="menuitem" to="/admin/anuncio" end className={linkClass} onClick={closeMenu}>Anúncio TV</NavLink></li>
        <li role="none"><NavLink role="menuitem" to="/admin/apoio/edit" end className={linkClass} onClick={closeMenu}>Apoio</NavLink></li>
        <li role="none"><NavLink role="menuitem" to="/admin/blocked-ips" end className={linkClass} onClick={closeMenu}>Desbloqueio IP/Usuário</NavLink></li>
        <li role="none"><NavLink role="menuitem" to="/regras" end className={linkClass} onClick={closeMenu}>Regras</NavLink></li>
      </ul>
    </nav>
  );
}
