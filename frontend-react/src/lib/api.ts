/**
 * Returns the correct API base URL depending on whether
 * we're running on the server (SSR) or in the browser.
 *
 * Server-side: uses Docker internal network (flask:8001)
 * Client-side: uses the public URL (through nginx)
 */
export function getApiBase(): string {
  if (typeof window === "undefined") {
    // Server-side rendering — reach Flask via Docker network
    return process.env.INTERNAL_API_URL || "http://flask:8001";
  }
  // Client-side — go through nginx
  return process.env.NEXT_PUBLIC_API_URL || "";
}
