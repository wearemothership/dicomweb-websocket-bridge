/**
 * @fileOverview This file initializes the Fastify server and sets up WebSocket communication.
 * It also handles uncaught exceptions and server shutdown processes.
 */

import type { Server } from "socket.io";
import type { FastifyReply } from "fastify";
import utils from "./utils";
import initServer from "./initFastify";

/**
 * @interface AddToQueue
 * @description Represents a request to be added to the processing queue.
 * @property {string} socketId - The ID of the socket connection.
 * @property {"wado-request" | "qido-request" | "stow-request"} type - The type of request.
 * @property {function} callback - The callback function to handle the response.
 * @property {string} [level] - Optional level of the request.
 * @property {Record<string, string>} [query] - Optional query parameters.
 * @property {Buffer} [body] - Optional body of the request.
 * @property {Record<string, string>} [headers] - Optional headers for the request.
 * @property {string} [uuid] - Optional unique identifier for the request.
 */
export interface AddToQueue {
  socketId: string,
  type: "wado-request" | "qido-request" | "stow-request",
  callback: (err: null | Error, data?: Buffer | string, headers?: Record<string, string>) => void,
  level?: string,
  query?: Record<string, string>,
  body?: Buffer,
  headers?: Record<string, string>,
  oldUuid?: string
}

/* eslint-disable no-unused-vars */
/**
 * @module fastify
 * @description Extends the Fastify instance with custom methods and properties.
 */
declare module "fastify" {
  interface FastifyInstance {
    /**
     * Emits a message to a WebSocket client.
     * @param {FastifyReply} reply - The Fastify reply object.
     * @param {string} level - The level of the message.
     * @param {unknown} query - The query parameters.
     * @param {string} token - The WebSocket token.
     */
    emitToWsClient: (
      reply: FastifyReply, level: string, query: unknown, token: string
    ) => void,

    /**
     * Emits a WADO message to a WebSocket client.
     * @param {FastifyReply} reply - The Fastify reply object.
     * @param {unknown} query - The query parameters.
     * @param {string} token - The WebSocket token.
     */
    emitToWadoWsClient: (
      reply: FastifyReply, query: unknown, token: string
    ) => void,

    /**
     * Emits a STOW-RS message to a WebSocket client.
     * @param {FastifyReply} reply - The Fastify reply object.
     * @param {Buffer} body - The body of the request.
     * @param {string} token - The WebSocket token.
     * @param {string} type - The type of the request.
     */
    emitToStowRsClient: (
      reply: FastifyReply, body: Buffer, token: string, type: string
    ) => void,

    io: Server,
    addToQueue: (args: AddToQueue) => void
  }

  interface FastifyRequest {
    websocketToken: string; // Token for WebSocket authentication
    multipart: Buffer; // Buffer for multipart data
  }
}
/* eslint-enable no-unused-vars */

const logger = utils.getLogger();

// Log uncaught exceptions
process.on("uncaughtException", async (err) => {
  await logger.error("uncaught exception received:");
  await logger.error(err.stack);
});

// Immediately invoked function to start the server
(async () => {
  logger.info("starting...");
  const fastify = await initServer(); // Initialize the Fastify server
  const { io } = fastify; // Extract the Socket.IO server instance

  // Handle server shutdown on SIGINT
  process.on("SIGINT", async () => {
    await logger.info("shutting down web server...");
    io.close(); // Close the WebSocket server
    fastify.close().then(
      async () => {
        await logger.info("webserver shutdown successfully");
      },
      (err) => {
        logger.error("webserver shutdown failed", err);
      },
    );
    process.exit(1); // Exit the process
  });
})();
