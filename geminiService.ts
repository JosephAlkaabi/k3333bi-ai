
import { GoogleGenAI, Type } from "@google/genai";
import { Category, SnapArticle } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchNewsAndGenerateSnap = async (category: Category): Promise<SnapArticle> => {
  const newsResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `أعطني خبراً جديداً جداً وحصرياً أو فكرة ممتعة عن فئة: ${category}. 
    يجب أن يكون العنوان جذاباً وقصيراً وباللغة العربية. 
    اكتب الخبر باللغة العربية الفصحى البسيطة. 
    اجعل النتيجة بصيغة JSON تحتوي على: 
    title (العنوان بالعربي), 
    content (تفاصيل الخبر كاملة ودقيقة بالعربي في 3-4 جمل), 
    hook_image_prompt (وصف إنجليزي لصورة جذب بصرية مذهلة بدون نصوص إطلاقاً، تعبر عن موضوع الخبر فنياً)،
    details_image_prompt (وصف إنجليزي لتصميم خلفية تقنية أو فنية نظيفة جداً وبدون نصوص، تترك مساحة لكتابة المعلومات فوقها).`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          hook_image_prompt: { type: Type.STRING },
          details_image_prompt: { type: Type.STRING }
        },
        required: ["title", "content", "hook_image_prompt", "details_image_prompt"]
      }
    }
  });

  const rawData = JSON.parse(newsResponse.text);
  const groundingChunks = newsResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;

  const generateImage = async (prompt: string, type: 'hook' | 'details') => {
    const stylePrefix = type === 'hook' 
      ? "Cinematic photography, high-impact minimal visual, 9:16 vertical, no text, ultra-high resolution, vibrant."
      : "Abstract digital background, minimal aesthetic, high-end professional design, no text, 9:16 ratio.";
    
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `${stylePrefix} Subject: ${prompt}` }]
      },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    for (const part of res.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "https://picsum.photos/1080/1920";
  };

  const [hookImageUrl, detailsImageUrl] = await Promise.all([
    generateImage(rawData.hook_image_prompt, 'hook'),
    generateImage(rawData.details_image_prompt, 'details')
  ]);

  return {
    id: Math.random().toString(36).substr(2, 9),
    category,
    title: rawData.title,
    description: rawData.content,
    hookImageUrl,
    detailsImageUrl,
    timestamp: Date.now(),
    sources: groundingChunks?.map((chunk: any) => chunk.web).filter(Boolean) || []
  };
};
