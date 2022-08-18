// eslint-disable-next-line import/no-extraneous-dependencies
import dotenv from "dotenv-safe";
import path from "path";

dotenv.config({ path: path.resolve("./.env") });

export const requireProcessEnv = (name: string) => {
  if (!process.env[name]) {
    throw new Error(`You must set the ${name} environment variable`);
  }
  return process.env[name];
};

console.log(requireProcessEnv("SECURE"), typeof requireProcessEnv("SECURE"), requireProcessEnv("SECURE") === "true");

export const env = process.env.NODE_ENV ?? "development";
export const root = path.join(__dirname, "..");
export const webserverPort = process.env.WEBSERVER_PORT
  ? parseInt((process.env.WEBSERVER_PORT as string), 10)
  : 5001;
export const websocketPort = process.env.WEBSOCKET_PORT
  ? parseInt((process.env.WEBSOCKET_PORT as string), 10)
  : 5001;
export const logDir = requireProcessEnv("LOG_DIR") as string;
export const websocketToken = requireProcessEnv("WEBSOCKET_TOKEN") as string;
export const pacsSecret = requireProcessEnv("JWT_PACS_SECRET") as string;
export const pacsIssuer = requireProcessEnv("JWT_PACS_ISSUER") as string;
export const secure = requireProcessEnv("SECURE") === "true";
export const withCors = requireProcessEnv("WITH_CORS") === "true";
export const certKeyPath = requireProcessEnv("CERT_KEY_PATH") as string;
export const certPath = requireProcessEnv("CERT_PATH") as string;
export const certChainPath = requireProcessEnv("CERT_CHAIN_PATH") as string;
export const certRevPath = requireProcessEnv("CERT_REVOCATION_PATH") as string;
export const knownOrigins = (requireProcessEnv("KNOWN_ORIGINS") as string).split(", ");
