import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import utils from "./utils";

const emittersPlugin = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  const { addToQueue } = fastify;

  const emitToWsClient = (
    reply,
    level,
    query,
    token
  // eslint-disable-next-line no-async-promise-executor
  ): Promise<void> => new Promise(async (resolve) => {
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

  fastify.decorate("emitToWsClient", emitToWsClient);

  const emitToWadoWsClient = (reply, query, token): Promise<void> => new Promise(
    // eslint-disable-next-line no-async-promise-executor
    async (resolve) => {
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

  fastify.decorate("emitToWadoWsClient", emitToWadoWsClient);

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

  fastify.decorate("emitToStowRsClient", emitToStowRsClient);
};

export default fp(emittersPlugin);
