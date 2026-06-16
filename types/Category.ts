export interface CategoryProduct {
  _id: string;
  name: { ar: string; en: string };
  slug: string;
}

export interface Category {
  _id: string;
  name: string;
  categoryNumber: number;
  color: string;
  products: CategoryProduct[];
  createdAt?: string;
  updatedAt?: string;
}
