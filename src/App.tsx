/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import logo from './assets/boraprojogomenor.svg';
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
  PlusCircle,
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
  MessageCircle,
  ShoppingBag,
  Tag,
  Search,
  Filter,
  Package,
  Star,
  ShoppingBasket,
  ShieldCheck,
  ShieldAlert,
  Percent
} from 'lucide-react';
import { format, addDays, startOfToday, isSameDay, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Slot, Booking, FinanceSummary, Location, AppSettings, BookingType, Product } from './types';
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
  onSnapshot,
  limit,
  storage,
  ref,
  uploadString,
  getDownloadURL
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
  const [view, setView] = useState<'public' | 'login' | 'admin' | 'shop'>('public');
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTeacherName, setActiveTeacherName] = useState('');
  const [activeUserType, setActiveUserType] = useState<'professor' | 'court_owner' | null>(null);
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
      
      // Try to get teacher name from URL immediately
      const params = new URLSearchParams(window.location.search);
      const profFromUrl = params.get('prof');
      const hasLoc = params.has('loc');
      const hasProf = params.has('prof');
      const hasTid = params.has('tid');
      const hasBooking = params.has('b');

      if (profFromUrl) {
        setActiveTeacherName(profFromUrl);
      }
      
      // Hidden access via /admin or if already authenticated
      if (window.location.pathname === '/loja') {
        setView('shop');
      } else if ((currentUser || window.location.pathname === '/admin') && !hasLoc && !hasProf && !hasTid && !hasBooking) {
        setView(currentUser ? 'admin' : 'login');
      } else if (hasLoc || hasProf || hasTid || hasBooking) {
        setView('public');
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
          setActiveUserType(data.user_type || 'professor');
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
            className="flex items-center gap-2 sm:gap-3 overflow-hidden h-10 md:h-16 lg:h-20 transition-all" 
          >
            <img src={logo} alt="Logo" className="h-full w-auto object-contain" />
            
            {activeTeacherName && (
              <div className="flex items-center border-l sm:border-l-2 border-gray-100 pl-2 sm:pl-4 h-6 md:h-10 lg:h-12 mt-0.5 sm:mt-1">
                <h1 className="font-black text-[10px] md:text-lg lg:text-xl tracking-tight whitespace-nowrap overflow-hidden text-ellipsis uppercase">
                  {activeUserType === 'professor' ? 'Instrutor ' : ''}
                  <span className="text-green-600">{activeTeacherName}</span>
                </h1>
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-6 ml-8">
            <button 
              onClick={() => setView('shop')}
              className={`text-sm font-semibold transition-colors ${view === 'shop' ? 'text-green-600' : 'text-gray-500 hover:text-green-500'}`}
            >
              Loja
            </button>
          </div>
          
          <div className="flex gap-4 items-center">
            {!user && view !== 'login' && (
              <button 
                onClick={() => setView('shop')}
                className="md:hidden p-2 text-gray-500 hover:text-green-600 transition-colors"
                title="Loja"
              >
                <ShoppingBag size={20} />
              </button>
            )}
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
              <PublicBooking 
                onTeacherNameFetched={setActiveTeacherName} 
                onUserTypeFetched={setActiveUserType}
                setToast={setToast} 
              />
            </motion.div>
          )}
          {view === 'shop' && (
            <motion.div key="shop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Shop setToast={setToast} />
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
  onUserTypeFetched,
  setToast 
}: { 
  onTeacherNameFetched?: (name: string) => void,
  onUserTypeFetched?: (type: 'professor' | 'court_owner') => void,
  setToast: (t: any) => void
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [isStudentEditing, setIsStudentEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', type: 'Individual' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastBooking, setLastBooking] = useState<any>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const bookingFormRef = useRef<HTMLDivElement>(null);
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const hasLocParam = params.has('loc');
  const hasBookingParam = params.has('b');

  useEffect(() => {
    const bookingId = params.get('b');
    if (bookingId) {
      const fetchBooking = async () => {
        try {
          const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
          if (bookingDoc.exists()) {
            const bData = { id: bookingDoc.id, ...bookingDoc.data() } as Booking;
            setExistingBooking(bData);
            setIsStudentEditing(true);
            setFormData({
              name: bData.student_name,
              phone: bData.student_phone,
              type: bData.booking_type
            });
            // Fetch location to set everything up
            const locDoc = await getDoc(doc(db, 'locations', bData.location_id));
            if (locDoc.exists()) {
              setSelectedLocation({ id: locDoc.id, ...locDoc.data() } as Location);
            }
          }
        } catch (error) {
          console.error("Error fetching student booking:", error);
        }
      };
      fetchBooking();
    }
  }, [params]);

  useEffect(() => {
    if (selectedSlot) {
      setTimeout(() => {
        bookingFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedSlot]);

  useEffect(() => {
    const fetchLocations = async () => {
      const params = new URLSearchParams(window.location.search);
      let teacherId = params.get('tid'); // Mantido para compatibilidade
      const locId = params.get('loc');
      const profName = params.get('prof');

      // 1. Tenta achar o teacherId pelo ID do local (Mais seguro)
      if (!teacherId && locId) {
        try {
          const locDoc = await getDoc(doc(db, 'locations', locId));
          if (locDoc.exists()) {
            teacherId = locDoc.data().teacher_id;
          }
        } catch (error) {
          console.error("Erro ao buscar local inicial:", error);
        }
      }

      // 2. Se ainda não achou, tenta buscar pelo nome (prof=...)
      if (!teacherId && profName) {
        try {
          const q = query(collection(db, 'settings'), where('teacher_name', '==', profName), limit(1));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            teacherId = snapshot.docs[0].id;
          }
        } catch (error) {
          console.error("Erro ao buscar por nome:", error);
        }
      }

      // 3. Tenta buscar pelo ID da reserva (b=...)
      if (!teacherId && params.get('b')) {
        try {
          const bId = params.get('b') as string;
          const bDoc = await getDoc(doc(db, 'bookings', bId));
          if (bDoc.exists()) {
            teacherId = bDoc.data().teacher_id;
          }
        } catch (error) {
          console.error("Erro ao buscar por reserva:", error);
        }
      }

      if (teacherId) {
        const q = query(collection(db, 'locations'), where('teacher_id', '==', teacherId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
          setLocations(locs);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));
        return unsubscribe;
      } else {
        // Fallback: Busca todos apenas se não houver parâmetros (modo Admin ou link genérico)
        const unsubscribe = onSnapshot(collection(db, 'locations'), (snapshot) => {
          const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
          setLocations(locs);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));
        return unsubscribe;
      }
    };

    let unsubscribe: (() => void) | undefined;
    fetchLocations().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
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
          if (settings.user_type) {
            onUserTypeFetched?.(settings.user_type);
          }
        }
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'settings'));
      
      return () => settingsUnsubscribe();
    }
  }, [selectedLocation, onTeacherNameFetched]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locId = params.get('loc');
    const profName = params.get('prof');
    
    if (profName) {
      onTeacherNameFetched?.(profName);
    }

    if (locId && locations.length > 0) {
      const matched = locations.find(l => l.id === locId);
      if (matched) {
        setSelectedLocation(matched);
      }
    }
  }, [locations, onTeacherNameFetched]);

  useEffect(() => {
    if (selectedLocation) {
      const q = query(
        collection(db, 'slots'), 
        where('location_id', '==', selectedLocation.id)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allSlots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slot));
        const todayStr = format(startOfToday(), 'yyyy-MM-dd');
        const now = new Date();
        const currentTime = format(now, 'HH:mm');

        // Filter: available slots OR the one currently booked by this student
        const filterableSlots = allSlots.filter(s => {
          const isOwnSlot = isStudentEditing && existingBooking && s.id === existingBooking.slot_id;
          return s.is_available || isOwnSlot;
        });

        // Filter out past days and past times of today
        const futureSlots = filterableSlots.filter(s => {
          if (s.date < todayStr) return false;
          if (s.date === todayStr && s.time <= currentTime) return false;
          return true;
        });

        const days = [...new Set(futureSlots.map(s => s.date))].sort();
        setAvailableDays(days);
        
        if (days.length > 0 && (!selectedDate || !days.includes(format(selectedDate, 'yyyy-MM-dd')))) {
          // If we are editing, try to stay on the current date of the booking initially
          const bookingDate = existingBooking?.date;
          if (isStudentEditing && bookingDate && days.includes(bookingDate)) {
            setSelectedDate(parseISO(bookingDate));
          } else {
            setSelectedDate(parseISO(days[0]));
          }
        }
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedLocation, isStudentEditing, existingBooking]);

  useEffect(() => {
    if (selectedLocation && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const q = query(
        collection(db, 'slots'),
        where('location_id', '==', selectedLocation.id),
        where('date', '==', dateStr)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slot));
        const todayStr = format(startOfToday(), 'yyyy-MM-dd');
        const now = new Date();
        const currentTime = format(now, 'HH:mm');

        // Filter: available slots OR the one currently booked by this student
        const filterableSlots = filtered.filter(s => {
          const isOwnSlot = isStudentEditing && existingBooking && s.id === existingBooking.slot_id;
          return s.is_available || isOwnSlot;
        });

        const futureSlots = filterableSlots.filter(s => {
          if (s.date < todayStr) return false;
          if (s.date === todayStr && s.time <= currentTime) return false;
          return true;
        });
        
        setSlots(futureSlots.sort((a, b) => a.time.localeCompare(b.time)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedDate, selectedLocation, isStudentEditing, existingBooking]);

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

      if (isStudentEditing && existingBooking) {
        // 1. Libera o slot antigo
        await updateDoc(doc(db, 'slots', existingBooking.slot_id), { is_available: true });
        
        // 2. Reserva o novo slot
        await updateDoc(doc(db, 'slots', selectedSlot.id), { is_available: false });

        // 3. Atualiza a reserva
        const bookingData = {
          slot_id: selectedSlot.id,
          booking_type: formData.type,
          price: selectedType?.price || 0,
          date: dateStr,
          time: selectedSlot.time,
          location_name: selectedLocation?.name || '',
          location_id: selectedLocation?.id || ''
        };
        await updateDoc(doc(db, 'bookings', existingBooking.id), bookingData);

        const fullBooking = {
          ...existingBooking,
          ...bookingData,
          teacher_name: appSettings?.teacher_name || (appSettings?.user_type === 'court_owner' ? 'Responsável' : 'Seu Instrutor')
        };
        setLastBooking(fullBooking);
        setStatus('success');

        // Sincronização Automática com Google Calendar (se habilitado)
        if (appSettings?.google_script_url && existingBooking.google_event_id) {
          try {
            const scriptUrl = appSettings.google_script_url.trim();
            if (scriptUrl.includes('/exec')) {
              const googleUrl = new URL(scriptUrl);
              const eventLabel = (appSettings?.user_type === 'court_owner') ? 'Reserva' : 'Aula';
              const syncParams = {
                titulo: `${eventLabel} (${formData.type}): ${formData.name}`,
                inicio: `${dateStr} ${selectedSlot.time}`,
                fim: `${dateStr} ${selectedSlot.time}`,
                descricao: `Tipo: ${formData.type}\nTelefone: ${formData.phone}\n(Editado pelo Aluno)`,
                local: selectedLocation?.name || '',
                id_evento: existingBooking.google_event_id,
                id_sistema: existingBooking.id
              };
              
              Object.entries(syncParams).forEach(([key, value]) => googleUrl.searchParams.append(key, value));
              
              const callbackName = `cb${Math.floor(Math.random() * 1000000)}`;
              const script = document.createElement('script');
              script.src = `${googleUrl.toString()}&callback=${callbackName}`;
              script.async = true;
              (window as any)[callbackName] = () => {
                delete (window as any)[callbackName];
                if (document.head.contains(script)) document.head.removeChild(script);
              };
              document.head.appendChild(script);
            }
          } catch (syncError) {
            console.error('Erro na sincronização automática:', syncError);
          }
        }

        // Notificação de Edição via WhatsApp
        try {
          if (appSettings?.whatsapp_enabled !== false) {
            const instructorLabel = appSettings?.user_type === 'court_owner' ? 'Responsável' : 'Professor';
            const instructorName = appSettings?.teacher_name || '';
            const msg = `🎾 *Reserva Alterada pelo Aluno!*\n\n👤 *${instructorLabel}:* ${instructorName}\n📍 *Local:* ${selectedLocation?.name}\n📅 *Nova Data:* ${format(selectedDate, "dd/MM/yyyy")}\n⏰ *Novo Horário:* ${selectedSlot.time}\n👤 *Aluno:* ${formData.name}\n📞 *Contato:* ${formData.phone}\n📝 *Tipo:* ${formData.type}`;
            
            await fetch('https://bedinoto.uazapi.com/send/text', {
              method: 'POST',
              headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'token': 'a5fdab6f-0e1d-407c-aa4e-e6b44f935509' },
              body: JSON.stringify({ number: appSettings?.whatsapp_number || "555599731123", text: msg })
            });
          }
        } catch (e) { console.error(e); }

      } else {
        // Update slot availability
        await updateDoc(doc(db, 'slots', selectedSlot.id), {
          is_available: false
        });

        // Add booking
        const bookingId = Date.now().toString();
        const bookingData = {
          id: bookingId,
          slot_id: selectedSlot.id,
          teacher_id: selectedLocation?.teacher_id,
          student_name: formData.name,
          student_phone: formData.phone,
          booking_type: formData.type,
          price: selectedType?.price || 0,
          paid: false,
          date: dateStr,
          time: selectedSlot.time,
          location_name: selectedLocation?.name || '',
          location_id: selectedLocation?.id || '',
          user_type: appSettings?.user_type || 'professor'
        };

        await setDoc(doc(db, 'bookings', bookingId), bookingData);

        setLastBooking({
          ...bookingData,
          teacher_name: appSettings?.teacher_name || (appSettings?.user_type === 'court_owner' ? 'Responsável' : 'Seu Instrutor')
        });
        setStatus('success');

        // Send WhatsApp Notification
        try {
          if (appSettings?.whatsapp_enabled !== false) {
            const instructorLabel = appSettings?.user_type === 'court_owner' ? 'Responsável' : 'Nome';
            const instructorName = appSettings?.teacher_name || (appSettings?.user_type === 'court_owner' ? 'Responsável' : 'Nome');
            const bookingLabel = appSettings?.user_type === 'court_owner' ? 'Reserva de Quadra' : 'Reserva de Aula';
            const userLabel = appSettings?.user_type === 'court_owner' ? 'Cliente' : 'Aluno';
            
            const message = `🎾 *Nova ${bookingLabel}!*
            
👤 *${instructorLabel}:* ${instructorName}
📍 *Local:* ${selectedLocation?.name}
📅 *Data:* ${format(selectedDate, "dd/MM/yyyy")}
⏰ *Hora:* ${selectedSlot.time}
👤 *${userLabel}:* ${formData.name}
📞 *Contato:* ${formData.phone}
📝 *Categoria:* ${formData.type}`;

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
      }

      setSelectedSlot(null);
      if (!isStudentEditing) setFormData({ name: '', phone: '', type: 'Individual' });
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
    
    const eventUserType = lastBooking.user_type || 'professor';
    const eventTitle = eventUserType === 'court_owner' ? 'Reserva de Quadra' : 'Aula de Padel/Beach Tennis';
    const title = encodeURIComponent(`${eventTitle} (${lastBooking.booking_type}) - ${lastBooking.teacher_name}`);
    const dates = `${formatDate(startDate)}/${formatDate(endDate)}`;
    const userLabel = eventUserType === 'court_owner' ? 'Cliente' : 'Aluno';
    const contextLabel = eventUserType === 'court_owner' ? 'Locação' : 'Aulas';
    const details = encodeURIComponent(`Tipo: ${lastBooking.booking_type}\n${userLabel}: ${lastBooking.student_name}\n\nAgendado via App de ${contextLabel}.`);
    const location = encodeURIComponent(lastBooking.location_name);
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  };

  if (!hasLocParam && !hasBookingParam) {
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
            Parece que você acessou um link genérico. Cada profissional ou estabelecimento possui seu link personalizado.
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

  if (appSettings?.is_active === false) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-6">
        <div className="bg-red-50 p-6 rounded-full text-red-600">
          <ShieldAlert size={48} />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Agenda Indisponível</h2>
          <p className="text-gray-500">
            A agenda deste {appSettings?.user_type === 'court_owner' ? 'espaço' : 'instrutor'} está temporariamente desativada. 
            Por favor, tente novamente mais tarde.
          </p>
        </div>
      </div>
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
        <h2 className="text-3xl font-bold tracking-tight">
          {!appSettings ? (
            <div className="h-9 w-48 bg-gray-200 animate-pulse mx-auto rounded-lg"></div>
          ) : (
            appSettings.user_type === 'court_owner' 
              ? (isStudentEditing ? 'Alterar Reserva de Quadra' : 'Reserve sua Quadra') 
              : (isStudentEditing ? 'Alterar Reserva de Aula' : 'Reserve sua Aula')
          )}
        </h2>
        <p className="text-gray-500">
          {!appSettings ? (
            <div className="h-5 w-64 bg-gray-100 animate-pulse mx-auto rounded-md mt-2"></div>
          ) : (
            isStudentEditing && existingBooking 
              ? `Olá ${existingBooking.student_name}, escolha seu novo horário!`
              : appSettings.user_type === 'court_owner' 
                ? 'Escolha a quadra e o horário para o seu jogo!' 
                : 'Escolha o local e horário para começar a treinar!'
          )}
        </p>
      </div>

      {isStudentEditing && existingBooking && (
        <div className="max-w-2xl mx-auto bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4 shadow-sm">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
            <Edit2 size={24} />
          </div>
          <div>
            <h4 className="font-bold text-blue-900">Editando Reserva Atual</h4>
            <p className="text-sm text-blue-700 leading-relaxed">
              Sua reserva atual está marcada para <span className="font-bold">{format(parseISO(existingBooking.date), 'dd/MM/yyyy')} às {existingBooking.time}</span>. 
              Ao escolher um novo horário abaixo e confirmar, a vaga antiga será liberada automaticamente.
            </p>
          </div>
        </div>
      )}

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
              {appSettings?.user_type === 'court_owner' ? 'Horário para' : 'Aula para'} {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedSlot.time}
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
              <label className="text-xs font-bold text-gray-400 uppercase">Categoria</label>
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
              {status === 'loading' ? 'Processando...' : isStudentEditing ? 'Confirmar Alteração de Reserva' : 'Confirmar Reserva'}
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
            className="bg-white p-8 rounded-3xl text-center space-y-4 max-w-sm w-full shadow-2xl"
          >
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle size={40} />
            </div>
            <h3 className="text-2xl font-bold">
              {isStudentEditing ? 'Reserva Atualizada!' : 'Reserva Confirmada!'}
            </h3>
            <p className="text-gray-500 leading-relaxed">
              {isStudentEditing 
                ? 'Sua reserva foi alterada com sucesso. Já avisamos seu professor!' 
                : appSettings?.user_type === 'court_owner' 
                  ? 'Seu horário foi agendado com sucesso. Bom jogo!' 
                  : 'Sua aula foi agendada com sucesso. Nos vemos na quadra!'}
            </p>
            
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
      <div className="text-center space-y-4">
        <img src={logo} alt="Logo" className="h-24 w-auto mx-auto object-contain" />
        <h2 className="text-2xl font-bold">Área do Gestor</h2>
        <p className="text-gray-500">Entre para gerenciar sua agenda.</p>
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

function ManualBookingModal({ 
  user, 
  locations, 
  appSettings, 
  onClose, 
  setToast 
}: { 
  user: any, 
  locations: Location[], 
  appSettings: AppSettings | null, 
  onClose: () => void, 
  setToast: (t: any) => void 
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    student_name: '',
    student_phone: '',
    booking_type: appSettings?.booking_types?.[0]?.name || 'Individual',
    location_id: locations[0]?.id || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '08:00'
  });

  const timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.location_id) {
      setToast({ message: "Selecione um local", type: 'error' });
      return;
    }
    if (!formData.student_name.trim()) {
      setToast({ message: "Nome do aluno/cliente obrigatório", type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const isTeacher = appSettings?.user_type !== 'court_owner';
      
      // 1. Check for Conflicts
      // For Teachers: Can't have 2 bookings at the same time in ANY location
      if (isTeacher) {
        const teacherConflictQ = query(
          collection(db, 'bookings'),
          where('teacher_id', '==', user.uid),
          where('date', '==', formData.date),
          where('time', '==', formData.time)
        );
        const conflictSnap = await getDocs(teacherConflictQ);
        if (!conflictSnap.empty) {
          throw new Error("Você já tem um agendamento neste horário em outro local.");
        }
      }

      // 2. Check Local Conflict (using slots which is public read)
      const slotId = `${formData.location_id}_${formData.date}_${formData.time.replace(':', '')}`;
      const slotRef = doc(db, 'slots', slotId);
      const slotSnap = await getDoc(slotRef);
      
      if (slotSnap.exists() && slotSnap.data().is_available === false) {
        throw new Error("Este local já possui um agendamento neste horário.");
      }

      const selectedLocation = locations.find(l => l.id === formData.location_id);
      const activeBookingTypes = appSettings?.booking_types || DEFAULT_BOOKING_TYPES;
      const selectedType = activeBookingTypes.find(t => t.name === formData.booking_type);

      // 3. Create Booking
      const bookingId = Date.now().toString();
      
      const bookingData = {
        id: bookingId,
        slot_id: slotId,
        teacher_id: user.uid,
        student_name: formData.student_name,
        student_phone: formData.student_phone,
        booking_type: formData.booking_type,
        price: selectedType?.price || 0,
        paid: false,
        date: formData.date,
        time: formData.time,
        location_name: selectedLocation?.name || '',
        location_id: formData.location_id,
        user_type: appSettings?.user_type || 'professor'
      };

      await setDoc(doc(db, 'bookings', bookingId), bookingData);

      // 3. Update/Create Slot to mark as occupied
      await setDoc(doc(db, 'slots', slotId), {
        location_id: formData.location_id,
        teacher_id: user.uid,
        date: formData.date,
        time: formData.time,
        is_available: false
      });

      setToast({ message: "Agendamento realizado com sucesso!", type: 'success' });
      onClose();
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || "Erro ao realizar agendamento manual", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-3xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <PlusCircle className="text-green-600" size={24} />
            Agendamento Manual
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <XCircle size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Nome do {appSettings?.user_type === 'court_owner' ? 'Cliente' : 'Aluno'}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input 
                  type="text" 
                  required
                  placeholder="Nome completo"
                  value={formData.student_name}
                  onChange={e => setFormData({ ...formData, student_name: e.target.value })}
                  className="w-full pl-10 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Telefone (Opcional)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input 
                  type="tel" 
                  placeholder="(00) 00000-0000"
                  value={formData.student_phone}
                  onChange={e => setFormData({ ...formData, student_phone: e.target.value })}
                  className="w-full pl-10 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Data</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input 
                  type="date" 
                  required
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full pl-10 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Horário</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <select 
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                  className="w-full pl-10 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none appearance-none"
                >
                  {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">Local / Quadra</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              <select 
                value={formData.location_id}
                onChange={e => setFormData({ ...formData, location_id: e.target.value })}
                className="w-full pl-10 p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none appearance-none"
              >
                <option value="">Selecione um local</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">Categoria / Modalidade</label>
            <div className="grid grid-cols-2 gap-2">
              {(appSettings?.booking_types || DEFAULT_BOOKING_TYPES).map(type => (
                <button
                  key={type.name}
                  type="button"
                  onClick={() => setFormData({ ...formData, booking_type: type.name })}
                  className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                    formData.booking_type === type.name 
                    ? 'border-green-600 bg-green-50 text-green-600' 
                    : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {type.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 py-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all shadow-lg shadow-green-100 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Agendar Agora'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AdminDashboard({ user, teacherName, setToast }: { user: any, teacherName: string, setToast: (t: any) => void }) {
  const [tab, setTab] = useState<'schedule' | 'bookings' | 'finance' | 'locations' | 'settings' | 'products' | 'superadmin'>('schedule');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [showManualBooking, setShowManualBooking] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
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

    // Fetch locations
    const qLocs = query(collection(db, 'locations'), where('teacher_id', '==', user.uid));
    const unsubLocs = onSnapshot(qLocs, (snapshot) => {
      setLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location)));
    });

    return () => {
      unsubscribe();
      unsubLocs();
    };
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
      const eventLabel = (appSettings?.user_type === 'court_owner') ? 'Reserva' : 'Aula';
      const params = {
        titulo: `${eventLabel} (${booking.booking_type}): ${booking.student_name}`,
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

  const handleGenerateReport = () => {
    const filtered = bookings.filter(b => {
      const matchesStart = startDate ? b.date >= startDate : true;
      const matchesEnd = endDate ? b.date <= endDate : true;
      const matchesStatus = statusFilter === 'all' 
        ? true 
        : statusFilter === 'paid' ? b.paid : !b.paid;
      const matchesLocation = locationFilter === 'all' 
        ? true 
        : (b.location_id === locationFilter || b.location_name === locationFilter);
      return matchesStart && matchesEnd && matchesStatus && matchesLocation;
    });

    if (filtered.length === 0) {
      setToast({ message: 'Nenhum dado encontrado para gerar relatório', type: 'error' });
      return;
    }

    // Sort by date and time
    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(22, 163, 74); // green-600
      doc.text('Relatório de Agendamentos', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const filterText = [
        `Período: ${startDate ? format(parseISO(startDate), 'dd/MM/yy') : 'Início'} até ${endDate ? format(parseISO(endDate), 'dd/MM/yy') : 'Fim'}`,
        `Local: ${locationFilter === 'all' ? 'Todos' : locations.find(l => l.id === locationFilter)?.name || 'Selecionado'}`,
        `Status: ${statusFilter === 'all' ? 'Todos' : statusFilter === 'paid' ? 'Pagos' : 'Pendentes'}`
      ].join(' | ');
      doc.text(filterText, 14, 30);
      
      doc.setFontSize(8);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 35);

      const tableRows = filtered.map(b => [
        format(parseISO(b.date), 'dd/MM/yy'),
        b.time,
        b.location_name,
        b.student_name,
        b.student_phone,
        b.booking_type,
        `R$ ${b.price.toFixed(2)}`,
        b.paid ? 'Pago' : 'Pendente'
      ]);

      autoTable(doc, {
        head: [['Data', 'Hora', 'Local', 'Cliente/Aluno', 'Telefone', 'Categoria', 'Preço', 'Status']],
        body: tableRows,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] }, // green-600
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          6: { halign: 'right' },
          7: { fontStyle: 'bold' }
        }
      });

      doc.save(`relatorio_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
      setToast({ message: 'Relatório PDF gerado com sucesso!', type: 'success' });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setToast({ message: 'Erro ao gerar PDF do relatório', type: 'error' });
    }
  };

  if (appSettings?.is_active === false && user.email !== 'uillian.bedinoto@gmail.com') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-8 bg-white rounded-3xl border border-red-100 shadow-sm">
        <div className="bg-red-50 p-8 rounded-full text-red-600">
          <ShieldAlert size={64} />
        </div>
        <div className="max-w-md space-y-3">
          <h2 className="text-3xl font-black text-gray-900 uppercase">Acesso Suspenso</h2>
          <p className="text-gray-500 font-medium leading-relaxed">
            Seu acesso ao sistema foi temporariamente desativado pelo administrador. 
            Todas as suas agendas também foram ocultadas.
          </p>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-black uppercase text-sm hover:bg-gray-800 transition-all shadow-xl shadow-gray-200"
        >
          Sair do Sistema
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Painel de Controle</h2>
          <p className="text-gray-500">Gerencie seus horários, {appSettings?.user_type === 'court_owner' ? 'clientes' : 'alunos'} e finanças.</p>
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
            {appSettings?.user_type === 'court_owner' ? 'Clientes' : 'Alunos'}
          </button>
          <button 
            onClick={() => setTab('finance')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'finance' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Financeiro
          </button>
          <button 
            onClick={() => setTab('products')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'products' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Loja
          </button>
          <button 
            onClick={() => setTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'settings' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <SettingsIcon size={16} />
          </button>
          {user.email === 'uillian.bedinoto@gmail.com' && (
            <button 
              onClick={() => setTab('superadmin')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${tab === 'superadmin' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-500 hover:text-purple-700'}`}
            >
              <ShieldCheck size={16} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ScheduleManager user={user} teacherName={teacherName} setToast={setToast} appSettings={appSettings} setConfirmConfig={setConfirmConfig} />
          </motion.div>
        )}
        {tab === 'locations' && (
          <motion.div key="locations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LocationManager user={user} setToast={setToast} />
          </motion.div>
        )}
        {tab === 'products' && (
          <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ProductManager user={user} setToast={setToast} />
          </motion.div>
        )}
        {tab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SettingsManager user={user} setToast={setToast} />
          </motion.div>
        )}
        {tab === 'superadmin' && user.email === 'uillian.bedinoto@gmail.com' && (
          <motion.div key="superadmin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SuperAdminManager setToast={setToast} />
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
                  Controle de {appSettings?.user_type === 'court_owner' ? 'Clientes' : 'Alunos'}
                </h3>
                <button
                  onClick={() => setShowManualBooking(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm active:scale-95"
                >
                  <PlusCircle size={18} />
                  NOVO AGENDAMENTO
                </button>
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

                <div className="space-y-1 col-span-1 lg:col-span-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Local</span>
                  <select 
                    className="w-full text-xs p-2.5 bg-gray-50 border-none rounded-xl outline-none focus:ring-1 focus:ring-green-500"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  >
                    <option value="all">Todos os Locais</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 col-span-2 lg:col-span-auto h-[37px]">
                  {(startDate || endDate || statusFilter !== 'all' || locationFilter !== 'all') && (
                    <button 
                      onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter('all'); setLocationFilter('all'); }} 
                      className="text-[10px] text-red-500 font-bold hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                  <button 
                    onClick={handleGenerateReport}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-[10px] hover:bg-black transition-all shadow-sm active:scale-95 uppercase tracking-wider"
                  >
                    <FileText size={14} />
                    Gerar Relatório
                  </button>
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
                    const matchesLocation = locationFilter === 'all' 
                      ? true 
                      : (booking.location_id === locationFilter || booking.location_name === locationFilter);
                    return matchesStart && matchesEnd && matchesStatus && matchesLocation;
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
                          <div className="text-[10px] font-bold text-gray-400 uppercase">Categoria</div>
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
                                message: `Deseja marcar esta reserva como ${booking.paid ? 'pendente' : 'paga'}?`,
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
                  const lm = locationFilter === 'all' ? true : (b.location_id === locationFilter || b.location_name === locationFilter);
                  return sm && em && stm && lm;
                }).length === 0 && (
                  <div className="bg-white py-14 text-center text-gray-400 rounded-3xl border border-dashed border-gray-100">
                    Nenhum {appSettings?.user_type === 'court_owner' ? 'cliente' : 'aluno'} encontrado.
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
                      <th className="px-6 py-4">{appSettings?.user_type === 'court_owner' ? 'Cliente' : 'Aluno'}</th>
                      <th className="px-6 py-4">Categoria</th>
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
                        const matchesLocation = locationFilter === 'all' 
                          ? true 
                          : (booking.location_id === locationFilter || booking.location_name === locationFilter);
                        return matchesStart && matchesEnd && matchesStatus && matchesLocation;
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
                            onClick={async () => {
                              const editLink = `${window.location.origin}/?b=${booking.id}`;
                              try {
                                await navigator.clipboard.writeText(editLink);
                                setToast({ message: 'Link para o aluno copiado!', type: 'success' });
                              } catch (err) {
                                setToast({ message: 'Erro ao copiar link.', type: 'error' });
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Copiar link para o aluno ver/editar reserva"
                          >
                            <ExternalLink size={18} />
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
        {showManualBooking && (
          <ManualBookingModal 
            user={user}
            locations={locations}
            appSettings={appSettings}
            onClose={() => setShowManualBooking(false)}
            setToast={setToast}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingBooking && (
          <EditBookingModal 
            booking={editingBooking} 
            onClose={() => setEditingBooking(null)} 
            onSync={handleCalendarSync}
            appSettings={appSettings}
            setToast={setToast}
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
  appSettings,
  setToast
}: { 
  booking: Booking, 
  onClose: () => void, 
  onSync: (booking: Booking) => void,
  appSettings: AppSettings | null,
  setToast: (t: any) => void
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
        
        if (newSlot) {
          const isTeacher = appSettings?.user_type !== 'court_owner';
          
          if (isTeacher) {
            const conflictQ = query(
              collection(db, 'bookings'),
              where('teacher_id', '==', booking.teacher_id),
              where('date', '==', newSlot.date),
              where('time', '==', newSlot.time)
            );
            const conflictSnap = await getDocs(conflictQ);
            // Ignore current booking if it happens to be at the same time (swapping location only)
            const hasConflict = conflictSnap.docs.some(doc => doc.id !== booking.id);
            
            if (hasConflict) {
              throw new Error("Você já possui um agendamento neste dia e horário em outro local.");
            }
          }

          const loc = locations.find(l => l.id === newSlot?.location_id);
          
          // Free old slot
          await updateDoc(doc(db, 'slots', booking.slot_id), { is_available: true });
          // Reserve new slot
          await updateDoc(doc(db, 'slots', selectedSlotId), { is_available: false });
          
          updates.slot_id = selectedSlotId;
          updates.date = newSlot.date;
          updates.time = newSlot.time;
          updates.location_name = loc?.name || '';
          updates.location_id = newSlot.location_id;
        }
      }

      await updateDoc(doc(db, 'bookings', booking.id), updates);

      // Se já tinha ID do Google, dispara a sincronização automática com os novos dados
      if (updates.google_event_id) {
        onSync({ ...booking, ...updates });
      }

      onClose();
    } catch (error: any) {
      if (error instanceof Error && error.message.includes('Você já possui um agendamento')) {
        setToast({ message: error.message, type: 'error' });
      } else {
        handleFirestoreError(error, OperationType.UPDATE, 'bookings');
      }
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
              <label className="text-xs font-bold text-gray-400 uppercase">Categoria</label>
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
  appSettings,
  setConfirmConfig
}: { 
  user: any, 
  teacherName: string, 
  setToast: (t: any) => void,
  appSettings: AppSettings | null,
  setConfirmConfig: (config: any) => void
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

  const handleDeleteSlot = async (id: string, time: string) => {
    setConfirmConfig({
      isOpen: true,
      title: "Excluir Horário?",
      message: `Deseja realmente remover o horário das ${time}? Esta ação não pode ser desfeita.`,
      type: 'danger',
      confirmText: 'Excluir',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'slots', id));
          setToast({ message: "Horário removido com sucesso!", type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'slots');
        }
      }
    });
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

      let horariosText = '';
      for (let i = 0; i < duration; i++) {
        const date = addDays(startDateReport, i);
        if (date < today) continue;

        const dateStr = format(date, 'yyyy-MM-dd');
        const daySlots = grouped[dateStr] || [];
        
        const dayName = format(date, "EEEE dd/MM", { locale: ptBR });
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        
        horariosText += `🎾 ${capitalizedDay}:\n`;
        if (daySlots.length === 0) {
          horariosText += `❌\n`;
        } else {
          horariosText += `\n${daySlots.map(t => t.replace(':00', 'h')).join('\n')}\n`;
        }
        horariosText += '\n';
      }

      const bookingLink = `${window.location.origin}/?loc=${selectedLocation.id}&prof=${encodeURIComponent(teacherName)}`;
      
      let finalReport = '';
      if (appSettings?.whatsapp_template) {
        finalReport = appSettings.whatsapp_template
          .split('{nome}').join(teacherName)
          .split('{instrutor}').join(teacherName) // Fallback for backward compatibility if needed, but the request says change.
          .split('{local}').join(selectedLocation.name)
          .split('{link}').join(bookingLink)
          .split('{horarios}').join(horariosText.trim());
      } else {
        const title = appSettings?.user_type === 'court_owner' ? 'Horários disponíveis' : 'Horários disponíveis para Aulas';
        const label = appSettings?.user_type === 'court_owner' ? 'Responsável' : 'Nome';
        const footerTitle = appSettings?.user_type === 'court_owner' ? 'Hora de reservar sua quadra!' : 'Hora de agendar sua aula!';
        const cta = appSettings?.user_type === 'court_owner' ? 'Escolha seu melhor horário' : 'Escolha seu melhor horário diretamente pelo link';
        
        const header = `📅 ${title}\n👤 ${label}: ${teacherName}\n📍 ${selectedLocation.name}\n\n`;
        const footer = `📅 ${footerTitle}\n\n${cta}:\n👉 ${bookingLink}\n\nOu, se preferir, me envie uma mensagem aqui no WhatsApp. Vamos evoluir juntos!`;
        finalReport = header + horariosText + footer;
      }

      await navigator.clipboard.writeText(finalReport.trim());
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
                  // Donos de quadra podem ter múltiplos horários simultâneos (múltiplas quadras)
                  const isBusyElsewhere = !!slotInOtherLocation && appSettings?.user_type !== 'court_owner';
                  const isSelected = availableTimes.includes(time);
                  
                  return (
                    <button
                      key={time}
                      disabled={isExistingInThisLocation || isBusyElsewhere}
                      onClick={() => {
                        if (isSelected) setAvailableTimes(availableTimes.filter(t => t !== time));
                        else setAvailableTimes([...availableTimes, time]);
                      }}
                      title={isBusyElsewhere ? `Você já tem aula marcada em: ${locations.find(l => l.id === slotInOtherLocation?.location_id)?.name}` : ''}
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
                {appSettings?.user_type !== 'court_owner' && (
                  <div className="flex items-center gap-1 text-red-400">
                    <div className="w-2 h-2 bg-red-50 border border-red-100 rounded" /> Ocupado em outro local
                  </div>
                )}
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
                        <button onClick={() => handleDeleteSlot(slot.id, slot.time)} className="text-gray-300 hover:text-red-500 transition-colors">
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
  const [userType, setUserType] = useState<'professor' | 'court_owner'>('professor');
  const [whatsappTemplate, setWhatsappTemplate] = useState('');
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
        setUserType(data.user_type || 'professor');
        setWhatsappTemplate(data.whatsapp_template || '');
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
        agenda_duration: agendaDuration,
        whatsapp_template: whatsappTemplate.trim()
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

        <div className="bg-gray-50 p-4 rounded-2xl flex items-start gap-4">
          <div className={`p-3 rounded-xl ${userType === 'court_owner' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
            {userType === 'court_owner' ? <MapPin size={20} /> : <User size={20} />}
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Conta</p>
            <p className="font-bold text-gray-900">{userType === 'court_owner' ? 'Dono de Quadra' : 'Professor'}</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              O tipo de conta define como sua agenda e loja aparecem para os clientes.
              {userType === 'court_owner' 
                ? ' (Focado em locação de quadras e equipamentos)' 
                : ' (Focado em aulas e pacotes de treinamento)'}
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase">
              {userType === 'court_owner' ? 'Nome do Estabelecimento / Quadra' : 'Nome do Professor'}
            </label>
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

          <div className="space-y-2 pt-2 border-t">
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

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase">Número do WhatsApp (Vendas na Loja e Notificações)</label>
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
                className={`w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all ${!whatsappEnabled ? 'ring-1 ring-red-200' : ''}`}
                value={whatsappNumber}
                onChange={e => setWhatsappNumber(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-gray-400">Este número receberá os pedidos da loja e as notificações de agendamento.</p>
          </div>

          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Modelo de Mensagem (Postar WhatsApp)</label>
              <div className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">Personalizável</div>
            </div>
            <textarea 
              rows={5}
              placeholder={`Ex:\nOlá! Esta é a agenda de {local}.\nPara agendar com {nome} acesse:\n{link}\n\nHorários:\n{horarios}`}
              className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm font-sans resize-none"
              value={whatsappTemplate}
              onChange={e => setWhatsappTemplate(e.target.value)}
            />
            <div className="bg-blue-50 p-3 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Como usar as Tags:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-[10px] text-blue-600"><b>{`{nome}`}</b>: Seu nome</span>
                <span className="text-[10px] text-blue-600"><b>{`{local}`}</b>: Nome do local</span>
                <span className="text-[10px] text-blue-600"><b>{`{link}`}</b>: Link de agendamento</span>
                <span className="text-[10px] text-blue-600"><b>{`{horarios}`}</b>: Lista das datas e horas</span>
              </div>
            </div>
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
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Categorias e Valores</label>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text"
                placeholder="Nome (Ex: Mensalista, Avulso, etc)"
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
                  Nenhuma categoria configurada. Use os padrões do sistema.
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

// --- NEW STORE COMPONENTS ---

function ProductManager({ user, setToast }: { user: any, setToast: (t: any) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Imagem muito grande (máx 5MB)', type: 'error' });
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imageBase64 = reader.result as string;
        const fileName = `${Date.now()}-${file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
        const storageRef = ref(storage, `products/${user.uid}/${fileName}`);
        
        // Upload to Firebase Storage
        await uploadString(storageRef, imageBase64, 'data_url');
        
        // Get Download URL
        const downloadUrl = await getDownloadURL(storageRef);
        
        setEditingProduct(prev => ({ ...prev, image_url: downloadUrl }));
        setToast({ message: 'Imagem carregada!', type: 'success' });
      } catch (error: any) {
        console.error('Upload error:', error);
        setToast({ message: 'Falha no upload (Verifique se o Firebase Storage está ativo)', type: 'error' });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const q = query(collection(db, 'products'), where('teacher_id', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));
    return () => unsubscribe();
  }, [user.uid]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.name || !editingProduct?.price) return;

    try {
      if (editingProduct.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), editingProduct);
        setToast({ message: 'Produto atualizado!', type: 'success' });
      } else {
        const newDoc = doc(collection(db, 'products'));
        await setDoc(newDoc, {
          ...editingProduct,
          id: newDoc.id,
          teacher_id: user.uid,
          created_at: new Date().toISOString()
        });
        setToast({ message: 'Produto criado!', type: 'success' });
      }
      setEditingProduct(null);
    } catch (error) {
      setToast({ message: 'Erro ao salvar produto', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Excluir Produto',
      message: 'Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.',
      type: 'danger',
      confirmText: 'Excluir Produto',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'products', id));
          setToast({ message: 'Produto excluído!', type: 'success' });
        } catch (error) {
          setToast({ message: 'Erro ao excluir produto', type: 'error' });
        } finally {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-green-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Package className="text-green-600" size={24} />
          Gerenciar Produtos
        </h3>
        <button 
          onClick={() => setEditingProduct({ name: '', price: 0, category: 'Raquetes', description: '', image_url: '', pix_discount: 0 })}
          className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all text-sm"
        >
          <Plus size={18} /> Novo Produto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(product => (
          <div key={product.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-contain rounded-xl" referrerPolicy="no-referrer" />
              ) : (
                <Package className="w-full h-full p-4 text-gray-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 truncate">{product.name}</h4>
              <p className="text-green-600 font-bold">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-gray-500 truncate">{product.category}</p>
              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => setEditingProduct(product)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(product.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh] shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                {editingProduct.id ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase">Nome do Produto</label>
                    <input 
                      type="text" 
                      required
                      value={editingProduct.name}
                      onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                      className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Preço (R$)</label>
                      <input 
                        type="number" 
                        required
                        step="0.01"
                        value={editingProduct.price}
                        onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                        className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">% Desconto PIX</label>
                      <div className="relative">
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                          type="number" 
                          value={editingProduct.pix_discount === undefined ? '' : editingProduct.pix_discount}
                          onChange={e => setEditingProduct({...editingProduct, pix_discount: e.target.value === '' ? undefined : parseFloat(e.target.value)})}
                          placeholder="Ex: 10"
                          className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">WhatsApp (Opcional)</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                          type="tel" 
                          placeholder="Ex: 55..."
                          value={editingProduct.whatsapp_number || ''}
                          onChange={e => setEditingProduct({...editingProduct, whatsapp_number: e.target.value})}
                          className="w-full pl-9 pr-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Categoria</label>
                  <select 
                    value={editingProduct.category}
                    onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option>RAQUETES DE BEACH TENNIS</option>
                    <option>MOCHILAS E RAQUETEIRAS</option>
                    <option>VESTUÁRIO</option>
                    <option>ACESSÓRIOS</option>
                    <option>PICKLEBALL</option>
                    <option>OUTROS</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Imagem do Produto</label>
                  <div className="flex flex-col gap-3">
                    {editingProduct.image_url && (
                      <div className="relative w-20 h-20 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                        <img 
                          src={editingProduct.image_url.startsWith('http') ? editingProduct.image_url : `${window.location.origin}${editingProduct.image_url}`} 
                          className="w-full h-full object-contain" 
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button" 
                          onClick={() => setEditingProduct({...editingProduct, image_url: ''})}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden" 
                          id="product-image-upload"
                          disabled={uploading}
                        />
                        <label 
                          htmlFor="product-image-upload"
                          className={`w-full p-3 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all ${uploading ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          {uploading ? <Loader2 className="animate-spin text-green-600" size={16} /> : <Plus className="text-gray-400" size={16} />}
                          <span className="text-[10px] font-bold text-gray-500">{uploading ? 'ENVIANDO...' : 'UPLOAD FOTO'}</span>
                        </label>
                      </div>

                      <div className="relative">
                        <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                          type="text" 
                          placeholder="Ou cole a URL aqui..."
                          value={editingProduct.image_url}
                          onChange={e => setEditingProduct({...editingProduct, image_url: e.target.value})}
                          className="w-full pl-9 pr-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Descrição</label>
                  <textarea 
                    rows={3}
                    value={editingProduct.description}
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                    className="w-full p-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-green-500 outline-none resize-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox"
                    checked={editingProduct.highlighted}
                    onChange={e => setEditingProduct({...editingProduct, highlighted: e.target.checked})}
                    id="highlighted"
                    className="rounded text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="highlighted" className="text-sm font-bold text-gray-700">Destaque na vitrine</label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="flex-1 py-4 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 rounded-2xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
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
    </div>
  );
}

function Shop({ setToast }: { setToast: (t: any) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('TODOS');
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const teacherId = params.get('loc');

  const categories = [
    'TODOS',
    'RAQUETES DE BEACH TENNIS',
    'MOCHILAS E RAQUETEIRAS',
    'VESTUÁRIO',
    'ACESSÓRIOS',
    'PICKLEBALL'
  ];

  useEffect(() => {
    let q;
    let effectiveTeacherId = teacherId;

    // Se não houver loc na URL, mas o usuário estiver logado, usamos o ID dele
    if (!effectiveTeacherId && auth.currentUser) {
      effectiveTeacherId = auth.currentUser.uid;
    }

    let unsubscribeSettings: () => void;

    if (effectiveTeacherId) {
      q = query(collection(db, 'products'), where('teacher_id', '==', effectiveTeacherId));
      
      // Fetch settings for whatsapp number with real-time updates
      unsubscribeSettings = onSnapshot(doc(db, 'settings', effectiveTeacherId), (snap) => {
        if (snap.exists()) {
          setAppSettings(snap.data() as AppSettings);
        }
      });
    } else {
      q = query(collection(db, 'products'), limit(50));
    }

    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
      
      // Se não temos appSettings (global shop) e temos produtos, 
      // tentamos carregar os settings do primeiro produto para ter um whatsapp base
      if (!effectiveTeacherId && docs.length > 0 && !appSettings) {
        getDoc(doc(db, 'settings', docs[0].teacher_id)).then(snap => {
          if (snap.exists()) setAppSettings(snap.data() as AppSettings);
        });
      }
      
      setLoading(false);
    });

    return () => {
      if (unsubscribeProducts) unsubscribeProducts();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, [teacherId, auth.currentUser?.uid]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'TODOS' || p.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleBuy = (product: Product) => {
    const whatsapp = product.whatsapp_number || appSettings?.whatsapp_number;
    if (!whatsapp) {
      setToast({ message: 'Número de WhatsApp não configurado! Vá em Painel > Configurações para definir o número de destino das vendas.', type: 'error' });
      return;
    }

    const instructorInfo = appSettings?.teacher_name ? ` do instrutor *${appSettings.teacher_name}*` : "";
    const text = encodeURIComponent(`Olá! Gostaria de comprar o produto${instructorInfo}: *${product.name}* (R$ ${product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
    
    // Garantir que não duplique o 55 se o usuário já inseriu no cadastro
    const cleanNumber = whatsapp.replace(/\D/g, '');
    const finalNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`;
    
    window.open(`https://wa.me/${finalNumber}?text=${text}`, '_blank');
  };

  if (loading) return <div className="flex justify-center p-24"><Loader2 className="animate-spin text-green-600 w-12 h-12" /></div>;

  if (products.length === 0 && !loading) {
    return (
      <div className="text-center py-24 space-y-4">
        <ShoppingBasket size={64} className="mx-auto text-gray-200" />
        <h2 className="text-2xl font-bold text-gray-400">Nenhum produto cadastrado nesta loja</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Search Header */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="text-gray-400" size={20} />
        </div>
        <input 
          type="text"
          placeholder="O que você está buscando?"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
        />
      </div>

      {/* Categories Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex overflow-x-auto scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-6 py-4 text-xs font-bold whitespace-nowrap transition-all border-b-2 uppercase tracking-wider ${
                category === cat 
                  ? 'border-green-600 text-green-600 bg-green-50/50' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <motion.div 
            layout
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col h-full"
          >
            <div 
              className="aspect-square bg-gray-50 relative overflow-hidden flex items-center justify-center p-6 cursor-pointer"
              onClick={() => setViewingProduct(product)}
            >
              {product.highlighted && (
                <div className="absolute top-4 left-4 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded flex items-center gap-1 z-10 uppercase">
                  <Star size={10} fill="currentColor" /> Destaque
                </div>
              )}
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Package size={64} className="text-gray-200" />
              )}
            </div>
            <div className="p-6 flex flex-col flex-1 space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{product.category}</span>
              <h4 
                className="font-bold text-gray-900 line-clamp-2 min-h-[3rem] leading-tight group-hover:text-green-600 transition-colors uppercase cursor-pointer"
                onClick={() => setViewingProduct(product)}
              >
                {product.name}
              </h4>
              <div className="pt-2 mt-auto">
                <div className="text-2xl font-black text-gray-900">
                  R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                {product.pix_discount && product.pix_discount > 0 && (
                  <div className="text-xs text-green-600 font-bold mb-4">
                    R$ {(product.price * (1 - product.pix_discount / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com Pix
                  </div>
                )}
                {(!product.pix_discount || product.pix_discount <= 0) && (
                   <div className="mb-4 h-4"></div>
                )}
                <button 
                  onClick={() => handleBuy(product)}
                  className="w-full py-3 bg-purple-600 text-white font-black rounded-xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-100 group-active:scale-95 text-xs uppercase"
                >
                  <ShoppingBag size={14} /> Comprar
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-400 italic">
          Nenhum produto encontrado na busca ou categoria selecionada.
        </div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {viewingProduct && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              <div className="md:w-1/2 bg-gray-50 relative p-8 flex items-center justify-center border-b md:border-b-0 md:border-r border-gray-100">
                <button 
                  onClick={() => setViewingProduct(null)}
                  className="absolute top-6 left-6 p-3 bg-white rounded-2xl text-gray-400 hover:text-gray-600 shadow-sm z-10 md:hidden"
                >
                  <ChevronLeft size={24} />
                </button>
                
                {viewingProduct.image_url ? (
                  <img 
                    src={viewingProduct.image_url} 
                    alt={viewingProduct.name} 
                    className="max-w-full max-h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Package size={128} className="text-gray-200" />
                )}
                
                {viewingProduct.highlighted && (
                  <div className="absolute top-6 right-6 bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1 uppercase tracking-widest">
                    <Star size={12} fill="currentColor" /> Destaque
                  </div>
                )}
              </div>

              <div className="md:w-1/2 p-8 md:p-12 flex flex-col overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-black text-green-600 uppercase tracking-[0.2em]">
                    {viewingProduct.category}
                  </span>
                  <button 
                    onClick={() => setViewingProduct(null)}
                    className="hidden md:block p-2 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                </div>

                <h2 className="text-3xl font-black text-gray-900 leading-tight mb-6 uppercase">
                  {viewingProduct.name}
                </h2>

                <div className="space-y-6 flex-1">
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição</h5>
                    <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-wrap">
                      {viewingProduct.description || "Nenhuma descrição detalhada disponível para este produto."}
                    </p>
                  </div>

                  <div className="p-6 bg-green-50 rounded-3xl space-y-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-gray-900">
                        R$ {viewingProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {viewingProduct.pix_discount && viewingProduct.pix_discount > 0 && (
                      <div className="flex items-center gap-2 text-green-700">
                        <div className="bg-green-600 text-white p-1 rounded font-bold text-[10px] uppercase">{viewingProduct.pix_discount}% OFF</div>
                        <span className="font-bold text-sm">
                          R$ {(viewingProduct.price * (1 - viewingProduct.pix_discount / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no PIX
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setViewingProduct(null)}
                    className="py-4 rounded-2xl font-black text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all uppercase text-xs tracking-widest"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={() => { handleBuy(viewingProduct); setViewingProduct(null); }}
                    className="py-4 bg-purple-600 text-white font-black rounded-2xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-purple-100 uppercase text-xs tracking-widest"
                  >
                    <MessageCircle size={16} /> Comprar agora
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SuperAdminManager({ setToast }: { setToast: (t: any) => void }) {
  const [teachers, setTeachers] = useState<AppSettings[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'settings'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppSettings));
      setTeachers(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'settings'));
    return () => unsubscribe();
  }, []);

  const toggleTeacherStatus = async (teacher: AppSettings) => {
    try {
      await updateDoc(doc(db, 'settings', teacher.id), {
        is_active: teacher.is_active === false
      });
      setToast({ 
        message: `Status de ${teacher.teacher_name || 'Usuário'} alterado!`, 
        type: 'success' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    }
  };

  const changeUserType = async (teacher: AppSettings, newType: 'professor' | 'court_owner') => {
    try {
      await updateDoc(doc(db, 'settings', teacher.id), {
        user_type: newType
      });
      setToast({ 
        message: `Tipo de conta de ${teacher.teacher_name || 'Usuário'} alterado para ${newType === 'professor' ? 'Professor' : 'Dono de Quadra'}!`, 
        type: 'success' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 flex items-center gap-4">
        <div className="bg-purple-600 text-white p-3 rounded-2xl">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-purple-900">Administração do Sistema</h3>
          <p className="text-purple-600 text-sm">Gerencie o acesso e o tipo de conta de todos os usuários.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {teachers.map(teacher => (
          <div key={teacher.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                {teacher.user_type === 'court_owner' ? <MapPin size={24} /> : <User size={24} />}
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{teacher.teacher_name || 'Nome não configurado'}</h4>
                <p className="text-xs text-gray-500 font-mono">{teacher.id}</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${teacher.is_active !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {teacher.is_active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 border-l pl-3 border-gray-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                      {teacher.user_type === 'court_owner' ? 'Dono de Quadra' : 'Professor'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-gray-50 p-1 rounded-xl">
                <button
                  onClick={() => changeUserType(teacher, 'professor')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    (teacher.user_type === 'professor' || !teacher.user_type)
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Professor
                </button>
                <button
                  onClick={() => changeUserType(teacher, 'court_owner')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                    teacher.user_type === 'court_owner'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Dono
                </button>
              </div>

              <button 
                onClick={() => toggleTeacherStatus(teacher)}
                className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  teacher.is_active !== false 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                {teacher.is_active !== false ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        ))}

        {teachers.length === 0 && (
          <div className="text-center py-12 text-gray-400 italic bg-gray-50 rounded-3xl">
            Nenhum usuário encontrado no sistema.
          </div>
        )}
      </div>
    </div>
  );
}
