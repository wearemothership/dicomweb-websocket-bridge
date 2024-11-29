/**
 * Call Queue Plugin for Fastify
 *
 * This plugin manages a queue of calls for each socket connection, ensuring that
 * a maximum number of concurrent calls are processed. It handles different types
 * of requests and manages the responses accordingly.
 *
 * @module callQueuePlugin
 */

import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { v4 as uuid4 } from "uuid";
import type { AddToQueue } from "./app";
import utils from "./utils";

const MAX_CALLS = 2; // Maximum number of concurrent calls allowed
const SOCKET_TIMEOUT = 40000; // Timeout for socket calls in milliseconds
const callQueue = {}; // Object to hold the call queues for each socket
const callCount = {}; // Object to track the number of active calls for each socket

/**
 * Clients Plugin for managing call queues
 *
 * @param {FastifyInstance} fastify - The Fastify instance
 */
const clientsPlugin = async (fastify: FastifyInstance) => {
  const { io } = fastify;
  const logger = utils.getLogger();

  /**
   * Function to process calls based on the queue
   *
   * @param {AddToQueue | string} [queueArgs] - Arguments for the call or socket ID
   */
  const doCall = (queueArgs?: AddToQueue | string) => {
    /**
     * Process the queue for a specific socket
     *
     * @param {string} sid - The socket ID
     */
    const processQueueForSocket = (sid: string) => {
      if (callQueue[sid].length > 0 && (callCount[sid] + 1 <= MAX_CALLS)) {
        callCount[sid] += 1; // Increment the call count for the socket
        const callArgs = callQueue[sid].shift(); // Get the next call arguments
        logger.info(`Calling ${callArgs.type} (${callArgs.uuid})`);
        doCall({ socketId: sid, ...callArgs }); // Recursively call doCall with the next arguments
      }
    };

    // If only a socketId is provided, process the queue for that socket
    if (typeof queueArgs === "string") {
      processQueueForSocket(queueArgs);
      return;
    }

    const {
      socketId, type, callback, level, query, body, headers: requestHeaders, uuid
    } = queueArgs as AddToQueue;

    /**
     * Handle errors during processing
     *
     * @param {string} msg - The error message
     */
    const processError = (msg: string) => {
      logger.error(msg);
      callback(new Error(msg)); // Return the error to the callback
      callCount[socketId] -= 1; // Decrement the call count for the socket
      processQueueForSocket(socketId); // Process the next call in the queue
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
        logger.info(`Completed call ${uuid}`);
        callback(null, buffer, headers); // Return the successful response
        callCount[socketId] -= 1; // Decrement the call count for the socket
        processQueueForSocket(socketId); // Process the next call in the queue
      });
    }
    else {
      /**
       * Process the response from the call
       *
       * @param {Error} err - The error object, if any
       * @param {any} responses - The responses from the call
       */
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
        logger.info(`Completed call ${uuid}`);
        callback(null, data ?? response); // Return the successful response
        callCount[socketId] -= 1; // Decrement the call count for the socket
        processQueueForSocket(socketId); // Process the next call in the queue
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

  /**
   * Add a call to the queue for processing
   *
   * @param {AddToQueue} args - The arguments for the call
   */
  const addToQueue = ({ socketId, ...args }: AddToQueue) => {
    try {
      if (!callQueue[socketId]) {
        logger.info("No queue for socket!", socketId);
        callQueue[socketId] = []; // Initialize the queue for the socket
        callCount[socketId] = 0; // Initialize the call count for the socket
      }
      const uuid = uuid4(); // Generate a unique identifier for the call
      callQueue[socketId].push({ ...args, uuid }); // Add the call to the queue
      doCall(socketId); // Start processing the queue
    }
    catch (e) {
      args.callback(e as Error); // Return the error to the callback
    }
  };

  fastify.decorate("addToQueue", addToQueue); // Decorate the Fastify instance with the addToQueue method
};

export default fp(clientsPlugin); // Export the plugin
