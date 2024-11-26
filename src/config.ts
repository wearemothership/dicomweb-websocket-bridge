/**
 * @fileOverview Configuration file for the application.
 * This file loads environment variables and exports configuration constants.
 */

import dotenv from "dotenv-safe";
import path from "path";

// Load environment variables from the .env file
dotenv.config({ path: path.resolve("./.env") });

/**
 * Retrieves the value of a specified environment variable.
 * @param {string} name - The name of the environment variable to retrieve.
 * @throws Will throw an error if the environment variable is not set.
 * @returns {string} The value of the environment variable.
 */
export const requireProcessEnv = (name: string) => {
  if (!process.env[name]) {
    throw new Error(`You must set the ${name} environment variable`);
  }
  return process.env[name];
};

// Application environment (development by default)
export const env = process.env.NODE_ENV ?? "development";

// Root directory of the application
export const root = path.join(__dirname, "..");

// Webserver port configuration
export const webserverPort = process.env.WEBSERVER_PORT
  ? parseInt((process.env.WEBSERVER_PORT as string), 10)
  : 5001;

// Websocket port configuration
export const websocketPort = process.env.WEBSOCKET_PORT
  ? parseInt((process.env.WEBSOCKET_PORT as string), 10)
  : 5001;

// Directory for logs
export const logDir = requireProcessEnv("LOG_DIR") as string;

// Token for websocket authentication
export const websocketToken = requireProcessEnv("WEBSOCKET_TOKEN") as string;

// JWT secret for PACS
export const pacsSecret = requireProcessEnv("JWT_PACS_SECRET") as string;

// JWT issuer for PACS
export const pacsIssuer = requireProcessEnv("JWT_PACS_ISSUER") as string;

// Secure connection flag
export const secure = requireProcessEnv("SECURE") === "true";

// CORS support flag
export const withCors = requireProcessEnv("WITH_CORS") === "true";

// Path to the certificate key
export const certKeyPath = requireProcessEnv("CERT_KEY_PATH") as string;

// Path to the certificate
export const certPath = requireProcessEnv("CERT_PATH") as string;

// Path to the certificate chain
export const certChainPath = requireProcessEnv("CERT_CHAIN_PATH") as string;

// Path to the certificate revocation list
export const certRevPath = requireProcessEnv("CERT_REVOCATION_PATH") as string;

// List of known origins for CORS
export const knownOrigins = (requireProcessEnv("KNOWN_ORIGINS") as string).split(", ");
