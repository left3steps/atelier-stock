export type TransactionType = "inbound" | "outbound";

export interface Product {
  id: string;
  product_code: string;
  name: string;
  brand: string;
  category: string | null;
  main_image_path: string | null;
  low_stock_threshold: number;
  is_rented: boolean;
  rented_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Variant {
  id: string;
  product_id: string;
  sku: string;
  color_name: string;
  color_code: string | null;
  color_image_path: string | null;
  size: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  variant_id: string;
  quantity: number;
  updated_at: string;
}

export interface InventoryRow extends Variant {
  quantity: number;
  product: Product;
}

export interface InventoryTransaction {
  id: string;
  variant_id: string;
  transaction_type: TransactionType;
  quantity: number;
  reason: string;
  memo: string | null;
  resulting_quantity: number;
  created_by: string;
  created_at: string;
  variant?: Variant & { product?: Product };
}

export interface VariantDraft {
  key: string;
  sku: string;
  color_name: string;
  color_code: string;
  size: string;
  image_file: File | null;
  image_preview: string | null;
}
