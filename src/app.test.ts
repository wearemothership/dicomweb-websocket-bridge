/* eslint-disable import/no-extraneous-dependencies */
import { v4 as uuid4 } from "uuid";
import jwt from "jsonwebtoken";
import socketIOClient from "socket.io-client";
import fs from "fs";
import path from "path";
import SocketIOStream from "@wearemothership/socket.io-stream";
import initFastify from "./initFastify";
import { websocketToken, pacsSecret, pacsIssuer } from "./config";

jest.mock("./utils", () => ({
  getLogger: () => console
}));

jest.mock("./config", () => ({
  logDir: "./logs",
  webserverPort: 5001,
  websocketPort: 6001,
  websocketToken: "WEBSOCKET_TOKEN",
  pacsSecret: "TEST_SECRET",
  pacsIssuer: "TEST_ISSUER",
  secure: false,
  withCors: false
}));

jest.mock("@wearemothership/socket.io-stream", () => jest.fn());

const validToken = jwt.sign({ websocketToken, id: uuid4() }, pacsSecret, { issuer: pacsIssuer });
const invalidIssuerToken = jwt.sign({ websocketToken, id: uuid4() }, pacsSecret, { issuer: "BAD_ISSUER" });
const invalidSecretToken = jwt.sign({ websocketToken, id: uuid4() }, "BAD_SECRET", { issuer: pacsIssuer });

describe("Dicom Websocket Bridge", () => {
  let app;
  beforeEach(async () => {
    app = await initFastify();
  });

  afterEach(() => {
    app.io.close();
    app.close();
  });

  test("Insecure webserver starts", async () => {
    const [addr] = app.addresses();
    expect(addr).toStrictEqual(expect.objectContaining({
      address: "0.0.0.0", family: "IPv4", port: 5001
    }));
  });

  // TODO: Get this working
  // test("Secure webserver starts", () => {});

  test("Socket Opens (insecure)", () => new Promise<void>((resolve, reject) => {
    const socket = socketIOClient(
      "http://0.0.0.0:6001",
      {
        reconnection: false,
        auth: {
          token: websocketToken
        }
      }
    );

    socket.on("connect", () => {
      expect(socket.connected).toBeTruthy();
      expect(app.connectedClients[websocketToken].id).toEqual(socket.id);
      expect(app.connectedClients[websocketToken].handshake.auth.token).toEqual(websocketToken);
      socket.close();
      resolve();
    });

    socket.on("error", (e) => {
      socket.close();
      reject(e);
    });
  }));

  // TODO: Get this working
  // test("Socket Opens (Secure)", () => {});

  // test("onRequest (valid token)", () => {

  // });

  test("onRequest (invalid issuer token)", async () => {
    const { statusCode } = await app.inject({
      method: "GET",
      url: "./viewer/rs/studies",
      headers: {
        authorization: `Bearer ${invalidIssuerToken}`
      }
    });

    expect(statusCode).toEqual(401);
  });

  test("onRequest (invalid secret token)", async () => {
    const { statusCode } = await app.inject({
      method: "GET",
      url: "./viewer/rs/studies",
      headers: {
        authorization: `Bearer ${invalidSecretToken}`
      }
    });

    expect(statusCode).toEqual(401);
  });

  describe("Test Routes", () => {
    let socket;
    const defaultResponse = JSON.stringify({ test: "response" });
    const onceFunc = {};
    beforeEach(() => new Promise<void>((resolve, reject) => {
      socket = socketIOClient(
        "http://0.0.0.0:6001",
        { reconnection: false, auth: { token: websocketToken } }
      );

      socket.on("connect", () => {
        resolve();
      });

      socket.on("error", (e) => {
        socket.close();
        reject(e);
      });
    }));

    afterEach(() => {
      socket.close();
    });

    const qidoRequests = [
      "/viewer/rs/studies",
      "/viewer/rs/studies/:studyInstanceUid/series",
      "/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances"
    ];

    test.each(qidoRequests)("GET %s", async (url) => {
      const client = app.connectedClients[websocketToken];
      client.once = jest.fn((uuid, fn) => {
        onceFunc[uuid] = fn;
      });
      client.emit = jest.fn((type, { uuid }) => {
        onceFunc?.[uuid]?.(defaultResponse);
        delete onceFunc[uuid];
      });
      const { statusCode, body } = await app.inject({
        method: "GET",
        url,
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(statusCode).toEqual(200);
      expect(body).toEqual(defaultResponse);
    });

    const wadoRequests = [
      "/viewer/rs/studies/:studyInstanceUid",
      "/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid",
      "/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid"
    ];

    describe.each(wadoRequests)("GET %s", (url) => {
      test("GET /", async () => {
        SocketIOStream.mockImplementation(() => ({
          on: (uuid, fn) => {
            onceFunc[uuid] = fn;
          }
        }));
        const client = app.connectedClients[websocketToken];
        const stream = fs.createReadStream(path.resolve("test/testDICOM.dcm"));
        client.emit = jest.fn((type, { uuid }) => {
          onceFunc?.[uuid]?.(stream, { contentType: "application/dicom" });
          delete onceFunc[uuid];
        });
        const { statusCode, body, headers } = await app.inject({
          method: "GET",
          url,
          headers: {
            authorization: `Bearer ${validToken}`
          }
        });

        expect(statusCode).toEqual(200);
        expect(body).toHaveLength(2470787);
        expect(headers).toStrictEqual(expect.objectContaining({ "content-type": "application/dicom" }));
      });

      test("GET /rendered", async () => {
        SocketIOStream.mockImplementation(() => ({
          on: (uuid, fn) => {
            onceFunc[uuid] = fn;
          }
        }));
        const client = app.connectedClients[websocketToken];
        const stream = fs.createReadStream(path.resolve("test/test.jpg"));
        client.emit = jest.fn((type, { uuid }) => {
          onceFunc?.[uuid]?.(stream, { contentType: "image/jpeg" });
          delete onceFunc[uuid];
        });
        const { statusCode, body, headers } = await app.inject({
          method: "GET",
          url: `${url}/rendered`,
          headers: {
            authorization: `Bearer ${validToken}`
          }
        });

        expect(statusCode).toEqual(200);
        expect(body).toHaveLength(2421611);
        expect(headers).toStrictEqual(expect.objectContaining({ "content-type": "image/jpeg" }));
      });

      test("GET /pixeldata", async () => {
        SocketIOStream.mockImplementation(() => ({
          on: (uuid, fn) => {
            onceFunc[uuid] = fn;
          }
        }));
        const client = app.connectedClients[websocketToken];
        const stream = fs.createReadStream(path.resolve("test/testDICOM.dcm"));
        client.emit = jest.fn((type, { uuid }) => {
          onceFunc?.[uuid]?.(stream, { contentType: "application/octet-stream" });
          delete onceFunc[uuid];
        });
        const { statusCode, body, headers } = await app.inject({
          method: "GET",
          url: `${url}/pixeldata`,
          headers: {
            authorization: `Bearer ${validToken}`
          }
        });

        expect(statusCode).toEqual(200);
        expect(body).toHaveLength(2470787);
        expect(headers).toStrictEqual(expect.objectContaining({ "content-type": "application/octet-stream" }));
      });

      test("GET /thumbnail", async () => {
        SocketIOStream.mockImplementation(() => ({
          on: (uuid, fn) => {
            onceFunc[uuid] = fn;
          }
        }));
        const client = app.connectedClients[websocketToken];
        const stream = fs.createReadStream(path.resolve("test/test.jpg"));
        client.emit = jest.fn((type, { uuid }) => {
          onceFunc?.[uuid]?.(stream, { contentType: "image/jpeg" });
          delete onceFunc[uuid];
        });
        const { statusCode, body, headers } = await app.inject({
          method: "GET",
          url: `${url}/thumbnail`,
          headers: {
            authorization: `Bearer ${validToken}`
          }
        });

        expect(statusCode).toEqual(200);
        expect(body).toHaveLength(2421611);
        expect(headers).toStrictEqual(expect.objectContaining({ "content-type": "image/jpeg" }));
      });

      test("GET /metadata", async () => {
        const client = app.connectedClients[websocketToken];
        client.once = jest.fn((uuid, fn) => {
          onceFunc[uuid] = fn;
        });
        client.emit = jest.fn((type, { uuid }) => {
          onceFunc?.[uuid]?.(defaultResponse);
          delete onceFunc[uuid];
        });
        const { statusCode, body } = await app.inject({
          method: "GET",
          url: `${url}/metadata`,
          headers: {
            authorization: `Bearer ${validToken}`
          }
        });

        expect(statusCode).toEqual(200);
        expect(body).toEqual(defaultResponse);
      });
    });

    test("POST /viewer/rs/studies", async () => {
      const fileBuff = await fs.promises.readFile(path.resolve("test/testDICOM.dcm"));
      const boundary = "----TEST_BOUNDARY";
      const buff: Buffer[] = [];
      buff.push(Buffer.from(boundary));
      buff.push(Buffer.from("\r\n"));
      buff.push(Buffer.from("'content-type': 'application/dicom'"));
      buff.push(Buffer.from("\r\n"));
      buff.push(Buffer.from("\r\n"));
      buff.push(fileBuff);
      buff.push(Buffer.from("\r\n"));
      buff.push(Buffer.from(`${boundary}--`));
      SocketIOStream.mockImplementation(() => ({
        emit: jest.fn(() => undefined)
      }));
      SocketIOStream.createStream = jest.fn().mockImplementation(() => (
        jest.requireActual("@wearemothership/socket.io-stream").createStream()
      ));
      const client = app.connectedClients[websocketToken];
      client.once = jest.fn((uuid, fn) => {
        onceFunc[uuid] = fn;
      });
      client.emit = jest.fn((type, { uuid }) => {
        onceFunc?.[uuid]?.(defaultResponse);
        delete onceFunc[uuid];
      });

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: "/viewer/rs/studies",
        body: Buffer.concat(buff),
        headers: {
          authorization: `Bearer ${validToken}`,
          "content-type": `multipart/related;type='application/dicom';boundary=${boundary}`,
          accepts: "application/json"
        }
      });

      expect(statusCode).toEqual(200);
      expect(body).toStrictEqual(defaultResponse);
    });

    const wadoQueries = [
      { id: "StudyUID", StudyUID: "1.2.345.67890" },
      { id: "StudyUID & SeriesUID", StudyUID: "1.2.345.67890", SeriesUID: "1.2.098.76543" },
      {
        id: "StudyUID, SeriesUID & ObjectUID", StudyUID: "1.2.345.67890", SeriesUID: "1.2.098.76543", ObjectUID: "1.2.678.09543"
      }
    ];

    test.each(wadoQueries)("GET /viewer/wadouri $id", async (props) => {
      const client = app.connectedClients[websocketToken];
      client.once = jest.fn((uuid, fn) => {
        onceFunc[uuid] = fn;
      });
      client.emit = jest.fn((type, { uuid, query }) => {
        const paramIn = new URLSearchParams(query);
        const result = {};
        // eslint-disable-next-line no-restricted-syntax
        for (const [key, val] of paramIn.entries()) {
          result[key] = val;
        }
        onceFunc?.[uuid]?.({
          contentType: "application/json",
          buffer: result
        });
        delete onceFunc[uuid];
      });
      const { StudyUID, SeriesUID, ObjectUID } = props;
      const params = new URLSearchParams({ StudyUID });
      if (SeriesUID) {
        params.append("SeriesUID", SeriesUID);
      }
      if (ObjectUID) {
        params.append("ObjectUID", ObjectUID);
      }

      const { statusCode, body } = await app.inject({
        method: "GET",
        url: `/viewer/wadouri?${params.toString()}`,
        headers: {
          authorization: `Bearer ${validToken}`,
          accepts: "*/*"
        }
      });

      expect(statusCode).toEqual(200);
      const json = JSON.parse(body);
      expect(json.StudyUID).toStrictEqual(StudyUID);
      expect(json.SeriesUID).toStrictEqual(SeriesUID);
      expect(json.ObjectUID).toStrictEqual(ObjectUID);
    });
  });
});
