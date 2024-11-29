/**
 * @fileOverview This module defines the routes for handling DICOM studies and their associated resources.
 * It provides endpoints for retrieving study, series, and instance data via WebSocket communication.
 */

import { FastifyInstance } from "fastify";
import utils from "./utils";

/**
 * Interface for query parameters.
 * @interface QueryParams
 * @property {string} [key] - The key for the query parameter.
 */
interface QueryParams {
  [key: string]: string;
}

/**
 * Registers the routes for the Fastify instance.
 * @param {FastifyInstance} fastify - The Fastify instance to register routes on.
 * @returns {Promise<void>} A promise that resolves when the routes are registered.
 */
const routes = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  const {
    io, emitToWsClient, emitToWadoWsClient, emitToStowRsClient
  } = fastify;

  //------------------------------------------------------------------

  // Route to get studies
  fastify.get("/rs/studies", (req, reply) => (
    emitToWsClient(reply, "STUDY", req.query, req.websocketToken)
  ));

  //------------------------------------------------------------------

  // Route to get a specific study by UID
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get rendered data for a specific study
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/rendered", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.dataFormat = "rendered"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get pixel data for a specific study
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/pixeldata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.dataFormat = "pixeldata"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get thumbnail data for a specific study
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/thumbnail", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.dataFormat = "thumbnail"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get metadata for a specific study
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/metadata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    return emitToWsClient(reply, "STUDY", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get series for a specific study
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    return emitToWsClient(reply, "SERIES", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get a specific series by UID
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get rendered data for a specific series
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/rendered", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    query.dataFormat = "rendered"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get pixel data for a specific series
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/pixeldata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    query.dataFormat = "pixeldata"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get thumbnail data for a specific series
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/thumbnail", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    query.dataFormat = "thumbnail"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get metadata for a specific series
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    return emitToWsClient(reply, "SERIES", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get instances for a specific series
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    return emitToWsClient(reply, "IMAGE", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get a specific instance by UID
  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    query.SOPInstanceUID = req.params.sopInstanceUid; // Set the SOPInstanceUID in the query
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get rendered data for a specific instance
  fastify.get<{
    Querystring: QueryParams,
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  // eslint-disable-next-line max-len
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/rendered", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    query.SOPInstanceUID = req.params.sopInstanceUid; // Set the SOPInstanceUID in the query
    query.dataFormat = "rendered"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get pixel data for a specific instance
  fastify.get<{
    Querystring: QueryParams,
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  // eslint-disable-next-line max-len
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/pixeldata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    query.SOPInstanceUID = req.params.sopInstanceUid; // Set the SOPInstanceUID in the query
    query.dataFormat = "pixeldata"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get thumbnail data for a specific instance
  fastify.get<{
    Querystring: QueryParams,
    Params: { studyInstanceUid: string; seriesInstanceUid: string; sopInstanceUid: string }
  // eslint-disable-next-line max-len
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/thumbnail", async (req, reply) => {
    const { query, params } = req;
    query.StudyInstanceUID = params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    query.SOPInstanceUID = params.sopInstanceUid; // Set the SOPInstanceUID in the query
    query.dataFormat = "thumbnail"; // Specify the data format
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to get metadata for a specific instance
  fastify.get<{
    Querystring: QueryParams,
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  // eslint-disable-next-line max-len
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/metadata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid; // Set the StudyInstanceUID in the query
    query.SeriesInstanceUID = req.params.seriesInstanceUid; // Set the SeriesInstanceUID in the query
    query.SOPInstanceUID = req.params.sopInstanceUid; // Set the SOPInstanceUID in the query
    return emitToWsClient(reply, "IMAGE", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  // Route to store studies
  fastify.post("/rs/studies", async (req, reply) => {
    const { headers, multipart, websocketToken } = req;
    const type = headers["content-type"] as string; // Get the content type from headers
    return emitToStowRsClient(reply, multipart, websocketToken, type);
  });

  //------------------------------------------------------------------

  // Route to handle WADO-URI requests
  fastify.get("/wadouri", ({ query, websocketToken }, reply): Promise<void> => new Promise((resolve) => {
    logger.info("WADO-URI Request"); // Log the WADO-URI request
    io.in(websocketToken).timeout(1000).emit("wadouri-request", { query }, (err, data) => {
      if (err) {
        reply.status(500).send(err); // Send error response if there's an error
        logger.error(err); // Log the error
        resolve();
        return;
      }
      reply.header("Content-Type", data.contentType); // Set the content type in the response
      reply.send(data.buffer); // Send the data buffer in the response
      resolve();
    });
  }));
};

export default routes;
