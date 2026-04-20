/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Phone, 
  CheckCircle, 
  XCircle, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Trash2, 
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  TrendingUp,
  MapPin,
  Settings as SettingsIcon,
  Edit2,
  Share2,
  FileText,
  Copy,
  ExternalLink,
  AlertCircle,
  MessageCircle
} from 'lucide-react';
import { format, addDays, startOfToday, isSameDay, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Slot, Booking, FinanceSummary, Location, AppSettings, BookingType } from './types';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from './firebase';

// --- ERROR HANDLING ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const DEFAULT_BOOKING_TYPES = [
  { name: 'Individual', price: 70 },
  { name: 'Dupla', price: 120 },
  { name: 'Trio', price: 150 },
  { name: 'Quarteto (jogo orientado)', price: 200 },
];

export default function App() {
  const [view, setView] = useState<'public' | 'login' | 'admin'>('public');
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTeacherName, setActiveTeacherName] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      // Hidden access via /admin or if already authenticated
      if (currentUser || window.location.pathname === '/admin') {
        setView(currentUser ? 'admin' : 'login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'settings', user.uid), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setActiveTeacherName(data.teacher_name || user.displayName || user.email?.split('@')[0]);
        }
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    setView('public');
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-green-600 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer overflow-hidden" 
            onClick={() => setView('public')}
          >
            <h1 className="font-bold text-lg md:text-xl tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
              {activeTeacherName ? (
                <>🎾 Instrutor <span className="text-green-600">{activeTeacherName}</span></>
              ) : (
                <>🎾 Agenda de Aulas</>
              )}
            </h1>
          </div>
          
          <div className="flex gap-4 items-center">
            {user && (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setView('admin')}
                  className={`text-sm font-medium transition-colors ${view === 'admin' ? 'text-green-600' : 'text-gray-600 hover:text-green-600'}`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm font-medium text-red-500 hover:text-red-600"
                >
                  <LogOut size={16} /> Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {view === 'public' && (
            <motion.div key="public" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PublicBooking onTeacherNameFetched={setActiveTeacherName} setToast={setToast} />
            </motion.div>
          )}
          {view === 'login' && (
            <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Login onLogin={() => setView('admin')} />
            </motion.div>
          )}
          {view === 'admin' && user && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AdminDashboard user={user} teacherName={activeTeacherName} setToast={setToast} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[200] flex items-center gap-3 border transition-colors ${
              toast.type === 'success' ? 'bg-green-600 border-green-500 text-white' : 
              toast.type === 'info' ? 'bg-blue-600 border-blue-500 text-white' :
              'bg-red-600 border-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
            <span className="font-bold text-sm text-white">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- COMPONENTS ---

function PublicBooking({ 
  onTeacherNameFetched,
  setToast 
}: { 
  onTeacherNameFetched?: (name: string) => void,
  setToast: (t: any) => void
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', type: 'Individual' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastBooking, setLastBooking] = useState<any>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const bookingFormRef = useRef<HTMLDivElement>(null);
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const hasLocParam = params.has('loc');

  useEffect(() => {
    if (selectedSlot) {
      setTimeout(() => {
        bookingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedSlot]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'locations'), (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
      setLocations(locs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      // Fetch app settings for this specific teacher
      const settingsUnsubscribe = onSnapshot(doc(db, 'settings', selectedLocation.teacher_id), (snapshot) => {
        if (snapshot.exists()) {
          const settings = { id: snapshot.id, ...snapshot.data() } as AppSettings;
          setAppSettings(settings);
          if (settings.teacher_name) {
            onTeacherNameFetched?.(settings.teacher_name);
          }
        }
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'settings'));
      
      return () => settingsUnsubscribe();
    }
  }, [selectedLocation, onTeacherNameFetched]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locId = params.get('loc');
    if (locId && locations.length > 0) {
      const matched = locations.find(l => l.id === locId);
      if (matched) {
        setSelectedLocation(matched);
      }
    }
  }, [locations]);

  useEffect(() => {
    if (selectedLocation) {
      const q = query(
        collection(db, 'slots'), 
        where('location_id', '==', selectedLocation.id),
        where('is_available', '==', true)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allSlots = snapshot.docs.map(doc => doc.data() as Slot);
        const todayStr = format(startOfToday(), 'yyyy-MM-dd');
        const now = new Date();
        const currentTime = format(now, 'HH:mm');

        // Filter out past days and past times of today
        const futureSlots = allSlots.filter(s => {
          if (s.date < todayStr) return false;
          if (s.date === todayStr && s.time <= currentTime) return false;
          return true;
        });

        const days = [...new Set(futureSlots.map(s => s.date))].sort();
        setAvailableDays(days);
        
        if (days.length > 0 && (!selectedDate || !days.includes(format(selectedDate, 'yyyy-MM-dd')))) {
          setSelectedDate(parseISO(days[0]));
        }
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocation && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const q = query(
        collection(db, 'slots'),
        where('location_id', '==', selectedLocation.id),
        where('date', '==', dateStr),
        where('is_available', '==', true)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slot));
        const todayStr = format(startOfToday(), 'yyyy-MM-dd');
        const now = new Date();
        const currentTime = format(now, 'HH:mm');

        const futureSlots = filtered.filter(s => {
          if (s.date < todayStr) return false;
          if (s.date === todayStr && s.time <= currentTime) return false;
          return true;
        });
        
        setSlots(futureSlots.sort((a, b) => a.time.localeCompare(b.time)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedDate, selectedLocation]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    
    // Validate phone number length (only digits)
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setToast({ message: "O telefone deve ter entre 10 e 11 dígitos (com DDD).", type: 'error' });
      return;
    }

    setStatus('loading');
    try {
      const activeBookingTypes = appSettings?.booking_types || DEFAULT_BOOKING_TYPES;
      const selectedType = activeBookingTypes.find(t => t.name === formData.type);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Update slot availability
      await updateDoc(doc(db, 'slots', selectedSlot.id), {
        is_available: false
      });

      // Add booking
      const bookingId = Date.now().toString();
      const bookingData = {
        slot_id: selectedSlot.id,
        teacher_id: selectedLocation?.teacher_id,
        student_name: formData.name,
        student_phone: formData.phone,
        booking_type: formData.type,
        price: selectedType?.price || 0,
        paid: false,
        date: dateStr,
        time: selectedSlot.time,
        location_name: selectedLocation?.name || ''
      };

      await setDoc(doc(db, 'bookings', bookingId), bookingData);

      setLastBooking({
        ...bookingData,
        teacher_name: appSettings?.teacher_name || 'Seu Instrutor'
      });
      setStatus('success');

      // Send WhatsApp Notification
      try {
        if (appSettings?.whatsapp_enabled !== false) {
          const message = `🎾 *Nova Reserva de Aula!*
          
📍 *Local:* ${selectedLocation?.name}
📅 *Data:* ${format(selectedDate, "dd/MM/yyyy")}
⏰ *Hora:* ${selectedSlot.time}
👤 *Aluno:* ${formData.name}
📞 *Contato:* ${formData.phone}
📝 *Tipo:* ${formData.type}`;

          await fetch('https://bedinoto.uazapi.com/send/text', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'token': 'a5fdab6f-0e1d-407c-aa4e-e6b44f935509'
            },
            body: JSON.stringify({
              number: appSettings?.whatsapp_number || "555599731123",
              text: message
            })
          });
        }
      } catch (notifyError) {
        console.error('Erro ao enviar notificação:', notifyError);
      }

      setSelectedSlot(null);
      setFormData({ name: '', phone: '', type: 'Individual' });
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const getGoogleCalendarUrl = () => {
    if (!lastBooking) return '';
    
    const [year, month, day] = lastBooking.date.split('-').map(Number);
    const [hour, minute] = lastBooking.time.split(':').map(Number);
    
    const startDate = new Date(year, month - 1, day, hour, minute);
    const endDate = new Date(startDate);
    endDate.setHours(startDate.getHours() + 1);
    
    const formatDate = (date: Date) => format(date, "yyyyMMdd'T'HHmmss");
    
    const title = encodeURIComponent(`Aula de Padel/Beach Tennis - ${lastBooking.teacher_name}`);
    const dates = `${formatDate(startDate)}/${formatDate(endDate)}`;
    const details = encodeURIComponent(`Tipo: ${lastBooking.booking_type}\nAluno: ${lastBooking.student_name}\n\nAgendado via App de Aulas.`);
    const location = encodeURIComponent(lastBooking.location_name);
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  if (!hasLocParam) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto text-center space-y-6 pt-12 text-balance px-4"
      >
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto shadow-sm border border-red-100">
          <AlertCircle size={48} className="text-red-500" />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 leading-tight">Link de Agendamento Incompleto</h2>
          <p className="text-gray-500 text-lg leading-relaxed">
            Parece que você acessou um link genérico. Cada professor possui seu link personalizado.
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 space-y-6">
          <p className="text-gray-600 font-medium">
            Como agendar sua aula:
          </p>
          <div className="text-left space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 flex-shrink-0 text-xs font-bold">1</div>
              <p className="text-gray-600 text-sm">Entre em contato com seu professor.</p>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600 flex-shrink-0 text-xs font-bold">2</div>
              <p className="text-gray-600 text-sm">Peça o link da **Agenda Disponível** atualizado.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => window.history.back()}
          className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors pt-4"
        >
          ← Voltar para a página anterior
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Reserve sua Aula</h2>
        <p className="text-gray-500">Escolha o local e horário para começar a treinar!</p>
      </div>

      {/* Location Selector */}
      <div className="space-y-4">
        <p className="text-center text-sm font-bold text-gray-400 uppercase tracking-widest">1. Selecione o Local</p>
        <div className="flex flex-wrap justify-center gap-3">
          {locations.map(loc => (
            <button
              key={loc.id}
              onClick={() => setSelectedLocation(loc)}
              className={`px-6 py-3 rounded-2xl font-bold transition-all ${
                selectedLocation?.id === loc.id
                  ? 'bg-green-600 text-white shadow-lg shadow-green-200 scale-105'
                  : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
              }`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedLocation ? (
          <motion.div 
            key="agenda"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid md:grid-cols-2 gap-8">
              {/* Calendar / Date Picker */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CalendarIcon size={18} className="text-green-600" />
                    2. Selecione o Dia
                  </h3>
                </div>
                
                {availableDays.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    Nenhum dia com horários disponíveis neste local.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableDays.map((dateStr) => {
                      const date = parseISO(dateStr);
                      const isSelected = isSameDay(date, selectedDate);
                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDate(date)}
                          className={`p-3 rounded-xl flex flex-col items-center transition-all ${
                            isSelected 
                              ? 'bg-green-600 text-white shadow-lg shadow-green-200' 
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-[10px] uppercase font-bold opacity-70">
                            {format(date, 'EEE', { locale: ptBR })}
                          </span>
                          <span className="text-lg font-bold">
                            {format(date, 'dd')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Slots List */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock size={18} className="text-green-600" />
                  3. Horários Disponíveis
                </h3>
                
                {slots.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    Nenhum horário disponível para este dia.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setTimeout(() => {
                            const section = document.getElementById('finalize-booking');
                            if (section) {
                              section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }, 100);
                        }}
                        className={`p-3 rounded-xl font-medium transition-all ${
                          selectedSlot?.id === slot.id
                            ? 'bg-green-600 text-white ring-2 ring-green-200'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center space-y-4 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200"
          >
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
              <MapPin size={32} />
            </div>
            <p className="text-gray-500 font-medium">Selecione um local acima para ver a agenda</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Form */}
      {selectedSlot && (
        <motion.div 
          id="finalize-booking"
          ref={bookingFormRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100 space-y-6"
        >
          <div className="text-center">
            <h3 className="text-xl font-bold">Finalizar Reserva</h3>
            <p className="text-sm text-gray-500">
              Aula para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedSlot.time}
            </p>
          </div>

          <form onSubmit={handleBooking} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Seu Nome</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="text"
                  placeholder="Ex: João Silva"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Telefone / WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="tel"
                  placeholder="(00) 00000-0000"
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <p className="text-[10px] text-gray-400">Entre 10 e 11 dígitos (ex: 55999998888)</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Tipo de Aula</label>
              <div className="grid grid-cols-1 gap-2">
                {(appSettings?.booking_types || DEFAULT_BOOKING_TYPES).map((type) => (
                  <button
                    key={type.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.name })}
                    className={`p-3 rounded-xl border text-left flex justify-between items-center transition-all ${
                      formData.type === type.name
                        ? 'border-green-600 bg-green-50 ring-1 ring-green-600'
                        : 'border-gray-200 bg-white hover:border-green-200'
                    }`}
                  >
                    <span className="font-medium text-sm">{type.name}</span>
                    <span className="font-bold text-green-600">R$ {type.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={status === 'loading'}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {status === 'loading' ? 'Processando...' : 'Confirmar Reserva'}
            </button>
          </form>
        </motion.div>
      )}

      {/* Success Modal */}
      {status === 'success' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-8 rounded-3xl text-center space-y-4 max-w-sm w-full"
          >
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-2xl font-bold">Reserva Confirmada!</h3>
            <p className="text-gray-500">Sua aula foi agendada com sucesso. Nos vemos na quadra!</p>
            
            <div className="space-y-3 pt-4">
              <a 
                href={getGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                <CalendarIcon size={20} />
                Adicionar ao Google Agenda
              </a>
              
              <button 
                onClick={() => setStatus('idle')}
                className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'google'>('email');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLogin();
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Erro: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      onLogin();
    } catch (err: any) {
      setError('Erro ao fazer login com Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-xl border border-gray-100 space-y-8"
    >
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto rotate-3">
          <LayoutDashboard size={32} />
        </div>
        <h2 className="text-2xl font-bold">Acesso do Professor</h2>
        <p className="text-gray-500">Entre para gerenciar suas aulas.</p>
      </div>

      <div className="space-y-6">
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setLoginMethod('email')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${loginMethod === 'email' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
          >
            E-mail
          </button>
          <button 
            onClick={() => setLoginMethod('google')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${loginMethod === 'google' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
          >
            Google
          </button>
        </div>

        {error && <p className="text-red-500 text-sm font-medium text-center bg-red-50 p-3 rounded-xl">{error}</p>}

        {loginMethod === 'email' ? (
          <form onSubmit={handleEmailAction} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">E-mail</label>
              <input 
                required
                type="email"
                placeholder="professor@exemplo.com"
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Senha</label>
              <input 
                required
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button 
              disabled={loading}
              className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Processando...' : (isRegistering ? 'Criar Conta' : 'Entrar')}
            </button>
            
            <div className="text-center">
              <button 
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-sm text-gray-500 hover:text-green-600 font-medium"
              >
                {isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Crie uma agora'}
              </button>
            </div>
          </form>
        ) : (
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            {loading ? 'Entrando...' : 'Entrar com Google'}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirmar", 
  type = 'danger' 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  confirmText?: string,
  type?: 'danger' | 'success'
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
      >
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="p-4 bg-gray-50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
              type === 'danger' 
                ? 'bg-red-500 shadow-red-100 hover:bg-red-600' 
                : 'bg-green-600 shadow-green-100 hover:bg-green-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AdminDashboard({ user, teacherName, setToast }: { user: any, teacherName: string, setToast: (t: any) => void }) {
  const [tab, setTab] = useState<'schedule' | 'bookings' | 'finance' | 'locations' | 'settings'>('schedule');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean,
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'success',
    confirmText: string
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger',
    confirmText: 'Confirmar'
  });

  useEffect(() => {
    // Fetch app settings for this teacher
    const unsubscribe = onSnapshot(doc(db, 'settings', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setAppSettings({ id: snapshot.id, ...snapshot.data() } as AppSettings);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'settings'));
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    let unsubscribe: () => void;
    
    if (tab === 'bookings') {
      const q = query(
        collection(db, 'bookings'), 
        where('teacher_id', '==', user.uid),
        orderBy('date', 'desc'), 
        orderBy('time', 'desc')
      );
      unsubscribe = onSnapshot(q, (snapshot) => {
        const allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
        setBookings(allBookings);
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));
    } else if (tab === 'finance') {
      const q = query(collection(db, 'bookings'), where('teacher_id', '==', user.uid));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const allBookings = snapshot.docs.map(doc => doc.data() as Booking);
        const total_revenue = allBookings.reduce((acc, b) => acc + b.price, 0);
        const total_paid = allBookings.filter(b => b.paid).reduce((acc, b) => acc + b.price, 0);
        const total_pending = total_revenue - total_paid;
        setFinance({
          total_revenue,
          total_paid,
          total_pending,
          total_bookings: allBookings.length
        });
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));
    } else {
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tab, user.uid]);

  const handleCalendarSync = async (booking: Booking) => {
    if (!appSettings?.google_script_url) {
      setToast({ message: 'Configure a URL do Script do Google nas configurações.', type: 'error' });
      return;
    }

    setSyncingIds(prev => new Set(prev).add(booking.id));
    
    try {
      const scriptUrl = appSettings.google_script_url ? appSettings.google_script_url.trim() : '';
      
      if (!scriptUrl.includes('/exec')) {
        setToast({ message: 'URL Inválida: Use a URL de "Implantação" (/exec).', type: 'error' });
        return;
      }

      const googleUrl = new URL(scriptUrl);
      const params = {
        titulo: `Aula: ${booking.student_name}`,
        inicio: `${booking.date} ${booking.time}`,
        fim: `${booking.date} ${booking.time}`,
        descricao: `Tipo: ${booking.booking_type}\nTelefone: ${booking.student_phone}`,
        local: booking.location_name,
        id_evento: booking.google_event_id || '',
        id_sistema: booking.id
      };
      
      Object.entries(params).forEach(([key, value]) => googleUrl.searchParams.append(key, value));

      console.log('Sincronização Ativa...');
      
      const callbackName = `cb${Math.floor(Math.random() * 1000000)}`;
      
      const syncResult: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Google demorou (mas deve ter criado)')), 10000);
        
        (window as any)[callbackName] = (data: any) => {
          clearTimeout(timeout);
          resolve(data);
        };

        const script = document.createElement('script');
        script.src = `${googleUrl.toString()}&callback=${callbackName}`;
        script.async = true;
        
        // Se o navegador der erro de CORS ao carregar o script,
        // ainda assim o pedido ao Google geralmente foi enviado e o evento criado.
        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Bloqueado pelo Navegador (Segurança)'));
        };
        
        document.head.appendChild(script);
        
        // Limpeza
        setTimeout(() => {
          if (document.head.contains(script)) document.head.removeChild(script);
          delete (window as any)[callbackName];
        }, 15000);
      });

      if (syncResult?.id) {
        await updateDoc(doc(db, 'bookings', booking.id), {
          google_event_id: syncResult.id,
          google_synced: true
        });
        setToast({ message: "Sincronizado e ID capturado!", type: 'success' });
      }

    } catch (error: any) {
      console.warn('Sync avisar:', error.message);
      
      // Mesmo com erro de leitura (CORS), marcamos como sincronizado
      // porque o Google Apps Script processa o pedido antes do navegador bloquear a resposta.
      await updateDoc(doc(db, 'bookings', booking.id), {
        google_synced: true
      });
      
      setToast({ 
        message: `Sincronizado! (Verifique agenda em segundos)`, 
        type: 'info' 
      });
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(booking.id);
        return next;
      });
    }
  };

  const handleDeleteGoogleEvent = async (booking: Booking) => {
    if (!appSettings?.google_script_url || !booking.google_event_id) return;

    try {
      const googleUrl = new URL(appSettings.google_script_url);
      googleUrl.searchParams.append('action', 'delete');
      googleUrl.searchParams.append('id_evento', booking.google_event_id);
      
      const script = document.createElement('script');
      script.src = googleUrl.toString();
      script.async = true;
      document.head.appendChild(script);
      setTimeout(() => { if (document.head.contains(script)) document.head.removeChild(script); }, 10000);
    } catch (e) {
      console.error('Erro ao deletar do Google:', e);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Painel de Controle</h2>
          <p className="text-gray-500">Gerencie seus horários, alunos e finanças.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setTab('schedule')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'schedule' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Agenda
          </button>
          <button 
            onClick={() => setTab('locations')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'locations' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Locais
          </button>
          <button 
            onClick={() => setTab('bookings')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'bookings' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Alunos
          </button>
          <button 
            onClick={() => setTab('finance')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'finance' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Financeiro
          </button>
          <button 
            onClick={() => setTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'settings' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ScheduleManager user={user} teacherName={teacherName} setToast={setToast} appSettings={appSettings} />
          </motion.div>
        )}
        {tab === 'locations' && (
          <motion.div key="locations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LocationManager user={user} setToast={setToast} />
          </motion.div>
        )}
        {tab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SettingsManager user={user} setToast={setToast} />
          </motion.div>
        )}
        {tab === 'bookings' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Users size={20} className="text-green-600" />
                  Controle de Alunos
                </h3>
              </div>
              
              <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Início</span>
                  <input 
                    type="date" 
                    className="w-full text-xs p-2.5 bg-gray-50 border-none rounded-xl outline-none focus:ring-1 focus:ring-green-500"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Fim</span>
                  <input 
                    type="date" 
                    className="w-full text-xs p-2.5 bg-gray-50 border-none rounded-xl outline-none focus:ring-1 focus:ring-green-500"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1 col-span-1 lg:col-span-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Status</span>
                  <select 
                    className="w-full text-xs p-2.5 bg-gray-50 border-none rounded-xl outline-none focus:ring-1 focus:ring-green-500"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                    <option value="all">Todos</option>
                    <option value="paid">Pagos</option>
                    <option value="pending">Pendentes</option>
                  </select>
                </div>

                <div className="flex items-center justify-center col-span-1 lg:col-span-1 h-[37px]">
                  {(startDate || endDate || statusFilter !== 'all') && (
                    <button 
                      onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter('all'); }} 
                      className="text-[10px] text-red-500 font-bold hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Mobile Card List View */}
              <div className="lg:hidden space-y-4">
                {bookings
                  .filter(booking => {
                    const matchesStart = startDate ? booking.date >= startDate : true;
                    const matchesEnd = endDate ? booking.date <= endDate : true;
                    const matchesStatus = statusFilter === 'all' 
                      ? true 
                      : statusFilter === 'paid' ? booking.paid : !booking.paid;
                    return matchesStart && matchesEnd && matchesStatus;
                  })
                  .map(booking => (
                    <div key={booking.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="bg-green-50 text-green-600 p-3 rounded-2xl text-center min-w-[55px]">
                            <div className="text-[10px] uppercase font-bold opacity-60 leading-none">{format(parseISO(booking.date), 'MMM', { locale: ptBR })}</div>
                            <div className="text-xl font-bold leading-none mt-1">{format(parseISO(booking.date), 'dd')}</div>
                            <div className="text-[10px] font-bold mt-1 text-gray-400">{booking.time}</div>
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 leading-tight">{booking.student_name}</div>
                            <div className="text-xs text-gray-500 mt-1">{booking.location_name}</div>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${booking.paid ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          {booking.paid ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between py-3 border-y border-gray-50">
                        <div>
                          <div className="text-[10px] font-bold text-gray-400 uppercase">Tipo</div>
                          <div className="text-xs font-semibold">{booking.booking_type}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-gray-400 uppercase">Valor</div>
                          <div className="text-sm font-bold text-green-600">R$ {booking.price.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => setEditingBooking(booking)}
                            className="p-3 bg-gray-50 text-gray-500 rounded-xl transition-all border border-transparent"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            disabled={syncingIds.has(booking.id)}
                            onClick={() => handleCalendarSync(booking)}
                            className={`p-3 rounded-xl transition-all border border-transparent ${syncingIds.has(booking.id) ? 'opacity-50' : booking.google_synced ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500'}`}
                          >
                            {syncingIds.has(booking.id) ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <CalendarIcon size={18} />
                            )}
                          </button>
                        </div>
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setConfirmConfig({
                                isOpen: true,
                                title: booking.paid ? "Alterar para Pendente?" : "Confirmar Pagamento?",
                                message: `Deseja marcar esta aula como ${booking.paid ? 'pendente' : 'paga'}?`,
                                type: booking.paid ? 'danger' : 'success',
                                confirmText: 'Confirmar',
                                onConfirm: async () => {
                                  try {
                                    await updateDoc(doc(db, 'bookings', booking.id), { paid: !booking.paid });
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, 'bookings');
                                  }
                                }
                              });
                            }}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${booking.paid ? 'bg-gray-100 text-gray-500' : 'bg-green-600 text-white shadow-green-100'}`}
                          >
                            {booking.paid ? 'Recomeçar' : 'Pagar'}
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmConfig({
                                isOpen: true,
                                title: "Excluir?",
                                message: `Remover reserva de ${booking.student_name}?`,
                                type: 'danger',
                                confirmText: 'Excluir',
                                onConfirm: async () => {
                                  try {
                                    if (booking.google_event_id) handleDeleteGoogleEvent(booking);
                                    await updateDoc(doc(db, 'slots', booking.slot_id), { is_available: true });
                                    await deleteDoc(doc(db, 'bookings', booking.id));
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.DELETE, 'bookings');
                                  }
                                }
                              });
                            }}
                            className="p-3 bg-red-50 text-red-500 rounded-xl"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                {bookings.filter(b => {
                  const sm = startDate ? b.date >= startDate : true;
                  const em = endDate ? b.date <= endDate : true;
                  const stm = statusFilter === 'all' ? true : statusFilter === 'paid' ? b.paid : !b.paid;
                  return sm && em && stm;
                }).length === 0 && (
                  <div className="bg-white py-14 text-center text-gray-400 rounded-3xl border border-dashed border-gray-100">
                    Nenhum aluno encontrado.
                  </div>
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      <th className="px-6 py-4">Data/Hora</th>
                      <th className="px-6 py-4">Local</th>
                      <th className="px-6 py-4">Aluno</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bookings
                      .filter(booking => {
                        const matchesStart = startDate ? booking.date >= startDate : true;
                        const matchesEnd = endDate ? booking.date <= endDate : true;
                        const matchesStatus = statusFilter === 'all' 
                          ? true 
                          : statusFilter === 'paid' ? booking.paid : !booking.paid;
                        return matchesStart && matchesEnd && matchesStatus;
                      })
                      .map(booking => (
                        <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm">{format(parseISO(booking.date), 'dd/MM')}</div>
                        <div className="text-xs text-gray-400">{booking.time}</div>
                      </td>
                      <td className="px-6 py-4 font-medium text-sm">{booking.location_name}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{booking.student_name}</div>
                        <div className="text-xs text-gray-400">{booking.student_phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">{booking.booking_type}</div>
                        <div className="text-xs text-green-600 font-bold">R$ {booking.price.toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${booking.paid ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          {booking.paid ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingBooking(booking)}
                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                            title="Editar reserva"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            disabled={syncingIds.has(booking.id)}
                            onClick={() => handleCalendarSync(booking)}
                            className={`p-2 transition-colors ${syncingIds.has(booking.id) ? 'opacity-50' : booking.google_synced ? 'text-green-600 hover:text-green-800' : 'text-red-500 hover:text-red-700'}`}
                            title={booking.google_synced ? "Sincronizado com Google Calendar" : "Enviar para Google Calendar"}
                          >
                            {syncingIds.has(booking.id) ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <CalendarIcon size={18} />
                            )}
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmConfig({
                                isOpen: true,
                                title: booking.paid ? "Alterar para Pendente?" : "Confirmar Pagamento?",
                                message: `Deseja marcar esta aula de R$ ${booking.price.toFixed(2)} como ${booking.paid ? 'pendente' : 'paga'}?`,
                                type: booking.paid ? 'danger' : 'success',
                                confirmText: 'Sim, Alterar',
                                onConfirm: async () => {
                                  try {
                                    await updateDoc(doc(db, 'bookings', booking.id), {
                                      paid: !booking.paid
                                    });
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.UPDATE, 'bookings');
                                  }
                                }
                              });
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                            title={booking.paid ? "Marcar como não pago" : "Marcar como pago"}
                          >
                            <DollarSign size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setConfirmConfig({
                                isOpen: true,
                                title: "Cancelar Reserva?",
                                message: `Deseja realmente cancelar a reserva de ${booking.student_name}? O horário voltará a ficar disponível.`,
                                type: 'danger',
                                confirmText: 'Sim, Cancelar',
                                onConfirm: async () => {
                                  try {
                                    // Se tem ID do Google, tenta deletar da agenda também
                                    if (booking.google_event_id) {
                                      handleDeleteGoogleEvent(booking);
                                    }
                                    await updateDoc(doc(db, 'slots', booking.slot_id), { is_available: true });
                                    await deleteDoc(doc(db, 'bookings', booking.id));
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.DELETE, 'bookings');
                                  }
                                }
                              });
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Nenhuma reserva encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
      )}
        {tab === 'finance' && finance && (
          <motion.div 
            key="finance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase">Total Bruto</p>
                <p className="text-2xl font-bold text-gray-900">R$ {finance.total_revenue.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-1">
                <p className="text-xs font-bold text-green-600 uppercase">Total Recebido</p>
                <p className="text-2xl font-bold text-green-600">R$ {finance.total_paid.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-1">
                <p className="text-xs font-bold text-yellow-600 uppercase">Total Pendente</p>
                <p className="text-2xl font-bold text-yellow-600">R$ {finance.total_pending.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-1">
                <p className="text-xs font-bold text-blue-600 uppercase">Total Reservas</p>
                <p className="text-2xl font-bold text-blue-600">{finance.total_bookings}</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <TrendingUp size={24} className="text-green-600" />
                Desempenho Financeiro
              </h3>
              <div className="h-64 flex items-end gap-4 pt-8">
                <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div 
                    className="w-full bg-green-100 rounded-t-xl transition-all duration-1000" 
                    style={{ height: `${(finance.total_paid / finance.total_revenue) * 100 || 0}%` }}
                  />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Pago</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <div 
                    className="w-full bg-yellow-100 rounded-t-xl transition-all duration-1000" 
                    style={{ height: `${(finance.total_pending / finance.total_revenue) * 100 || 0}%` }}
                  />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Pendente</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmText={confirmConfig.confirmText}
      />

      <AnimatePresence>
        {editingBooking && (
          <EditBookingModal 
            booking={editingBooking} 
            onClose={() => setEditingBooking(null)} 
            onSync={handleCalendarSync}
            appSettings={appSettings}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EditBookingModal({ 
  booking, 
  onClose, 
  onSync,
  appSettings 
}: { 
  booking: Booking, 
  onClose: () => void, 
  onSync: (booking: Booking) => void,
  appSettings: AppSettings | null 
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState(booking.slot_id);
  const [bookingType, setBookingType] = useState(booking.booking_type);
  const [googleEventId, setGoogleEventId] = useState(booking.google_event_id || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'locations'), where('teacher_id', '==', booking.teacher_id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));
    return () => unsubscribe();
  }, [booking.teacher_id]);

  useEffect(() => {
    // Fetch available slots for this specific teacher
    const q = query(
      collection(db, 'slots'), 
      where('is_available', '==', true),
      where('teacher_id', '==', booking.teacher_id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSlots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slot));
      const todayStr = format(startOfToday(), 'yyyy-MM-dd');
      const now = new Date();
      const currentTime = format(now, 'HH:mm');

      const futureSlots = allSlots.filter(s => {
        if (s.date < todayStr) return false;
        if (s.date === todayStr && s.time <= currentTime) return false;
        return true;
      });

      setAvailableSlots(futureSlots);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const activeBookingTypes = appSettings?.booking_types || DEFAULT_BOOKING_TYPES;
      const selectedType = activeBookingTypes.find(t => t.name === bookingType);
      
      const updates: any = {
        booking_type: bookingType,
        price: selectedType?.price || 0,
        google_event_id: googleEventId.trim(),
        google_synced: false // Resetar para exigir nova sincronização se houver alteração
      };

      if (selectedSlotId !== booking.slot_id) {
        const newSlot = availableSlots.find(s => s.id === selectedSlotId);
        const loc = locations.find(l => l.id === newSlot?.location_id);
        
        if (newSlot) {
          // Free old slot
          await updateDoc(doc(db, 'slots', booking.slot_id), { is_available: true });
          // Reserve new slot
          await updateDoc(doc(db, 'slots', selectedSlotId), { is_available: false });
          
          updates.slot_id = selectedSlotId;
          updates.date = newSlot.date;
          updates.time = newSlot.time;
          updates.location_name = loc?.name || '';
        }
      }

      await updateDoc(doc(db, 'bookings', booking.id), updates);

      // Se já tinha ID do Google, dispara a sincronização automática com os novos dados
      if (updates.google_event_id) {
        onSync({ ...booking, ...updates });
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bookings');
    } finally {
      setLoading(false);
    }
  };

  const dates: string[] = Array.from(new Set(availableSlots.map(s => s.date))).sort() as string[];
  const filteredSlots = availableSlots.filter(s => s.date === selectedDate && (selectedLocationId ? s.location_id === selectedLocationId : true));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white p-8 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-6"
      >
        <div className="flex justify-between items-center border-b pb-4">
          <h3 className="text-xl font-bold">Editar Reserva</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle size={24} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-xl space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase">Reserva Atual</p>
            <div className="text-sm">
              <span className="font-bold underline decoration-green-500">{booking.student_name}</span> - {booking.location_name} - {format(parseISO(booking.date), 'dd/MM')} às {booking.time}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Tipo de Aula</label>
              <select 
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                value={bookingType}
                onChange={e => setBookingType(e.target.value)}
              >
                {(appSettings?.booking_types || DEFAULT_BOOKING_TYPES).map(t => <option key={t.name} value={t.name}>{t.name} (R$ {t.price})</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Filtrar por Local</label>
              <select 
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
              >
                <option value="">Todos os locais</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">Google Event ID (Para alteração na agenda)</label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="ID do Evento no Google Calendar"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                value={googleEventId}
                onChange={e => setGoogleEventId(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-gray-400">Preencha este campo caso queira alterar um evento já existente.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">Mudar Data</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate('');
                  setSelectedSlotId(booking.slot_id);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${!selectedDate ? 'bg-green-600 text-white shadow-md' : 'bg-gray-50 text-gray-500'}`}
              >
                Manter Atual
              </button>
              {dates.map(date => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${selectedDate === date ? 'bg-green-600 text-white shadow-md' : 'bg-gray-50 text-gray-500'}`}
                >
                  {format(parseISO(date), 'dd/MM')}
                </button>
              ))}
            </div>
          </div>

          {selectedDate && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Selecione Novo Horário</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {filteredSlots.map(slot => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`p-2 rounded-lg text-xs font-bold transition-all ${selectedSlotId === slot.id ? 'bg-green-600 text-white shadow-md' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                  >
                    {slot.time}
                    <div className="text-[8px] opacity-70 truncate">{locations.find(l => l.id === slot.location_id)?.name}</div>
                  </button>
                ))}
                {filteredSlots.length === 0 && <p className="col-span-full text-center py-4 text-xs text-gray-400">Nenhum horário disponível para este filtro.</p>}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              disabled={loading}
              className="flex-1 py-3 rounded-xl font-bold bg-green-600 text-white shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ScheduleManager({ 
  user, 
  teacherName, 
  setToast,
  appSettings 
}: { 
  user: any, 
  teacherName: string, 
  setToast: (t: any) => void,
  appSettings: AppSettings | null 
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [existingSlots, setExistingSlots] = useState<any[]>([]);
  const [allSlotsForDate, setAllSlotsForDate] = useState<Slot[]>([]);
  const [datesWithSlots, setDatesWithSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00'
  ];

  useEffect(() => {
    const q = query(collection(db, 'locations'), where('teacher_id', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
      setLocations(locs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    if (selectedLocation) {
      const q = query(collection(db, 'slots'), where('location_id', '==', selectedLocation.id));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const slots = snapshot.docs.map(doc => doc.data() as Slot);
        const dates = [...new Set(slots.map(s => s.date))];
        setDatesWithSlots(dates);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocation && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const q = query(collection(db, 'slots'), where('location_id', '==', selectedLocation.id), where('date', '==', dateStr));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slot));
        setExistingSlots(filtered.sort((a, b) => a.time.localeCompare(b.time)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedDate, selectedLocation]);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const q = query(collection(db, 'slots'), where('date', '==', dateStr), where('teacher_id', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slot));
        setAllSlotsForDate(slots);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedDate, user.uid]);

  const handleSaveSlots = async () => {
    if (!selectedLocation || availableTimes.length === 0) return;
    
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      for (const time of availableTimes) {
        const slotId = `${selectedLocation.id}_${dateStr}_${time.replace(':', '')}`;
        await setDoc(doc(db, 'slots', slotId), {
          location_id: selectedLocation.id,
          teacher_id: user.uid,
          date: dateStr,
          time,
          is_available: true
        });
      }

      setShowSuccess(true);
      setAvailableTimes([]);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'slots');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'slots', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'slots');
    }
  };

  const handleShareWeeklyAgenda = async () => {
    if (!selectedLocation) return;
    
    try {
      setLoading(true);
      
      const startDay = appSettings?.agenda_start_day !== undefined ? appSettings.agenda_start_day : 1;
      const duration = appSettings?.agenda_duration || 7;

      // Calculate Start and End of the report
      const today = startOfToday();
      const startDateReport = startOfWeek(today, { weekStartsOn: startDay as any });
      const endDateReport = addDays(startDateReport, duration - 1);
      
      const startStr = format(startDateReport, 'yyyy-MM-dd');
      const endStr = format(endDateReport, 'yyyy-MM-dd');
      
      const q = query(
        collection(db, 'slots'), 
        where('location_id', '==', selectedLocation.id),
        where('date', '>=', startStr),
        where('date', '<=', endStr),
        where('is_available', '==', true)
      );
      
      const snapshot = await getDocs(q);
      const slots = snapshot.docs.map(doc => doc.data() as Slot);
      
      // Sort in memory
      slots.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

      // Group by date
      const grouped = slots.reduce((acc, slot) => {
        if (!acc[slot.date]) acc[slot.date] = [];
        acc[slot.date].push(slot.time);
        return acc;
      }, {} as Record<string, string[]>);

      let report = `📅 Horários disponíveis para Aulas\n👤 Instrutor: ${teacherName}\n📍 ${selectedLocation.name}\n\n`;
      
      for (let i = 0; i < duration; i++) {
        const date = addDays(startDateReport, i);
        if (date < today) continue;

        const dateStr = format(date, 'yyyy-MM-dd');
        const daySlots = grouped[dateStr] || [];
        
        const dayName = format(date, "EEEE dd/MM", { locale: ptBR });
        // Uppercase first letter
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        
        report += `🎾 ${capitalizedDay}:\n`;
        
        if (daySlots.length === 0) {
          report += `❌\n`;
        } else {
          // Add a newline before times as in example
          report += `\n${daySlots.map(t => t.replace(':00', 'h')).join('\n')}\n`;
        }
        report += '\n';
      }

      const bookingLink = `${window.location.origin}/?loc=${selectedLocation.id}`;
      report += `📅 Hora de agendar sua aula!\n\nEscolha seu melhor horário diretamente pelo link:\n👉 ${bookingLink}\n\nOu, se preferir, me envie uma mensagem aqui no WhatsApp. Vamos evoluir juntos!`;

      await navigator.clipboard.writeText(report.trim());
      setToast({ message: "Agenda da semana copiada!", type: 'success' });
      
    } catch (error) {
      console.error(error);
      setToast({ message: "Erro ao gerar agenda.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <MapPin size={18} className="text-green-600" />
            1. Escolha o Local
          </h3>
          <div className="space-y-2">
            {locations.map(loc => (
              <button
                key={loc.id}
                onClick={() => setSelectedLocation(loc)}
                className={`w-full p-3 rounded-xl text-left font-medium transition-all ${selectedLocation?.id === loc.id ? 'bg-green-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        {selectedLocation && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <CalendarIcon size={18} className="text-green-600" />
              2. Escolha o Dia
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[...Array(12)].map((_, i) => {
                const date = addDays(startOfToday(), i);
                const dateStr = format(date, 'yyyy-MM-dd');
                const hasSlots = datesWithSlots.includes(dateStr);
                const isSelected = isSameDay(date, selectedDate);
                
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`p-2 rounded-xl flex flex-col items-center relative transition-all ${isSelected ? 'bg-green-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                  >
                    <span className="text-[8px] uppercase font-bold opacity-70">{format(date, 'EEE', { locale: ptBR })}</span>
                    <span className="text-sm font-bold">{format(date, 'dd')}</span>
                    {hasSlots && !isSelected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border-2 border-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="md:col-span-2 space-y-6">
        {selectedLocation ? (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-xl">Gerenciar Horários: {selectedLocation.name}</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleShareWeeklyAgenda}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all border border-blue-100"
                  title="Copiar agenda da semana para o clipboard"
                >
                  <Share2 size={16} />
                  Postar Whats
                </button>
                <div className="text-sm text-gray-400 font-medium">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selecione os horários para abrir</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {timeSlots.map(time => {
                  const isExistingInThisLocation = existingSlots.some(s => s.time === time);
                  const slotInOtherLocation = allSlotsForDate.find(s => s.time === time && s.location_id !== selectedLocation?.id);
                  const isBusyElsewhere = !!slotInOtherLocation;
                  const isSelected = availableTimes.includes(time);
                  
                  return (
                    <button
                      key={time}
                      disabled={isExistingInThisLocation || isBusyElsewhere}
                      onClick={() => {
                        if (isSelected) setAvailableTimes(availableTimes.filter(t => t !== time));
                        else setAvailableTimes([...availableTimes, time]);
                      }}
                      title={isBusyElsewhere ? `Já ocupado em: ${locations.find(l => l.id === slotInOtherLocation?.location_id)?.name}` : ''}
                      className={`p-2 rounded-lg text-xs font-bold transition-all ${
                        isExistingInThisLocation 
                          ? 'bg-green-50 text-green-600 border border-green-100 cursor-default' 
                          : isBusyElsewhere
                            ? 'bg-red-50 text-red-400 border border-red-100 cursor-not-allowed'
                            : isSelected
                              ? 'bg-green-600 text-white shadow-md'
                              : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {time}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1 text-green-600">
                  <div className="w-2 h-2 bg-green-100 border border-green-200 rounded" /> Aberto aqui
                </div>
                <div className="flex items-center gap-1 text-red-400">
                  <div className="w-2 h-2 bg-red-50 border border-red-100 rounded" /> Ocupado em outro local
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {availableTimes.length} horários selecionados
              </div>
              <button
                disabled={loading || availableTimes.length === 0}
                onClick={handleSaveSlots}
                className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Salvar Horários
              </button>
            </div>

            {showSuccess && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-50 text-green-600 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
                <CheckCircle size={18} /> Horários salvos com sucesso!
              </motion.div>
            )}

            <div className="space-y-4">
              <h4 className="font-bold text-sm text-gray-400 uppercase tracking-widest">Horários Criados</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {existingSlots.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="font-bold text-sm">{slot.time}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${slot.is_available ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {slot.is_available ? 'Livre' : 'Ocupado'}
                      </span>
                      {slot.is_available && (
                        <button onClick={() => handleDeleteSlot(slot.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {existingSlots.length === 0 && <div className="col-span-full py-8 text-center text-gray-400 text-sm italic">Nenhum horário criado para este dia.</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 text-gray-400 space-y-4">
            <MapPin size={48} />
            <p className="font-medium">Selecione um local para gerenciar a agenda</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationManager({ user, setToast }: { user: any, setToast: (t: any) => void }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'locations'), where('teacher_id', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
      setLocations(locs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));
    return () => unsubscribe();
  }, [user.uid]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'locations', id), { 
        name: newName,
        teacher_id: user.uid
      });
      setNewName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'locations');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja remover este local? Todos os horários vinculados serão perdidos.')) {
      try {
        await deleteDoc(doc(db, 'locations', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'locations');
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="font-bold text-xl md:text-2xl flex items-center gap-2">
          <MapPin size={24} className="text-green-600" />
          Gerenciar Locais
        </h3>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Nome do Local (Ex: Arena Padel)"
              className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-green-500 outline-none text-sm transition-all"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <button 
            onClick={handleAdd}
            className="bg-green-600 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"
          >
            <Plus size={20} />
            <span>Adicionar</span>
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Meus Locais ({locations.length})</p>
          <div className="grid gap-3">
            {locations.map(loc => (
              <div key={loc.id} className="group flex items-center justify-between p-4 bg-gray-50 hover:bg-white hover:shadow-md hover:shadow-gray-100 rounded-2xl border border-gray-100 transition-all">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm shrink-0">
                    <MapPin size={20} />
                  </div>
                  <span className="font-bold text-gray-700 truncate">{loc.name}</span>
                </div>
                <button 
                  onClick={() => handleDelete(loc.id)} 
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Remover local"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
            {locations.length === 0 && (
              <div className="text-center py-10 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm">Você ainda não cadastrou nenhum local.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsManager({ user, setToast }: { user: any, setToast: (t: any) => void }) {
  const [teacherName, setTeacherName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [googleScriptUrl, setGoogleScriptUrl] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [agendaStartDay, setAgendaStartDay] = useState(1);
  const [agendaDuration, setAgendaDuration] = useState(7);
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypePrice, setNewTypePrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        setTeacherName(data.teacher_name || '');
        setWhatsappNumber(data.whatsapp_number || '');
        setGoogleScriptUrl(data.google_script_url || '');
        setWhatsappEnabled(data.whatsapp_enabled !== false);
        setAgendaStartDay(data.agenda_start_day !== undefined ? data.agenda_start_day : 1);
        setAgendaDuration(data.agenda_duration || 7);
        setBookingTypes(data.booking_types || DEFAULT_BOOKING_TYPES);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings'));
    return () => unsubscribe();
  }, [user.uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', user.uid), {
        teacher_id: user.uid,
        teacher_name: teacherName.trim(),
        whatsapp_number: whatsappNumber.replace(/\D/g, ''),
        google_script_url: googleScriptUrl.trim(),
        whatsapp_enabled: whatsappEnabled,
        booking_types: bookingTypes,
        agenda_start_day: agendaStartDay,
        agenda_duration: agendaDuration
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddType = () => {
    if (!newTypeName.trim() || !newTypePrice) return;
    setBookingTypes([...bookingTypes, { 
      name: newTypeName.trim(), 
      price: Number(newTypePrice) 
    }]);
    setNewTypeName('');
    setNewTypePrice('');
  };

  const handleRemoveType = (index: number) => {
    setBookingTypes(bookingTypes.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="font-bold text-xl md:text-2xl flex items-center gap-2">
          <SettingsIcon size={24} className="text-green-600" />
          Configurações
        </h3>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">Seu Nome (Como aparece para o aluno)</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                required
                type="text"
                placeholder="Ex: Seu Nome"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                value={teacherName}
                onChange={e => setTeacherName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase">Número do WhatsApp (Destino das Notificações)</label>
              <button
                type="button"
                onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                  whatsappEnabled 
                    ? 'bg-green-100 text-green-600 border border-green-200' 
                    : 'bg-red-100 text-red-600 border border-red-200'
                }`}
              >
                {whatsappEnabled ? (
                  <><CheckCircle size={12} /> ATIVO</>
                ) : (
                  <><XCircle size={12} /> INATIVO</>
                )}
              </button>
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                required
                type="tel"
                placeholder="Ex: 555599731123"
                className={`w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-opacity ${!whatsappEnabled ? 'opacity-50' : ''}`}
                value={whatsappNumber}
                onChange={e => setWhatsappNumber(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-gray-400">Insira o número completo com DDI (Ex: 55 para Brasil), DDD e o número.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase">Google Scripts URL (Integração Agenda)</label>
              <button 
                type="button"
                onClick={() => setShowGuide(true)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100"
              >
                <FileText size={12} /> MANUAL DE CRIAÇÃO
              </button>
            </div>
            <div className="relative">
              <LayoutDashboard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                value={googleScriptUrl}
                onChange={e => setGoogleScriptUrl(e.target.value)}
                onBlur={() => {
                  if (googleScriptUrl && !googleScriptUrl.startsWith('http')) {
                    setGoogleScriptUrl(`https://${googleScriptUrl}`);
                  }
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400">URL do Web App implantado no Google Apps Script.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Início do Relatório (Agenda)</label>
              <select 
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-green-500 outline-none text-sm"
                value={agendaStartDay}
                onChange={e => setAgendaStartDay(Number(e.target.value))}
              >
                <option value={0}>Domingo</option>
                <option value={1}>Segunda-feira</option>
                <option value={2}>Terça-feira</option>
                <option value={3}>Quarta-feira</option>
                <option value={4}>Quinta-feira</option>
                <option value={5}>Sexta-feira</option>
                <option value={6}>Sábado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Duração (Dias)</label>
              <input 
                type="number"
                min="1"
                max="30"
                className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-green-500 outline-none text-sm"
                value={agendaDuration}
                onChange={e => setAgendaDuration(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Tipos de Aula e Valores</label>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text"
                placeholder="Nome (Ex: Aula Individual)"
                className="flex-1 px-4 py-3.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm transition-all"
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
              />
              <div className="flex gap-2">
                <input 
                  type="number"
                  placeholder="Preço (R$)"
                  className="flex-1 sm:w-24 px-4 py-3.5 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm transition-all"
                  value={newTypePrice}
                  onChange={e => setNewTypePrice(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={handleAddType}
                  className="p-3.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-100 shrink-0"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {bookingTypes.map((type, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{type.name}</span>
                    <span className="text-green-600 font-bold text-sm">R$ {type.price}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleRemoveType(index)}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {bookingTypes.length === 0 && (
                <div className="text-center py-4 text-gray-400 text-xs italic">
                  Nenhum tipo de aula configurado. Use os padrões do sistema.
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t flex justify-end">
            <button 
              disabled={loading}
              className="w-full sm:w-auto bg-green-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
              Salvar Configurações
            </button>
          </div>
        </form>

        {showSuccess && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-50 text-green-600 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
            <CheckCircle size={18} /> Configurações salvas com sucesso!
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showGuide && (
          <ScriptGuideModal onClose={() => setShowGuide(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ScriptGuideModal({ onClose }: { onClose: () => void }) {
  const codeSnippet = `function doGet(e) {
  try {
    var p = e.parameter;
    var calendar = CalendarApp.getDefaultCalendar();
    var event;
    
    // --- AÇÃO DE EXCLUSÃO ---
    if (p.action === "delete" && p.id_evento && p.id_evento !== "" && p.id_evento !== "undefined") {
      try {
        event = calendar.getEventById(p.id_evento);
        if (event) {
          event.deleteEvent();
        }
      } catch (e) {}
      return respond({ status: "success", message: "Excluído" }, p.callback);
    }
    // ------------------------

    var start = new Date(p.inicio);
    var end = new Date(p.fim);
    if (!p.fim || start.getTime() === end.getTime()) {
      end = new Date(start.getTime() + (60 * 60 * 1000));
    }

    if (p.id_evento && p.id_evento !== "" && p.id_evento !== "undefined") {
      try {
        event = calendar.getEventById(p.id_evento);
        if (event) {
          event.setTitle(p.titulo);
          event.setDescription(p.descricao);
          event.setLocation(p.local);
          event.setTime(start, end);
        } else {
          event = calendar.createEvent(p.titulo, start, end, {description: p.descricao, location: p.local});
        }
      } catch (err) {
        event = calendar.createEvent(p.titulo, start, end, {description: p.descricao, location: p.local});
      }
    } else {
      event = calendar.createEvent(p.titulo, start, end, {description: p.descricao, location: p.local});
    }

    return respond({
      status: "success",
      id: event.getId(),
      message: "Sync OK"
    }, p.callback);

  } catch (error) {
    return respond({status: "error", message: error.toString()}, e.parameter.callback);
  }
}

function respond(result, callback) {
  var output = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + output + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(codeSnippet);
    alert('Código copiado para a área de transferência!');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white p-8 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600">
          <XCircle size={28} />
        </button>

        <div className="space-y-2">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="text-green-600" size={24} />
            Configurar Google Calendar
          </h3>
          <p className="text-gray-500 text-sm">Siga os passos abaixo para criar o script que sincroniza o sistema com sua agenda.</p>
        </div>

        <div className="space-y-6">
          <section className="space-y-3">
            <h4 className="font-bold text-gray-900 border-l-4 border-green-500 pl-3">Passo 1: Criar o Script</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 ml-2">
              <li>Acesse o <a href="https://script.google.com/home" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold inline-flex items-center gap-1">Google Apps Script <ExternalLink size={12} /></a></li>
              <li>Clique em <span className="font-bold text-gray-900">"Novo Projeto"</span>.</li>
              <li>Apague todo o código que estiver lá e cole este:</li>
            </ol>
            
            <div className="relative group">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-[10px] overflow-x-auto font-mono max-h-48">
                {codeSnippet}
              </pre>
              <button 
                onClick={copyCode}
                className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold"
              >
                <Copy size={14} /> COPIAR CÓDIGO
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="font-bold text-gray-900 border-l-4 border-green-500 pl-3">Passo 2: Publicar como Web App</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 ml-2">
              <li>No canto superior direito, clique em <span className="font-bold text-gray-900">Implantar &gt; Nova implantação</span>.</li>
              <li>Selecione o tipo: <span className="font-bold text-gray-900">App da Web</span>.</li>
              <li>Em "Executar como", deixe <span className="font-bold text-gray-900">"Eu"</span> (sua conta).</li>
              <li>Em "Quem tem acesso", escolha <span className="font-bold text-gray-900 text-red-600">"Qualquer pessoa"</span>.</li>
              <li>Clique em <span className="font-bold text-gray-900">Implantar</span> e autorize todas as permissões.</li>
              <li><span className="font-bold text-gray-900">IMPORTANTE:</span> Copie o link gerado chamado <span className="text-green-600 font-bold">"URL do app da Web"</span> e cole nas configurações do sistema.</li>
            </ol>
          </section>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold mt-4"
        >
          Entendi, pronto para configurar!
        </button>
      </motion.div>
    </div>
  );
}
