import { v4 as uuidv4 } from "uuid";
import SocketIOStream from "@wearemothership/socket.io-stream";
import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import utils from "./utils";

const emittersPlugin = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  const { connectedClients } = fastify;
  const emitToWsClient = (
    reply,
    level,
    query,
    token
  ): Promise<void> => new Promise((resolve) => {
    const client = connectedClients[token];
    if (!client || client.handshake.auth.token !== token) {
      const msg = "no ws client connected, cannot emit";
      logger.error(msg);
      reply.status(401).send(msg);
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

  fastify.decorate("emitToWsClient", emitToWsClient);

  const emitToWadoWsClient = (reply, query, token): Promise<void> => new Promise((resolve) => {
    const client = connectedClients[token];
    if (!client || client.handshake.auth.token !== token) {
      const msg = "no ws client connected, cannot emit";
      logger.error(msg);
      reply.status(401).send(msg);
      resolve();
    }
    else {
      const uuid = uuidv4();
      SocketIOStream(client, {}).on(uuid, (stream, headers) => {
        const { contentType } = headers ?? {};
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
          resolve();
        }
      });
      client.emit("wado-request", { query, uuid });
    }
  });

  fastify.decorate("emitToWadoWsClient", emitToWadoWsClient);

  const emitToStowRsClient = (
    reply,
    body,
    token,
    type
  ): Promise<void> => new Promise((resolve) => {
    const client = connectedClients[token];
    if (!client || client.handshake.auth.token !== token) {
      const msg = "no ws client connected, cannot emit";
      logger.error(msg);
      reply.status(401).send(msg);
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

  fastify.decorate("emitToStowRsClient", emitToStowRsClient);
};

export default fp(emittersPlugin);
