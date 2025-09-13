import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    // Busca rodadas abertas
  api.get(`${API_BASE}/bolao/rodadas-todas`)
      .then(res => {
        const rodadas = Array.isArray(res.data) ? res.data : (res.data.rodadas || []);
        console.log('Rodadas recebidas:', rodadas);
        const abertas = rodadas.filter(r => !r.finalizada && !r.finalizado);
        console.log('Rodadas abertas:', abertas);
        setHasOpenRodada(abertas.length > 0);
      })
      .catch((err) => {
        console.error('Erro ao buscar rodadas:', err);
        setHasOpenRodada(false);
      });
  }, []);

  useEffect(() => {
    if (!hasOpenRodada) return;
    const updateTimer = () => {
      const now = new Date();
      const deadline = getNextSaturday14h();
      const diffMs = deadline - now;
      if (diffMs <= 0) {
        setTimeLeft('Apostas encerradas!');
        setIsWarning(true);
        return;
      }
      setTimeLeft(formatCountdown(diffMs));
      setIsWarning(diffMs < 15 * 60 * 1000); // menos de 15 minutos
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hasOpenRodada]);

  const [visivel, setVisivel] = useState(true);
  if (!visivel) return null;
  return (
    <>
      <style>{`
        .aposta-timer-visual {
          position: fixed;
          top: 110px;
          left: 24px;
          z-index: 1000;
          width: 200px;
          min-height: 80px;
          max-width: 200px;
          border-radius: 12px;
          box-sizing: border-box;
          font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif;
          font-weight: 700;
          font-size: 0.95em;
          letter-spacing: 0.35px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0.38em 0.22em;
          box-shadow: 0 4px 16px 1px #b71c1c88;
          border: 2px solid #fff;
          overflow: hidden;
          background: linear-gradient(135deg,#ff1744 0%,#b71c1c 100%);
          color: #fff;
          transition: box-shadow 0.2s;
          animation: apostaPulse 1.2s infinite;
        }
        .aposta-timer-close {
          position: absolute;
          top: 8px;
          right: 12px;
          background: #b71c1cdd;
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px 0px #b71c1c88;
          transition: background 0.2s;
        }
        .aposta-timer-icon {
          font-size: 1.2em; 
          margin-bottom: 0.09em; 
          filter: drop-shadow(0 2px 4px #fff8);
          text-shadow: 0 1px 4px #b71c1c88;
        }
        .aposta-timer-title {
          font-size: 0.98em; 
          font-weight: 700;
          text-align: center;
          margin-bottom: 0.13em;
          letter-spacing: 0.5px;
          text-shadow: 0 1px 4px #fff6, 0 1px 0 #b71c1c;
        }
        .aposta-timer-badge {
          background: #fff;
          color: #b71c1c;
          font-size: 1em;
          font-weight: bold;
          border-radius: 50%;
          padding: 0.13em 0.38em;
          margin-bottom: 0.13em;
          box-shadow: 0 2px 8px #b71c1c88;
          border: 2px solid #b71c1c;
          display: inline-block;
          transition: box-shadow 0.2s;
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
