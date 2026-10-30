// Types de la base Supabase, alignés sur supabase/migrations.
// Ils peuvent être régénérés avec : npx supabase gen types typescript --linked
// (vérifier ensuite que les alias en bas de fichier restent valides).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'admin' | 'cashier';
export type SaleStatus = 'completed' | 'partially_refunded' | 'refunded' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending';
export type StockMovementType = 'sale' | 'sale_cancel' | 'restock' | 'adjustment';
export type ReceiptFormat = '80mm' | '58mm' | 'a4';

type Table<Row, Insert, Update, Relationships extends unknown[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: AppRole;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SettingsRow = {
  id: number;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  receipt_footer: string | null;
  receipt_format: ReceiptFormat;
  receipt_prefix: string;
  stock_enabled: boolean;
  pos_show_images: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_archived: boolean;
  track_stock: boolean;
  stock_quantity: number;
  minimum_stock: number;
  created_at: string;
  updated_at: string;
};

export type PaymentMethodRow = {
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type SaleRow = {
  id: string;
  receipt_number: string;
  cashier_id: string;
  cashier_name: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  refunded_amount: number;
  payment_method: string;
  payment_method_label: string;
  payment_status: PaymentStatus;
  sale_status: SaleStatus;
  item_count: number;
  note: string | null;
  idempotency_key: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
};

export type SaleItemRow = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  category_name: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type StockMovementRow = {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  stock_after: number;
  reason: string | null;
  sale_id: string | null;
  user_id: string;
  created_at: string;
};

export type RefundRow = {
  id: string;
  sale_id: string;
  amount: number;
  reason: string;
  user_id: string;
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        { id: string; full_name?: string; email?: string | null; role?: AppRole; permissions?: string[]; is_active?: boolean },
        { full_name?: string; role?: AppRole; permissions?: string[]; is_active?: boolean }
      >;
      restaurant_settings: Table<
        SettingsRow,
        Partial<SettingsRow>,
        Partial<Omit<SettingsRow, 'id' | 'created_at' | 'updated_at'>>
      >;
      categories: Table<
        CategoryRow,
        { name: string; description?: string | null; sort_order?: number; is_active?: boolean },
        { name?: string; description?: string | null; sort_order?: number; is_active?: boolean }
      >;
      products: Table<
        ProductRow,
        {
          name: string;
          price: number;
          description?: string | null;
          category_id?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          is_archived?: boolean;
          track_stock?: boolean;
          minimum_stock?: number;
        },
        {
          name?: string;
          price?: number;
          description?: string | null;
          category_id?: string | null;
          image_url?: string | null;
          is_available?: boolean;
          is_archived?: boolean;
          track_stock?: boolean;
          minimum_stock?: number;
        },
        [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ]
      >;
      payment_methods: Table<
        PaymentMethodRow,
        { code: string; label: string; is_active?: boolean; sort_order?: number },
        { label?: string; is_active?: boolean; sort_order?: number }
      >;
      sales: Table<SaleRow, never, never>;
      sale_items: Table<
        SaleItemRow,
        never,
        never,
        [
          {
            foreignKeyName: 'sale_items_sale_id_fkey';
            columns: ['sale_id'];
            isOneToOne: false;
            referencedRelation: 'sales';
            referencedColumns: ['id'];
          },
        ]
      >;
      stock_movements: Table<
        StockMovementRow,
        never,
        never,
        [
          {
            foreignKeyName: 'stock_movements_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      refunds: Table<
        RefundRow,
        never,
        never,
        [
          {
            foreignKeyName: 'refunds_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
      audit_logs: Table<AuditLogRow, never, never>;
    };
    Views: { [_ in never]: never };
    Functions: {
      get_branding: { Args: Record<string, never>; Returns: Json };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_active_user: { Args: Record<string, never>; Returns: boolean };
      has_permission: { Args: { p_permission: string }; Returns: boolean };
      create_sale: {
        Args: {
          p_items: Json;
          p_payment_method: string;
          p_idempotency_key: string;
          p_discount_amount?: number;
          p_note?: string | null;
        };
        Returns: Json;
      };
      cancel_sale: { Args: { p_sale_id: string; p_reason: string }; Returns: undefined };
      refund_sale: { Args: { p_sale_id: string; p_amount: number; p_reason: string }; Returns: Json };
      record_stock_movement: {
        Args: { p_product_id: string; p_movement_type: string; p_quantity: number; p_reason?: string | null };
        Returns: number;
      };
      get_sales_report: { Args: { p_from: string; p_to: string }; Returns: Json };
      get_dashboard_summary: { Args: Record<string, never>; Returns: Json };
      log_admin_event: {
        Args: { p_action: string; p_entity_type: string; p_entity_id: string; p_details?: Json };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: AppRole;
      sale_status: SaleStatus;
      payment_status: PaymentStatus;
      stock_movement_type: StockMovementType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

// ---------------------------------------------------------------------------
// Formes renvoyées par les fonctions SQL (jsonb)
// ---------------------------------------------------------------------------
export type CreateSaleResult = {
  sale_id: string;
  receipt_number: string;
  total_amount: number;
  replayed: boolean;
};

export type SalesReport = {
  from: string;
  to: string;
  timezone: string;
  gross_sales: number;
  refunds_total: number;
  refunds_count: number;
  net_revenue: number;
  discount_total: number;
  sales_count: number;
  average_basket: number;
  items_sold: number;
  cancelled_count: number;
  cancelled_amount: number;
  by_day: { day: string; gross: number; refunds: number; net: number; count: number }[];
  by_payment_method: { code: string; label: string; count: number; gross: number; refunds: number; net: number }[];
  top_products: { product_id: string; name: string; quantity: number; revenue: number }[];
  by_category: { name: string; quantity: number; revenue: number }[];
  by_cashier: {
    cashier_id: string;
    name: string;
    count: number;
    gross: number;
    refunds: number;
    net: number;
    cancelled_count: number;
  }[];
};

export type DashboardSummary = {
  today: string;
  timezone: string;
  periods: Record<'today' | 'week' | 'month', { gross: number; refunds: number; net: number; count: number }>;
  active_products: number;
  low_stock_products: number;
};

export type Branding = { name: string; tagline: string | null; logo_url: string | null };
