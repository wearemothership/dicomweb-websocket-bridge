import { Server, ServerOptions } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import httpsServer from "https";
import httpServer from "http";
import { readFileSync } from "fs";
import utils from "./utils";
import {
  websocketPort, secure, withCors, certKeyPath,
  certPath, certChainPath, certRevPath, knownOrigins
} from "./config";

const clientsPlugin = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  try {
    let webServer;

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

    const ioOptions: Partial<ServerOptions> | undefined = withCors ? {
      cors: {
        origin: knownOrigins,
        methods: ["GET", "OPTIONS", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["Content-Type", "Authorization"]
      },
      transports: ["websocket"],
      maxHttpBufferSize: 2e8 // 20MB
    } : undefined;

    const io = new Server(webServer, ioOptions);
    const pubClient = createClient({ url: "redis://localhost:6379" });
    const subClient = pubClient.duplicate();
    pubClient.on("error", (err) => logger.error("[pubClient] Redis Client Error", err));
    subClient.on("error", (err) => logger.error("[subClient] Redis Client Error", err));
    await Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      webServer.listen(websocketPort);
    });
    logger.info(`websocket-server listening on port: ${websocketPort}`);

    // incoming websocket connections are registered here
    io.on("connection", async (socket) => {
      const origin = socket.conn.remoteAddress;
      logger.info(`websocket client connected from origin: ${origin}`);
      const { token } = socket.handshake.auth;
      logger.info("Added socket to clients", token);
      socket.join(token);

      socket.on("disconnect", (reason) => {
        logger.info(`websocket client disconnected, origin: ${origin}, reason: ${reason}`);
        socket.join(token);
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
