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
  TrendingUp
} from 'lucide-react';
import { format, addDays, startOfToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Slot, Booking, FinanceSummary } from './types';

// --- API HELPERS ---
const API_URL = '';

export default function App() {
  const [view, setView] = useState<'public' | 'login' | 'admin'>('public');
  const [token, setToken] = useState<string | null>(localStorage.getItem('padel_token'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      setView('admin');
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('padel_token');
    setToken(null);
    setView('public');
  };

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
            <h1 className="font-bold text-xl tracking-tight">Padel Pro <span className="text-green-600">Manager</span></h1>
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
            {token && (
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
              <Login onLogin={(t) => { setToken(t); setView('admin'); }} />
            </motion.div>
          )}
          {view === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AdminDashboard token={token!} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- COMPONENTS ---

function PublicBooking() {
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
    fetchAvailableDays();
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [selectedDate]);

  const fetchAvailableDays = async () => {
    const res = await fetch(`${API_URL}/api/available-days`);
    const data = await res.json();
    setAvailableDays(data);
    
    // If current selected date is not in available days, select the first available one
    if (data.length > 0 && !data.includes(format(selectedDate, 'yyyy-MM-dd'))) {
      setSelectedDate(parseISO(data[0]));
    }
  };

  const fetchSlots = async () => {
    const res = await fetch(`${API_URL}/api/available-slots?date=${format(selectedDate, 'yyyy-MM-dd')}`);
    const data = await res.json();
    setSlots(data);
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    
    setStatus('loading');
    try {
      const selectedType = bookingTypes.find(t => t.name === formData.type);
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          student_name: formData.name,
          student_phone: formData.phone,
          booking_type: formData.type,
          price: selectedType?.price || 0
        })
      });
      
      if (res.ok) {
        setStatus('success');
        fetchAvailableDays(); // Refresh available days list
        fetchSlots();
        setSelectedSlot(null);
        setFormData({ name: '', phone: '', type: 'Individual' });
      } else {
        setStatus('error');
      }
    } catch (err) {
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
        <p className="text-gray-500">Escolha um horário disponível e comece a treinar!</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Calendar / Date Picker */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <CalendarIcon size={18} className="text-green-600" />
              Selecione o Dia
            </h3>
          </div>
          
          {availableDays.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              Nenhum dia com horários disponíveis no momento.
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
            Horários Disponíveis
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

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem('padel_token', data.token);
        onLogin(data.token);
      } else {
        setError(data.error || 'Erro ao fazer login');
      }
    } catch (err) {
      setError('Erro de conexão');
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
        <p className="text-gray-500">Entre com suas credenciais para gerenciar suas aulas.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-400 uppercase">Usuário</label>
          <input 
            required
            type="text"
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-gray-400 uppercase">Senha</label>
          <input 
            required
            type="password"
            className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

        <button 
          disabled={loading}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar no Sistema'}
        </button>
      </form>
    </motion.div>
  );
}

function AdminDashboard({ token }: { token: string }) {
  const [tab, setTab] = useState<'schedule' | 'bookings' | 'finance'>('schedule');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    const headers = { 'Authorization': `Bearer ${token}` };
    
    try {
      if (tab === 'bookings') {
        const res = await fetch(`${API_URL}/api/admin/bookings`, { headers });
        const data = await res.json();
        setBookings(data);
      } else if (tab === 'finance') {
        const res = await fetch(`${API_URL}/api/admin/finance`, { headers });
        const data = await res.json();
        setFinance(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Painel de Controle</h2>
          <p className="text-gray-500">Gerencie seus horários, alunos e finanças.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
          <button 
            onClick={() => setTab('schedule')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'schedule' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Agenda
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
            <ScheduleManager token={token} />
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
                              await fetch(`${API_URL}/api/admin/bookings/${booking.id}/pay`, {
                                method: 'PATCH',
                                headers: { 
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ paid: !booking.paid, price: booking.price })
                              });
                              fetchData();
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                            title={booking.paid ? "Marcar como não pago" : "Marcar como pago"}
                          >
                            <DollarSign size={18} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (confirm('Deseja realmente cancelar esta reserva?')) {
                                await fetch(`${API_URL}/api/admin/bookings/${booking.id}`, {
                                  method: 'DELETE',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                fetchData();
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
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">Nenhuma reserva encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
        {tab === 'finance' && finance && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid md:grid-cols-3 gap-6"
          >
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Receita Total</p>
                <h3 className="text-3xl font-bold">R$ {finance.total_revenue.toFixed(2)}</h3>
              </div>
              <p className="text-xs text-gray-400">Total de {finance.total_bookings} aulas agendadas</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Recebido</p>
                <h3 className="text-3xl font-bold text-blue-600">R$ {finance.total_paid.toFixed(2)}</h3>
              </div>
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full" 
                  style={{ width: `${(finance.total_paid / finance.total_revenue) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-4">
              <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pendente</p>
                <h3 className="text-3xl font-bold text-yellow-600">R$ {finance.total_pending.toFixed(2)}</h3>
              </div>
              <p className="text-xs text-gray-400">Aguardando pagamento dos alunos</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScheduleManager({ token }: { token: string }) {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
    '19:00', '20:00', '21:00', '22:00'
  ];

  const toggleTime = (time: string) => {
    if (availableTimes.includes(time)) {
      setAvailableTimes(availableTimes.filter(t => t !== time));
    } else {
      setAvailableTimes([...availableTimes, time]);
    }
  };

  const saveAvailability = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/admin/slots`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          date: format(selectedDate, 'yyyy-MM-dd'),
          times: availableTimes
        })
      });
      alert('Horários salvos com sucesso!');
    } catch (err) {
      alert('Erro ao salvar horários');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid md:grid-cols-2 gap-8"
    >
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <CalendarIcon size={20} className="text-green-600" />
          1. Escolha o Dia
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {[...Array(12)].map((_, i) => {
            const date = addDays(startOfToday(), i);
            const isSelected = isSameDay(date, selectedDate);
            return (
              <button
                key={i}
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
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Clock size={20} className="text-green-600" />
          2. Defina os Horários
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {timeSlots.map(time => (
            <button
              key={time}
              onClick={() => toggleTime(time)}
              className={`p-2 rounded-lg text-sm font-bold transition-all ${
                availableTimes.includes(time)
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
        <button 
          onClick={saveAvailability}
          disabled={loading || availableTimes.length === 0}
          className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition-all disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Disponibilidade'}
        </button>
      </div>
    </motion.div>
  );
}

