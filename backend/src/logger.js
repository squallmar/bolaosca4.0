// Simple structured logger (no external deps)
// Usage: import { logger } from './logger.js'; logger.info('message', { meta });
const LEVELS = ['trace','debug','info','warn','error'];
const ENV_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const MIN_INDEX = LEVELS.indexOf(ENV_LEVEL) === -1 ? 2 : LEVELS.indexOf(ENV_LEVEL);

function log(level, message, meta) {
  const idx = LEVELS.indexOf(level);
  if (idx < MIN_INDEX) return;
  const rec = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(meta && typeof meta === 'object' ? { meta } : {})
  };
  // Use stdout for <= info, stderr for warn/error
  const line = JSON.stringify(rec);
  if (level === 'warn' || level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  trace: (m, meta) => log('trace', m, meta),
  debug: (m, meta) => log('debug', m, meta),
  info: (m, meta) => log('info', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  error: (m, meta) => log('error', m, meta),
};

export default logger;
