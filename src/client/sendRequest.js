import http from "node:http";
import { env } from "../../settings.js";
import { ResponseHandlerTypeRecord } from "../server/sendResponse.js";

/**
 * Send a client request to the server
 * @param {string} type
 * @param {object} data
 */
export async function sendRequest(type, data = {}) {
  if (!ResponseHandlerTypeRecord[type]) {
    throw new Error('Invalid type argument');
  }
  return await new Promise((resolve) => {
    const chunks = [];
    let client;
    try {
      client = http.request({
        host: env.INTERNAL_DATA_SERVER_HOST,
        port: env.INTERNAL_DATA_SERVER_PORT,
        pathname: `/api/${type}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      resolve({
        stage: "request-creation",
        error: err.stack,
      });
      return;
    }
    client.on("error", (err) => {
      resolve({
        stage: "network",
        error: err.stack,
      });
      return;
    });
    client.on("response", (res) => {
      res.on("data", (data) => chunks.push(data));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        let obj;
        try {
          obj = JSON.parse(text);
          // normalize error objects
          if (typeof obj !== "object" || obj.error === true) {
            const message =
              typeof obj !== "object" ? obj.stack || obj.message || obj.reason || obj.cause : null;
            obj.error =
              message && typeof message !== "string"
                ? message
                : `Unexpected server response: ${JSON.stringify(obj)}`;
          }
          if (res.statusCode === 404 && !obj.error) {
            obj.error = "Server responded with not found";
          }
          if (res.statusCode !== 200) {
            obj.status = 200;
          }
          resolve(obj);
          return;
        } catch (err) {
          resolve({
            error: "Failed parsing server response from text",
            stage: "response",
            response: text,
          });
          return;
        }
      });
    });
    try {
      client.write(JSON.stringify(data));
      client.end();
    } catch (err) {
      resolve({
        stage: "request-send",
        error: err.stack,
      });
    }
  });
}
