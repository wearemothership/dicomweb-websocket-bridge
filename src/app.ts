import config from "config";
import { v4 as uuidv4 } from "uuid";
import SocketIOStream from "@wearemothership/socket.io-stream";
import { Server } from "socket.io";
import path from "path";
import fastify from "fastify";
import jsonwebtoken from "jsonwebtoken";
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import fastifyHelmet from '@fastify/helmet';
import fastifyCompress from '@fastify/compress';
import utils from "./utils";
import httpsServer from "https";
import { readFileSync } from "fs";
import knownOrigins from "../config/knownOrigins";

declare module "fastify" {
  // eslint-disable-next-line no-unused-vars
  interface FastifyRequest {
    websocketToken: string
    multipart: Buffer
  }
}

interface QueryParams {
  [key: string]: string;
}

const httpPort = config.get("webserverPort") as number;
const wsPort = config.get("websocketPort") as number;
const defaultToken = config.get("websocketToken") as string;
const httpServer = httpsServer.createServer({
  key: readFileSync(config.get("certificateKeyPath"), "utf8"),
  cert: readFileSync(config.get("certificatePath"), "utf8"),
  ca: [readFileSync(config.get("certificateChainPath"), "utf8")],
  crl: [readFileSync(config.get("certificateRevocationList"), "utf8")],
  requestCert: true,
  rejectUnauthorized: true
})

const io = new Server(httpServer, {
  cors: {
    origin: knownOrigins,
    methods: ["GET", "OPTIONS", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type", "Authorization"]
  }
});
httpServer.listen(wsPort)
const server = fastify({ logger: false, bodyLimit: 20971520 });

server.register(fastifyStatic, {
  root: path.join(__dirname, "../public"),
});

server.register(fastifyCors, {});

server.register(fastifySensible);

server.register(fastifyHelmet, { contentSecurityPolicy: false });

server.register(fastifyCompress, { global: true });

server.decorateRequest("multipart", "");
server.addContentTypeParser("multipart/related", { parseAs: "buffer" }, async (request, payload) => {
  request.multipart = payload;
});

const logger = utils.getLogger();

const connectedClients = {};

const emitToWsClient = (reply, level, query, token): Promise<void> => new Promise((resolve) => {
  const client = connectedClients[token];
  if (!client || client.handshake.auth.token !== token) {
    const msg = "no ws client connected, cannot emit";
    logger.error(msg);
    reply.send(msg);
    resolve();
  }
  else {
    const uuid = uuidv4();
    client.once(uuid, (data) => {
      if (data instanceof Error) {
        reply.status(500);
      }
      reply.send(data);
      resolve();
    });

    client.emit("qido-request", { level, query, uuid });
  }
});

const emitToWadoWsClient = (reply, query, token): Promise<void> => new Promise((resolve) => {
  const client = connectedClients[token];
  if (!client || client.handshake.auth.token !== token) {
    const msg = "no ws client connected, cannot emit";
    logger.error(msg);
    reply.send(msg);
    resolve();
  }
  else {
    const uuid = uuidv4();
    SocketIOStream(client, {}).on(uuid, (stream, headers) => {
      const { contentType } = headers;
      reply.status(200);
      reply.header("content-type", contentType);
      const bufferData: Buffer[] = [];
      stream.on("data", (data) => {
        bufferData.push(data);
      });
      stream.on("end", () => {
        const b = Buffer.concat(bufferData);
        reply.send(b);
        resolve();
      });
    });
    client.on(uuid, (resp) => {
      if (resp instanceof Error) {
        reply.status(500).send(resp);
      }
    });
    client.emit("wado-request", { query, uuid });
  }
});

const emitToStowRsClient = (reply, body, token, type): Promise<void> => new Promise((resolve) => {
  const client = connectedClients[token];
  if (!client || client.handshake.auth.token !== token) {
    const msg = "no ws client connected, cannot emit";
    logger.error(msg);
    reply.send(msg);
    resolve();
  }
  else {
    const uuid = uuidv4();
    const stream = SocketIOStream.createStream({});
    SocketIOStream(client, {}).emit("stow-request", stream, { contentType: type, uuid });
    client.once(uuid, (data) => {
      if (data instanceof Error) {
        reply.status(500);
      }
      reply.send(data);
      resolve();
    });
    logger.info(body.length, token, type);
    let offset = 0;
    const chunkSize = 512 * 1024; // 512kb
    const writeBuffer = () => {
      let ok = true;
      do {
        const b = Buffer.alloc(chunkSize);
        body.copy(b, 0, offset, offset + chunkSize);
        ok = stream.write(b);
        offset += chunkSize;
      } while (offset < body.length && ok);
      if (offset < body.length) {
        stream.once("drain", writeBuffer);
      }
      else {
        stream.end();
      }
    };
    writeBuffer();

    client.emit("stow-request", { type, body, uuid });
  }
});

// log exceptions
process.on("uncaughtException", async (err) => {
  await logger.error("uncaught exception received:");
  await logger.error(err.stack);
});

//------------------------------------------------------------------

process.on("SIGINT", async () => {
  await logger.info("shutting down web server...");
  io.close();
  server.close().then(
    async () => {
      await logger.info("webserver shutdown successfully");
    },
    (err) => {
      logger.error("webserver shutdown failed", err);
    },
  );
  process.exit(1);
});

//------------------------------------------------------------------

// incoming websocket connections are registered here
io.on("connection", (socket) => {
  const origin = socket.conn.remoteAddress;
  logger.info(`websocket client connected from origin: ${origin}`);
  const { token } = socket.handshake.auth;
  logger.info("Added socket to clients", token);
  connectedClients[token] = socket;

  socket.on("disconnect", (reason) => {
    logger.info(`websocket client disconnected, origin: ${origin}, reason: ${reason}`);
    delete connectedClients[token];
  });
});

server.decorateRequest("websocketToken", "");

server.addHook("onRequest", async (request) => {
  const { headers } = request;
  const token = headers.authorization?.replace(/bearer /ig, "");
  if (token) {
    try {
      const secret = config.get("jwtPacsSecret") as string;
      const issuer = config.get("jwtPacsIssuer") as string;
      const { websocketToken } = jsonwebtoken.verify(token, secret, { issuer });
      logger.info(websocketToken, " ", request.url, " ", request.method);
      request.websocketToken = websocketToken || defaultToken;
    }
    catch (e) {
      request.websocketToken = defaultToken;
    }
  }
  else {
    request.websocketToken = defaultToken;
  }
});

//------------------------------------------------------------------

server.get("/viewer/rs/studies", (req, reply) => (
  emitToWsClient(reply, "STUDY", req.query, req.websocketToken)
));

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string }
}>("/viewer/rs/studies/:studyInstanceUid", async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/rendered', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.dataFormat = "rendered";
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/pixeldata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.dataFormat = "pixeldata";
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/thumbnail', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.dataFormat = "thumbnail";
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string }
}>("/viewer/rs/studies/:studyInstanceUid/metadata", async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  return emitToWsClient(reply, "STUDY", query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string }
}>("/viewer/rs/studies/:studyInstanceUid/series", async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  return emitToWsClient(reply, "SERIES", query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string }
}>("/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid", async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/rendered', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  query.dataFormat = "rendered";
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/pixeldata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  query.dataFormat = "pixeldata";
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/thumbnail', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  query.dataFormat = "thumbnail";
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string }
}>("/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata", async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  return emitToWsClient(reply, "SERIES", query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string }
}>("/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances", async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  return emitToWsClient(reply, "IMAGE", query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
}>("/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid", async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  query.SOPInstanceUID = req.params.sopInstanceUid;
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/rendered', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  query.SOPInstanceUID = req.params.sopInstanceUid;
  query.dataFormat = "rendered";
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/pixeldata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  query.SOPInstanceUID = req.params.sopInstanceUid;
  query.dataFormat = "pixeldata"
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
}>('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/thumbnail', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  query.SOPInstanceUID = req.params.sopInstanceUid;
  query.dataFormat = "thumbnail"
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

server.get<{
  Querystring: QueryParams
  Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
}>("/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/metadata", async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  query.SOPInstanceUID = req.params.sopInstanceUid;
  return emitToWsClient(reply, "IMAGE", query, req.websocketToken);
});

//------------------------------------------------------------------

server.post("/viewer/rs/studies", async (req, reply) => {
  const { headers, multipart, websocketToken } = req;
  const type = headers["content-type"];
  return emitToStowRsClient(reply, multipart, websocketToken, type);
});

//------------------------------------------------------------------

server.get("/viewer/wadouri", (req, reply): Promise<void> => new Promise((resolve) => {
  const uuid = uuidv4();

  const client = connectedClients[req.websocketToken];
  if (!client || client.handshake.auth !== req.websocketToken) {
    client.once(uuid, (data) => {
      reply.header("Content-Type", data.contentType);
      reply.send(data.buffer);
      resolve();
    });

    const { query } = req;
    client.emit("wadouri-request", { query, uuid });
  }
  else {
    const msg = "no ws client connected, cannot emit";
    logger.error(msg);
    reply.send(msg);
  }
}));

//------------------------------------------------------------------

logger.info("starting...");

server.listen({ port: httpPort, host: "0.0.0.0" }, async (err, address) => {
  if (err) {
    await logger.error(err, address);
    process.exit(1);
  }
  logger.info(`web-server listening on port: ${httpPort}`);
  logger.info(`websocket-server listening on port: ${wsPort}`);
});

//------------------------------------------------------------------
