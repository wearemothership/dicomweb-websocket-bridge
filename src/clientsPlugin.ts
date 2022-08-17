import config from "config";
import { Server } from "socket.io";
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { Socket } from "socket.io";
import httpsServer from "https";
import httpServer from "http";
import { readFileSync } from "fs";
import knownOrigins from "../config/knownOrigins";
import utils from "./utils";

const clientsPlugin = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  try {
    const connectedClients: Record<string, Socket> = {};
    fastify.decorate("connectedClients", connectedClients);

    const wsPort = config.get("websocketPort") as number;
    const secure = config.get("secure") === "true";
    const withCors = config.get("withCors") === "true";
    let webServer;

    if (secure) {
      logger.info("Starting secure server");
      webServer = httpsServer.createServer({
        key: readFileSync(config.get("certificateKeyPath"), "utf8"),
        cert: readFileSync(config.get("certificatePath"), "utf8"),
        ca: [readFileSync(config.get("certificateChainPath"), "utf8")],
        crl: [readFileSync(config.get("certificateRevocationList"), "utf8")],
        requestCert: true,
        rejectUnauthorized: true
      });
    }
    else {
      logger.warn("Starting insecure server");
      webServer = httpServer.createServer();
    }

    const ioOptions = withCors ? {
      cors: {
        origin: knownOrigins,
        methods: ["GET", "OPTIONS", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Type", "Authorization"]
      }
    } : undefined;

    const io = new Server(webServer, ioOptions);
    webServer.listen(wsPort);
    logger.info(`websocket-server listening on port: ${wsPort}`);

    // incoming websocket connections are registered here
    io.on("connection", (socket) => {
      const origin = socket.conn.remoteAddress;
      logger.info(`websocket client connected from origin: ${origin}`);
      const { token } = socket.handshake.auth;
      logger.info("Added socket to clients", token);
      connectedClients[token] = socket;

      socket.on("disconnect", (reason) => {
        logger.info(`websocket client disconnected, origin: ${origin}, reason: ${reason}`);
        delete connectedClients[token];
      });
    });

    fastify.decorate("io", io);
    return io;
  }
  catch (e) {
    logger.error("[clientsPlugin]", e);
    throw e;
  }
};

export default fp(clientsPlugin);
