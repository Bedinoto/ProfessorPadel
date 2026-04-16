export interface Location {
  id: string;
  name: string;
}

export interface Slot {
  id: string;
  location_id: string;
  date: string;
  time: string;
  is_available: boolean;
}

export interface Booking {
  id: string;
  slot_id: string;
  student_name: string;
  student_phone: string;
  booking_type: string;
  price: number;
  paid: boolean;
  date: string;
  time: string;
  location_name: string;
  location_id: string;
}

export interface FinanceSummary {
  total_revenue: number;
  total_paid: number;
  total_pending: number;
  total_bookings: number;
}
