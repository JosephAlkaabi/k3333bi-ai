
export enum Category {
  AI = "الذكاء الاصطناعي",
  CARS = "تكنولوجيا السيارات",
  GADGETS = "الأجهزة الحديثة",
  AGRICULTURE = "الزراعة الذكية",
  TRENDS = "الترندات العالمية",
  HEALTH = "أخبار الصحة",
  BEAUTY = "أخبار الجمال",
  FUNNY = "مقاطع مضحكة",
  IDEAS = "أفكار ممتعة",
  TOURISM = "أخبار السياحة"
}

export interface SnapArticle {
  id: string;
  category: Category;
  title: string;
  description: string;
  newsDate: string;
  imageUrl: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
}

export interface GenerationState {
  loading: boolean;
  error: string | null;
  currentProgress: string;
}

export interface PublishConfig {
  tgBotToken: string;
  tgChatId: string;
  tgEnabled: boolean;
}
