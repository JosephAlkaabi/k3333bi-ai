
import { GoogleGenAI, Type } from "@google/genai";
import { Category, SnapArticle } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchNewsAndGenerateSnap = async (category: Category): Promise<SnapArticle> => {
  const newsResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `ابحث عن أحدث خبر عالمي أو محلي موثوق جداً (خلال الـ 24 ساعة الماضية) لفئة: ${category}.
    
    متطلبات التحقق والصياغة الكوميدية المتميزة:
    1. التحقق: تأكد من صحة الخبر من 3 مصادر موثوقة.
    2. الأسلوب: تقمص شخصية "صانع محتوى ساخر" خفيف الظل.
    3. العنوان: صغ عنواناً "هوك" كوميدي ومثير. يجب أن يكون قصيراً وواضحاً.
    4. التفاصيل: اكتب الخبر بأسلوب فكاهي (جملتين كاملتين بحد أقصى). **هام جداً: يجب أن تكون الجمل مكتملة المعنى وغير مقطوعة أو ناقصة.**
    5. التاريخ: استخرج توقيت النشر الدقيق.

    النتيجة بصيغة JSON:
    - title: العنوان الكوميدي المثير بالعربية.
    - content: التفاصيل الساخرة المكتملة بالعربية (تأكد من اكتمال الجملة).
    - news_date: تاريخ وتوقيت النشر.
    - image_prompt: وصف إنجليزي لصورة خلفية سينمائية 8K بجودة مذهلة، يفضل أن تكون الألوان في الجزء العلوي هادئة أو داكنة لتسمح ببروز النص الأصفر.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          news_date: { type: Type.STRING },
          image_prompt: { type: Type.STRING }
        },
        required: ["title", "content", "news_date", "image_prompt"]
      }
    }
  });

  const rawData = JSON.parse(newsResponse.text);
  const groundingChunks = newsResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;

  // توليد الصورة الخلفية
  const resImage = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `High-impact 8k cinematic masterpiece, vertical 9:16 aspect ratio, dramatic realistic lighting, no text, photorealistic. The top third should be relatively dark or simple. Subject: ${rawData.image_prompt}` }]
    },
    config: { imageConfig: { aspectRatio: "9:16" } }
  });

  let imageUrl = "https://picsum.photos/1080/1920";
  for (const part of resImage.candidates[0].content.parts) {
    if (part.inlineData) {
      imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    category,
    title: rawData.title,
    description: rawData.content,
    newsDate: rawData.news_date,
    imageUrl,
    timestamp: Date.now(),
    sources: groundingChunks?.map((chunk: any) => chunk.web).filter(Boolean) || []
  };
};
