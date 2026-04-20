export interface Location {
  id: string;
  name: string;
  teacher_id: string;
}

export interface Slot {
  id: string;
  location_id: string;
  teacher_id: string;
  date: string;
  time: string;
  is_available: boolean;
}

export interface Booking {
  id: string;
  slot_id: string;
  teacher_id: string;
  student_name: string;
  student_phone: string;
  booking_type: string;
  price: number;
  paid: boolean;
  date: string;
  time: string;
  location_name: string;
  google_event_id?: string;
  google_synced?: boolean;
}

export interface FinanceSummary {
  total_revenue: number;
  total_paid: number;
  total_pending: number;
  total_bookings: number;
}

export interface BookingType {
  name: string;
  price: number;
}

export interface AppSettings {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  whatsapp_number: string;
  google_script_url: string;
  whatsapp_enabled: boolean;
  booking_types?: BookingType[];
  agenda_start_day?: number; // 0 (Sun) to 6 (Sat)
  agenda_duration?: number; // Number of days to show
}

export interface Product {
  id: string;
  teacher_id: string;
  name: string;
  price: number;
  description: string;
  image_url: string;
  category: string;
  whatsapp_number?: string;
  stock?: number;
  highlighted?: boolean;
}
