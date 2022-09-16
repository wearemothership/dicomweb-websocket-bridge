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
  // eslint-disable-next-line no-async-promise-executor
  ): Promise<void> => new Promise(async (resolve) => {
    logger.info("QIDO-RS Request");
    io.in(token).timeout(1000).emit("qido-request", { level, query }, (err, data) => {
      if (err) {
        reply.status(500).send(err);
        logger.error("QIDO-RS", err);
        resolve();
        return;
      }
      reply.send(data[0]);
      resolve();
    });
  });

  fastify.decorate("emitToWsClient", emitToWsClient);

  const emitToWadoWsClient = (reply, query, token): Promise<void> => new Promise((resolve) => {
    logger.info("WADO-RS Request");
    io.in(token).timeout(10000).emit("wado-request", { query }, (err, response) => {
      if (err || !response) {
        reply.status(500).send(err ?? "No response stream");
        logger.error("WADO-RS", err, response);
        resolve();
      }
      else {
        const [{ buffer, headers }] = response;
        const { contentType } = headers ?? {};
        reply.status(200);
        reply.header("content-type", contentType);
        reply.send(buffer);
        resolve();
      }
    });
  });

  fastify.decorate("emitToWadoWsClient", emitToWadoWsClient);

  const emitToStowRsClient = (
    reply,
    body,
    token,
    type
  ): Promise<void> => new Promise((resolve) => {
    logger.info("STOW-RS Request", body.length);
    io.in(token).timeout(10000).emit("stow-request", body, { contentType: type }, (data) => {
      if (data instanceof Error) {
        reply.status(500);
        logger.error("STOW-RS", data);
      }
      reply.send(data);
      resolve();
    });
  });

  fastify.decorate("emitToStowRsClient", emitToStowRsClient);
};

export default fp(emittersPlugin);
