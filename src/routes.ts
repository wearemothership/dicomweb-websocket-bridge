import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import utils from "./utils";

interface QueryParams {
  [key: string]: string;
}

const routes = async (fastify: FastifyInstance) => {
  const logger = utils.getLogger();
  const {
    connectedClients, emitToWsClient, emitToWadoWsClient, emitToStowRsClient
  } = fastify;
  //------------------------------------------------------------------

  fastify.get("/rs/studies", (req, reply) => (
    emitToWsClient(reply, "STUDY", req.query, req.websocketToken)
  ));

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/rendered", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.dataFormat = "rendered";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/pixeldata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.dataFormat = "pixeldata";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/thumbnail", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.dataFormat = "thumbnail";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/metadata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    return emitToWsClient(reply, "STUDY", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    return emitToWsClient(reply, "SERIES", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/rendered", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    query.dataFormat = "rendered";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/pixeldata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    query.dataFormat = "pixeldata";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/thumbnail", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    query.dataFormat = "thumbnail";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/metadata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    return emitToWsClient(reply, "SERIES", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    return emitToWsClient(reply, "IMAGE", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    query.SOPInstanceUID = req.params.sopInstanceUid;
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/rendered", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    query.SOPInstanceUID = req.params.sopInstanceUid;
    query.dataFormat = "rendered";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/pixeldata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    query.SOPInstanceUID = req.params.sopInstanceUid;
    query.dataFormat = "pixeldata";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/thumbnail", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    query.SOPInstanceUID = req.params.sopInstanceUid;
    query.dataFormat = "thumbnail";
    return emitToWadoWsClient(reply, req.query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.get<{
    Querystring: QueryParams
    Params: { studyInstanceUid: string, seriesInstanceUid: string, sopInstanceUid: string }
  }>("/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid/metadata", async (req, reply) => {
    const { query } = req;
    query.StudyInstanceUID = req.params.studyInstanceUid;
    query.SeriesInstanceUID = req.params.seriesInstanceUid;
    query.SOPInstanceUID = req.params.sopInstanceUid;
    return emitToWsClient(reply, "IMAGE", query, req.websocketToken);
  });

  //------------------------------------------------------------------

  fastify.post("/rs/studies", async (req, reply) => {
    const { headers, multipart, websocketToken } = req;
    const type = headers["content-type"] as string;
    return emitToStowRsClient(reply, multipart, websocketToken, type);
  });

  //------------------------------------------------------------------

  fastify.get("/wadouri", (req, reply): Promise<void> => new Promise((resolve) => {
    const uuid = uuidv4();

    const client = connectedClients[req.websocketToken];
    if (!client || client.handshake.auth.token !== req.websocketToken) {
      const msg = "no ws client connected, cannot emit";
      logger.error(msg);
      reply.send(msg);
    }
    else {
      client.once(uuid, (data) => {
        reply.header("Content-Type", data.contentType);
        reply.send(data.buffer);
        resolve();
      });

      const { query } = req;
      client.emit("wadouri-request", { query, uuid });
    }
  }));
};

export default routes;
