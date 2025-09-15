import React from 'react';
import { Link } from 'react-router-dom';

export default function Manutencao() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f8f9fa, #e9ecef)',
      color: '#2c3e50',
      padding: 20,
      textAlign: 'center'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '40px 28px',
        maxWidth: 500,
        width: '100%',
        boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
      }}>
        <span style={{ fontSize: 60, display: 'block', marginBottom: 16 }}>🛠️</span>
        <h1 style={{
          fontSize: 32,
          color: '#f39c12',
          marginBottom: 16,
          fontWeight: 'bold',
          letterSpacing: 1
        }}>
          Estamos em manutenção
        </h1>
        <p style={{ fontSize: 18, marginBottom: 32, lineHeight: 1.5 }}>
          O site está passando por melhorias.<br />
          Voltamos em breve! 🚀
        </p>

        {/* Botão para login */}
        <Link
          to="/login"
          style={{
            display: 'inline-block',
            background: '#1976d2',
            color: '#fff',
            padding: '12px 28px',
            borderRadius: 8,
            fontSize: 18,
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#125ea8'}
          onMouseOut={e => e.currentTarget.style.background = '#1976d2'}
        >
          🔑 Acessar Login
        </Link>
      </div>

      <footer style={{
        marginTop: 40,
        fontSize: 14,
        color: '#6c757d'
      }}>
        © {new Date().getFullYear()} Bolão SCA — Todos os direitos reservados
      </footer>
    </div>
  );
}
