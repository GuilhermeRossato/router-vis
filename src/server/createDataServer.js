import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { config, env } from "../../settings.js";

const debug = false;

/**
 * @param {(type: string, data: any) => Promise<any>} handler
 */
export default function createDataServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/" || req.url === "/index.html") {
        return res.end("Router Vis Extractor - Data Extractor Server\n");
      }
      if (!req.url.startsWith("/api/")) {
        res.statusCode = 404;
        return res.end('Router Vis Extractor - Expected "api/" route prefix at request\n');
      }
      const type = req.url.substring(1).split("/")[1].split("?")[0];
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const chunks = [];
      req.on("data", (data) => chunks.push(data));
      req.on("end", () => {
        try {
          let text = "";
          if (chunks.length && chunks[0]?.length) {
            text = Buffer.concat(chunks).toString("utf-8");
          }
          if (text && (!text.startsWith("{") || !text.includes("}"))) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                error: `Invalid request body ${
                  text.length === 0 ? "(empty)" : `starting with char code ${text.charCodeAt(0)}"`
                }`,
                body: text,
              }),
            );
            return;
          }
          const obj = text ? JSON.parse(text) : null;
          if (obj && req.url.indexOf("?") !== -1) {
            const urlArgPairs = req.url
              .substring(req.url.indexOf("?") + 1)
              .split("&")
              .map((a) => a.split("="))
              .filter((p) => p[0] && p[1] && !obj[p[0]]);
            for (const [key, value] of urlArgPairs) {
              obj[key.toLowerCase()] = obj[key.toLowerCase()] || value;
            }
          }
          handler(type, obj).then(
            (data) => {
              if (debug) {
                process.stdout.write(
                  `Received ${JSON.stringify(obj)} Replied ${JSON.stringify(data)}`,
                );
              }
              res.statusCode = 200;
              res.end(JSON.stringify(data));
            },
            (err) => {
              if (debug) {
                process.stdout.write(
                  `Received ${JSON.stringify(obj)} Threw ${JSON.stringify(err)}`,
                );
              }
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.stack }));
            },
          );
        } catch (err) {
          console.log("Server response failed:");
          console.log(err.stack);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: "Invalid data",
            }),
          );
        }
      });
    });
    server.on("error", reject);
    server.listen(env.INTERNAL_DATA_SERVER_PORT, env.INTERNAL_DATA_SERVER_HOST, () =>
      resolve(server),
    );
  });
}
