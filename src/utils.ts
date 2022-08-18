import config from "config";
import SimpleLogger from "simple-node-logger";
import fs from "fs/promises";

// make sure default directories exist
const logDir = config.get("logDir") as string;
fs.mkdir(logDir, { recursive: true });

// create a rolling file logger based on date/time that fires process events
const opts = {
  errorEventName: "error",
  logDirectory: logDir, // NOTE: folder must exist and be writable...
  fileNamePattern: "roll-<DATE>.log",
  dateFormat: "YYYY.MM.DD",
};
const manager = SimpleLogger.createLogManager();
manager.createRollingFileAppender(opts);
const logger = manager.createLogger();

export default {
  getLogger: () => logger
};
