function lineCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return counts;
}

export function summarizeChange(
  oldCode: string,
  newCode: string,
): { addedLines: number; removedLines: number; summary: string } {
  const oldC = lineCounts(oldCode);
  const newC = lineCounts(newCode);
  let addedLines = 0;
  for (const [line, n] of newC)
    addedLines += Math.max(0, n - (oldC.get(line) ?? 0));
  let removedLines = 0;
  for (const [line, n] of oldC)
    removedLines += Math.max(0, n - (newC.get(line) ?? 0));

  const parts: string[] = [];
  if (addedLines > 0)
    parts.push(`added ${addedLines} line${addedLines === 1 ? "" : "s"}`);
  if (removedLines > 0)
    parts.push(`removed ${removedLines} line${removedLines === 1 ? "" : "s"}`);
  const summary =
    parts.length === 0
      ? "No changes this time — try asking for something different!"
      : `I ${parts.join(" and ")} of code. ✨`;
  return { addedLines, removedLines, summary };
}
