import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

import { SOCKET_URL } from './config';

export default function ChatRealtime({ userObj }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { withCredentials: true });
    socketRef.current.emit('join', userObj);

    socketRef.current.on('chatMessage', (msg) => {
      // Se msg for string, converte para objeto padrão
      let parsedMsg = msg;
      if (typeof msg === 'string') {
        parsedMsg = { message: msg, apelido: 'Usuário', tipo: '', timestamp: Date.now() };
      }
      setMessages((prev) => [...prev, parsedMsg]);
    });
    socketRef.current.on('onlineUsers', (users) => {
      setOnlineUsers(users);
    });
    return () => {
      socketRef.current.disconnect();
    };
  }, [userObj]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim()) {
      socketRef.current.emit('chatMessage', {
        message: input,
        apelido: userObj.apelido,
        tipo: userObj.tipo,
        timestamp: Date.now()
      });
      setInput('');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', background: '#f8f8f8', borderRadius: 12, boxShadow: '0 2px 8px #0002', padding: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Chat em tempo real</h3>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 8, maxHeight: 48, overflowY: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 'bold', color: '#2c3e50', marginRight: 6 }}>Online:</span>
        {onlineUsers.length === 0 ? (
          <span style={{ marginLeft: 8 }}>Ninguém</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 320 }}>
            {onlineUsers.slice(0, 10).map((user, idx) => {
              const isAdmin = String(user.tipo).toLowerCase() === 'admin';
              return (
                <span key={user.apelido + idx} style={{
                  background: isAdmin ? '#e3f2fd' : '#e8f5e9',
                  color: isAdmin ? '#1565c0' : '#388e3c',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontWeight: 'bold',
                  border: isAdmin ? '1px solid #90caf9' : '1px solid #c8e6c9',
                  boxShadow: isAdmin ? '0 1px 4px #1565c022' : '0 1px 4px #388e3c22',
                  marginBottom: 2
                }}>{isAdmin ? 'Admin' : user.apelido}</span>
              );
            })}
            {onlineUsers.length > 10 && (
              <span style={{ color: '#388e3c', fontWeight: 'bold', marginLeft: 8 }}>
                +{onlineUsers.length - 10} mais
              </span>
            )}
          </div>
        )}
      </div>
      <div style={{ height: 220, overflowY: 'auto', background: '#fff', borderRadius: 8, padding: 8, marginBottom: 8, border: '1px solid #eee' }}>
        {messages.map((msg, i) => {
          if (typeof msg !== 'object' || typeof msg.message !== 'string') return null;
          const isAdmin = String(msg.tipo).toLowerCase() === 'admin';
          const displayName = isAdmin ? 'Admin' : (msg.apelido || 'Usuário');
          return (
            <div key={i} style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 'bold', color: isAdmin ? '#1565c0' : '#2c3e50' }}>{displayName}:</span> <span>{msg.message}</span>
              <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6 }}>
                {msg.timestamp ? `${new Date(msg.timestamp).toLocaleTimeString()} - ${new Date(msg.timestamp).toLocaleDateString()}` : ''}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '6px 12px', borderRadius: 6, background: '#2c3e50', color: '#fff', border: 'none' }}>Enviar</button>
      </form>
    </div>
  );
}
