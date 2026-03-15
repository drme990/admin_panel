export type ProjectName = 'ghadaq' | 'manasik';

export interface WorksImages {
  row1: string[];
  row2: string[];
}

export interface BannerText {
  ar: string;
  en: string;
}

export interface Appearance {
  _id: string;
  project: ProjectName;
  worksImages: WorksImages;
  whatsAppDefaultMessage?: string;
  bannerText?: BannerText;
  createdAt: string;
  updatedAt: string;
}
