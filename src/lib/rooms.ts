export function compareRoomNumbers(a: string, b: string): number {
  const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
  const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
