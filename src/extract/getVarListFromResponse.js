const skipVarList = [
  "port",
  "wep",
  "Converted",
  "item",
  "dns6",
  "vodst",
  "loc",
  "code",
  "itm",
  "hide5",
  "auth5",
  "hide",
  "auth",
  "sel",
  "calc",
  "item",
  "tab",
  "accessClass",
];

/**
 * Normalize html lines into variable lines and return a variable list
 * @param {string | import("./sendRouterRequest.js").RouterResponseEntry} response
 */
export default function getVarListFromResponse(response) {
  let html = "";
  if (typeof response === "string") {
    html = response;
  } else if (typeof response === "object" && typeof (response.body || response['html']) === "string") {
    html = response.body || response['html'];
  } else {
    throw new Error(`Invalid argument: ${JSON.stringify(response)}`);
  }
  if (html.length <= 300) {
    throw new Error(`Argument too small (${html.length}): ${JSON.stringify(html)}`);
  }
  let s = html.indexOf("<script");
  let o = html.lastIndexOf("/script>");
  if (s === -1 || o === -1) {
    throw new Error("Page does not have a valid script tag");
  }
  s = html.indexOf(">", s + 1);
  o = o - 1;
  const lines = html.substring(s, o).split("\n");
  const simpleLines = lines.map((rawLine, i) => {
    const line = rawLine.replace(/\r/g, "").trim();
    if (line.startsWith(`$('#liWanIp').html((pppUptime==0)?'--':'`) && line.endsWith(`');`)) {
      return `var publicIpv4Address=${line.substring(line.indexOf("':'") + 2, line.length - 2)};`;
    }
    if (line.startsWith(`$('#liWanGw').html((pppUptime==0)?'--':'`) && line.endsWith(`');`)) {
      return `var defaultExternalGateway=${line.substring(
        line.indexOf("':'") + 2,
        line.length - 2,
      )};`;
    }
    if (line.startsWith(`$('#liDNS1').html((pppUptime==0)?'--':'`) && line.endsWith(`');`)) {
      return `var primaryDNS=${line.substring(line.indexOf("':'") + 2, line.length - 2)};`;
    }
    if (line.startsWith(`$('#liDNS2').html((pppUptime==0)?'--':'`) && line.endsWith(`');`)) {
      return `var secondaryDNS=${line.substring(line.indexOf("':'") + 2, line.length - 2)};`;
    }
    if (line.startsWith(`$('#liChan').html('`) && line.endsWith(`');`)) {
      return `var wifi2Channel=${line.substring(line.indexOf("html('") + 5, line.length - 2)};`;
    }
    if (line.startsWith(`$('#liChan5').html('`) && line.endsWith(`');`)) {
      return `var wifi5Channel=${line.substring(line.indexOf("html('") + 5, line.length - 2)};`;
    }
    if (line[0] !== line[0] && line.startsWith(`var orgLanHostList="`) && line.endsWith(`";`)) {
      return line;
    }
    if (line.startsWith(`var wlanIntfSts=`)) {
      return `var wlanIntfSts=${line.substring(line.indexOf("=") + 1, line.length - 1)};`;
    }
    if (
      line.startsWith("var tmp") &&
      line.indexOf('0 = "', 13) !== -1 &&
      line.includes("'.match(")
    ) {
      const equalIndex = line.indexOf('0 = "', 13) + 2;
      const varName = `telTmp${line[7].toUpperCase()}${line[8]}`;

      const sufix = line.substring(equalIndex + 3, line.indexOf('"', equalIndex + 3));
      return `var ${varName} = '${sufix}'`;
    }
    return line;
  });
  const varLines = simpleLines.filter((line) => line.includes("=") && line.startsWith("var "));
  const varList = getVarListFromVarLines(varLines);
  return varList;
}

function getVarListFromVarLines(lines) {
  const veredicts = lines.map((line) => {
    const equal = line.indexOf("=");
    const name = line.substring(line.indexOf(" "), equal).trim();
    const rawContent = line.substring(equal + 1).trim();
    if (name.includes("=")) {
      throw new Error(`Assertation failed at ${JSON.stringify({ line })}`);
    }
    if (name[0] === "_" || name.length < 2) {
      return "irrelevant";
    }
    if (skipVarList.includes(name)) {
      return "on-skip-list";
    }
    let content = rawContent;
    if (content.endsWith(";")) {
      content = content.substring(0, content.length - 1);
    }
    if (
      content.startsWith("mngToHostList(") ||
      content.startsWith("ethHost[") ||
      content.startsWith("$(") ||
      content.startsWith("lanHostList.split(") ||
      content.startsWith("hostList[i].split(") ||
      content.startsWith("staList.split(") ||
      content.startsWith("document.")
    ) {
      return "ignored-prefix";
    }
    if (content.startsWith("htmlDecode('") && content.endsWith("')")) {
      content = content
        .substring(11, content.length - 1)
        .replace(/<.*?>/g, "")
        .replace(/\\\'/g, "'");
    }
    if (content.startsWith("parseFloat('") && content.endsWith("')")) {
      content = parseFloat(content.substring(12, content.length - 2)).toString();
    }
    if (content.startsWith("parseInt('") && content.endsWith("')")) {
      const relevant = content.split("parseInt(")[1].split(")")[0].split(".")[0].replace(/\W/g, "");
      content = parseInt(relevant).toString();
    }
    if (
      content.length === 0 ||
      content === "[]" ||
      content === '""' ||
      content === "null" ||
      content === "''"
    ) {
      return "empty-content";
    }
    if (content[0] !== "'" && content[0] !== '"' && content.includes(".split(")) {
      return "has-split-call";
    }
    if (content[0] === "$") {
      return "is-selector";
    }
    if (
      ["lanHostList", "hostList", "hostList5"].includes(name) &&
      ((content.startsWith("staToHost") && content.includes("(")) ||
        (line[0] === "\t" && content.length <= 3))
    ) {
      return "is-null-host";
    }
    return { name, content, original: line };
  });
  /** @type {{name: string, content: string, original: string}[]} */
  let vlist = veredicts.filter((f) => f && typeof f === "object");
  const uniqueList = vlist.filter((self, i) => {
    return vlist.slice(i + 1).filter((other) => other.name === self.name).length === 0;
  });
  if (uniqueList.length !== vlist.length) {
    console.warn(
      `[Warning] There are ${vlist.length - uniqueList.length} duplicated vars on var list`,
    );
    vlist = uniqueList;
  }
  if (vlist.length === 0) {
    throw new Error(`Resulting variable list is empty from line array: ${JSON.stringify(lines)}`);
  }
  return vlist;
}
