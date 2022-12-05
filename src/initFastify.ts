import path from "path";
import jsonwebtoken from "jsonwebtoken";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import fastifyHelmet from "@fastify/helmet";
import fastifyCompress from "@fastify/compress";
import clientsPlugin from "./clientsPlugin";
import emittersPlugin from "./emitters";
import utils from "./utils";
import routes from "./routes";
import {
  websocketToken, webserverPort, pacsSecret, pacsIssuer
} from "./config";

const initServer = async () => {
  const logger = utils.getLogger();
  try {
    const defaultToken = websocketToken;
    const fastify = Fastify({ logger: false, bodyLimit: 20971520 });

    await fastify.register(clientsPlugin);
    await fastify.register(emittersPlugin);
    await fastify.register(fastifyStatic, {
      root: path.join(__dirname, "../public"),
    });
    await fastify.register(fastifyCors, {});
    await fastify.register(fastifySensible);
    await fastify.register(fastifyHelmet, { contentSecurityPolicy: false });
    await fastify.register(fastifyCompress, { global: true });

    fastify.decorateRequest("multipart", "");
    fastify.addContentTypeParser("multipart/related", { parseAs: "buffer" }, async (request, payload) => {
      request.multipart = payload;
    });

    fastify.decorateRequest("websocketToken", websocketToken);

    fastify.addHook("onRequest", async (request, reply) => {
      try {
        const { io } = fastify;
        const { headers } = request;
        const token = headers.authorization?.replace(/bearer /ig, "");
        let tokenToUse;
        if (token) {
          try {
            const { websocketToken: wst } = jsonwebtoken.verify(
              token,
              pacsSecret,
              { issuer: pacsIssuer }
            );
            tokenToUse = wst || defaultToken;
          }
          catch (e) {
            logger.warn("[onRequest] Using default token", e);
            tokenToUse = defaultToken;
          }
        }
        else {
          logger.warn("[onRequest] Using default token");
          tokenToUse = defaultToken;
        }
        const socks = await io.fetchSockets();
        if (socks.find((s) => s.rooms.has(tokenToUse))) {
          request.websocketToken = tokenToUse;
        }
        else {
          logger.error("Token not valid");
          reply.status(401).send();
        }
      }
      catch (e) {
        logger.error("[onRequest]", e);
        reply.status(500).send(e);
      }
    });

    await fastify.register(routes, { prefix: "/viewer" });
    await fastify.listen({ port: webserverPort, host: "0.0.0.0" });
    logger.info(`web-server listening on port: ${webserverPort}`);
    return fastify;
  }
  catch (e) {
    logger.error("[Init Fastify]", e);
    throw e;
  }
};

export default initServer;
