import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { v4 as uuid4 } from "uuid";
import type { AddToQueue } from "./app";
import utils from "./utils";

const MAX_CALLS = 2;
const SOCKET_TIMEOUT = 40000;
const callQueue = {};
const callCount = {};

const clientsPlugin = async (fastify: FastifyInstance) => {
  const { io } = fastify;
  const logger = utils.getLogger();

  const doCall = (queueArgs?: AddToQueue | string) => {
    const processQueueForSocket = (sid: string) => {
      if (callQueue[sid].length > 0 && (callCount[sid] + 1 <= MAX_CALLS)) {
        callCount[sid] += 1;
        const callArgs = callQueue[sid].shift();
        doCall({ socketId: sid, ...callArgs });
      }
    };

    // Calling with just a socketId is essentially a call to just process the queue.
    if (typeof queueArgs === "string") {
      processQueueForSocket(queueArgs);
      return;
    }

    const {
      socketId, type, callback, level, query, body, headers: requestHeaders, uuid
    } = queueArgs as AddToQueue;

    const processError = (msg: string) => {
      logger.error(msg);
      callback(new Error(msg));
      callCount[socketId] -= 1;
      processQueueForSocket(socketId);
    };

    if (type === "wado-request") {
      io.in(socketId).timeout(SOCKET_TIMEOUT).emit("wado-request", { query }, (err, response) => {
        if (err || !response) {
          processError(`[WADO-RS] ${err ? err.message : "No Response"} ${uuid}`);
          return;
        }

        const { buffer, headers, success } = Array.isArray(response)
          ? response[0] ?? response[1]
          : response;
        if (!success) {
          processError(`[WADO-RS] Failed ${uuid}`);
          return;
        }
        if (!buffer || buffer.length === 0) {
          processError(`[WADO-RS] Empty Buffer ${uuid}`);
          return;
        }
        callback(null, buffer, headers);
        callCount[socketId] -= 1;
        processQueueForSocket(socketId);
      });
    }
    else {
      const processResponse = (err, responses) => {
        const response = Array.isArray(responses) ? responses[0] ?? responses[1] : responses;
        if (err) {
          processError(`[${type.toUpperCase()}] ${err ? err.message : "No Response"} ${uuid}`);
          return;
        }
        if (!response) {
          processError(`[${type.toUpperCase()}] No Response ${uuid}`);
          return;
        }
        const { success, data } = response;
        if (!success) {
          processError(`[${type.toUpperCase()}] call failed ${uuid}`);
          return;
        }
        callback(null, data ?? response);
        callCount[socketId] -= 1;
        processQueueForSocket(socketId);
      };
      if (type === "stow-request") {
        io.in(socketId).timeout(SOCKET_TIMEOUT).emit(
          type,
          body,
          requestHeaders,
          processResponse
        );
      }
      else {
        io.in(socketId).timeout(SOCKET_TIMEOUT).emit(
          type,
          { level, query },
          processResponse
        );
      }
    }
  };

  const addToQueue = ({ socketId, ...args }: AddToQueue) => {
    try {
      if (!callQueue[socketId]) {
        logger.info("No queue for socket!", socketId);
        callQueue[socketId] = [];
        callCount[socketId] = 0;
      }
      const uuid = uuid4();
      callQueue[socketId].push({ ...args, uuid });
      doCall(socketId);
    }
    catch (e) {
      args.callback(e as Error);
    }
  };

  fastify.decorate("addToQueue", addToQueue);
};

export default fp(clientsPlugin);
