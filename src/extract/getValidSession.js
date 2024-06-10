import sleep from "../utils/sleep.js";
import { endpointRecord } from "./endpointRecord.js";
import sendRouterRequest from "./sendRouterRequest.js";
import { getLoginCredentials } from "./getLoginCredentials.js";
import { config } from "../../settings.js";

const debug = false;

export default async function getValidSession(previousSessionId, referer) {
  const first = await sendRouterRequest(endpointRecord.root, previousSessionId, referer);

  let s = first.sessionId;

  await sleep(200);

  const maintained =
    previousSessionId && first.sessionId === previousSessionId && s === previousSessionId;

  if (maintained) {
    debug && console.log("Previous session id maintained on first request:", s);
  } else if (previousSessionId) {
    debug && console.log("Previous session id replaced on first request:", s);
  } else if (!previousSessionId) {
    debug && console.log("Session id was obtained on first request", s);
  }
  // Check for imediate success
  if (maintained) {
    const verify = await sendRouterRequest(endpointRecord.status, s, first.url);
    const failed =
      verify.isRedirectResponse ||
      verify.isUnauthenticatedResponse ||
      verify.status !== 200 ||
      verify.sessionId !== s;
    debug &&
      console.log(
        "Maintained session id",
        failed ? "was updated" : "was asserted",
        "during status retrieval",
      );
    if (!failed) {
      return verify;
    }
    await sleep(100);
  }
  // Check if A new response will match the LAST session id
  let resp = await sendRouterRequest(endpointRecord.status, s, first.url);
  // If it did not match then loop until it stabilizes
  if (resp.sessionId !== s) {
    debug && console.log("Router updated session at first status request");
    for (let i = 0; i < 5 && s !== resp.sessionId; i++) {
      debug &&
        console.log(`Retrying for the ${i}th time for session (from ${s} to ${resp.sessionId})`);
      s = resp.sessionId;
      resp = await sendRouterRequest(endpointRecord.status, s, first.url);
      if (s === resp.sessionId) {
        break;
      }
      await sleep(500 + 500 * i);
    }
  }
  if (resp.sessionId !== s) {
    throw new Error(`Could not get matching session id: ${JSON.stringify([resp.sessionId, s])}`);
  }
  const { u, p } = await getLoginCredentials();
  if (!u || !p) {
    throw new Error(
      `Missing credentials for login after ${
        config.session
          ? "the specified session failed"
          : previousSessionId
          ? "the cached session id failed"
          : "not finding a cached session id"
      } (you may define both "ROUTER_USERNAME" and "ROUTER_PASSWORD" to perform authentication)`,
    );
  }
  await sleep(500);
  /*
  const resp = await sendRouterRequest(
    endpointRecord.form,
    s,
    resp.url,
    `loginUsername=${u}&loginPassword=${p}`,
  );
  if (s !== resp.sessionId) {
    debug && console.log(`Login form response changed session from ${s} to ${resp.sessionId}`);
    s = resp.sessionId;
  }*/
  const loginResponse = await sendRouterRequest(
    endpointRecord.login,
    s,
    resp.url,
    `loginUsername=${u}&loginPassword=${p}`,
  );
  if (s !== loginResponse.sessionId) {
    debug && console.log(`Login response changed session from ${s} to ${loginResponse.sessionId}`);
    s = loginResponse.sessionId;
  }
  await sleep(500);
  const verify = await sendRouterRequest(endpointRecord.status, s, loginResponse.url);
  if (verify.status !== 200) {
    throw new Error(`Login request was successful but verify session response failed with status ${verify.status}`);
  }
  if (verify.isUnauthenticatedResponse) {
    throw new Error(`Login request was successful but verify session response failed with unauthenticated status ${verify.status}`);
  }
  if (verify.body.split("\n").length <= 30) {
    throw new Error("Login request was successful but verify session response body was too small");
  }
  if (verify.sessionId !== s) {
    throw new Error("Login request was successful but verifiation updated session id");
  }
  return verify;
}
