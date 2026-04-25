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

export interface Appearance {
  _id: string;
  project: ProjectName;
  worksImages: WorksImages;
  audioReviews?: AudioReview[];
  whatsAppDefaultMessage?: string;
  bannerText?: BannerText;
  createdAt: string;
  updatedAt: string;
}
