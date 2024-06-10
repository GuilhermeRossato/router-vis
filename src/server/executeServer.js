import createInternalDataServer from "./createInternalDataServer.js";
import executeExtraction from "../executeExtraction.js";

export default async function executeServer() {
  console.log("Extraction server script started");
  const { url } = await createInternalDataServer();
  console.log("Extraction server listening at:", url);
  await executeExtraction();
}
