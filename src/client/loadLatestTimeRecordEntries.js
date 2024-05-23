import { loadUsageTimeRecordEntries } from "../vis/loadUsageTimeRecordEntries.js";

export function loadLatestTimeRecordEntries(amount = 2) {
  return loadUsageTimeRecordEntries((files) => {
    const [ethList, wlanList] = ["eth", "wlan"]
      .map((interfaceName) => files.filter((f) => f.interfaceName === interfaceName)
      )
      .map((list) => list.sort((a, b) => {
        if (a.toTime !== b.toTime) {
          return a.toTime > b.toTime ? -1 : 1;
        }
        if (a.interfaceName !== b.interfaceName) {
          return a.interfaceName[0] === "e" ? -1 : 1;
        }
        return 0;
      })
      );
    return [...ethList.slice(0, amount), ...wlanList.slice(0, amount)];
  });
}
