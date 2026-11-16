// Shared by server and client: one canonical string per choice of extra bags and seats, so the page can tell
// whether the latest price check covers what the customer has picked. Ids are the API's opaque ids.

export type ExtraPick = { id: string; quantity: number };

export function extrasKey(choice: ExtraPick[]): string {
  return choice
    .filter((c) => c.quantity > 0)
    .map((c) => `${c.id}:${c.quantity}`)
    .sort()
    .join(",");
}
