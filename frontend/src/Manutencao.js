import React from 'react';

export default function Manutencao() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8f9fa',
      color: '#2c3e50'
    }}>
      <h1 style={{ fontSize: 38, color: '#f39c12', marginBottom: 16 }}>Estamos em manutenção</h1>
      <p style={{ fontSize: 20, marginBottom: 32 }}>
        O site está passando por melhorias.<br />
        Volte em breve!
      </p>
      <span style={{ fontSize: 48 }}>🛠️</span>
    </div>
  );
}
