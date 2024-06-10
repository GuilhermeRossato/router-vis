import { getVarFolderName } from "./getVarFileDataPath.js";
import { saveRootTextFile } from "./rootTextFileStorage.js";


export async function saveLatestDataState(stateKey = 'unknown', rec) {
  if (typeof rec === 'string' && typeof stateKey === 'object') {
    const tmp = stateKey;
    stateKey = rec;
    rec = tmp;
  }
  if (!rec || !rec.time) {
    throw new Error('Invalid latest data state');
  }
  if (rec.date) {
    delete rec.date;
  }
  await saveRootTextFile(
    `latest-${stateKey}.json`,
    JSON.stringify(
      rec,
      null,
      "  "
    )
  );
}
