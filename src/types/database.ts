// Supabase database types generated from schema
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chat_messages: {
        Row: {
          chat_id: string
          chat_type: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chat_id: string
          chat_type: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chat_id?: string
          chat_type?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "item_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "space_chats"
            referencedColumns: ["id"]
          }
        ]
      }
      item_chats: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_chats_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_chats_user_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      item_metadata: {
        Row: {
          author: string | null
          domain: string | null
          item_id: string
          profile_image: string | null
          published_date: string | null
          username: string | null
        }
        Insert: {
          author?: string | null
          domain?: string | null
          item_id: string
          profile_image?: string | null
          published_date?: string | null
          username?: string | null
        }
        Update: {
          author?: string | null
          domain?: string | null
          item_id?: string
          profile_image?: string | null
          published_date?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_metadata_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          }
        ]
      }
      item_spaces: {
        Row: {
          created_at: string
          item_id: string
          space_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          space_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_spaces_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_spaces_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          }
        ]
      }
      item_type_metadata: {
        Row: {
          content_type: string
          data: Json
          item_id: string
        }
        Insert: {
          content_type: string
          data: Json
          item_id: string
        }
        Update: {
          content_type?: string
          data?: Json
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_type_metadata_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          }
        ]
      }
      items: {
        Row: {
          content: string | null
          content_type: string
          created_at: string
          desc: string | null
          id: string
          is_archived: boolean
          raw_text: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          content_type: string
          created_at?: string
          desc?: string | null
          id?: string
          is_archived?: boolean
          raw_text?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          content_type?: string
          created_at?: string
          desc?: string | null
          id?: string
          is_archived?: boolean
          raw_text?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      offline_queue: {
        Row: {
          action_type: string
          created_at: string
          id: string
          payload: Json
          status: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          payload: Json
          status?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      space_chats: {
        Row: {
          created_at: string
          id: string
          space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          space_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_chats_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_chats_user_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      spaces: {
        Row: {
          color: string
          created_at: string | null
          desc: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          desc?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          desc?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spaces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      users: {
        Row: {
          email: string
          id: string
        }
        Insert: {
          email: string
          id: string
        }
        Update: {
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
