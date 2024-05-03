import fs from "node:fs";
import path from "node:path";
import config from "../../config.js";
import asyncTryCatchNull from "../utils/asyncTryCatchNull.js";

export async function getCredentialsFromEnv() {
  const envFilePath = path.resolve(config.projectPath, ".env");
  const raw = await asyncTryCatchNull(
    fs.promises.readFile(envFilePath, "utf-8")
  );
  let u, p;
  if (typeof raw === "string") {
    raw
      .split("\n")
      .map((a) => a.trim().split("="))
      .forEach(([key, value]) => {
        if (["u", "user", "username", "router_username"].includes(
          key.toLowerCase()
        )) {
          u = value;
        } else if (["p", "pass", "password", "router_password"].includes(
          key.toLowerCase()
        )) {
          p = value;
        }
      });
  }
  if (!u && process.env['ROUTER_USERNAME']) {
    u = process.env['ROUTER_USERNAME'];
  }
  if (!p && process.env['ROUTER_PASSWORD']) {
    p = process.env['ROUTER_PASSWORD'];
  }
  return { u, p };
}
