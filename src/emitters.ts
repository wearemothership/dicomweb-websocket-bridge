import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Socket } from "socket.io";
import socketIOstream from "@wearemothership/socket.io-stream";
import { v4 as uuidv4 } from "uuid";
import utils from "./utils";

const emittersPlugin = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  const { io } = fastify;

  io.on("remote-wado", async (token, query, cb) => {
    let socket;
    io.sockets.sockets.forEach((s) => {
      const rooms = Array.from(s.rooms.values());
      if (rooms.includes(token)) {
        socket = s;
      }
    });
    if (socket && socket instanceof Socket) {
      const uuid = uuidv4();
      socketIOstream(socket).once(uuid, (buffer, headers) => {
        const b: Buffer[] = [];
        buffer.on("data", (data) => {
          b.push(data);
        });
        buffer.on("end", () => {
          const buff = Buffer.concat(b);
          cb({ buffer: buff, headers });
        });
      });
      socket.emit("wado-request", { uuid, query });
    }
    else {
      throw new Error("Socket not found");
    }
  });

  const emitToWsClient = (
    reply,
    level,
    query,
    token
  // eslint-disable-next-line no-async-promise-executor
  ): Promise<void> => new Promise(async (resolve) => {
    logger.info("QIDO-RS Request");
    io.in(token).timeout(1000).emit("qido-request", { level, query }, (err, responses) => {
      const response = responses[0] ?? responses[1];
      if (err) {
        reply.status(500).send(err);
        logger.error("QIDO-RS", err);
        resolve();
        return;
      }
      reply.send(response);
      resolve();
    });
  });

  fastify.decorate("emitToWsClient", emitToWsClient);

  const emitToWadoWsClient = (reply, query, token): Promise<void> => new Promise(
    // eslint-disable-next-line no-async-promise-executor
    async (resolve) => {
      logger.info("WADO-RS Request");
      let socket;
      io.sockets.sockets.forEach((s) => {
        const rooms = Array.from(s.rooms.values());
        if (rooms.includes(token)) {
          socket = s;
        }
      });

      const processResponse = (buffer, headers) => {
        if (!buffer || !headers) {
          reply.status(500).send("No response stream");
          logger.error("WADO-RS", buffer, headers);
          resolve();
        }
        else {
          const { contentType } = headers ?? {};
          reply.status(200);
          reply.header("content-type", contentType);
          reply.send(buffer);
          resolve();
        }
      };

      if (socket) {
        try {
          const uuid = uuidv4();
          socketIOstream(socket).once(uuid, (buffer, headers) => {
            const b: Buffer[] = [];
            buffer.on("data", (data) => {
              b.push(data);
            });
            buffer.on("end", () => {
              processResponse(Buffer.concat(b), headers);
            });
          });
          socket.emit("wado-request", { uuid, query });
        }
        catch (e) {
          logger.error("[WADO-RS] Socket.IO error", e);
        }
      }
      else {
        io.serverSideEmit("remote-wado", token, query, (err, responses) => {
          if (err) {
            reply.status(500).send(err);
            return;
          }
          const response = responses[0] ?? responses[1];
          if (response) {
            const { buffer, headers } = response;
            processResponse(Buffer.from(buffer), headers);
          }
          else {
            // This will throw on purpose - saving rewriting all the error handling.
            processResponse(undefined, undefined);
          }
        });
      }
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
