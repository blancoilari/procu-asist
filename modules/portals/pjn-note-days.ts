export function isPjnNoteDay(date = new Date()): boolean {
  const day = date.getDay();
  return day === 2 || day === 5;
}
