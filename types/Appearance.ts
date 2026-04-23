export type ProjectName = 'ghadaq' | 'manasik' | 'shared';

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
  audioReviews?: { ar: string[]; en: string[] };
  whatsAppDefaultMessage?: string;
  bannerText?: BannerText;
  createdAt: string;
  updatedAt: string;
}
