import "server-only";
import { env } from "./env";
import { defaultDepart } from "./search-params";
import type { SearchFormValues } from "@/components/search-form";

/** Form defaults. In replay mode, the recorded search, so the first click shows results. */
export function defaultValues(origin: string): SearchFormValues {
  if (env.apiMode === "replay") return { from: "ARN", to: "es.barcelona", depart: "2026-12-13", nights: 3, adults: 2, childAges: [] };
  return { from: origin, to: "", depart: defaultDepart(), nights: 7, adults: 2, childAges: [] };
}
