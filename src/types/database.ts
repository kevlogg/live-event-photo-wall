export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PhotoStatus = 'pending' | 'approved' | 'rejected';
export type ModerationMode = 'auto_approve' | 'strict';

export interface Venue {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface PhysicalTable {
  id: string;
  venue_id: string;
  table_number: number;
  token_hash: string;
  created_at: string;
}

export interface Event {
  id: string;
  venue_id: string;
  title: string;
  start_time: string;
  end_time: string;
  active_tables_count: number;
  is_active: boolean;
  moderation_mode: ModerationMode;
  created_at: string;
}

export interface Photo {
  id: string;
  event_id: string;
  table_number: number;
  storage_path: string;
  uploader_name: string;
  caption?: string | null;
  status: PhotoStatus;
  created_at: string;
}

export interface BlockedTable {
  id: string;
  event_id: string;
  table_number: number;
  reason?: string | null;
  created_at: string;
}

export interface EventWithVenue extends Event {
  venue: Venue;
}

export type Database = {
  public: {
    Tables: {
      venues: {
        Row: Venue;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      physical_tables: {
        Row: PhysicalTable;
        Insert: {
          id?: string;
          venue_id: string;
          table_number: number;
          token_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          table_number?: number;
          token_hash?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'physical_tables_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          }
        ];
      };
      events: {
        Row: Event;
        Insert: {
          id?: string;
          venue_id: string;
          title: string;
          start_time: string;
          end_time: string;
          active_tables_count?: number;
          is_active?: boolean;
          moderation_mode?: ModerationMode;
          created_at?: string;
        };
        Update: {
          id?: string;
          venue_id?: string;
          title?: string;
          start_time?: string;
          end_time?: string;
          active_tables_count?: number;
          is_active?: boolean;
          moderation_mode?: ModerationMode;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'events_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          }
        ];
      };
      photos: {
        Row: Photo;
        Insert: {
          id?: string;
          event_id: string;
          table_number: number;
          storage_path: string;
          uploader_name: string;
          caption?: string | null;
          status?: PhotoStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          table_number?: number;
          storage_path?: string;
          uploader_name?: string;
          caption?: string | null;
          status?: PhotoStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'photos_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          }
        ];
      };
      blocked_tables: {
        Row: BlockedTable;
        Insert: {
          id?: string;
          event_id: string;
          table_number: number;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          table_number?: number;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocked_tables_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      photo_status: PhotoStatus;
      moderation_mode: ModerationMode;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
