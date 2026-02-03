import { GoogleGenAI } from "@google/genai";

const getApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY;

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = getApiKey();
  if (!key) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { style, beforeImage, afterImage, serviceName } = body;

    const ai = new GoogleGenAI({ apiKey: key });
    const model = "veo-2.0-generate-001";
    const cleanBase64 = (str: string) => (str?.includes(",") ? str.split(",")[1] : str) || "";

    let prompt = "";
    let imagePart: any = undefined;

    if (style === "transformation" && beforeImage && afterImage) {
      prompt = `A smooth cinematic transformation video showing a dirty, unpolished car gradually becoming sparkling clean with high-gloss professional detailing. The video should start with the dirty car and smoothly transition to show the same car after professional detailing - clean, shiny, with deep reflections and perfect paint finish. Professional studio lighting, 4k quality, slow motion transition effect.`;
      imagePart = { imageBytes: cleanBase64(beforeImage), mimeType: "image/jpeg" };
    } else if (style === "cinematic" && afterImage) {
      prompt = `Wide-angle cinematic B-roll of a freshly detailed car. Elegant slow camera gimbal movement around the car's curves. Dramatic studio lighting with lens flares and realistic environment reflections.`;
      imagePart = { imageBytes: cleanBase64(afterImage), mimeType: "image/jpeg" };
    } else if (style === "satisfying" && afterImage) {
      prompt = `Macro-style extreme close-up of a perfectly detailed car panel. Slow motion camera panning over deep paint reflections, water beading, or thick foam textures. Extremely satisfying and focused motion.`;
      imagePart = { imageBytes: cleanBase64(afterImage), mimeType: "image/jpeg" };
    } else {
      prompt =
        serviceName && serviceName.length > 10
          ? serviceName
          : `High-end cinematic promotional footage of a luxury car being professionally detailed with ${serviceName || "high-gloss coating"}. macro shots, foam cannons, and studio lighting.`;
    }

    let operation = await ai.models.generateVideos({
      model,
      prompt,
      image: imagePart,
      config: { numberOfVideos: 1, resolution: "720p", aspectRatio: "9:16" },
    });

    let pollCount = 0;
    const maxPolls = 60;
    while (!operation.done && pollCount < maxPolls) {
      await new Promise((r) => setTimeout(r, 10000));
      pollCount++;
      try {
        operation = await ai.operations.getVideosOperation({ operation });
      } catch (e: any) {
        throw e;
      }
    }

    if (!operation.done) {
      throw new Error("Video generation timed out. Please try again.");
    }

    const downloadLink = (operation as any).response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed to return a URI.");

    const videoResponse = await fetch(`${downloadLink}&key=${key}`);
    if (!videoResponse.ok) {
      throw new Error("Failed to fetch generated video.");
    }
    const videoBuffer = await videoResponse.arrayBuffer();

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(videoBuffer));
  } catch (err: any) {
    console.error("Video API error:", err);
    return res.status(500).json({ error: err?.message || "Video generation failed" });
  }
}
