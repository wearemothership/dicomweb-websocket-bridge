/**
 * @fileOverview This module provides a Fastify plugin for emitting messages to WebSocket clients.
 * It includes methods for handling QIDO-RS, WADO-RS, and STOW-RS requests.
 *
 * This plugin allows the Fastify server to communicate with WebSocket clients
 * by emitting specific types of requests and handling their responses.
 */

import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import utils from "./utils";

/**
 * Fastify plugin to add WebSocket emitting capabilities.
 *
 * @param {FastifyInstance} fastify - The Fastify instance.
 * @returns {Promise<void>} A promise that resolves when the plugin is registered.
 */
const emittersPlugin = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  const { addToQueue } = fastify;

  /**
   * Emits a QIDO-RS request to the WebSocket client.
   *
   * @param {Object} reply - The Fastify reply object.
   * @param {string} level - The level of the request.
   * @param {Object} query - The query parameters for the request.
   * @param {string} token - The WebSocket token for the client.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  const emitToWsClient = (
    reply,
    level,
    query,
    token
  ): Promise<void> => new Promise((resolve) => {
    logger.info("QIDO-RS Request");
    addToQueue({
      socketId: token,
      type: "qido-request",
      level,
      query,
      callback: (err, response) => {
        if (err) {
          reply.status(500).send(err);
          logger.error("QIDO-RS", err);
          resolve();
          return;
        }
        reply.send(response);
        resolve();
      }
    });
  });

  // Decorate the Fastify instance with the emitToWsClient method
  fastify.decorate("emitToWsClient", emitToWsClient);

  /**
   * Emits a WADO-RS request to the WebSocket client.
   *
   * @param {Object} reply - The Fastify reply object.
   * @param {Object} query - The query parameters for the request.
   * @param {string} token - The WebSocket token for the client.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  const emitToWadoWsClient = (reply, query, token): Promise<void> => new Promise(
    (resolve) => {
      logger.info("WADO-RS Request");
      addToQueue({
        socketId: token,
        type: "wado-request",
        query,
        callback: (err, response, headers) => {
          if (err || !response || !headers) {
            reply.status(500).send("No response stream");
            logger.error("WADO-RS", response, headers);
            resolve();
            return;
          }
          const { contentType } = headers ?? {};
          reply.status(200);
          reply.header("content-type", contentType);
          reply.send(response);
          resolve();
        }
      });
    }
  );

  // Decorate the Fastify instance with the emitToWadoWsClient method
  fastify.decorate("emitToWadoWsClient", emitToWadoWsClient);

  /**
   * Emits a STOW-RS request to the WebSocket client.
   *
   * @param {Object} reply - The Fastify reply object.
   * @param {Object} body - The body of the request.
   * @param {string} token - The WebSocket token for the client.
   * @param {string} type - The content type of the request.
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   */
  const emitToStowRsClient = (
    reply,
    body,
    token,
    type
  ): Promise<void> => new Promise((resolve) => {
    logger.info("STOW-RS Request", body.length);
    addToQueue({
      socketId: token,
      type: "stow-request",
      body,
      headers: { contentType: type },
      callback: (err, response) => {
        if (err || !response) {
          reply.status(500).send("STOW-RS Failed", err);
          logger.error("STOW-RS", response);
          resolve();
          return;
        }
        reply.send(response);
        resolve();
      }
    });
  });

  // Decorate the Fastify instance with the emitToStowRsClient method
  fastify.decorate("emitToStowRsClient", emitToStowRsClient);
};

export default fp(emittersPlugin);
