const config = require("config");
const { v4: uuidv4 } = require('uuid');

const httpPort = config.get("webserverPort");
const wsPort = config.get("websocketPort");
const io = require("socket.io")(wsPort);
const path = require("path");
const fastify = require("fastify")({ logger: false });
const utils = require("./utils");

let connectedClient = null;

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "../public"),
});

fastify.register(require("@fastify/cors"), {});

fastify.register(require("@fastify/sensible"));

fastify.register(require("@fastify/helmet"), { contentSecurityPolicy: false });

fastify.register(require("@fastify/compress"), { global: true });

const logger = utils.getLogger();

const emitToWsClient = (reply, level, query) => {
  if (!connectedClient) {
    const msg = 'no ws client connected, cannot emit';
    logger.error(msg);
    reply.send(msg);
  } else {
    const uuid = uuidv4();

    connectedClient.once(uuid, (data) => {
      reply.send(data);
    });
  
    connectedClient.emit('qido-request', { level, query, uuid });
  }
}

// log exceptions
process.on("uncaughtException", async (err) => {
  await logger.error("uncaught exception received:");
  await logger.error(err.stack);
});

//------------------------------------------------------------------

process.on("SIGINT", async () => {
  await logger.info("shutting down web server...");
  io.close();
  fastify.close().then(
    async () => {
      await logger.info("webserver shutdown successfully");
    },
    (err) => {
      logger.error("webserver shutdown failed", err);
    }
  );
  process.exit(1);
});

//------------------------------------------------------------------

// incoming websocket connections are registered here
io.on("connection", (socket) => {
  const origin = socket.conn.remoteAddress;
  logger.info(`websocket client connected from origin: ${origin}`);
  connectedClient = socket;

  socket.on("disconnect", () => {
    logger.info(`websocket client disconnected, origin: ${origin}`);
    connectedClient = null;
  });

});

//------------------------------------------------------------------

io.use((socket, next) => {

  const {token} = socket.handshake.auth;

  if (token === config.get('websocketToken')) {
    next();
  }
  else {
    const err = new Error("not authorized");
    logger.error('invalid auth token passed, this might be an attack, token used: ', token);
    next(err);
  }
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies', (req, reply) => {
  emitToWsClient(reply, 'STUDY', req.query);
});

//------------------------------------------------------------------

fastify.get('/rs/studies', async (req, reply) => {
  emitToWsClient(reply, 'STUDY', req.query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  emitToWsClient(reply, 'SERIES', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  emitToWsClient(reply, 'SERIES', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  emitToWsClient(reply, 'IMAGE', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  emitToWsClient(reply, 'IMAGE', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/wadouri', async (req, reply) => {
  const uuid = uuidv4();

  connectedClient.once(uuid, (data) => {
    reply.header('Content-Type', 'application/dicom');
    reply.send(data);
  });
  const { query } = req;
  connectedClient.emit('wadouri-request', { query, uuid });
});

//------------------------------------------------------------------

logger.info("starting...");

fastify.listen(httpPort, '0.0.0.0', async (err, address) => {
  if (err) {
    await logger.error(err, address);
    process.exit(1);
  }
  logger.info(`web-server listening on port: ${httpPort}`);
  logger.info(`websocket-server listening on port: ${wsPort}`);
});

//------------------------------------------------------------------
