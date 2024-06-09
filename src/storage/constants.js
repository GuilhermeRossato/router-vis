
export const ignoredKeyList = [
  "date",
  "time",
  "period",
  "uptime",
];

export const varPathRecord = {
  "ethernetUsage": ['statistics', 'objects', 'eth-intf-sts'],
  "wifiUsage": ['statistics', 'objects', 'wlan-intf-sts'],
};

export function removeIgnoredKeys(obj) {
  for (const key of ignoredKeyList) {
    delete obj[key];
  }
}