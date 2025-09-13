import React, { useEffect, useState } from 'react';
import './ApostaTimer.css';
import api from './services/api';
import { formatDistanceStrict } from 'date-fns';
import { API_BASE } from './config';

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

function getNextSaturday14h() {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  const day = zonedNow.getDay();
  // Se hoje é sábado e já passou das 14h, pega o próximo sábado
  const isAfterDeadline = day === 6 && zonedNow.getHours() >= 14;
  const diff = isAfterDeadline ? 7 : (6 - day);
  const nextSaturday = new Date(zonedNow);
  nextSaturday.setDate(zonedNow.getDate() + diff);
  nextSaturday.setHours(14, 0, 0, 0);
  // Converte para UTC para comparar corretamente
  return fromZonedTime(nextSaturday, TIMEZONE);
}


const ApostaTimer = () => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isWarning, setIsWarning] = useState(false);
  const [hasOpenRodada, setHasOpenRodada] = useState(null);
    return (
      <div className="aposta-timer-visual">
        <button
          className="aposta-timer-close"
          aria-label="Fechar aviso"
          onClick={() => setVisivel(false)}
          tabIndex={0}
        >
          ×
        </button>
        <span className="aposta-timer-icon">⚠️</span>
        <span className="aposta-timer-title">URGENTE! Prazo final para apostas</span>
        <span className="aposta-timer-badge">{timeLeft}</span>
        <span className="aposta-timer-desc">
          Atenção! O tempo está acabando.<br />Faça seu palpite agora ou ficará de fora!
        </span>
      </div>
    );
      const now = new Date();
      const deadline = getNextSaturday14h();
      const diffMs = deadline - now;
      if (diffMs <= 0) {
        setTimeLeft('Apostas encerradas!');
        <div className="aposta-timer-visual" style={{position:'relative'}}>
        }
        .aposta-timer-desc {
          font-size: 0.9em; 
          color: #fff;
          font-weight: 700;
          text-align: center;
          margin-bottom: 0.09em;
          text-shadow: 0 1px 4px #b71c1c88;
        }
        @keyframes apostaPulse {
          0% { box-shadow: 0 0 0 0 #b71c1c44; }
          50% { box-shadow: 0 0 16px 6px #b71c1c88; }
          100% { box-shadow: 0 0 0 0 #b71c1c44; }
        }
      `}</style>
      <div className="aposta-timer-visual" style={{position:'relative'}}>
        <button
          className="aposta-timer-close"
          aria-label="Fechar aviso"
          onClick={() => setVisivel(false)}
          tabIndex={0}
        >
          ×
        </button>
        <span className="aposta-timer-icon">⚠️</span>
        <span className="aposta-timer-title">URGENTE! Prazo final para apostas</span>
        <span className="aposta-timer-badge">{timeLeft}</span>
        <span className="aposta-timer-desc">
          Atenção! O tempo está acabando.<br />Faça seu palpite agora ou ficará de fora!
        </span>
      </div>
    </>
  );
};

export default ApostaTimer;
