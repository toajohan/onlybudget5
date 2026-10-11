"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Updates dashboard URL params (null removes one) while keeping the others, without jumping back to the top of the page. */
export function useUpdateParams() {
  const router = useRouter();
  const params = useSearchParams();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router.push(query ? `/dashboard?${query}` : "/dashboard", { scroll: false });
  }

  return { params, update };
}
