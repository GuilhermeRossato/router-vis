import { appendVarDataUpdate } from "./varFileStorage.js";

/**
 * @param {UpdateEntry[]} updateList
 * @param {'status' | 'statistics' | string} extractionName
 * @param {'values' | 'objects' | string} recordType
 */
export async function saveUpdateEntryList(updateList, extractionName, recordType) {
  for (const update of updateList) { 
    await appendVarDataUpdate(extractionName, recordType, update.varName, update.time, {...update, varName: undefined});
  }
}
