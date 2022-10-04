import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { v4 as uuid4 } from "uuid";
import type { AddToQueue } from "./app";
import utils from "./utils";

const MAX_CALLS = 2;
const MAX_RETRIES = 3;

const clientsPlugin = async (fastify: FastifyInstance) => {
  const { io } = fastify;
  const callQueue = {};
  const callCount = {};
  const retryCount: Record<string, number> = {};
  const logger = utils.getLogger();

  const doCall = (queueArgs?: AddToQueue | string) => {
    const processQueueForSocket = (sid: string) => {
      const socketQueue = callQueue[sid] ?? [];
      if (socketQueue.length > 0 && (!callCount[sid] || callCount[sid] + 1 <= MAX_CALLS)) {
        const callArgs = socketQueue.shift();
        callCount[sid] = callCount[sid] ? callCount[sid] += 1 : 1;
        doCall({ socketId: sid, ...callArgs });
      }
    };

    // Calling with just a socketId is essentially a call to just process the queue.
    if (typeof queueArgs === "string") {
      if (callCount[queueArgs] === undefined) {
        callCount[queueArgs] = 0;
      }
      processQueueForSocket(queueArgs);
      return;
    }

    const {
      socketId, type, callback, level, query, body, headers: requestHeaders, oldUuid
    } = queueArgs as AddToQueue;

    const retryCall = (uuid: string, warning: string, callArgs: AddToQueue) => {
      logger.warn(`${warning}, retrying call, retryCount ${retryCount[uuid]}`);
      if (retryCount[uuid] < MAX_RETRIES) {
        retryCount[uuid] += 1;
        doCall({ ...callArgs, oldUuid: uuid });
        processQueueForSocket(socketId);
        return;
      }
      throw new Error(`Retries failed ${warning}`);
    };

    const uuid = oldUuid ?? uuid4();
    if (!retryCount[uuid]) {
      retryCount[uuid] = 0;
    }
    if (type === "wado-request") {
      io.in(socketId).timeout(10000).emit("wado-request", { query }, (err, response) => {
        if (err || !response) {
          try {
            retryCall(uuid, "[WADO-RS] No Response", {
              socketId, type, callback, query
            });
            return;
          }
          catch (e) {
            callback(e as Error);
            delete retryCount[uuid];
            callCount[socketId] -= 1;
            processQueueForSocket(socketId);
            return;
          }
        }

        const { buffer, headers, success } = Array.isArray(response)
          ? response[0] ?? response[1]
          : response;
        if (!success) {
          try {
            retryCall(uuid, "[WADO-RS] Failed", {
              socketId, type, callback, query
            });
            return;
          }
          catch (e) {
            callback(e as Error);
            delete retryCount[uuid];
            callCount[socketId] -= 1;
            processQueueForSocket(socketId);
          }
        }
        if (!buffer || buffer.length === 0) {
          try {
            retryCall(uuid, "[WADO-RS] Empty Buffer", {
              socketId, type, callback, query
            });
            return;
          }
          catch (e) {
            callback(e as Error);
            delete retryCount[uuid];
            callCount[socketId] -= 1;
            processQueueForSocket(socketId);
          }
        }
        callback(null, buffer, headers);
        delete retryCount[uuid];
        callCount[socketId] -= 1;
        processQueueForSocket(socketId);
      });
    }
    else {
      const processResponse = (err, responses) => {
        const response = Array.isArray(responses) ? responses[0] ?? responses[1] : responses;
        if (err) {
          try {
            retryCall(uuid, `[${type.toUpperCase()}] No Response, retrying`, {
              socketId, type, callback, level, query, body, headers: requestHeaders
            });
            return;
          }
          catch (e) {
            callback(e as Error);
            delete retryCount[uuid];
            callCount[socketId] -= 1;
            processQueueForSocket(socketId);
          }
        }
        if (!response) {
          try {
            retryCall(uuid, `[${type.toUpperCase()}] No Response, retrying`, {
              socketId, type, callback, level, query, body, headers: requestHeaders
            });
            return;
          }
          catch (e) {
            callback(e as Error);
            delete retryCount[uuid];
            callCount[socketId] -= 1;
            processQueueForSocket(socketId);
          }
        }
        const { success, data } = response;
        if (!success) {
          try {
            retryCall(uuid, `[${type.toUpperCase()}] call failed, retrying`, {
              socketId, type, callback, level, query, body, headers: requestHeaders
            });
            return;
          }
          catch (e) {
            callback(e as Error);
            delete retryCount[uuid];
            callCount[socketId] -= 1;
            processQueueForSocket(socketId);
          }
        }
        callback(null, data ?? response);
        delete retryCount[uuid];
        callCount[socketId] -= 1;
        processQueueForSocket(socketId);
      };
      if (type === "stow-request") {
        io.in(socketId).timeout(10000).emit(
          type,
          body,
          requestHeaders,
          processResponse
        );
      }
      else {
        io.in(socketId).timeout(10000).emit(
          type,
          { level, query },
          processResponse
        );
      }
    }
  };

  const addToQueue = ({ socketId, ...args }: AddToQueue) => {
    try {
      callQueue[socketId] = (callQueue[socketId] ?? []).concat([{ ...args }]);

      doCall(socketId);
    }
    catch (e) {
      args.callback(e as Error);
    }
  };

  fastify.decorate("addToQueue", addToQueue);
};

export default fp(clientsPlugin);
