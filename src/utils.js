const config = require('config');
const shell = require('shelljs');
const simpleLogger = require('simple-node-logger');

// make sure default directories exist
const logDir = config.get('logDir');
shell.mkdir('-p', logDir);

// create a rolling file logger based on date/time that fires process events
const opts = {
  errorEventName: 'error',
  logDirectory: logDir, // NOTE: folder must exist and be writable...
  fileNamePattern: 'roll-<DATE>.log',
  dateFormat: 'YYYY.MM.DD',
};
const manager = simpleLogger.createLogManager();
manager.createRollingFileAppender(opts);
const logger = manager.createLogger();

const utils = {
  getLogger: () => logger
};
module.exports = utils;
