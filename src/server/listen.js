import http from "node:http";
import config from "../../config.js";

const debug = false;

/**
 * @param {(data: any) => Promise<any>} handler
 */
export default function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/" && req.method === "GET") {
        return res.end("Router Vis - Extraction Server");
      }
      res.setHeader("Content-Type", "application/json");
      const chunks = [];
      req.on("data", (data) => chunks.push(data));
      req.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        if (!text || text[0] !== "{") {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: "Invalid data prefix",
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
    server.listen(config.port, () => resolve(server));
  });
}
