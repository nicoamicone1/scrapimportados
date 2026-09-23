export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_meta: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity: string | null
          entity_id: string | null
          id: string
          store_id: string
          summary: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          store_id: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          store_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          name: string
          parent_id: string | null
          position: number
          seo: Json
          slug: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name: string
          parent_id?: string | null
          position?: number
          seo?: Json
          slug: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          parent_id?: string | null
          position?: number
          seo?: Json
          slug?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          customer_email: string
          id: string
          order_id: string | null
          store_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          customer_email: string
          id?: string
          order_id?: string | null
          store_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          customer_email?: string
          id?: string
          order_id?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          category_ids: string[]
          code: string
          created_at: string
          ends_at: string | null
          first_order_only: boolean
          id: string
          is_active: boolean
          max_uses: number | null
          max_uses_per_customer: number | null
          min_subtotal: number | null
          product_ids: string[]
          scope: string
          starts_at: string | null
          store_id: string
          type: string
          updated_at: string
          uses_count: number
          value: number
        }
        Insert: {
          category_ids?: string[]
          code: string
          created_at?: string
          ends_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_customer?: number | null
          min_subtotal?: number | null
          product_ids?: string[]
          scope?: string
          starts_at?: string | null
          store_id: string
          type: string
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Update: {
          category_ids?: string[]
          code?: string
          created_at?: string
          ends_at?: string | null
          first_order_only?: boolean
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_customer?: number | null
          min_subtotal?: number | null
          product_ids?: string[]
          scope?: string
          starts_at?: string | null
          store_id?: string
          type?: string
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          default_address: Json | null
          doc_number: string | null
          email: string | null
          id: string
          name: string | null
          notes: string | null
          orders_count: number
          phone: string | null
          store_id: string
          tags: string[]
          total_spent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_address?: Json | null
          doc_number?: string | null
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          orders_count?: number
          phone?: string | null
          store_id: string
          tags?: string[]
          total_spent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_address?: Json | null
          doc_number?: string | null
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          orders_count?: number
          phone?: string | null
          store_id?: string
          tags?: string[]
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      import_items: {
        Row: {
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          job_id: string
          name: string | null
          payload: Json
          product_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          job_id: string
          name?: string | null
          payload?: Json
          product_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          job_id?: string
          name?: string | null
          payload?: Json
          product_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          adapter: string
          created_at: string
          created_by: string | null
          cursor: Json | null
          error: string | null
          finished_at: string | null
          id: string
          log: Json[]
          options: Json
          source_url: string
          started_at: string | null
          stats: Json
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          adapter: string
          created_at?: string
          created_by?: string | null
          cursor?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          log?: Json[]
          options?: Json
          source_url: string
          started_at?: string | null
          stats?: Json
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          adapter?: string
          created_at?: string
          created_by?: string | null
          cursor?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          log?: Json[]
          options?: Json
          source_url?: string
          started_at?: string | null
          stats?: Json
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          note: string | null
          order_id: string | null
          reason: string
          stock_after: number
          store_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          reason: string
          stock_after: number
          store_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          reason?: string
          stock_after?: number
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "low_stock_variants"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          handle: string
          id: string
          items: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          items?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          items?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          id: string
          message: string | null
          order_id: string
          store_id: string
          type: string
          visible_to_customer: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          message?: string | null
          order_id: string
          store_id: string
          type: string
          visible_to_customer?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          message?: string | null
          order_id?: string
          store_id?: string
          type?: string
          visible_to_customer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          list_price: number
          name: string
          order_id: string
          product_id: string | null
          qty: number
          sku: string | null
          store_id: string
          total: number
          unit_price: number
          variant_id: string | null
          variant_title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          list_price: number
          name: string
          order_id: string
          product_id?: string | null
          qty: number
          sku?: string | null
          store_id: string
          total: number
          unit_price: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          list_price?: number
          name?: string
          order_id?: string
          product_id?: string | null
          qty?: number
          sku?: string | null
          store_id?: string
          total?: number
          unit_price?: number
          variant_id?: string | null
          variant_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "low_stock_variants"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          method_code: string | null
          note: string | null
          order_id: string
          paid_at: string
          receipt_url: string | null
          reference: string | null
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          method_code?: string | null
          note?: string | null
          order_id: string
          paid_at?: string
          receipt_url?: string | null
          reference?: string | null
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method_code?: string | null
          note?: string | null
          order_id?: string
          paid_at?: string
          receipt_url?: string | null
          reference?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          coupon_code: string | null
          coupon_discount: number
          created_at: string
          currency: string
          customer: Json
          customer_id: string | null
          delivered_at: string | null
          discount_total: number
          expires_at: string | null
          fulfillment: string
          id: string
          internal_notes: string | null
          notes: string | null
          number: number
          paid_at: string | null
          payment_discount: number
          payment_discount_percent: number
          payment_method_code: string | null
          payment_status: string
          pickup_location_id: string | null
          promo_total: number
          public_token: string
          seen_at: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_cost: number
          shipping_zone_id: string | null
          shipping_zone_name: string | null
          source: string
          status: string
          store_id: string
          subtotal: number
          total: number
          tracking_carrier: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          whatsapp_sent_at: string | null
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          coupon_code?: string | null
          coupon_discount?: number
          created_at?: string
          currency?: string
          customer?: Json
          customer_id?: string | null
          delivered_at?: string | null
          discount_total?: number
          expires_at?: string | null
          fulfillment?: string
          id?: string
          internal_notes?: string | null
          notes?: string | null
          number?: number
          paid_at?: string | null
          payment_discount?: number
          payment_discount_percent?: number
          payment_method_code?: string | null
          payment_status?: string
          pickup_location_id?: string | null
          promo_total?: number
          public_token?: string
          seen_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number
          shipping_zone_id?: string | null
          shipping_zone_name?: string | null
          source?: string
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          whatsapp_sent_at?: string | null
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          coupon_code?: string | null
          coupon_discount?: number
          created_at?: string
          currency?: string
          customer?: Json
          customer_id?: string | null
          delivered_at?: string | null
          discount_total?: number
          expires_at?: string | null
          fulfillment?: string
          id?: string
          internal_notes?: string | null
          notes?: string | null
          number?: number
          paid_at?: string | null
          payment_discount?: number
          payment_discount_percent?: number
          payment_method_code?: string | null
          payment_status?: string
          pickup_location_id?: string | null
          promo_total?: number
          public_token?: string
          seen_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_cost?: number
          shipping_zone_id?: string | null
          shipping_zone_name?: string | null
          source?: string
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          tracking_carrier?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "pickup_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      page_drafts: {
        Row: {
          data: Json
          page_id: string
          store_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data: Json
          page_id: string
          store_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          page_id?: string
          store_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_drafts_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_drafts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          published_at: string | null
          seo: Json
          show_in_menu: boolean
          slug: string
          status: string
          store_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          published_at?: string | null
          seo?: Json
          show_in_menu?: boolean
          slug: string
          status?: string
          store_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          published_at?: string | null
          seo?: Json
          show_in_menu?: boolean
          slug?: string
          status?: string
          store_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          created_at: string
          discount_percent: number
          id: string
          instructions_md: string | null
          is_active: boolean
          name: string
          position: number
          store_id: string
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_percent?: number
          id?: string
          instructions_md?: string | null
          is_active?: boolean
          name: string
          position?: number
          store_id: string
          type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_percent?: number
          id?: string
          instructions_md?: string | null
          is_active?: boolean
          name?: string
          position?: number
          store_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_locations: {
        Row: {
          address: string | null
          created_at: string
          hours_text: string | null
          id: string
          instructions_md: string | null
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          position: number
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          hours_text?: string | null
          id?: string
          instructions_md?: string | null
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          position?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          hours_text?: string | null
          id?: string
          instructions_md?: string | null
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          position?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          is_public: boolean
          limits: Json
          name: string
          position: number
          price_monthly: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          is_public?: boolean
          limits?: Json
          name: string
          position?: number
          price_monthly?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          is_public?: boolean
          limits?: Json
          name?: string
          position?: number
          price_monthly?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      price_batches: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          rule: Json
          rule_summary: string
          scope: Json
          scope_summary: string
          source: string
          store_id: string
          undo_result: Json | null
          undone_at: string | null
          undone_by: string | null
          variant_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          rule?: Json
          rule_summary?: string
          scope?: Json
          scope_summary?: string
          source?: string
          store_id: string
          undo_result?: Json | null
          undone_at?: string | null
          undone_by?: string | null
          variant_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          rule?: Json
          rule_summary?: string
          scope?: Json
          scope_summary?: string
          source?: string
          store_id?: string
          undo_result?: Json | null
          undone_at?: string | null
          undone_by?: string | null
          variant_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      price_changes: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          id: string
          new_compare_at: number | null
          new_price: number | null
          old_compare_at: number | null
          old_price: number | null
          store_id: string
          variant_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_compare_at?: number | null
          new_price?: number | null
          old_compare_at?: number | null
          old_price?: number | null
          store_id: string
          variant_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          new_compare_at?: number | null
          new_price?: number | null
          old_compare_at?: number | null
          old_price?: number | null
          store_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_changes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_changes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "admin_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "price_changes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "low_stock_variants"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "price_changes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          position: number
          product_id: string
          store_id: string
        }
        Insert: {
          category_id: string
          position?: number
          product_id: string
          store_id: string
        }
        Update: {
          category_id?: string
          position?: number
          product_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          height: number | null
          id: string
          position: number
          product_id: string
          store_id: string
          updated_at: string
          url: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          product_id: string
          store_id: string
          updated_at?: string
          url: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          product_id?: string
          store_id?: string
          updated_at?: string
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          allow_backorder: boolean
          barcode: string | null
          compare_at_price: number | null
          cost: number | null
          created_at: string
          id: string
          image_id: string | null
          is_active: boolean
          low_stock_threshold: number | null
          option_values: Json
          position: number
          price: number
          product_id: string
          sku: string | null
          stock: number
          store_id: string
          title: string
          track_inventory: boolean
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          allow_backorder?: boolean
          barcode?: string | null
          compare_at_price?: number | null
          cost?: number | null
          created_at?: string
          id?: string
          image_id?: string | null
          is_active?: boolean
          low_stock_threshold?: number | null
          option_values?: Json
          position?: number
          price: number
          product_id: string
          sku?: string | null
          stock?: number
          store_id: string
          title?: string
          track_inventory?: boolean
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          allow_backorder?: boolean
          barcode?: string | null
          compare_at_price?: number | null
          cost?: number | null
          created_at?: string
          id?: string
          image_id?: string | null
          is_active?: boolean
          low_stock_threshold?: number | null
          option_values?: Json
          position?: number
          price?: number
          product_id?: string
          sku?: string | null
          stock?: number
          store_id?: string
          title?: string
          track_inventory?: boolean
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "product_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          created_at: string
          description_html: string | null
          external_id: string | null
          featured: boolean
          id: string
          metadata: Json
          name: string
          options: Json
          published_at: string | null
          related_ids: string[]
          seo: Json
          short_description: string | null
          slug: string
          source: string
          source_url: string | null
          specs: Json
          status: string
          store_id: string
          tags: string[]
          updated_at: string
          vat_percent: number | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          description_html?: string | null
          external_id?: string | null
          featured?: boolean
          id?: string
          metadata?: Json
          name: string
          options?: Json
          published_at?: string | null
          related_ids?: string[]
          seo?: Json
          short_description?: string | null
          slug: string
          source?: string
          source_url?: string | null
          specs?: Json
          status?: string
          store_id: string
          tags?: string[]
          updated_at?: string
          vat_percent?: number | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          description_html?: string | null
          external_id?: string | null
          featured?: boolean
          id?: string
          metadata?: Json
          name?: string
          options?: Json
          published_at?: string | null
          related_ids?: string[]
          seo?: Json
          short_description?: string | null
          slug?: string
          source?: string
          source_url?: string | null
          specs?: Json
          status?: string
          store_id?: string
          tags?: string[]
          updated_at?: string
          vat_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_platform_admin: boolean
          last_seen_at: string | null
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_platform_admin?: boolean
          last_seen_at?: string | null
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_platform_admin?: boolean
          last_seen_at?: string | null
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          badge_label: string | null
          category_ids: string[]
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          product_ids: string[]
          scope: string
          stackable: boolean
          starts_at: string | null
          store_id: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          badge_label?: string | null
          category_ids?: string[]
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          product_ids?: string[]
          scope?: string
          stackable?: boolean
          starts_at?: string | null
          store_id: string
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          badge_label?: string | null
          category_ids?: string[]
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          product_ids?: string[]
          scope?: string
          stackable?: boolean
          starts_at?: string | null
          store_id?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      redirects: {
        Row: {
          created_at: string
          created_by: string | null
          from_path: string
          hits: number
          id: string
          store_id: string
          to_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_path: string
          hits?: number
          id?: string
          store_id: string
          to_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_path?: string
          hits?: number
          id?: string
          store_id?: string
          to_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "redirects_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          cost: number
          created_at: string
          eta_text: string | null
          free_over: number | null
          geometry: Json | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          position: number
          postal_prefixes: string[]
          provinces: string[]
          store_id: string
          type: string
          updated_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          eta_text?: string | null
          free_over?: number | null
          geometry?: Json | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          position?: number
          postal_prefixes?: string[]
          provinces?: string[]
          store_id: string
          type: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          eta_text?: string | null
          free_over?: number | null
          geometry?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          position?: number
          postal_prefixes?: string[]
          provinces?: string[]
          store_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zones_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          store_id: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: string
          store_id: string
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          store_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_invites_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          created_at: string
          invited_by: string | null
          is_active: boolean
          role: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          is_active?: boolean
          role: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          is_active?: boolean
          role?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          address: string | null
          announcement: Json
          catalog: Json
          checkout: Json
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          favicon_url: string | null
          footer: Json
          free_shipping_bar: Json
          header: Json
          integrations: Json
          inventory_policy: string
          legal: Json
          locale: string
          logo_url: string | null
          low_stock_threshold: number
          maintenance: Json
          name: string
          policies: Json
          seo: Json
          social: Json
          store_id: string
          tagline: string | null
          tax: Json
          theme: Json
          timezone: string
          updated_at: string
          whatsapp_button: Json
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          announcement?: Json
          catalog?: Json
          checkout?: Json
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          favicon_url?: string | null
          footer?: Json
          free_shipping_bar?: Json
          header?: Json
          integrations?: Json
          inventory_policy?: string
          legal?: Json
          locale?: string
          logo_url?: string | null
          low_stock_threshold?: number
          maintenance?: Json
          name?: string
          policies?: Json
          seo?: Json
          social?: Json
          store_id: string
          tagline?: string | null
          tax?: Json
          theme?: Json
          timezone?: string
          updated_at?: string
          whatsapp_button?: Json
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          announcement?: Json
          catalog?: Json
          checkout?: Json
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          favicon_url?: string | null
          footer?: Json
          free_shipping_bar?: Json
          header?: Json
          integrations?: Json
          inventory_policy?: string
          legal?: Json
          locale?: string
          logo_url?: string | null
          low_stock_threshold?: number
          maintenance?: Json
          name?: string
          policies?: Json
          seo?: Json
          social?: Json
          store_id?: string
          tagline?: string | null
          tax?: Json
          theme?: Json
          timezone?: string
          updated_at?: string
          whatsapp_button?: Json
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          custom_domain: string | null
          custom_domain_verified: boolean
          id: string
          name: string
          next_order_number: number
          onboarding: Json
          owner_id: string | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          custom_domain_verified?: boolean
          id?: string
          name: string
          next_order_number?: number
          onboarding?: Json
          owner_id?: string | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          custom_domain_verified?: boolean
          id?: string
          name?: string
          next_order_number?: number
          onboarding?: Json
          owner_id?: string | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          notes: string | null
          plan_code: string
          provider: string | null
          provider_ref: string | null
          status: string
          store_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          notes?: string | null
          plan_code: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          store_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          notes?: string | null
          plan_code?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          store_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          code: string
          contact: string
          created_at: string
          id: string
          name: string
          order_id: string | null
          order_number: number | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          code: string
          contact: string
          created_at?: string
          id?: string
          name: string
          order_id?: string | null
          order_number?: number | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          code?: string
          contact?: string
          created_at?: string
          id?: string
          name?: string
          order_id?: string | null
          order_number?: number | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_inventory: {
        Row: {
          category_ids: string[] | null
          cost: number | null
          image_url: string | null
          is_active: boolean | null
          low_stock_threshold: number | null
          position: number | null
          product_id: string | null
          product_name: string | null
          product_slug: string | null
          product_status: string | null
          sku: string | null
          stock: number | null
          stock_state: string | null
          store_id: string | null
          threshold: number | null
          track_inventory: boolean | null
          updated_at: string | null
          variant_id: string | null
          variant_title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_products: {
        Row: {
          brand: string | null
          category_ids: string[] | null
          created_at: string | null
          featured: boolean | null
          first_variant_id: string | null
          id: string | null
          image_url: string | null
          low_count: number | null
          max_price: number | null
          min_price: number | null
          name: string | null
          out_count: number | null
          skus: string | null
          slug: string | null
          source: string | null
          source_url: string | null
          status: string | null
          stock_state: string | null
          store_id: string | null
          total_stock: number | null
          tracked: boolean | null
          updated_at: string | null
          variant_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_variants: {
        Row: {
          product_id: string | null
          product_name: string | null
          product_slug: string | null
          sku: string | null
          stock: number | null
          store_id: string | null
          threshold: number | null
          variant_id: string | null
          variant_title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "admin_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      price_batch_list: {
        Row: {
          batch_id: string | null
          created_at: string | null
          created_by: string | null
          created_by_email: string | null
          rule: Json | null
          rule_summary: string | null
          scope_summary: string | null
          source: string | null
          store_id: string | null
          undo_result: Json | null
          undone_at: string | null
          variant_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_changes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_store_invite: { Args: { p_token: string }; Returns: string }
      adjust_stock: {
        Args: {
          p_delta: number
          p_note?: string
          p_order_id?: string
          p_reason: string
          p_variant_id: string
        }
        Returns: number
      }
      admin_list_users: {
        Args: { p_store_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_seen_at: string
          last_sign_in_at: string
          name: string
          role: string
        }[]
      }
      admin_sales_series: {
        Args: {
          p_bucket?: string
          p_from: string
          p_store_id: string
          p_to: string
          p_tz?: string
        }
        Returns: {
          bucket: string
          orders: number
          sales: number
        }[]
      }
      admin_store_ids: { Args: never; Returns: string[] }
      admin_top_products: {
        Args: {
          p_from: string
          p_limit?: number
          p_store_id: string
          p_to: string
        }
        Returns: {
          image_url: string
          name: string
          product_id: string
          qty: number
          revenue: number
        }[]
      }
      apply_price_changes: {
        Args: { p_batch_id: string; p_changes: Json; p_store_id: string }
        Returns: Json
      }
      can_manage_media: { Args: { p_name: string }; Returns: boolean }
      check_store_slug: { Args: { p_slug: string }; Returns: boolean }
      create_order: { Args: { payload: Json }; Returns: Json }
      create_store: {
        Args: {
          p_kind?: string
          p_name: string
          p_options?: Json
          p_slug: string
          p_whatsapp?: string
        }
        Returns: string
      }
      create_withdrawal_request: { Args: { payload: Json }; Returns: Json }
      current_plan: { Args: { p_store_id: string }; Returns: Json }
      expire_trials: { Args: never; Returns: number }
      expire_unpaid_orders: { Args: { p_store_id: string }; Returns: number }
      get_order_by_token: { Args: { p_token: string }; Returns: Json }
      get_store_invite: { Args: { p_token: string }; Returns: Json }
      hit_redirect: {
        Args: { p_from_path: string; p_store_id: string }
        Returns: string
      }
      inventory_summary: { Args: { p_store_id: string }; Returns: Json }
      invite_store_member: {
        Args: { p_email: string; p_role: string; p_store_id: string }
        Returns: Json
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_store_admin: { Args: { p_store_id: string }; Returns: boolean }
      is_store_member: { Args: { p_store_id: string }; Returns: boolean }
      is_store_owner: { Args: { p_store_id: string }; Returns: boolean }
      platform_list_stores: {
        Args: never
        Returns: {
          created_at: string
          id: string
          name: string
          orders: number
          owner_email: string
          plan_code: string
          products: number
          slug: string
          status: string
          sub_status: string
          trial_ends_at: string
        }[]
      }
      platform_set_plan: {
        Args: {
          p_plan_code: string
          p_status: string
          p_store_id: string
          p_trial_ends_at?: string
        }
        Returns: undefined
      }
      platform_set_store_status: {
        Args: { p_status: string; p_store_id: string }
        Returns: undefined
      }
      platform_stats: { Args: never; Returns: Json }
      pricing_scope_facets: { Args: { p_store_id: string }; Returns: Json }
      pricing_scope_variants: {
        Args: { p_scope: Json; p_store_id: string }
        Returns: {
          compare_at_price: number
          cost: number
          image_url: string
          price: number
          product_id: string
          product_name: string
          product_slug: string
          product_status: string
          sku: string
          stock: number
          track_inventory: boolean
          variant_id: string
          variant_title: string
        }[]
      }
      reorder_categories: {
        Args: { items: Json; p_store_id: string }
        Returns: number
      }
      run_daily_maintenance: { Args: never; Returns: Json }
      store_is_active: { Args: { p_store_id: string }; Returns: boolean }
      touch_last_seen: { Args: never; Returns: undefined }
      undo_price_batch: {
        Args: { p_batch_id: string; p_store_id: string }
        Returns: Json
      }
      update_my_profile: { Args: { p_name: string }; Returns: undefined }
      validate_coupon: {
        Args: {
          p_code: string
          p_email?: string
          p_items?: Json
          p_store_id: string
          p_subtotal: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
