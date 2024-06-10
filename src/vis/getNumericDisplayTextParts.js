export function getNumericDisplayTextParts(
  index,
  interfaceName,
  interfaceIndex,
  recvValue,
  sentValue,
  timeBased = false,
  unit = "M"
) {
  const indexSufix = index === 0 ? ` ${timeBased ? "speed" : "total"} I/O` : '';
  const valueType = timeBased ? "BPS" : "B";

  const parts = [
    {
      name: "interface name",
      text: interfaceName,
      sufix: `${interfaceIndex.toString()}${indexSufix}`,
      green: true,
      size: index == 0 ? 10 : 7,
      pad: [1, 0],
    },
    {
      name: "input",
      text: recvValue.toFixed(1),
      sufix: ` ${unit}${valueType}`,
      yellow: true,
      size: 15,
      pad: [1, 0],
    },
    {
      name: "output",
      text: sentValue.toFixed(1),
      sufix: ` ${unit}${valueType}`,
      yellow: true,
      size: 15,
      pad: [1, 0],
    },
  ];

  return parts;
}
