import { camelCaseToDash } from "./camelCaseToDash.js";

export function getNormalizedVarName(varName) {
  return camelCaseToDash(varName.replace(/\W/, "-"))
    .replace(/\"/, "-")
    .replace(/(\d)/g, "$1-")
    .replace(/\-\-+/g, "-");
}
