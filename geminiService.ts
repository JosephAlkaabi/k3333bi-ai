
import { GoogleGenAI, Type } from "@google/genai";
import { Category, SnapArticle } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchNewsAndGenerateSnap = async (category: Category): Promise<SnapArticle> => {
  const isWisdom = category === Category.WISDOM;
  
  const newsResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: isWisdom 
      ? `اختر حكمة فلسفية عالمية أو عربية عميقة جداً ومؤثرة.
    
    متطلبات الصياغة:
    1. اللغة: اللغة العربية الفصحى.
    2. العنوان (الهوك): يجب أن يكون بأسلوب ساخر، فكاهي، ومثير بالفصحى حول "الفلسفة" أو "الحكمة" (لا يتجاوز 6 كلمات).
    3. المحتوى: الحكمة نفسها فقط بأسلوب رصين وفلسفي.
    4. صاحب المقولة: اسم صاحب الحكمة بشكل واضح.
    5. التفاصيل: اجعل النص مختصراً جداً ومركزاً (بين 15 إلى 30 كلمة).
    6. التاريخ: اليوم الحالي.`
      : `ابحث عن أحدث خبر عالمي أو محلي موثوق جداً (خلال الـ 24 ساعة الماضية) لفئة: ${category}.
    
    متطلبات التحقق والصياغة المتميزة:
    1. التحقق: تأكد من صحة الخبر من مصادر عالمية موثوقة.
    2. اللغة: يجب أن تكون جميع النصوص باللغة العربية الفصحى.
    3. العنوان (الهوك): يجب أن يكون بأسلوب ساخر، فكاهي، ومثير جداً بالفصحى (لا يتجاوز 6 كلمات).
    4. المحتوى: يجب أن تُكتب تفاصيل الخبر بأسلوب رسمي، احترافي، ومختصر جداً بالفصحى.
    5. التفاصيل: **يجب أن يكون النص عبارة عن فقرة واحدة قصيرة (بين 15 إلى 30 كلمة فقط) مكتملة المعنى تماماً بدون أي بتر أو جمل ناقصة.**
    6. التاريخ: استخرج توقيت النشر الدقيق.`,
    config: {
      tools: isWisdom ? [] : [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          author: { type: Type.STRING, description: "اسم صاحب المقولة إذا كانت حكمة، أو فارغ إذا كان خبراً" },
          news_date: { type: Type.STRING },
          image_prompt: { type: Type.STRING }
        },
        required: ["title", "content", "news_date", "image_prompt"]
      }
    }
  });

  const rawData = JSON.parse(newsResponse.text);
  const groundingChunks = newsResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;

  const resImage = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `High-impact 8k cinematic masterpiece, vertical 9:16 aspect ratio, dramatic realistic lighting, no text, photorealistic. ${isWisdom ? 'Abstract philosophical art, minimalist, dark academia vibes.' : 'Dynamic news environment.'} Subject: ${rawData.image_prompt}` }]
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
    author: rawData.author,
    newsDate: rawData.news_date,
    imageUrl,
    timestamp: Date.now(),
    sources: groundingChunks?.map((chunk: any) => chunk.web).filter(Boolean) || []
  };
};

export const editNewsArticle = async (article: SnapArticle, command: string): Promise<{ title: string; content: string; author?: string }> => {
  const isWisdom = article.category === Category.WISDOM;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `لديك هذا النص:
    العنوان الحالي: ${article.title}
    المحتوى الحالي: ${article.description}
    ${article.author ? `المؤلف الحالي: ${article.author}` : ""}
    
    نفذ التعديل التالي بناءً على طلب المستخدم: "${command}"
    
    شروط التعديل الإلزامية:
    1. جميع النصوص يجب أن تظل باللغة العربية الفصحى.
    2. العنوان (الهوك) يجب أن يظل ساخراً وكوميدياً بأسلوب ذكي.
    3. المحتوى يجب أن يظل ${isWisdom ? 'فلسفياً وعميقاً' : 'رسمياً واحترافياً'}.
    4. إذا كان هناك حقل مؤلف (author)، تأكد من الحفاظ عليه أو تحديثه إذا طلب المستخدم.
    5. المحتوى يجب أن يكون فقرة واحدة كاملة ومختصرة (لا تزيد عن 30 كلمة).
    6. أعد النتيجة بصيغة JSON فقط.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          author: { type: Type.STRING }
        },
        required: ["title", "content"]
      }
    }
  });

  return JSON.parse(response.text);
};
