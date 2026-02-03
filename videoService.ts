import { VideoStyle } from "./types.ts";

const API_BASE = "";

export const generateDetailerVideo = async (
  style: VideoStyle,
  beforeImage?: string | null,
  afterImage?: string | null,
  serviceName?: string,
  onProgress?: (progress: { status: string; progress?: number }) => void
): Promise<string> => {
  onProgress?.({ status: "Starting video generation...", progress: 0 });
  onProgress?.({ status: "Video generation in progress...", progress: 20 });

  const res = await fetch(`${API_BASE}/api/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      style,
      beforeImage: beforeImage ?? undefined,
      afterImage: afterImage ?? undefined,
      serviceName: serviceName ?? undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Video API error ${res.status}`);
  }

  const blob = await res.blob();
  onProgress?.({ status: "Complete!", progress: 100 });
  return URL.createObjectURL(blob);
};
