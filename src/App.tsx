/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  MapPin
} from 'lucide-react';
import { format, addDays, startOfToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Slot, Booking, FinanceSummary, Location } from './types';
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

export default function App() {
  const [view, setView] = useState<'public' | 'login' | 'admin'>('public');
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        setView('admin');
      }
    });
    return () => unsubscribe();
  }, []);

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
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => setView('public')}
          >
            <div className="bg-green-600 p-2 rounded-lg">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">🎾 Instrutor <span className="text-green-600">Rafael Vielmo</span></h1>
          </div>
          
          <div className="flex gap-4 items-center">
            {view === 'public' && (
              <button 
                onClick={() => setView('login')}
                className="text-sm font-medium text-gray-600 hover:text-green-600 transition-colors"
              >
                Área do Professor
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
              <PublicBooking />
            </motion.div>
          )}
          {view === 'login' && (
            <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Login onLogin={() => setView('admin')} />
            </motion.div>
          )}
          {view === 'admin' && user && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AdminDashboard user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- COMPONENTS ---

function PublicBooking() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', type: 'Individual' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const bookingTypes = [
    { name: 'Individual', price: 70 },
    { name: 'Dupla', price: 120 },
    { name: 'Trio', price: 150 },
    { name: 'Quarteto (jogo orientado)', price: 200 },
  ];

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'locations'), (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
      setLocations(locs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      const q = query(
        collection(db, 'slots'), 
        where('location_id', '==', selectedLocation.id),
        where('is_available', '==', true)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allSlots = snapshot.docs.map(doc => doc.data() as Slot);
        const days = [...new Set(allSlots.map(s => s.date))].sort();
        setAvailableDays(days);
        
        if (days.length > 0 && !days.includes(format(selectedDate, 'yyyy-MM-dd'))) {
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
        setSlots(filtered.sort((a, b) => a.time.localeCompare(b.time)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedDate, selectedLocation]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    
    setStatus('loading');
    try {
      const selectedType = bookingTypes.find(t => t.name === formData.type);

      // Update slot availability
      await updateDoc(doc(db, 'slots', selectedSlot.id), {
        is_available: false
      });

      // Add booking
      const bookingId = Date.now().toString();
      await setDoc(doc(db, 'bookings', bookingId), {
        slot_id: selectedSlot.id,
        student_name: formData.name,
        student_phone: formData.phone,
        booking_type: formData.type,
        price: selectedType?.price || 0,
        paid: false,
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedSlot.time,
        location_name: selectedLocation?.name || ''
      });

      setStatus('success');
      setSelectedSlot(null);
      setFormData({ name: '', phone: '', type: 'Individual' });
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

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
                        onClick={() => setSelectedSlot(slot)}
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
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Tipo de Aula</label>
              <div className="grid grid-cols-1 gap-2">
                {bookingTypes.map((type) => (
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
            <button 
              onClick={() => setStatus('idle')}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold"
            >
              Entendido
            </button>
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

function AdminDashboard({ user }: { user: any }) {
  const [tab, setTab] = useState<'schedule' | 'bookings' | 'finance' | 'locations'>('schedule');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: () => void;
    
    if (tab === 'bookings') {
      const q = query(collection(db, 'bookings'), orderBy('date', 'desc'), orderBy('time', 'desc'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
        setBookings(allBookings);
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));
    } else if (tab === 'finance') {
      unsubscribe = onSnapshot(collection(db, 'bookings'), (snapshot) => {
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
  }, [tab]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Painel de Controle</h2>
          <p className="text-gray-500">Gerencie seus horários, alunos e finanças.</p>
        </div>
        
        <div className="flex flex-wrap bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
          <button 
            onClick={() => setTab('schedule')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'schedule' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Agenda
          </button>
          <button 
            onClick={() => setTab('locations')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'locations' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Locais
          </button>
          <button 
            onClick={() => setTab('bookings')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'bookings' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Alunos
          </button>
          <button 
            onClick={() => setTab('finance')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'finance' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Financeiro
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ScheduleManager user={user} />
          </motion.div>
        )}
        {tab === 'locations' && (
          <motion.div key="locations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LocationManager user={user} />
          </motion.div>
        )}
        {tab === 'bookings' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users size={20} className="text-green-600" />
                Controle de Alunos
              </h3>
            </div>
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
                  {bookings.map(booking => (
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
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'bookings', booking.id), {
                                  paid: !booking.paid
                                });
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, 'bookings');
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                            title={booking.paid ? "Marcar como não pago" : "Marcar como pago"}
                          >
                            <DollarSign size={18} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm('Deseja realmente cancelar esta reserva?')) {
                                try {
                                  await updateDoc(doc(db, 'slots', booking.slot_id), { is_available: true });
                                  await deleteDoc(doc(db, 'bookings', booking.id));
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.DELETE, 'bookings');
                                }
                              }
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
    </div>
  );
}

function ScheduleManager({ user }: { user: any }) {
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
    const unsubscribe = onSnapshot(collection(db, 'locations'), (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
      setLocations(locs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));
    return () => unsubscribe();
  }, []);

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
      const q = query(collection(db, 'slots'), where('date', '==', dateStr));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slot));
        setAllSlotsForDate(slots);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'slots'));
      return () => unsubscribe();
    }
  }, [selectedDate]);

  const handleSaveSlots = async () => {
    if (!selectedLocation || availableTimes.length === 0) return;
    
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      for (const time of availableTimes) {
        const slotId = `${selectedLocation.id}_${dateStr}_${time.replace(':', '')}`;
        await setDoc(doc(db, 'slots', slotId), {
          location_id: selectedLocation.id,
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
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xl">Gerenciar Horários: {selectedLocation.name}</h3>
              <div className="text-sm text-gray-400 font-medium">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</div>
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

function LocationManager({ user }: { user: any }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'locations'), (snapshot) => {
      const locs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
      setLocations(locs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locations'));
    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const id = Date.now().toString();
      await setDoc(doc(db, 'locations', id), { name: newName });
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="font-bold text-xl">Gerenciar Locais de Aula</h3>
        
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Nome do Local (Ex: Arena Padel)"
            className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button 
            onClick={handleAdd}
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all"
          >
            Adicionar
          </button>
        </div>

        <div className="space-y-2">
          {locations.map(loc => (
            <div key={loc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm">
                  <MapPin size={20} />
                </div>
                <span className="font-bold">{loc.name}</span>
              </div>
              <button onClick={() => handleDelete(loc.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
