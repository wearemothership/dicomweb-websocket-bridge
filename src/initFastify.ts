/**
 * @fileOverview Initializes the Fastify server with various plugins and configurations.
 * @module initFastify
 */

import path from "path";
import jsonwebtoken from "jsonwebtoken";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import fastifySensible from "@fastify/sensible";
import fastifyHelmet from "@fastify/helmet";
import clientsPlugin from "./clientsPlugin";
import emittersPlugin from "./emitters";
import callQueuePlugin from "./callQueuePlugin";
import utils from "./utils";
import routes from "./routes";
import {
  websocketToken, webserverPort, pacsSecret, pacsIssuer
} from "./config";

/**
 * Initializes the Fastify server.
 * @returns {Promise<Fastify>} The initialized Fastify server instance.
 * @throws {Error} Throws an error if server initialization fails.
 */
const initServer = async () => {
  const logger = utils.getLogger();
  try {
    const defaultToken = websocketToken; // Set the default token from configuration
    const fastify = Fastify({ logger: false, bodyLimit: 20971520 }); // Create Fastify instance with body limit

    // Register various plugins
    await fastify.register(clientsPlugin);
    await fastify.register(callQueuePlugin);
    await fastify.register(emittersPlugin);
    await fastify.register(fastifyStatic, {
      root: path.join(__dirname, "../public"), // Serve static files from the public directory
    });
    await fastify.register(fastifyCors, {
      origin: true
    }); // Enable CORS
    await fastify.register(fastifySensible); // Register sensible utilities
    await fastify.register(fastifyHelmet, { contentSecurityPolicy: false }); // Register helmet for security

    // Decorate request with multipart property
    fastify.decorateRequest("multipart");
    fastify.addContentTypeParser("multipart/related", { parseAs: "buffer" }, async (request, payload) => {
      request.multipart = payload; // Parse multipart/related content
    });

    // Decorate request with websocketToken
    fastify.decorateRequest("websocketToken", websocketToken);

    // Hook to handle incoming requests
    fastify.addHook("onRequest", async (request, reply) => {
      try {
        const { io } = fastify; // Access the socket.io instance
        const { headers } = request; // Get request headers
        const token = headers.authorization?.replace(/bearer /ig, ""); // Extract token from headers
        let tokenToUse;

        if (token) {
          try {
            // Verify the token and extract websocketToken
            const { websocketToken: wst } = jsonwebtoken.verify(
              token,
              pacsSecret,
              { issuer: pacsIssuer }
            );
            tokenToUse = wst || defaultToken; // Use extracted token or default
          }
          catch (e) {
            logger.warn("[onRequest] Using default token", e); // Log warning and use default token
            tokenToUse = defaultToken;
          }
        }
        else {
          logger.warn("[onRequest] Using default token"); // Log warning for missing token
          tokenToUse = defaultToken;
        }

        // Check if the token is valid by looking for it in the connected sockets
        const socks = await io.fetchSockets();
        if (socks.find((s) => s.rooms.has(tokenToUse))) {
          request.websocketToken = tokenToUse; // Set the valid token on the request
        }
        else {
          logger.error("Token not valid"); // Log error for invalid token
          reply.status(401).send(); // Send unauthorized response
        }
      }
      catch (e) {
        logger.error("[onRequest]", e); // Log error during request handling
        reply.status(500).send(e); // Send internal server error response
      }
    });

    // Register routes with a prefix
    await fastify.register(routes, { prefix: "/viewer" });
    await fastify.listen({ port: webserverPort, host: "0.0.0.0" }); // Start the server
    logger.info(`web-server listening on port: ${webserverPort}`); // Log server start
    return fastify; // Return the Fastify instance
  }
  catch (e) {
    logger.error("[Init Fastify]", e); // Log error during initialization
    throw e; // Rethrow the error
  }
};

export default initServer;
