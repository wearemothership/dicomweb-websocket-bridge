/**
 * @fileOverview This file contains the clientsPlugin which sets up a WebSocket server
 * using Socket.IO and Redis for pub/sub messaging. It handles both secure and insecure
 * server configurations and manages incoming WebSocket connections.
 */

import { Server, ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import httpsServer from "https";
import httpServer from "http";
import { readFileSync } from "fs";
import socketIOStream from "@wearemothership/socket.io-stream";
import utils from "./utils";
import {
  websocketPort, secure, withCors, certKeyPath,
  certPath, certChainPath, certRevPath, knownOrigins
} from "./config";

/**
 * Clients plugin for Fastify that initializes a WebSocket server.
 * @param {FastifyInstance} fastify - The Fastify instance.
 * @returns {Promise<Server>} The initialized Socket.IO server.
 */
const clientsPlugin = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  try {
    let webServer;

    // Create a secure or insecure server based on the configuration
    if (secure) {
      logger.info("Starting secure server");
      webServer = httpsServer.createServer({
        key: readFileSync(certKeyPath, "utf8"),
        cert: readFileSync(certPath, "utf8"),
        ca: [readFileSync(certChainPath, "utf8")],
        crl: [readFileSync(certRevPath, "utf8")],
        requestCert: true,
        rejectUnauthorized: true
      });
    }
    else {
      logger.warn("Starting insecure server");
      webServer = httpServer.createServer();
    }

    // Configure Socket.IO options
    const ioOptions: Partial<ServerOptions> | undefined = withCors ? {
      cors: {
        origin: knownOrigins,
        methods: ["GET", "OPTIONS", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Type", "Authorization"]
      },
      transports: ["websocket"],
      maxHttpBufferSize: 2e8 // 200MB
    } : undefined;

    // Initialize Socket.IO server
    const io = new Server(webServer, ioOptions);
    const pubClient = createClient({ url: "redis://localhost:6379" });
    const subClient = pubClient.duplicate();

    // Set up Redis client event listeners
    pubClient.on("error", (err) => logger.error("[pubClient] Redis Client Error", err));
    pubClient.on("connect", () => logger.info("[pubClient] Connect"));
    pubClient.on("reconnecting", () => logger.info("[pubClient] Reconnecting"));
    pubClient.on("ready", () => logger.info("[pubClient] Ready"));
    subClient.on("error", (err) => logger.error("[subClient] Redis Client Error", err));
    subClient.on("connect", () => logger.info("[subClient] Connect"));
    subClient.on("reconnecting", () => logger.info("[subClient] Reconnecting"));
    subClient.on("ready", () => logger.info("[subClient] Ready"));
    subClient.on("disconnect", (reason) => logger.info(`[subClient] Disconnect ${reason}`));

    // Connect to Redis clients
    await Promise.all([pubClient.connect(), subClient.connect()]);

    // Set up the Socket.IO adapter with Redis
    io.adapter(createAdapter(
      pubClient,
      subClient,
      {
        requestsTimeout: 10000,
        publishOnSpecificResponseChannel: true
      }
    ));

    // Start the web server
    webServer.listen(websocketPort);
    logger.info(`websocket-server listening on port: ${websocketPort}`);

    // Handle incoming WebSocket connections
    io.on("connection", (socket) => {
      const origin = socket.conn.remoteAddress;
      logger.info(`websocket client connected from origin: ${origin}`);
      const { token } = socket.handshake.auth;
      logger.info("Added socket to clients", token);
      socketIOStream(socket);
      socket.join(token);

      // Handle socket errors
      socket.on("error", (err) => logger.error(`Socket Error ${err.message}`));

      // Handle socket disconnection
      socket.on("disconnect", (reason) => {
        logger.info(`websocket client disconnected, origin: ${origin}, reason: ${reason}`);
        socket.join(token);
      });
    });

    // Decorate Fastify instance with Socket.IO server
    fastify.decorate("io", io);
  }
  catch (e) {
    logger.error("[clientsPlugin]", e);
    throw e;
  }
};

export default fp(clientsPlugin);
