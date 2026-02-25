export interface WorksImages {
  row1: string[];
  row2: string[];
}

export interface Appearance {
  _id: string;
  worksImages: WorksImages;
  createdAt: string;
  updatedAt: string;
}
