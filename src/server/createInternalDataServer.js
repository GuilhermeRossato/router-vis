import http from "node:http";
import { env } from "../../settings.js";
import processInternalRequest, { ResponseHandlerTypeRecord } from "./processInternalRequest.js";

const debug = false;

const stringify = (o) => JSON.stringify(o, null, "  ");

export default function createInternalDataServer() {
  const port = env.INTERNAL_DATA_SERVER_PORT;
  const host = env.INTERNAL_DATA_SERVER_HOST;
  const url = `http://${host}:${port}/`;
  const server = new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on("error", reject);
    server.on("request", (req, res) => {
      if (!req.url.startsWith("/api/")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        const mem = process.memoryUsage();
        let head = "";
        let text = "";
        if (req.url === "/" || req.url.startsWith("/index")) {
          head = "Index";
          text = `Routes:<br>\n${Object.keys(ResponseHandlerTypeRecord)
            .map((k) => `/api/${k === "index" ? "" : k}`)
            .map((k) => `<a href="${k}">${k}</a><br>`)
            .join("\n")}`;
        } else if (!req.url.startsWith("/api/")) {
          res.statusCode = 404;
          head = "Invalid url prefix";
          text = 'Url must start with "/api/"';
        } else {
          res.statusCode = 500;
          head = "Unhandled";
          text = '<a href="/">To root</a><br><a href="/api/">To api</a>';
        }
        const firstLine = `Router Vis Extractor Server - ${head} - (Process: ${
          process.pid
        }, Memory: ${Math.floor(mem.heapUsed / 1024)} KB / ${Math.floor(mem.heapTotal / 1024)} KB)`;
        return res.end(`${firstLine}\n<br>\n${text}`);
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      let q = req.url.indexOf("?");
      const type = req.url.substring(req.url.indexOf("/", 1) + 1, q === -1 ? req.url.length : q);
      const chunks = [];
      req.on("data", (data) => chunks.push(data));
      req.on("end", () => {
        try {
          let text = "";
          if (chunks.length && chunks[0]?.length) {
            text = Buffer.concat(chunks).toString("utf-8");
          }
          if (text && (!text.startsWith("{") || !text.includes("}"))) {
            throw new Error(`Invalid request body with ${text.length} bytes`);
          }
          const obj = text ? JSON.parse(text) : {};
          if (q !== -1) {
            const urlArgPairs = req.url
              .substring(q + 1)
              .split("&")
              .map((a) => a.split("="))
              .filter((p) => p[0] && p[1] && !obj[p[0]]);
            for (const [key, value] of urlArgPairs) {
              obj[key.toLowerCase()] = obj[key.toLowerCase()] || value;
            }
          }
          if (["shutdown", "login"].includes(type) && req.method !== "POST") {
            res.statusCode = 500;
            res.end(
              stringify({ error: `Invalid request method`, expected: "POST", got: req.method }),
            );
            return;
          }
          processInternalRequest(type, obj).then(
            (data) => {
              if (debug) {
                process.stdout.write(
                  `Api "${type}" received ${stringify(obj).substring(
                    0,
                    128,
                  )} and replied ${stringify(data).substring(0, 256)}`,
                );
              }
              res.statusCode = data && data.error ? 500 : 200;
              res.end(stringify(data));
            },
            (err) => {
              if (debug) {
                process.stdout.write(
                  `Api "${type}" received ${stringify(obj).substring(0, 128)} and threw ${stringify(
                    err,
                  ).substring(0, 256)}`,
                );
              }
              res.statusCode = 500;
              res.end(stringify({ error: err.stack }));
            },
          );
        } catch (err) {
          console.log("Server response failed:");
          console.log(err.stack);
          res.statusCode = 500;
          res.end(
            stringify({
              error: `Unexpected failure while processing request: ${err.message}`,
            }),
          );
        }
      });
    });
    server.listen(port, host, () => resolve(server));
  });
  return {
    url,
    server,
  };
}
