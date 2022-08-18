import path from "path";
import config from "config";
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

const initServer = async () => {
  const logger = utils.getLogger();
  try {
    const defaultToken = config.get("websocketToken") as string;
    const httpPort = config.get("webserverPort") as number;
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

    fastify.decorateRequest("websocketToken", "");

    fastify.addHook("onRequest", async (request) => {
      const { headers } = request;
      const token = headers.authorization?.replace(/bearer /ig, "");
      if (token) {
        try {
          const secret = config.get("jwtPacsSecret") as string;
          const issuer = config.get("jwtPacsIssuer") as string;
          const { websocketToken } = jsonwebtoken.verify(token, secret, { issuer });
          request.websocketToken = websocketToken || defaultToken;
        }
        catch (e) {
          logger.warn("[onRequest] Using default token", e);
          request.websocketToken = defaultToken;
        }
      }
      else {
        logger.warn("[onRequest] Using default token");
        request.websocketToken = defaultToken;
      }
    });

    await fastify.register(routes, { prefix: "/viewer" });
    await fastify.listen({ port: httpPort, host: "0.0.0.0" });
    logger.info(`web-server listening on port: ${httpPort}`);
    return fastify;
  }
  catch (e) {
    logger.error("[Init Fastify]", e);
    throw e;
  }
};

export default initServer;
