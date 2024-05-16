import http from "node:http";
import config from "../../config.js";

/**
 * Send a client request
 * @param {keyof import("../server/sendResponse.js").responseHandlerTypeRecord} type
 * @param {object} data
 * @returns
 */
export default async function sendRequest(type, data = {}) {
  return await new Promise((resolve) => {
    const chunks = [];
    const client = http.request({
      host: "127.0.0.1",
      port: config.port,
      pathname: "/",
      method: "POST",
      headers: {
        "Content-type": "application/json",
      },
    });
    client.on("error", (err) => {
      resolve({
        stage: "network",
        error: err.stack,
      });
    });
    client.on("response", (res) => {
      res.on("data", (data) => chunks.push(data));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        try {
          return resolve(JSON.parse(text));
        } catch (err) {
          return resolve({
            error: "Could not parse server response",
            stage: "response",
            response: text,
          });
        }
      });
    });
    client.write(JSON.stringify({...data, type}));
    client.end();
  });
}
