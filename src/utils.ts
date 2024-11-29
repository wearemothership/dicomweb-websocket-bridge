/**
 * @fileOverview This module provides logging functionality using a rolling file logger.
 * It ensures that the default logging directory exists and creates a logger that rolls log files
 * based on date and time.
 */

import SimpleLogger from "simple-node-logger";
import fs from "fs/promises";
import { logDir } from "./config";

// Ensure that the default logging directory exists
fs.mkdir(logDir, { recursive: true })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`Log directory created at: ${logDir}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`Failed to create log directory: ${err}`);
  });

// Options for the rolling file logger
const opts = {
  errorEventName: "error", // Event name for logging errors
  logDirectory: logDir, // Directory where log files will be stored
  fileNamePattern: "roll-<DATE>.log", // Pattern for log file names
  dateFormat: "YYYY.MM.DD", // Date format for log files
};

// Create a log manager and a rolling file appender
const manager = SimpleLogger.createLogManager();
manager.createRollingFileAppender(opts);

// Create a logger instance
const logger = manager.createLogger();

/**
 * Gets the logger instance.
 * @returns {Object} The logger instance for logging messages.
 */
export default {
  getLogger: () => logger // Function to retrieve the logger instance
};
