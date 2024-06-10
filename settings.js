import path from "node:path";
import { loadEnvSync } from "./src/utils/loadEnvSync.js";

export const config = {
  debug: false,
  standalone: false,
  speed: ["auto", "gbps", "mbps", "kbps", "bps"][0],
  usage: ["auto", "mb", "kb", "b"][0],
  projectPath: path.dirname(path.resolve(process.argv[1])),
  dataPath: path.resolve(path.dirname(path.resolve(process.argv[1])), "data"),
  session: "",
  user: "",
  pass: "",
};

export const modes = {
  help: false,
  status: false,
  restart: false,
  shutdown: false,
  server: false,
  logs: false,
  api: false,
  speed: [false, "bps", "kbps", "mbps", "gbps"][0],
  usage: [false, "b", "kb", "mb", "gb"][0],
};

export const dataFileName = {
  clientLog: "client.log",
  serverLog: "server.log",
  latestStatus: "latest-status.json",
  latestStatistics: "latest-statistics.json",
  sessionId: "session-id.txt",
};

const loaded = loadEnvSync([
  config.projectPath,
  config.projectPath ? path.resolve(config.projectPath, "src") : "",
  config.dataPath ? path.basename(config.dataPath) : "",
  config.dataPath,
  process.cwd(),
]);

export const env = {
  ROUTER_HOSTNAME: process.env.ROUTER_HOSTNAME || loaded.ROUTER_HOSTNAME || "192.168.15.1",
  ROUTER_USERNAME: process.env.ROUTER_USERNAME || loaded.ROUTER_USERNAME || "admin",
  ROUTER_PASSWORD: process.env.ROUTER_PASSWORD || loaded.ROUTER_PASSWORD || "",
  INTERNAL_DATA_SERVER_HOST:
    process.env.INTERNAL_DATA_SERVER_HOST || loaded.INTERNAL_DATA_SERVER_HOST || "127.0.0.1",
  INTERNAL_DATA_SERVER_PORT:
    process.env.INTERNAL_DATA_SERVER_PORT || loaded.INTERNAL_DATA_SERVER_PORT || "49737",
};
