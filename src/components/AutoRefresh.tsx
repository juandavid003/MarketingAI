"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-renders the current server page every few seconds while some background
// work (e.g. video processing) is in progress. Render it only while that's
// true — once the page re-renders without it, polling stops.
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
