import sleep from "../utils/sleep.js";
import { endpointRecord } from "./endpoints.js";
import routerRequest from "./routerRequest.js";
import { getCredentialsFromEnv } from "./getCredentialsFromEnv.js";

export default async function login(previousSessionId, referer) {
  const first = await routerRequest(
    endpointRecord.root,
    previousSessionId,
    referer
  );

  let s = first.sessionId;

  await sleep(250);

  const maintained = previousSessionId && first.sessionId === previousSessionId && s === previousSessionId;
  if (maintained) {
    console.log("Previous session id maintained on first request:", s);
  } else if (previousSessionId) {
    console.log("Previous session id replaced on first request:", s);
  } else if (!previousSessionId) {
    console.log("Session id was obtained on first request", s);
  }

  // Check for instant success
  if (maintained) {
    const verify = await routerRequest(endpointRecord.status, s, first.url);
    const failed = (
      verify.isRedirect ||
      verify.isUnauthenticated ||
      verify.status !== 200 ||
      verify.lineCount <= 30 ||
      verify.sessionId !== s
    );
    console.log('Maintained session', failed ? 'failed' : 'succeeded','status retrieval');
    await sleep(500);
    if (!failed) {
      return verify;
    }
  }

  // Check if new response will match the session id
  let resp = await routerRequest(endpointRecord.status, s, first.url);

  // Loop until it stabilizes
  if (resp.sessionId !== s) {
    console.log("Router updated session at first status request");
    for (let i = 0; i < 4 && s !== resp.sessionId; i++) {
      console.log(
        `Response ${i}/4 updated session from ${s} to ${resp.sessionId}`
      );
      s = resp.sessionId;
      resp = await routerRequest(endpointRecord.status, s, first.url);
      await sleep(400 + 400 * i);
    }
  }
  if (resp.sessionId !== s) {
    throw new Error(
      `Could not get matching session id: ${JSON.stringify([
        resp.sessionId,
        s,
      ])}`
    );
  }
  const {u, p} = await getCredentialsFromEnv();
  if (!u || !p) {
    throw new Error(
      `Could not find "ROUTER_USERNAME" or "ROUTER_PASSWORD" variables for authentication`
    );
  }
  const loginResponse = await routerRequest(
    endpointRecord.login,
    s,
    resp.url,
    `loginUsername=${u}&loginPassword=${p}`
  );
  if (s !== loginResponse.sessionId) {
    console.log(
      `Login response changed session from ${s} to ${loginResponse.sessionId}`
    );
    s = loginResponse.sessionId;
  }
  await sleep(250);
  const verify = await routerRequest(endpointRecord.status, s, loginResponse.url);
  if (
    verify.isRedirect ||
    verify.isUnauthenticated ||
    verify.status !== 200 ||
    verify.lineCount <= 30 ||
    verify.sessionId !== s
  ) {
    throw new Error(
      "Login request successful but verify session function failed"
    );
  }
  return verify;
}


