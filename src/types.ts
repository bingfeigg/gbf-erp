export type RoleName = "admin" | "sales" | "purchase" | "warehouse" | "finance";

export interface User {
  id: number;
  username: string;
  password: string;
  role: RoleName;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  unit: string;
  costPrice: number;
  salePrice: number;
}
