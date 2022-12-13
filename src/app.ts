import type { Server } from "socket.io";
import type { FastifyReply } from "fastify";
import utils from "./utils";
import initServer from "./initFastify";

export interface AddToQueue {
  socketId: string,
  type: "wado-request" | "qido-request" | "stow-request",
  callback: (err: null | Error, data?: Buffer | string, headers?: Record<string, string>) => void,
  level?: string,
  query?: Record<string, string>,
  body?: Buffer,
  headers?: Record<string, string>,
  uuid?: string
}

/* eslint-disable no-unused-vars */
declare module "fastify" {
  interface FastifyInstance {
    emitToWsClient: (
      reply: FastifyReply, level: string, query: unknown, token: string
    ) => void,
    emitToWadoWsClient: (
      reply: FastifyReply, query: unknown, token: string
    ) => void,
    emitToStowRsClient: (
      reply: FastifyReply, body: Buffer, token: string, type: string
    ) => void,
    io: Server,
    addToQueue: (args: AddToQueue) => void
  }
  interface FastifyRequest {
    websocketToken: string;
    multipart: Buffer;
  }
}
/* eslint-enable no-unused-vars */

const logger = utils.getLogger();

// log exceptions
process.on("uncaughtException", async (err) => {
  await logger.error("uncaught exception received:");
  await logger.error(err.stack);
});

(async () => {
  logger.info("starting...");
  const fastify = await initServer();
  const { io } = fastify;

  process.on("SIGINT", async () => {
    await logger.info("shutting down web server...");
    io.close();
    fastify.close().then(
      async () => {
        await logger.info("webserver shutdown successfully");
      },
      (err) => {
        logger.error("webserver shutdown failed", err);
      },
    );
    process.exit(1);
  });
})();
