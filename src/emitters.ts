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
  const { io } = fastify;

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
    io.in(token).timeout(20000).emit(
      "qido-request",
      { level, query },
      (err, response) => {
        if (err || !response) {
          logger.error(`[QIDO-RS] Error ${err}`);
          reply.status(500).send(`[QIDO-RS] Error ${err}`);
          return resolve();
        }
        const { success, data } = Array.isArray(response)
          ? response[0] ?? response[1]
          : response;
        if (!success) {
          logger.error("[QIDO-RS] Failed");
          reply.status(500).send("[QIDO-RS] Failed");
          return resolve();
        }
        reply.status(200).send(data);
        return resolve();
      }
    );
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
      io.in(token).timeout(20000).emit("wado-request", { query }, (err, response) => {
        if (err || !response) {
          logger.error(`[WADO-RS] No Response or error ${err}`);
          reply.status(500).send(`[WADO-RS] No Response or error ${err}`);
          return resolve();
        }
        const { buffer, headers, success } = Array.isArray(response)
          ? response[0] ?? response[1]
          : response;
        if (!success) {
          logger.error("[WADO-RS] Failed");
          reply.status(500).send("[WADO-RS] Failed");
          return resolve();
        }
        if (!buffer || buffer.length === 0) {
          logger.error("[WADO-RS] Empty Buffer");
          reply.status(500).send("[WADO-RS] Empty Buffer");
          return resolve();
        }
        const { contentType } = headers ?? {};
        reply.status(200);
        reply.header("content-type", contentType);
        reply.send(buffer);
        return resolve();
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
    io.in(token).timeout(20000).emit(
      "stow-request",
      body,
      { contentType: type },
      (err, response) => {
        if (err || !response) {
          logger.error(`[STOW-RS] Error ${err}`);
          reply.status(500).send(`[STOW-RS] Error ${err}`);
          return resolve();
        }
        const { success } = Array.isArray(response)
          ? response[0] ?? response[1]
          : response;
        if (!success) {
          logger.error("[STOW-RS] Failed");
          reply.status(500).send("[STOW-RS] Failed");
          return resolve();
        }
        reply.status(200).send(response);
        return resolve();
      }
    );
  });

  // Decorate the Fastify instance with the emitToStowRsClient method
  fastify.decorate("emitToStowRsClient", emitToStowRsClient);
};

export default fp(emittersPlugin);
