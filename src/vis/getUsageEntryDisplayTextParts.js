

export function getUsageEntryDisplayTextParts(entry, isMegaByte) {
  const isRecvPerSeconds = typeof entry.recvKbps === 'number';
  const [recv, recvType] = isRecvPerSeconds ? [entry.recvKbps, 'BPS'] : [entry.recvKb, "B"];
  const isSentPerSeconds = typeof entry.sentKbps === 'number';
  const [sent, sentType] = isSentPerSeconds ? [entry.sentKbps, 'BPS'] : [entry.sentKb, "B"];
  const divisor = isMegaByte ? 1024 : 1;
  const unit = isMegaByte ? 'M' : 'K';
  return [
    {
      text: entry.interfaceName,
      green: true,
      size: 7,
      sufix: entry.interfaceIndex,
    },
    {
      text: parseFloat((recv / divisor).toFixed(1)),
      sufix: ` ${unit}${recvType} I`,
      size: 17,
      yellow: true,
      leftPad: true,
    },
    {
      text: parseFloat((sent / divisor).toFixed(1)),
      sufix: ` ${unit}${sentType} O`,
      size: 17,
      yellow: true,
      leftPad: true,
    },
  ];
}
