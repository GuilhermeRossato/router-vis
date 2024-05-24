export const config = {
  routerHost: "",
  routerUser: "",
  routerPass: "",
  projectPath: "",
  extractionServerHost: "localhost",
  extractionServerPort: "49737",
  debug: false,
  config: false,
  shutdown: false,
  restart: false,
  standalone: false,
  logs: false,
  speed: "",
  usage: "",
};

if (
  !config.projectPath ||
  !config.routerHost ||
  !config.routerUser ||
  !config.routerPass ||
  process.argv.includes("--config")
) {
  config.config = true;
}

export default config;
