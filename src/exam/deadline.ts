/** Both the section clock and the shared exam closing time are enforced. */
export function examDeadline(sectionDeadline: string, closesAt?: string): number {
  return Math.min(Date.parse(sectionDeadline), closesAt ? Date.parse(closesAt) : Infinity);
}
