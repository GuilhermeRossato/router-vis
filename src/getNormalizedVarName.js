import { camelCaseToDash } from "./camelCaseToDash.js";

export function getNormalizedVarName(varName) {
  const name = camelCaseToDash(varName.replace(/\W/, "-"))
    .replace(/\"/, "-")
    .replace(/(\d)/g, "$1-")
    .replace(/\-\-+/g, "-");
  return name.substring(name.startsWith('-') ? 1 : 0, name.length - (name.endsWith('-') ? 1 : 0))
}
