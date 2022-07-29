const config = require("config");
const { v4: uuidv4 } = require('uuid');
const socketIOStream = require("@wearemothership/socket.io-stream");

const httpPort = config.get("webserverPort");
const wsPort = config.get("websocketPort");
const io = require("socket.io")(wsPort);
const path = require("path");
const fastify = require("fastify")({ logger: false, bodyLimit: 20971520 }); // 20MB
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

const emitToWsClient = (reply, level, query) => new Promise((resolve) => {
  if (!connectedClient) {
    const msg = 'no ws client connected, cannot emit';
    logger.error(msg);
    reply.send(msg);
    resolve();
  } else {
    const uuid = uuidv4();
    connectedClient.once(uuid, (data) => {
      if (data instanceof Error) {
        reply.status(500)
      }
      reply.send(data);
      resolve()
    });
  
    connectedClient.emit("qido-request", { level, query, uuid });
  }
})

const emitToWadoWsClient = (reply, query) => new Promise((resolve) => {
  if (!connectedClient) {
    const msg = 'no ws client connected, cannot emit';
    logger.error(msg);
    reply.send(msg);
    resolve()
  } else {
    const uuid = uuidv4();
    socketIOStream(connectedClient).on(uuid, (stream, headers) => {
      const { contentType } = headers;
      reply.status(200)
      reply.header("content-type", contentType)
      const bufferData = []
      stream.on("data", (data) => {
        bufferData.push(data)
      })
      stream.on("end", () => {
        const b = Buffer.concat(bufferData)
        reply.send(b)
        resolve()
      })
    });
    connectedClient.on(uuid, (resp) => {
      if (resp instanceof Error) {
        reply.status(500).send(resp)
      }
    })
    connectedClient.emit("wado-request", { query, uuid });
  }
})

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

  socket.on("disconnect", (reason) => {
    logger.info(`websocket client disconnected, origin: ${origin}, reason: ${reason}`);
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

fastify.get('/viewer/rs/studies', (req, reply) => (
  emitToWsClient(reply, 'STUDY', req.query)
));

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid', async (req, reply) => {
  const { query } = req;
  query.studyInstanceUid = req.params.studyInstanceUid;
  return emitToWadoWsClient(reply, req.query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  return emitToWsClient(reply, 'SERIES', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  return emitToWsClient(reply, 'SERIES', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid', async (req, reply) => {
  const { query } = req;
  query.studyInstanceUid = req.params.studyInstanceUid;
  query.seriesInstanceUid = req.params.seriesInstanceUid;
  return emitToWadoWsClient(reply, req.query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  return emitToWsClient(reply, 'IMAGE', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid', async (req, reply) => {
  const { query } = req;
  query.studyInstanceUid = req.params.studyInstanceUid;
  query.seriesInstanceUid = req.params.seriesInstanceUid;
  query.sopInstanceUid = req.params.sopInstanceUid;
  return emitToWadoWsClient(reply, req.query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.studyInstanceUid = req.params.studyInstanceUid;
  query.seriesInstanceUid = req.params.seriesInstanceUid;
  query.sopInstanceUid = req.params.sopInstanceUid;
  return emitToWsClient(reply, 'IMAGE', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  return emitToWsClient(reply, 'IMAGE', query);
});

//------------------------------------------------------------------

fastify.get('/viewer/wadouri', (req, reply) => new Promise((resolve) => {
  const uuid = uuidv4();

  if (connectedClient) {
    connectedClient.once(uuid, (data) => {
      reply.header('Content-Type', data.contentType);
      reply.send(data.buffer);
      resolve();
    });

    const { query } = req;
    connectedClient.emit('wadouri-request', { query, uuid });
  }
  else {
    const msg = 'no ws client connected, cannot emit';
    logger.error(msg);
    reply.send(msg);
  }
}));

//------------------------------------------------------------------

logger.info("starting...");

fastify.listen({ port: httpPort, host: '0.0.0.0' }, async (err, address) => {
  if (err) {
    await logger.error(err, address);
    process.exit(1);
  }
  logger.info(`web-server listening on port: ${httpPort}`);
  logger.info(`websocket-server listening on port: ${wsPort}`);
});

//------------------------------------------------------------------
