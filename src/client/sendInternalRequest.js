import http from "node:http";
import { config, env } from "../../settings.js";

/**
 * Send a client request
 * @param {string} type
 * @param {any} data
 */
export default async function sendInternalRequest(type = "", data = null) {
  const host = env.INTERNAL_DATA_SERVER_HOST || "127.0.0.1";
  const port = env.INTERNAL_DATA_SERVER_PORT || "49737";
  const hostname = `${host}:${port}`;
  let stage = "start";
  let status = 0;
  let body = "";
  try {
    stage = "network";
    const isPostOnlyType = ["shutdown", "login"].includes(type);
    const response = await fetch(`http://${hostname}/api/${type}`, {
      method: data || isPostOnlyType ? "POST" : "GET",
      body: data && typeof data === "object" ? JSON.stringify(data) : isPostOnlyType ? '{}' : undefined,
      headers:
        data && typeof data === "object"
          ? {
              "Content-Type": "application/json",
            }
          : {},
    });
    stage = "body";
    status = response.status;
    body = await response.text();
  } catch (err) {
    return {
      error: "Internal server request failed",
      stage,
      status,
      body,
      hostname,
    };
  }
  stage = "data";
  let obj;
  try {
    obj = body ? JSON.parse(body) : "";
  } catch (err) {
    return {
      error: "Internal server response interpretation failed",
      stage,
      status,
      body,
      hostname,
    };
  }
  stage = "response";
  if (obj && typeof obj === "object" && status !== 200) {
    obj.status = status;
  }
  return obj;
}
