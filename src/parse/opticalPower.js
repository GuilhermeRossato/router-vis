export function opticalPower(varName, content) {
  const state = {};
  const p = content.replace(/\'/g, "").replace(/\"/g, "").split(";");
  if (p.length === 2 && p[0].startsWith("TX:") && p[1].startsWith("RX:")) {
    p.forEach(
      (k) => (state[`opticalPower${k[0]}x`] = parseFloat(
        parseFloat(k.substring(3)).toFixed(1)
      ))
    );
  } else {
    state[varName] = content;
  }
  return state;
}
