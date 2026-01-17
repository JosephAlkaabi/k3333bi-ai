
export enum Category {
  AI = "الذكاء الاصطناعي",
  CARS = "تكنولوجيا السيارات",
  GADGETS = "الأجهزة الحديثة",
  AGRICULTURE = "الزراعة الذكية",
  TRENDS = "الترندات العالمية",
  FUNNY = "مقاطع مضحكة",
  IDEAS = "أفكار ممتعة"
}

export interface SnapArticle {
  id: string;
  category: Category;
  title: string;
  description: string;
  hookImageUrl: string;
  detailsImageUrl: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
}

export interface GenerationState {
  loading: boolean;
  error: string | null;
  currentProgress: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}
