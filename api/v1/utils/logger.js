// src/utils/logger.js
const { createLogger, transports, format } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console()
  ]
});

// Stream para que Morgan lo invoque
logger.stream = {
  write: (message) => {
    // Morgan incluye un "\n" al final, lo quitamos
    logger.info(message.trim());
  }
};

module.exports = logger;
