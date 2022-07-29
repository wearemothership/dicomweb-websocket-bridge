const config = require("config");
const { v4: uuidv4 } = require('uuid');
const socketIOStream = require("@wearemothership/socket.io-stream");

const httpPort = config.get("webserverPort");
const wsPort = config.get("websocketPort");
const defaultToken = config.get("websocketToken");
const io = require("socket.io")(wsPort);
const path = require("path");
const fastify = require("fastify")({ logger: false, bodyLimit: 20971520 }); // 20MB
const jsonwebtoken = require("jsonwebtoken")
const utils = require("./utils");

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "../public"),
});

fastify.register(require("@fastify/cors"), {});

fastify.register(require("@fastify/sensible"));

fastify.register(require("@fastify/helmet"), { contentSecurityPolicy: false });

fastify.register(require("@fastify/compress"), { global: true });

fastify.decorateRequest("multipart")
fastify.addContentTypeParser("multipart/related", { parseAs: "buffer" }, async (request, payload) => {
  request.multipart = payload
})

const logger = utils.getLogger();

const connectedClients = {}

const emitToWsClient = (reply, level, query, token) => new Promise((resolve) => {
  const client = connectedClients[token]
  if (!client || client.handshake.auth.token !== token) {
    const msg = 'no ws client connected, cannot emit';
    logger.error(msg);
    reply.send(msg);
    resolve();
  } else {
    const uuid = uuidv4();
    client.once(uuid, (data) => {
      if (data instanceof Error) {
        reply.status(500)
      }
      reply.send(data);
      resolve()
    });
  
    client.emit("qido-request", { level, query, uuid });
  }
})

const emitToWadoWsClient = (reply, query, token) => new Promise((resolve) => {
  const client = connectedClients[token]
  if (!client || client.handshake.auth.token !== token) {
    const msg = 'no ws client connected, cannot emit';
    logger.error(msg);
    reply.send(msg);
    resolve()
  } else {
    const uuid = uuidv4();
    socketIOStream(client).on(uuid, (stream, headers) => {
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
    client.on(uuid, (resp) => {
      if (resp instanceof Error) {
        reply.status(500).send(resp)
      }
    })
    client.emit("wado-request", { query, uuid });
  }
})

const emitToStowRsClient = (reply, body, token, type) => new Promise((resolve) => {
  const client = connectedClients[token];
  if (!client || client.handshake.auth.token !== token) {
    const msg = 'no ws client connected, cannot emit';
    logger.error(msg);
    reply.send(msg);
    resolve();
  } else {
    const uuid = uuidv4();
    const stream = socketIOStream.createStream()
    socketIOStream(client).emit("stow-request", stream, { contentType: type, uuid })
    client.once(uuid, (data) => {
      if (data instanceof Error) {
        reply.status(500)
      }
      reply.send(data)
      resolve()
    });
    logger.info(body.length, token, type)
    let offset = 0;
    const chunkSize = 512*1024 // 512kb
    const writeBuffer = () => {
      let ok = true;
      do {
        const b = Buffer.alloc(chunkSize)
        body.copy(b, 0, offset, offset + chunkSize)
        ok = stream.write(b)
        offset += chunkSize
      } while (offset < body.length && ok)
      if (offset < body.length) {
        stream.once("drain", writeBuffer)
      }
      else {
        stream.end()
      }
    }
    writeBuffer()
  
    client.emit("stow-request", { type, body, uuid });
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
  const { token } = socket.handshake.auth;
  logger.info("Added socket to clients", token)
  connectedClients[token] = socket;

  socket.on("disconnect", (reason) => {
    logger.info(`websocket client disconnected, origin: ${origin}, reason: ${reason}`);
    delete connectedClients[token]
  });
});

fastify.decorateRequest("websocketToken", "");

fastify.addHook("onRequest", async (request) => {
  const { headers } = request;
  const token = headers.authorization.replace(/bearer /ig, "");
  if (token) {
    try {
      const { websocketToken } = jsonwebtoken.verify(token, config.jwtPacsSecret, { issuer: config.jwtPacsIssuer })
      logger.info(websocketToken, " ", request.url, " ", request.method)
      request.websocketToken = websocketToken || defaultToken;
    }
    catch (e) {
      request.websocketToken = defaultToken;
    }
  }
  else {
    request.websocketToken = defaultToken;
  }
})

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies', (req, reply) => (
  emitToWsClient(reply, 'STUDY', req.query, req.websocketToken)
));

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid', async (req, reply) => {
  const { query } = req;
  query.studyInstanceUid = req.params.studyInstanceUid;
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  return emitToWsClient(reply, 'SERIES', query, req.websocketToken);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  return emitToWsClient(reply, 'SERIES', query, req.websocketToken);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid', async (req, reply) => {
  const { query } = req;
  query.studyInstanceUid = req.params.studyInstanceUid;
  query.seriesInstanceUid = req.params.seriesInstanceUid;
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  return emitToWsClient(reply, 'IMAGE', query, req.websocketToken);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid', async (req, reply) => {
  const { query } = req;
  query.studyInstanceUid = req.params.studyInstanceUid;
  query.seriesInstanceUid = req.params.seriesInstanceUid;
  query.sopInstanceUid = req.params.sopInstanceUid;
  return emitToWadoWsClient(reply, req.query, req.websocketToken);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.studyInstanceUid = req.params.studyInstanceUid;
  query.seriesInstanceUid = req.params.seriesInstanceUid;
  query.sopInstanceUid = req.params.sopInstanceUid;
  return emitToWsClient(reply, 'IMAGE', query, req.websocketToken);
});

//------------------------------------------------------------------

fastify.get('/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata', async (req, reply) => {
  const { query } = req;
  query.StudyInstanceUID = req.params.studyInstanceUid;
  query.SeriesInstanceUID = req.params.seriesInstanceUid;
  return emitToWsClient(reply, 'IMAGE', query, req.websocketToken);
});

//------------------------------------------------------------------

fastify.put('/viewer/rs/studies', async (req, reply) => {
  const { headers, multipart, websocketToken } = req;
  const type = headers["content-type"];
  return emitToStowRsClient(reply, multipart, websocketToken, type)
});

//------------------------------------------------------------------

fastify.get('/viewer/wadouri', (req, reply) => new Promise((resolve) => {
  const uuid = uuidv4();

  const client = connectedClients[req.websocketToken]
  if (!client || client.handshake.auth !== req.websocketToken) {
    client.once(uuid, (data) => {
      reply.header('Content-Type', data.contentType);
      reply.send(data.buffer);
      resolve();
    });

    const { query } = req;
    client.emit('wadouri-request', { query, uuid });
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
