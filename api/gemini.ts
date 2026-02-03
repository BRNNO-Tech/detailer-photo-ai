import { GoogleGenAI, Type } from "@google/genai";

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
    const { action } = body;

    const ai = new GoogleGenAI({ apiKey: key });

    switch (action) {
      case "socialPack": {
        const { base64Image, serviceName } = body;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Image?.includes(",") ? base64Image.split(",")[1] : base64Image,
                  mimeType: "image/jpeg",
                },
              },
              {
                text: `Generate a full social media detailing pack for this ${serviceName || "General Detail"} job. Provide 3 different caption options. Provide 10 trending detailing hashtags. Provide a short 15-second TikTok script (Visuals vs Audio). Provide 3 recommended posting times for maximum detailing engagement.`,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                captions: { type: Type.ARRAY, items: { type: Type.STRING } },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                tiktokScript: { type: Type.STRING },
                postingTimes: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              propertyOrdering: ["captions", "hashtags", "tiktokScript", "postingTimes"],
            },
          },
        });
        const text = (response as any).text;
        const data = text ? JSON.parse(text) : {};
        return res.status(200).json(data);
      }

      case "regenerateCaption": {
        const { base64Image, serviceName } = body;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Image?.includes(",") ? base64Image.split(",")[1] : base64Image,
                  mimeType: "image/jpeg",
                },
              },
              {
                text: `Generate one new, catchy, and professional social media caption for this ${serviceName || "Professional Detail"} detailing job. Keep it engaging and concise.`,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: { caption: { type: Type.STRING } },
              propertyOrdering: ["caption"],
            },
          },
        });
        const text = (response as any).text;
        const data = text ? JSON.parse(text) : {};
        return res.status(200).json({ caption: data.caption || "Ready for its next adventure! ✨" });
      }

      case "videoCreative": {
        const { style, base64Image, serviceName } = body;
        const parts: any[] = [
          {
            text: `Generate a creative brief for a ${style} detailing video clip for a ${serviceName || "Professional"} service. Include a punchy hook, a short script/voiceover, a highly detailed visual scene description for an AI video generator, and a suggested music mood.`,
          },
        ];
        if (base64Image) {
          parts.push({
            inlineData: {
              data: base64Image.includes(",") ? base64Image.split(",")[1] : base64Image,
              mimeType: "image/jpeg",
            },
          });
        }
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: { parts },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                hook: { type: Type.STRING },
                script: { type: Type.STRING },
                sceneDescription: { type: Type.STRING },
                suggestedMusicMood: { type: Type.STRING },
              },
              required: ["hook", "script", "sceneDescription", "suggestedMusicMood"],
            },
          },
        });
        const text = (response as any).text;
        const data = text ? JSON.parse(text) : {};
        return res.status(200).json(data);
      }

      case "detectPairs": {
        const { images } = body as { images: string[] };
        if (!Array.isArray(images) || images.length < 2) {
          return res.status(200).json([]);
        }
        const pairs: Array<{ before: string; after: string }> = [];
        const usedIndices = new Set<number>();
        const maxImages = Math.min(images.length, 10);

        for (let i = 0; i < maxImages - 1; i++) {
          if (usedIndices.has(i)) continue;
          for (let j = i + 1; j < maxImages; j++) {
            if (usedIndices.has(j)) continue;
            try {
              const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: {
                  parts: [
                    {
                      inlineData: {
                        data: images[i].includes(",") ? images[i].split(",")[1] : images[i],
                        mimeType: "image/jpeg",
                      },
                    },
                    {
                      inlineData: {
                        data: images[j].includes(",") ? images[j].split(",")[1] : images[j],
                        mimeType: "image/jpeg",
                      },
                    },
                    {
                      text: `Analyze these two car detailing photos. Determine which one is the "before" (dirty/unpolished/dull) and which is the "after" (clean/polished/shiny) photo. Both photos should be of the same car or similar angle. Respond with JSON: {"isPair": true/false, "beforeIndex": 0 or 1, "confidence": "high/medium/low"}`,
                    },
                  ],
                },
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      isPair: { type: Type.BOOLEAN },
                      beforeIndex: { type: Type.NUMBER },
                      confidence: { type: Type.STRING },
                    },
                  },
                },
              });
              const analysis = JSON.parse((response as any).text || "{}");
              if (analysis.isPair && analysis.confidence !== "low") {
                const beforeIdx = analysis.beforeIndex === 0 ? i : j;
                const afterIdx = analysis.beforeIndex === 0 ? j : i;
                pairs.push({ before: images[beforeIdx], after: images[afterIdx] });
                usedIndices.add(i);
                usedIndices.add(j);
                break;
              }
            } catch (_) {}
          }
        }

        if (pairs.length === 0) {
          for (let i = 0; i < images.length - 1; i += 2) {
            pairs.push({ before: images[i], after: images[i + 1] });
          }
        } else {
          const remaining = images.map((_, idx) => idx).filter((idx) => !usedIndices.has(idx));
          for (let i = 0; i < remaining.length - 1; i += 2) {
            pairs.push({ before: images[remaining[i]], after: images[remaining[i + 1]] });
          }
        }
        return res.status(200).json(pairs);
      }

      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err: any) {
    console.error("Gemini API error:", err);
    return res.status(500).json({ error: err?.message || "Gemini API failed" });
  }
}
