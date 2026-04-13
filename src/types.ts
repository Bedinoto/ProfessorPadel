export interface Slot {
  id: number;
  date: string;
  time: string;
  is_available: number;
}

export interface Booking {
  id: number;
  slot_id: number;
  student_name: string;
  student_phone: string;
  booking_type: string;
  price: number;
  paid: number;
  created_at: string;
  date: string;
  time: string;
}

export interface FinanceSummary {
  total_revenue: number;
  total_paid: number;
  total_pending: number;
  total_bookings: number;
}
