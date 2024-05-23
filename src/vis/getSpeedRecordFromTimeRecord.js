
export function getSpeedRecordFromTimeRecord(timeRecord) {
  const speeds = [];
  const resets = [];
  const timeList = Object.keys(timeRecord)
    .map((a) => Number(a))
    .sort((a, b) => b - a);
  for (let i = 0; i < timeList.length; i++) {
    const timeNow = timeList[i];
    const list = timeRecord[timeNow.toString()];
    for (const entry of list) {
      if (!entry.prevTime) {
        continue;
      }
      const elapsed = (timeNow - entry.prevTime) / 1000;
      if (elapsed < 0) {
        throw new Error(
          `Invalid elapsed value for ${JSON.stringify(entry)} at ${timeNow}`
        );
      }
      if (elapsed > 3 * 60) {
        continue;
      }
      const deltaRecv = entry.recvKb - entry.prevRecvKb;
      const deltaSent = entry.sentKb - entry.prevSentKb;
      if (deltaRecv < 0 || deltaSent < 0) {
        resets.push(entry);
        continue;
      }
      const recvKbps = deltaRecv / elapsed;
      const sentKbps = deltaSent / elapsed;
      speeds.push({
        interfaceName: entry.interfaceName,
        interfaceIndex: entry.interfaceIndex,
        time: timeNow,
        prev: entry.prevTime,
        elapsed,
        recvKb: deltaRecv,
        sentKb: deltaSent,
        recvKbps: parseFloat(
          recvKbps.toFixed(recvKbps > 1000 ? 1 : recvKbps > 50 ? 3 : 5)
        ),
        sentKbps: parseFloat(
          sentKbps.toFixed(sentKbps > 1000 ? 1 : sentKbps > 50 ? 3 : 5)
        ),
      });
    }
  }
  return speeds;
}
