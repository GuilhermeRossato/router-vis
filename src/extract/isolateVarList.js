const debug = false;

const skipVarList = ['port', 'wep', 'Converted', 'item', 'dns6', 'vodst', 'loc', 'code', 'itm', 'hide5', 'auth5', , 'hide', 'auth', 'sel', 'calc', 'item', 'tab', 'accessClass'];

/**
 * Extract and normalize variable lines from html
 * @param {string | {body: string}} text_or_response 
 */
export default function isolateVarList(text_or_response) {
    let html = (typeof text_or_response === 'object' && typeof text_or_response.body === 'string') ? text_or_response.body : text_or_response;
    if (typeof html !== 'string' || html.length <= 300) {
        throw new Error(`Incomplete data page: ${JSON.stringify(html)}`);
    }
    const s = html.indexOf('<script');
    const o = html.lastIndexOf('/script>');
    if (s === -1 && o === -1) {
        throw new Error('Data page is missing both starting and ending script tags');
    }
    if (s === -1) {
        throw new Error('Data page is missing starting script tags');
    }
    if (o === -1) {
        throw new Error('Data page is missing ending script tags');
    }

    const lines = html.substring(s, o).split('\n');

    const treatedList = lines.map((line, i) => {
        line = line.replace(/\r/g, '');
        const trimmed = line.trim();
        if (trimmed.startsWith(`$('#liWanIp').html((pppUptime==0)?'--':'`) && trimmed.endsWith(`');`)) {
            return `var publicIpv4Address=${trimmed.substring(trimmed.indexOf("':'") + 2, trimmed.length - 2)};`;
        }
        if (trimmed.startsWith(`$('#liWanGw').html((pppUptime==0)?'--':'`) && trimmed.endsWith(`');`)) {
            return `var defaultExternalGateway=${trimmed.substring(trimmed.indexOf("':'") + 2, trimmed.length - 2)};`;
        }
        if (trimmed.startsWith(`$('#liDNS1').html((pppUptime==0)?'--':'`) && trimmed.endsWith(`');`)) {
            return `var primaryDNS=${trimmed.substring(trimmed.indexOf("':'") + 2, trimmed.length - 2)};`;
        }
        if (trimmed.startsWith(`$('#liDNS2').html((pppUptime==0)?'--':'`) && trimmed.endsWith(`');`)) {
            return `var secondaryDNS=${trimmed.substring(trimmed.indexOf("':'") + 2, trimmed.length - 2)};`;
        }
        if (trimmed.startsWith(`$('#liChan').html('`) && trimmed.endsWith(`');`)) {
            return `var wifi2Channel=${trimmed.substring(trimmed.indexOf("html('") + 5, trimmed.length - 2)};`;
        }
        if (trimmed.startsWith(`$('#liChan5').html('`) && trimmed.endsWith(`');`)) {
            return `var wifi5Channel=${trimmed.substring(trimmed.indexOf("html('") + 5, trimmed.length - 2)};`;
        }
        if (line[0] !== trimmed[0] && trimmed.startsWith(`var orgLanHostList="`) && trimmed.endsWith(`";`)) {
            return trimmed;
        }
        if (trimmed.startsWith(`var wlanIntfSts=`)) {
            return `var wlanIntfSts=${trimmed.substring(trimmed.indexOf("=") + 1, trimmed.length - 1)};`;
        }
        if (trimmed.startsWith('var tmp') && trimmed.indexOf('0 = "', 13) !== -1 && trimmed.includes("'.match(")) {
            const equalIndex = trimmed.indexOf('0 = "', 13) + 2;
            const varName = `telTmp${trimmed[7].toUpperCase()}${trimmed[8]}`
            
            const sufix = trimmed.substring(equalIndex + 3, trimmed.indexOf('"', equalIndex + 3));
            return `var ${varName} = '${sufix}'`;
        }
        return line;
    });

    const ignoreList = [];

    /**
     * @type {{name: string, content: string, original: string}[]}
     */
    const vlist = treatedList.filter(
        line => line.includes('=') && line.trim().startsWith('var ')
    ).map((line, i) => {
        const trimmed = line.trim();
        const variableName = trimmed.substring(trimmed.indexOf(' '), trimmed.indexOf('=')).replace(/\r/g, '').trim();
        if (variableName.includes('=')) {
            throw new Error(`Assertation failed at ${JSON.stringify({ line, variableName })}`);
        }
        if (variableName[0] === '_' || variableName.length < 2 || skipVarList.includes(variableName)) {
            // console.log(`Ignored variable at #${i} because of variable name: ${variableName}`);
            return null;
        }
        let content = line.substring(line.indexOf('=') + 1).replace(/\r/g, '').trim();
        if (content.endsWith(';')) {
            content = content.substring(0, content.length - 1);
        }
        if (content.startsWith('mngToHostList(') || content.startsWith('ethHost[') || content.startsWith('$(') || content.startsWith('lanHostList.split(') || content.startsWith('hostList[i].split(') || content.startsWith('staList.split(') || content.startsWith('document.')) {
            return null;
        }
        if (content.length === 0 || content === '[]' || content === '""' || content === "''") {
            return null;
        }
        if (content.startsWith('htmlDecode(\'') && content.endsWith('\')')) {
            content = content.substring(11, content.length - 1).replace(/<.*?>/g, "").replace(/\\\'/g, "'");
        }
        if (content.startsWith('parseFloat(\'') && content.endsWith('\')')) {
            content = parseFloat(content.substring(12, content.length - 2)).toString();
        }
        if (content.startsWith('parseInt(\'') && content.endsWith('\')')) {
            const relevant = content.split('parseInt(')[1].split(')')[0].split('.')[0].replace(/\W/g, '');
            content = parseInt(relevant).toString();
        }
        const hasSplit = content[0] !== "'" && content[0] !== '"' && content.includes('.split(');
        const isSelect = content[0] === '$';
        const isNull = (['lanHostList', 'hostList', 'hostList5'].includes(variableName)) && (content === 'null' || (content.startsWith('staToHost') && content.includes('(')) || (line[0] === '\t' && content.length <= 3));
        if (hasSplit || isSelect || isNull) {
            ignoreList.push(content);
            return null;
        }
        return { name: variableName, content, original: line };
    }).filter(Boolean);
    // console.log(ignoreList);
    if (vlist.length <= 1) {
        throw new Error(`Could not generate variable list from treated list: ${JSON.stringify(treatedList)}`);
    }
    const duplicatedList = vlist.filter((v, i) => {
        return (vlist.filter((other, j) => j > i && other.name === v.name).length > 0)
    });
    if (duplicatedList.length) {
        throw new Error(`Duplicated variable check returned ${duplicatedList.length}: ${JSON.stringify(duplicatedList, null, '  ')}`);
    }
    return vlist;
}
