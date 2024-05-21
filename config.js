const backendFilePath = "/home/backend/dev/router-vis";
const frontendFilePath = "D:\\dev\\router-vis";

const config = {
  projectPath: process.cwd()[0] === backendFilePath[0] ? backendFilePath : frontendFilePath,
  serverPort: "49737",
  routerHost: 'http://192.168.15.1/',
  debug: false,
};

export default config;
