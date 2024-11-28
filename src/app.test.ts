/* eslint-disable import/no-extraneous-dependencies */
import { v4 as uuid4 } from "uuid";
import jwt from "jsonwebtoken";
import socketIOClient from "socket.io-client";
import fs from "fs";
import path from "path";
import initFastify from "./initFastify";
import { pacsSecret, pacsIssuer } from "./config";

jest.mock("./utils", () => ({
  getLogger: () => console
}));

jest.mock("./config", () => ({
  logDir: "./logs",
  webserverPort: 5001,
  websocketPort: 6001,
  websocketToken: "DEFAULT_TOKEN",
  pacsSecret: "TEST_SECRET",
  pacsIssuer: "TEST_ISSUER",
  secure: false,
  withCors: false
}));

const data = {};

const mockClient = ({
  flushAll: jest.fn(() => {
    Object.keys(data).forEach((key) => delete data[key]);
    return Promise.resolve();
  }),
  get: jest.fn((key) => Promise.resolve(data[key])),
  set: jest.fn((key, value) => {
    data[key] = value;
    return Promise.resolve();
  }),
  del: jest.fn((key) => {
    delete data[key];
    return Promise.resolve();
  }),
  connect: jest.fn(),
  disconnect: jest.fn(),
  duplicate: jest.fn().mockReturnThis(),
  psubscribe: jest.fn(),
  subscribe: jest.fn(),
  send_command: jest.fn(),
  publish: jest.fn(),
  on: jest.fn(),
  quit: jest.fn()
});

jest.mock("redis", () => ({
  createClient: jest.fn(() => mockClient)
}));

const token = "96e5accc-15d5-49f9-a547-8914e64942e3";
const validToken = jwt.sign(
  { websocketToken: token, id: uuid4() },
  pacsSecret,
  { issuer: pacsIssuer }
);
const invalidIssuerToken = jwt.sign({ websocketToken: token, id: uuid4() }, pacsSecret, { issuer: "BAD_ISSUER" });
const invalidSecretToken = jwt.sign({ websocketToken: token, id: uuid4() }, "BAD_SECRET", { issuer: pacsIssuer });

describe("Dicom Websocket Bridge", () => {
  let app;
  let infoSpy;
  let warnSpy;
  beforeEach(async () => {
    infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    app = await initFastify();
    const rooms = new Set();
    rooms.add(token);
    app.io.fetchSockets = jest.fn(() => ([{
      rooms
    }]));
    app.io.in = jest.fn(() => ({
      timeout: jest.fn(() => ({
        emit: jest.fn((_type, _args, callback) => {
          // eslint-disable-next-line no-console
          console.error("Default emit called");
          callback();
        })
      }))
    }));
  });

  afterEach(() => {
    app.io.close();
    app.close();
    infoSpy.mockReset();
    warnSpy.mockReset();
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
          token
        }
      }
    );

    socket.on("connect", async () => {
      expect(socket.connected).toBeTruthy();
      const serSocket = app.io.of("/").sockets.get(socket.id);
      expect(serSocket.id).toEqual(socket.id);
      expect(serSocket.handshake.auth.token).toEqual(token);
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

  test("onRequest (invalid issuer token)", () => new Promise<void>((resolve, reject) => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const socket = socketIOClient(
      "http://0.0.0.0:6001",
      {
        reconnection: false,
        auth: {
          token
        }
      }
    );

    socket.on("connect", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: "./viewer/rs/studies",
        headers: {
          authorization: `Bearer ${invalidIssuerToken}`
        }
      });

      expect(statusCode).toEqual(401);
      expect(errorSpy).toHaveBeenCalledWith("Token not valid");
      socket.close();
      errorSpy.mockRestore();
      resolve();
    });

    socket.on("error", (e) => {
      socket.close();
      errorSpy.mockRestore();
      reject(e);
    });
  }));

  test("onRequest (invalid secret token)", () => new Promise<void>((resolve, reject) => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const socket = socketIOClient(
      "http://0.0.0.0:6001",
      {
        reconnection: false,
        auth: {
          token
        }
      }
    );

    socket.on("connect", async () => {
      const { statusCode } = await app.inject({
        method: "GET",
        url: "./viewer/rs/studies",
        headers: {
          authorization: `Bearer ${invalidSecretToken}`
        }
      });

      expect(statusCode).toEqual(401);
      expect(errorSpy).toHaveBeenCalledWith("Token not valid");
      socket.close();
      errorSpy.mockRestore();
      resolve();
    });

    socket.on("error", (e) => {
      socket.close();
      errorSpy.mockRestore();
      reject(e);
    });
  }));

  describe("Test Routes", () => {
    let socket;
    const defaultResponse = { test: "response" };
    beforeEach(() => new Promise<void>((resolve, reject) => {
      socket = socketIOClient(
        "http://0.0.0.0:6001",
        { reconnection: false, auth: { token } }
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
      app.io.in = jest.fn(() => ({
        timeout: jest.fn(() => ({
          emit: jest.fn((_type, _args, callback) => {
            callback(null, [{ success: true, data: defaultResponse }]);
          })
        }))
      }));
      const { statusCode, body } = await app.inject({
        method: "GET",
        url,
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(statusCode).toEqual(200);
      expect(JSON.parse(body)).toEqual(defaultResponse);
    });

    const wadoRequests = [
      "/viewer/rs/studies/:studyInstanceUid",
      "/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid",
      "/viewer/rs/studies/:studyInstanceUid/series/:seriesInstanceUid/instances/:sopInstanceUid"
    ];

    describe.each(wadoRequests)("GET %s", (url) => {
      test("GET /", async () => {
        const buffer = fs.readFileSync(path.resolve("test/testDICOM.dcm"));
        app.io.in = jest.fn(() => ({
          timeout: jest.fn(() => ({
            emit: jest.fn((_type, _args, callback) => {
              callback(null, [{ success: true, buffer, headers: { contentType: "application/dicom" } }]);
            })
          }))
        }));

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
        const buffer = fs.readFileSync(path.resolve("test/test.jpg"));
        app.io.in = jest.fn(() => ({
          timeout: jest.fn(() => ({
            emit: jest.fn((_type, _args, callback) => {
              callback(null, [{ success: true, buffer, headers: { contentType: "image/jpeg" } }]);
            })
          }))
        }));

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
        const buffer = fs.readFileSync(path.resolve("test/testDICOM.dcm"));
        app.io.in = jest.fn(() => ({
          timeout: jest.fn(() => ({
            emit: jest.fn((_type, _args, callback) => {
              callback(null, [{ success: true, buffer, headers: { contentType: "application/octet-stream" } }]);
            })
          }))
        }));

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
        const buffer = fs.readFileSync(path.resolve("test/test.jpg"));
        app.io.in = jest.fn(() => ({
          timeout: jest.fn(() => ({
            emit: jest.fn((_type, _args, callback) => {
              callback(null, [{ success: true, buffer, headers: { contentType: "image/jpeg" } }]);
            })
          }))
        }));

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
        app.io.in = jest.fn(() => ({
          timeout: jest.fn(() => ({
            emit: jest.fn((_type, _args, callback) => {
              callback(null, [{ success: true, data: defaultResponse }]);
            })
          }))
        }));

        const { statusCode, body } = await app.inject({
          method: "GET",
          url: `${url}/metadata`,
          headers: {
            authorization: `Bearer ${validToken}`
          }
        });

        expect(statusCode).toEqual(200);
        expect(JSON.parse(body)).toEqual(defaultResponse);
      });
    });

    test("POST /viewer/rs/studies", async () => {
      const fileBuff = await fs.promises.readFile(path.resolve("test/testDICOM.dcm"));
      const boundary = `--${uuid4()}`;
      const buff: Buffer[] = [];
      buff.push(Buffer.from(boundary));
      buff.push(Buffer.from("\r\n"));
      buff.push(Buffer.from("'content-type': 'application/dicom'"));
      buff.push(Buffer.from("\r\n"));
      buff.push(Buffer.from("\r\n"));
      buff.push(fileBuff);
      buff.push(Buffer.from("\r\n"));
      buff.push(Buffer.from(`${boundary}--`));

      app.io.in = jest.fn(() => ({
        timeout: jest.fn(() => ({
          emit: jest.fn((_type, _body, _headers, callback) => {
            callback(null, { success: true, data: defaultResponse });
          })
        }))
      }));

      const { statusCode, body } = await app.inject({
        method: "POST",
        url: "/viewer/rs/studies",
        body: Buffer.concat(buff),
        headers: {
          authorization: `Bearer ${validToken}`,
          "content-type": `multipart/related; type="application/dicom"; boundary=${boundary}`,
          accepts: "application/json"
        }
      });

      expect(statusCode).toEqual(200);
      expect(JSON.parse(body)).toEqual(expect.objectContaining({
        success: true,
        data: defaultResponse
      }));
    });

    const wadoQueries = [
      { id: "StudyUID", StudyUID: "1.2.345.67890" },
      { id: "StudyUID & SeriesUID", StudyUID: "1.2.345.67890", SeriesUID: "1.2.098.76543" },
      {
        id: "StudyUID, SeriesUID & ObjectUID",
        StudyUID: "1.2.345.67890",
        SeriesUID: "1.2.098.76543",
        ObjectUID: "1.2.678.09543"
      }
    ];

    test.each(wadoQueries)("GET /viewer/wadouri $id", async (props) => {
      app.io.in = jest.fn(() => ({
        timeout: jest.fn(() => ({
          emit: jest.fn((_type, { query }, callback) => {
            const paramIn = new URLSearchParams(query);
            const result = {};
            // eslint-disable-next-line no-restricted-syntax
            for (const [key, val] of paramIn.entries()) {
              result[key] = val;
            }
            callback(null, { contentType: "application/json", buffer: result });
          })
        }))
      }));

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
