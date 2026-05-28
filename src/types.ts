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
  location_id?: string;
  google_event_id?: string;
  google_synced?: boolean;
  user_type?: 'professor' | 'court_owner';
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
  is_active?: boolean;
  user_type?: 'professor' | 'court_owner';
  whatsapp_template?: string;
  whatsapp_instance_token?: string;
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
  pix_discount?: number;
}

export interface Tournament {
  id: string;
  teacher_id: string;
  name: string;
  type: 'padel' | 'beach';
  rules: string;
  locations: string[]; // Courts/spaces list, e.g. ["Quadra 1", "Quadra 2"]
  times: string[]; // List of available times e.g. ["08:00", "09:30"]
  dates: string[]; // List of YYYY-MM-DD match dates
  categories: string[]; // List of categories, e.g. ["Categoria A", "Categoria B"]
  created_at: string;
}

export interface TournamentTeam {
  id: string;
  teacher_id: string;
  tournament_id: string;
  category: string;
  group_name: string; // "Chave A", "Chave B" etc.
  player1_name: string;
  player1_phone?: string;
  player2_name: string;
  player2_phone?: string;
  
  // Stats for standings
  points?: number;
  games_played?: number;
  games_won?: number;
  games_lost?: number;
  sets_won?: number;
  sets_lost?: number;
}

export interface TournamentMatch {
  id: string;
  teacher_id: string;
  tournament_id: string;
  category: string;
  stage: string; // "Chave A", "Semifinal", "Final" etc.
  team1_id?: string;
  team1_name: string; // fallback or composite team text e.g. "João/Maria"
  team2_id?: string;
  team2_name: string;
  score1_sets?: number[];
  score2_sets?: number[];
  score1_text?: string;
  score2_text?: string;
  date: string;
  time: string;
  location: string;
  status: 'agendado' | 'em_andamento' | 'encerrado';
  winner_id?: string;
}
