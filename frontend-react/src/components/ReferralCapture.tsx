"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      document.cookie = `chalan_ref=${ref};path=/;max-age=${30 * 24 * 60 * 60}`;
    }
  }, [searchParams]);

  return null;
}
