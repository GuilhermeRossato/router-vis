import path from "node:path";
import fs from "node:fs";
import { env } from "../../settings.js";
import { config } from "../../settings.js";
import getDateTimeString from "../utils/getDateTimeString.js";
import sleep from "../utils/sleep.js";

const debug = false;

/**
 * @typedef {Object} RouterResponseEntry
 * @property {string} host
 * @property {string} url
 * @property {string} method
 * @property {number} status
 * @property {string} sessionId
 * @property {Record<string, string>} headers
 * @property {string} body
 * @property {boolean} isRedirectResponse
 * @property {boolean} isUnauthenticatedResponse
 * @property {Date} date
 * @property {number} time
 * @property {number} duration
 * @property {number} requestNumber
 */

let reqCounter = 0;
let prevRequestData = null;

function getDefaultHeaders() {
  return {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    Host: env.ROUTER_HOSTNAME,
    Origin: `http://${env.ROUTER_HOSTNAME}`,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "sec-fetch-mode": "",
  };
}

/**
 *
 * @param {string} pathname
 * @param {string | number | undefined} sessionId
 * @param {string} [referer]
 * @param {string} [body]
 * @returns {Promise<RouterResponseEntry>}
 */
export default async function sendRouterRequest(
  pathname,
  sessionId = "",
  referer = "",
  body = undefined,
) {
  /** @type {Record<string, string>} */
  const responseHeaders = {};
  const result = {
    host: env.ROUTER_HOSTNAME || "192.168.15.1",
    url: pathname,
    method: body ? "POST" : "GET",
    status: 0,
    sessionId: typeof sessionId === "number" ? sessionId.toString() : sessionId,
    headers: responseHeaders,
    body: "",
    isRedirectResponse: false,
    isUnauthenticatedResponse: false,
    date: new Date(),
    time: new Date().getTime(),
    duration: 0,
    requestNumber: 0,
  };
  if (typeof pathname !== "string") {
    throw new Error(`Unexpected url parameter of type "${typeof pathname}"`);
  }
  if (!pathname.startsWith("/")) {
    throw new Error(`Unexpected url parameter prefix: "${pathname[0]}"`);
  }
  if (!sessionId) {
    sessionId = "";
  }
  if (typeof sessionId === "number") {
    sessionId = sessionId.toString();
  }
  if (typeof sessionId !== "string") {
    throw new Error(`Unexpected session of type "${typeof sessionId}"`);
  }
  if (!referer) {
    referer = "";
  }
  if (typeof referer !== "string") {
    throw new Error(`Unexpected referer of type "${typeof referer}"`);
  }
  if (result.host.endsWith("/")) {
    result.host = result.host.substring(0, result.host.length - 1);
  }
  result.url = result.host + pathname;
  if (!result.url.startsWith("http://") && !result.url.startsWith("https://")) {
    result.url = `http://${result.url}`;
  }
  debug && console.log("Starting", result.method, "request to", result.url);
  const requestHeaders = getDefaultHeaders();
  if (referer) {
    requestHeaders["Referer"] = referer;
  }
  if (sessionId) {
    requestHeaders["Cookie"] = `sessionID=${sessionId}`;
  }
  if (body) {
    requestHeaders["Content-Type"] = "application/x-www-form-urlencoded";
    requestHeaders["Content-Length"] = body.length.toString();
  }
  let date = new Date();
  if (prevRequestData) {
    const prevEnd = prevRequestData.time + prevRequestData.duration * 1000;
    const elapsed = (date.getTime() - prevEnd) / 1000;
    const matchesPrevious =
      prevRequestData?.url === result.url &&
      prevRequestData?.method === result.method &&
      prevRequestData?.sessionId === sessionId;
    if (matchesPrevious && elapsed <= 7) {
      debug && console.log("Returning matching duplicated request from cache");
      await sleep(500);
      return {
        ...prevRequestData,
        date: date,
        time: date.getTime(),
        duration: parseFloat(((new Date().getTime()-date.getTime())/1000).toFixed(2)),
      };
    }
    const timeToWait = Math.round(Math.max(0, (1 - elapsed) * 1000));
    debug && console.log("Last request finished", parseFloat(elapsed.toFixed(1)), `seconds ago`);
    if (timeToWait) {
      debug && console.log(`Waiting for ${timeToWait} ms (throttling) between requests`);
      await sleep(timeToWait);
      date = new Date();
    }
  }
  debug && console.log(`Sending requesting with ${JSON.stringify(requestHeaders["Cookie"])}`);
  const response = await fetch(result.url, {
    method: result.method.toUpperCase(),
    body,
    headers: requestHeaders,
  });
  result.status = response.status;
  try {
    for (const key in response.headers) {
      responseHeaders[key] = response.headers[key];
    }
  } catch (err) {
    console.debug("Failed iterating headers:", err);
    try {
      const list = [...response.headers.entries()];
      for (const [key, value] of list) {
        responseHeaders[key] = value;
      }
    } catch (err) {
      console.debug("Failed iterating headers with alternative method:", err);
      responseHeaders["Error"] = err.message;
    }
  }
  const setCookie = response.headers.get("set-cookie");
  if (
    setCookie &&
    setCookie.startsWith("session") &&
    setCookie.includes("=") &&
    setCookie.includes(";")
  ) {
    const newId = setCookie.split("=")[1].split(";")[0].trim();
    if (newId) {
      sessionId = newId;
      result.sessionId = sessionId;
    }
  }
  result.body = await response.text();
  result.duration = parseFloat(((new Date().getTime()-result.time)/1000).toFixed(2)),
  reqCounter++;
  result.requestNumber = reqCounter;
  const lines = result.body.split("\n");
  const normalized =
    lines.length >= 30
      ? lines
      : lines.map((l) =>
          l
            .toLowerCase()
            .replace(/\s/g, "")
            .replace(/\'/g, "")
            .replace(/\"/g, "")
            .replace(/\;/g, ""),
        );
  result.isRedirectResponse =
    lines.length <= 30 &&
    Boolean(
      normalized.find(
        (line, i) => line.startsWith("<script") && normalized[i + 1] === "window.top.location=/",
      ),
    );
  result.isUnauthenticatedResponse = Boolean(
    lines.find(
      (l) =>
        l.includes('<th colspan="2">Você não está Autenticado</th>') ||
        l.includes('<th colspan="2">You are not logged in</th>'),
    ),
  );
  prevRequestData = result;
  if (debug) {
    const requestFolder = path.resolve(config.dataPath, "requests");
    const filePath = path.resolve(
      requestFolder,
      `r-${getDateTimeString(result.time, false).replace(/\D/g, "-")}.json`,
    );
    if (reqCounter <= 1) {
      console.log("Saving request number", reqCounter, "to", JSON.stringify(filePath));
    }
    await fs.promises.mkdir(requestFolder, { recursive: true });
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(
        {
          requestHeaders,
          ...result,
          body: result.body.split("\n"),
        },
        null,
        "  ",
      ),
    );
  }
  return result;
}
