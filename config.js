const backendFilePath = "/home/backend/dev/router-vis";
const frontendFilePath = "D:\\dev\\router-vis";
const config = {
  projectPath: process.cwd()[0] === backendFilePath[0] ? backendFilePath : frontendFilePath,
  port: "49737",
  routerHost: 'http://192.168.15.1/',
  showLogSource: true,
};

export default config;
