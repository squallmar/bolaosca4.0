
import React, { useEffect, useState } from 'react';
import './ApostaTimer.css';
import api from './services/api';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { API_BASE } from './config';

function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

const TIMEZONE = 'America/Sao_Paulo';

function getNextSaturday14h() {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  const day = zonedNow.getDay();
  const isAfterDeadline = day === 6 && zonedNow.getHours() >= 14;
  const diff = isAfterDeadline ? 7 : (6 - day);
  const nextSaturday = new Date(zonedNow);
  nextSaturday.setDate(zonedNow.getDate() + diff);
  nextSaturday.setHours(14, 0, 0, 0);
  return fromZonedTime(nextSaturday, TIMEZONE);
}

const ApostaTimer = () => {
  const [timeLeft, setTimeLeft] = useState('');
  const [visivel, setVisivel] = useState(true);
  const [hasOpenRodada, setHasOpenRodada] = useState(null);

  useEffect(() => {
    api.get(`${API_BASE}/bolao/rodadas-todas`)
      .then(res => {
        const rodadas = Array.isArray(res.data) ? res.data : (res.data.rodadas || []);
        const abertas = rodadas.filter(r => !r.finalizada && !r.finalizado);
        setHasOpenRodada(abertas.length > 0);
      })
      .catch(() => setHasOpenRodada(false));
  }, []);

  useEffect(() => {
    if (!hasOpenRodada) return;
    const updateTimer = () => {
      const now = new Date();
      const deadline = getNextSaturday14h();
      const diffMs = deadline - now;
      if (diffMs <= 0) {
        setTimeLeft('Apostas encerradas!');
        return;
      }
      setTimeLeft(formatCountdown(diffMs));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hasOpenRodada]);

  if (!visivel) return null;
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
};

export default ApostaTimer;
