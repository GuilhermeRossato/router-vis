export function parsePppUptime(_, content) {
  const uptime = parseInt(content);
  return { uptime };
}
