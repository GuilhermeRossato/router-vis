import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import config from "../../config.js";

const debug = false;

/**
 * @param {(data: any) => Promise<any>} handler
 */
export default function createDataServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/favicon.ico') {
        res.writeHead(404).end();
        return;
      }
      if ((["/", "/index", "/index.htm", "/index.html", "/request.js", "/script.js"].includes(req.url)) && req.method === "GET") {
        const dashboardFolderPath = path.resolve(config.projectPath, 'src', 'dashboard');
        const isIndexHtml = req.url === '/' || req.url.startsWith('/i') || req.url.endsWith('.html');
        const targetPath = path.resolve(dashboardFolderPath, (isIndexHtml ? '/index.html' : req.url).substring(1));
        if (!fs.existsSync(targetPath)) {
          return res.end("Router Vis - Data Server");
        }
        res.setHeader("Content-Type", isIndexHtml ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
        res.statusCode = 200;
        return res.end(fs.readFileSync(targetPath, 'utf-8'));
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      const chunks = [];
      req.on("data", (data) => chunks.push(data));
      req.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        if (!text || text[0] !== "{") {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: `Invalid request data (${text.length === 0 ? 'empty' : `char code ${text.charCodeAt(0)}"`})`,
            })
          );
          return;
        }
        try {
          const obj = JSON.parse(text);
          handler(obj).then(
            (data) => {
              if (debug) {
                console.log(
                  "Received",
                  JSON.stringify(obj),
                  "Reply",
                  JSON.stringify(data)
                );
              }
              res.end(JSON.stringify(data));
            },
            (err) => {
              if (debug) {
                console.log(
                  "Received",
                  JSON.stringify(obj),
                  "Threw",
                  JSON.stringify(err)
                );
                res.statusCode = 500;
              }
              res.end(JSON.stringify({ error: err.stack }));
            }
          );
        } catch (err) {
          console.log(err.stack);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: "Invalid data",
            })
          );
        }
      });
    });
    server.on("error", reject);
    server.listen(config.serverPort, () => resolve(server));
  });
}
