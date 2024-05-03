import { endpointRecord } from "./endpoints.js";
import routerRequest from "./routerRequest.js";
import isolateVarList from "./isolateVarList.js";
import { loadRootDataFile, saveRootDataFile } from "../cli/storage.js";

export async function loadRawStatisticsPage(sessionId, referer) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('Cannot load raw data page without session id');
  }
  return await routerRequest(
    endpointRecord.statistics,
    sessionId,
    referer
  );
}

export default async function getStatisticsVars(sessionId, referer, resp = undefined) {
  if (!resp) {
    if (!sessionId) {
      sessionId = await loadRootDataFile("session-id.txt");
      console.log('Retrieved session id to load statistics page:', sessionId);
    }
    resp = await loadRawStatisticsPage(sessionId, referer);
    if (resp.sessionId && typeof resp.sessionId === 'string' && resp.sessionId !== sessionId) {
      console.log('Session id was updated');
      sessionId = resp.sessionId;
      await saveRootDataFile("session-id.txt", sessionId);
    }
  }
  const list = isolateVarList(resp)
  return {
    list,
    sessionId,
    referer: resp.url,
    date: resp.date,
  }
}