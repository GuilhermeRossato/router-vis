import config from "../../config.js";
import { endpointRecord } from "./endpoints.js";

import fs from "node:fs";
import getDateTimeString from "../utils/getDateTimeString.js";

let c = 0;

async function handleDataResponseForDebug(url, bodyText, dateObj, requestCount, isStatus, isStatistics, config) {
  // const fileName = `r-${isStatistics ? 'b' : 'a'}-${requestCount % 10}.html`;
  // await fs.promises.writeFile(`${config.projectPath}/data/${fileName}`, `<!-- ${url} -->\n<!-- ${getDateTimeString(dateObj)} -->\n${bodyText}`, 'utf-8');
}

let previousRequestData;

export function getPreviousRequestData() {
  return previousRequestData;
}

export default async function routerRequest(url, sessionId, referer, body) {
  if (sessionId === null || sessionId === undefined || sessionId === "") {
    sessionId = "";
  }
  if (typeof sessionId !== 'string') {
    throw new Error(`Unexpected session of type ${typeof sessionId}`);
  }
  if (referer === null || referer === undefined || referer === "") {
    referer = "";
  }
  if (typeof referer !== 'string') {
    throw new Error(`Unexpected referer of type ${typeof referer}`);
  }
  if (!url.startsWith("/")) {
    throw new Error("Invalid url");
  }
  const host = config.routerHost.endsWith("/")
    ? config.routerHost.substring(0, config.routerHost.length - 1)
    : config.routerHost;
  url = host + url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `http://${url}`;
  }
  const requestHeaders = {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Encoding": "gzip, deflate",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    Host: "192.168.15.1",
    Origin: "http://192.168.15.1",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    Pragma: "no-cache",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "sec-fetch-mode": "",
  };
  
  if (referer) {
    requestHeaders["Referer"] = referer;
  }
  if (sessionId) {
    requestHeaders["Cookie"] = `sessionID=${sessionId}`;
  }
  const method = body ? "POST" : "GET";
  if (body) {
    requestHeaders["Content-Type"] = "application/x-www-form-urlencoded";
    requestHeaders["Content-Length"] = body.length.toString();
  }
  let responseHeaders = undefined;
  let responseStatus = undefined;
  let responseBody = undefined;
  /*
  fs.appendFileSync(`D:\\dev\\router-vis\\data\\req-${c}.json`, JSON.stringify({
    date: getDateTimeString(),
    request: {
      url,
      method,
      body,
      headers: requestHeaders
    },
    response: {
      status: null,
      headers: null,
    }
  }, null, '  '), 'utf-8');
  */
  const date = new Date();
  const response = await fetch(url, {
      method: method.toUpperCase(),
      body,
      headers: requestHeaders,
  });
  responseStatus = response.status;
  responseHeaders = {};
  try {
    for (const key in response.headers) {
      responseHeaders[key] = response.headers[key]
    }
    responseHeaders['a'] = 1;
  } catch (err) {
    try {
      const list = [...response.headers.entries()];
      for (const [key, value] of list) {
        responseHeaders[key] = value;
      }
      responseHeaders['a'] = 2;
    } catch (err) {
      responseHeaders = {
        error: err.stack,
      }
    }
  }
  const setCookie = response.headers.get('set-cookie');
  if (setCookie && setCookie.startsWith('session') && setCookie.includes('=') && setCookie.includes(';')) {
      const newId = setCookie.split('=')[1].split(';')[0].trim();
      if (newId) {
        sessionId = newId;
      }
  }
  responseBody = await response.text();
  
  if (url.includes(endpointRecord.status) || url.includes(endpointRecord.statistics)) {
    await handleDataResponseForDebug(url, responseBody, date, c, url.includes(endpointRecord.status), url.includes(endpointRecord.statistics), config);
    c++;
  }
  const lines = (responseBody || '').split('\n');
  const normalized = lines.length >= 30 ? lines : lines.map(
      l => l.toLowerCase().replace(/\s/g, '').replace(/\'/g, '').replace(/\"/g, '').replace(/\;/g, '')
  );
  const isRedirect = lines.length <= 30 && normalized.find((line, i) => line.startsWith("<script") && normalized[i+1] === 'window.top.location=/');
  const isUnauthenticated = lines.find(l => l.includes('<th colspan="2">Você não está Autenticado</th>') || l.includes('<th colspan="2">You are not logged in</th>'));
  /*
  fs.appendFileSync(`D:\\dev\\router-vis\\data\\req-${c}.json`, JSON.stringify({
    date: getDateTimeString(),
    request: {
      url,
      method,
      body,
      headers: requestHeaders
    },
    response: {
      status: responseStatus,
      sessionId,
      headers: responseHeaders,
      body: responseBody,
      isRedirect,
      isUnauthenticated,
      lineCount: lines.length,
    }
  }, null, '  '), 'utf-8');
  */
  const result = {
    url,
    status: responseStatus,
    sessionId,
    headers: responseHeaders,
    body: responseBody,
    isRedirect,
    isUnauthenticated,
    lineCount: lines.length,
    date,
  }
  previousRequestData = result;
  return result;
}