export type ProjectName = 'ghadaq' | 'manasik' | 'shared';
export type AudioLanguage = 'ar' | 'en' | 'shared';

export interface WorksImages {
  row1: string[];
  row2: string[];
}

export interface BannerText {
  ar: string;
  en: string;
}

export interface DocumentationAnswer {
  ar: string;
  en: string;
}

export type ProductBannerPlatform = 'ghadaq' | 'manasik' | 'shared';
export type ProductBannerLanguage = 'ar' | 'en' | 'shared';

export interface ProductBanner {
  id: string;
  imageUrl: string;
  platform: ProductBannerPlatform;
  language: ProductBannerLanguage;
  link: string;
}

export interface AudioReview {
  id: string;
  url: string;
  nameAr: string;
  nameEn: string;
  userImage: string;
  platform: ProjectName;
  language: AudioLanguage;
  isMain: boolean;
}

export interface FAQ {
  id: string;
  question: { ar: string; en: string };
  answer: { ar: string; en: string };
  platform: ProjectName;
  showOnProductDetails: boolean;
}

export interface Appearance {
  _id: string;
  project: ProjectName;
  worksImages: WorksImages;
  audioReviews?: AudioReview[];
  whatsAppDefaultMessage?: string;
  bannerText?: BannerText;
  documentationAnswer?: DocumentationAnswer;
  productsBanners?: ProductBanner[];
  faqs?: FAQ[];
  createdAt: string;
  updatedAt: string;
}
