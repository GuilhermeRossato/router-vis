import fs from "node:fs";
import path from "node:path";
import { config } from "../../settings.js";

export function executeConfigMode(callback) {
  let timeoutTimer = setTimeout(() => {
    console.log("Router-Vis Config Mode has timed out");
    console.log("Program will exit");
    process.exit(1);
  }, 2 * 60_000);

  console.log("Router Vis Config Mode");

  let stage = 0;

  
  if (!config.dataPath) {
    config.dataPath = guessProjectPath();
    console.debug('Guessed project path', config.dataPath);
  }

  const stages = [
    [
      "projectPath",
      "project path",
      process.cwd()
    ],
    ["routerHost", "router host", "http://192.168.15.1/"],
    ["routerUser", "router user", "admin"],
    ["routerPass", "router pass"],
  ];

  const skipProjectPathQuery =
    config.dataPath && !process.argv.includes("--config");

  if (skipProjectPathQuery) {
    stages.shift();
  }

  printQuery();

  process.stdin.on("data", handleUserInputData);

  function finalizeConfigMode() {
    process.stdin.off("data", printQuery);
    process.stdin.pause();
    const configFilePath = path.resolve(config.dataPath || ".", "config.js");
    let source = fs
      .readFileSync(configFilePath, "utf-8")
      .replace(/\'\'/g, '""');

    const vars = ["routerHost", "routerUser", "routerPass", "projectPath"];
    for (const key of vars) {
      const start = source.indexOf(key + ":");
      if (start === -1) {
        continue;
      }
      const end = source.indexOf("\n", start);
      source = [
        source.substring(0, start + key.length) + ": ",
        JSON.stringify(config[key]) + ",",
        source.substring(end),
      ].join("");
    }
    fs.writeFileSync(configFilePath, source.trim() + "\n", "utf-8");
    console.debug("Updated config file at:", configFilePath);
    clearTimeout(timeoutTimer);
    if (!callback) {
      process.exit(0);
    }
    callback(config).catch((err) => {
      console.debug("Failed after config");
      console.log(err);
      process.exit(1);
    });
  }

  function printQuery() {
    const list = stages[stage];
    if (list) {
      const [key, query, def] = list;
      const sufix = `[${config[key] ? "current" : "default"} ${JSON.stringify(
        key === 'routerPass' ? '(omitted)' : (config[key] || def || 'none')
      )}]`;
      console.log(`Specify the ${query}: ${sufix}`);
      process.stdout.write(query + " > ");
      return;
    }
    finalizeConfigMode();
  }

  function handleUserInputData(data) {
    let text = data.toString("utf-8").trim();
    const [key, query, def] = stages[stage];
    if (!text && (config[key] || def)) {
      config[key] = config[key] || def;
      stage++;
      printQuery();
      return;
    }
    if (!text || text.length > 500) {
      console.log("Invalid input");
      printQuery();
      return;
    }
    if (key === "projectPath") {
      text = path.resolve(text);
      if (!fs.existsSync(text)) {
        console.log("Path not found:", text);
        printQuery();
        return;
      }
      if (!fs.statSync(text).isFile()) {
        text = path.dirname(text);
      }
      text = text.replace(/\\/g, "/");
    }
    if (key === "routerHost") {
      if (!text.substring(1, 9).includes("://")) {
        text = `http://${text}`;
      }
      if (!text.endsWith("/")) {
        text = `${text}/`;
      }
    }
    config[key] = text;
    stage++;
    printQuery();
    return;
  }
}

function guessProjectPath() {
  for (const candidate of [
    ".",
    "./router-vis",
    "./router-vis-master",
    "..",
    "../router-vis",
  ]) {
    const packagePath = path.resolve(process.cwd(), candidate, "package.json");
    console.debug({ packagePath });
    try {
      const text = fs.readFileSync(packagePath, "utf-8");
      if (JSON.parse(text).name === "router-vis") {
        console.debug("Found project path with package at", packagePath);
        const projectPath = path.dirname(packagePath).replace(/\\/g, "/");
        console.debug("Project path:", projectPath);
        return projectPath;
      }
    } catch (err) {
      console.debug(candidate, "not found");
    }
  }
}
