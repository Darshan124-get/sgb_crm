const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
  debug: (msg, ...args) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[DEBUG] ${msg}`, ...args);
    }
  }
};

module.exports = logger;
