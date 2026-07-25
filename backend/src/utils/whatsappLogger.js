const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../../debug.log');

const writeLog = (level, msg, ...args) => {
  try {
    const time = new Date().toISOString();
    const formattedMsg = `[${time}] [${level}] ${msg} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
    fs.appendFileSync(logFile, formattedMsg);
  } catch (err) {
    // Ignore log errors
  }
  if (level === 'ERROR') {
    console.error(`[ERROR] ${msg}`, ...args);
  } else if (level === 'WARN') {
    console.warn(`[WARN] ${msg}`, ...args);
  } else {
    console.log(`[INFO] ${msg}`, ...args);
  }
};

const logger = {
  info: (msg, ...args) => writeLog('INFO', msg, ...args),
  error: (msg, ...args) => writeLog('ERROR', msg, ...args),
  warn: (msg, ...args) => writeLog('WARN', msg, ...args),
  debug: (msg, ...args) => {
    if (process.env.DEBUG === 'true') {
      writeLog('DEBUG', msg, ...args);
    }
  }
};

module.exports = logger;
