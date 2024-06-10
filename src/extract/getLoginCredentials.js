import path from "node:path";
import { config, env } from "../../settings.js";
import { loadEnvSync } from "../utils/loadEnvSync.js";

export async function getLoginCredentials() {
  loadEnvSync(
    [
      config.projectPath,
      config.projectPath ? path.resolve(config.projectPath, "src") : "",
      config.dataPath ? path.basename(config.dataPath) : "",
      config.dataPath,
      process.cwd(),
    ],
    env,
  );
  return { u: config.user || env.ROUTER_USERNAME, p: config.pass || env.ROUTER_PASSWORD };
}
