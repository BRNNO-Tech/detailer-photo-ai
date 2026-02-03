
import { SocialData, VideoCreative, VideoStyle } from "./types.ts";

const API_BASE = "";

async function callGeminiApi<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}/api/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `API error ${res.status}`);
  }
  return res.json();
}

// Client-side image enhancement using Canvas API
export const enhanceImageWithAI = async (base64Image: string, serviceName: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(base64Image);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Apply enhancements: brightness, contrast, saturation
      for (let i = 0; i < data.length; i += 4) {
        // Brightness adjustment (+10%)
        data[i] = Math.min(255, data[i] * 1.1);     // R
        data[i + 1] = Math.min(255, data[i + 1] * 1.1); // G
        data[i + 2] = Math.min(255, data[i + 2] * 1.1); // B

        // Contrast adjustment
        const factor = 1.15;
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));

        // Saturation boost
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const satFactor = 1.2;
        data[i] = Math.min(255, gray + (data[i] - gray) * satFactor);
        data[i + 1] = Math.min(255, gray + (data[i + 1] - gray) * satFactor);
        data[i + 2] = Math.min(255, gray + (data[i + 2] - gray) * satFactor);
      }

      // Apply sharpening
      ctx.putImageData(imageData, 0, 0);
      const sharpened = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const sharpData = sharpened.data;
      const originalData = new Uint8ClampedArray(data);

      // Simple sharpening kernel
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          const idx = (y * canvas.width + x) * 4;
          for (let c = 0; c < 3; c++) {
            const val = originalData[idx + c] * 5 -
              originalData[((y - 1) * canvas.width + x) * 4 + c] -
              originalData[((y + 1) * canvas.width + x) * 4 + c] -
              originalData[(y * canvas.width + (x - 1)) * 4 + c] -
              originalData[(y * canvas.width + (x + 1)) * 4 + c];
            sharpData[idx + c] = Math.min(255, Math.max(0, val));
          }
          sharpData[idx + 3] = originalData[idx + 3]; // Alpha
        }
      }

      ctx.putImageData(sharpened, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => resolve(base64Image);
    img.src = base64Image;
  });
};

export const generateVideoCreative = async (style: VideoStyle, base64Image: string | null, serviceName: string): Promise<VideoCreative> => {
  try {
    return await callGeminiApi<VideoCreative>("videoCreative", { style, base64Image, serviceName });
  } catch (e) {
    return {
      hook: "From Grime to Prime. ✨",
      script: "Watch as we transform this ride with our signature detail. Perfection isn't a goal, it's our standard.",
      sceneDescription: "Cinematic slow motion pan of a luxury car with deep reflections and professional studio lighting.",
      suggestedMusicMood: "High-energy, punchy phonk or elegant lo-fi."
    };
  }
};

export const generateSocialPack = async (base64Image: string, serviceName: string): Promise<SocialData> => {
  try {
    return await callGeminiApi<SocialData>("socialPack", { base64Image, serviceName });
  } catch (e) {
    return {
      captions: [
        "Full refresh on this ride! ✨ Pure detailing magic.",
        "Deep clean mode: Activated. 🧼 Results speak for themselves.",
        "That ceramic glow hits different. 🛡️ Ready for the road."
      ],
      hashtags: ["#detailing", "#carcare", "#clean", "#gloss", "#detailingworld"],
      tiktokScript: "Visual: Fast cuts of foam cannon. Audio: 'Is it just me or is this satisfying?'",
      postingTimes: ["9:00 AM", "12:30 PM", "6:00 PM"]
    };
  }
};

export const detectPhotoPairs = async (images: string[]): Promise<Array<{ before: string; after: string }>> => {
  if (images.length < 2) return [];
  try {
    return await callGeminiApi<Array<{ before: string; after: string }>>("detectPairs", { images });
  } catch (e) {
    const pairs: Array<{ before: string; after: string }> = [];
    for (let i = 0; i < images.length - 1; i += 2) {
      pairs.push({ before: images[i], after: images[i + 1] });
    }
    return pairs;
  }
};

export const regenerateSingleCaption = async (base64Image: string, serviceName: string): Promise<string> => {
  try {
    const data = await callGeminiApi<{ caption: string }>("regenerateCaption", { base64Image, serviceName });
    return data.caption || "Ready for its next adventure! ✨";
  } catch (e) {
    return "A fresh look for a fresh ride! 🧼✨";
  }
};
