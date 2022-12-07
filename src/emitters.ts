import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import utils from "./utils";

const emittersPlugin = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  const { io } = fastify;

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

  fastify.decorate("emitToWsClient", emitToWsClient);

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

  fastify.decorate("emitToWadoWsClient", emitToWadoWsClient);

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

  fastify.decorate("emitToStowRsClient", emitToStowRsClient);
};

export default fp(emittersPlugin);
