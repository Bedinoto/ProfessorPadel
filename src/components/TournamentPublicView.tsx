import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, doc, query, where, onSnapshot, getDoc 
} from 'firebase/firestore';
import { Tournament, TournamentTeam, TournamentMatch } from '../types';
import { 
  Trophy, Calendar, Users, Award, Clock, MapPin, 
  ChevronRight, Info, Search, ListFilter, RotateCcw
} from 'lucide-react';

interface TournamentPublicViewProps {
  tournamentId: string;
  setToast: (t: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

export function TournamentPublicView({ tournamentId, setToast }: TournamentPublicViewProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [activeTab, setActiveTab] = useState<'matches' | 'standings' | 'rules'>('matches');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // Monitor loading the central tournament
  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, 'tournaments', tournamentId);
    
    // Realtime listener for tournament info
    const unsubTourney = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() } as Tournament;
        setTournament(data);
        if (data.categories && data.categories.length > 0) {
          setSelectedCategory(data.categories[0]);
        }
      } else {
        setToast({ message: 'Torneio não localizado!', type: 'error' });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tournament:", error);
      setToast({ message: 'Erro ao carregar torneio.', type: 'error' });
      setLoading(false);
    });

    // Sub collections monitoring
    const qTeams = query(collection(db, 'tournament_teams'), where('tournament_id', '==', tournamentId));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentTeam)));
    });

    const qMatches = query(collection(db, 'tournament_matches'), where('tournament_id', '==', tournamentId));
    const unsubMatches = onSnapshot(qMatches, (snapshot) => {
      setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TournamentMatch)));
    });

    return () => {
      unsubTourney();
      unsubTeams();
      unsubMatches();
    };
  }, [tournamentId]);

  // Standings calculator (dynamic)
  const groupStandingsMap = React.useMemo(() => {
    const activeTeams = teams.filter(t => t.category === selectedCategory);
    const activeMatches = matches.filter(m => m.category === selectedCategory);

    const stand: { [teamId: string]: {
      id: string;
      player1_name: string;
      player2_name: string;
      group_name: string;
      played: number;
      won: number;
      lost: number;
      setsWon: number;
      setsLost: number;
      gamesWon: number;
      gamesLost: number;
      points: number;
    }} = {};

    activeTeams.forEach(t => {
      stand[t.id] = {
        id: t.id,
        player1_name: t.player1_name,
        player2_name: t.player2_name,
        group_name: t.group_name,
        played: 0,
        won: 0,
        lost: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        points: 0
      };
    });

    activeMatches.forEach(m => {
      if (m.status !== 'encerrado') return;
      const t1Id = m.team1_id;
      const t2Id = m.team2_id;

      if (!t1Id || !t2Id || !stand[t1Id] || !stand[t2Id]) return;

      stand[t1Id].played += 1;
      stand[t2Id].played += 1;

      let setsWonT1 = 0;
      let setsWonT2 = 0;
      let gamesWonT1 = 0;
      let gamesWonT2 = 0;

      const s1 = m.score1_sets || [];
      const s2 = m.score2_sets || [];

      for (let i = 0; i < 3; i++) {
        const g1 = s1[i] || 0;
        const g2 = s2[i] || 0;
        if (g1 === 0 && g2 === 0) continue;
        
        gamesWonT1 += g1;
        gamesWonT2 += g2;
        
        if (g1 > g2) {
          setsWonT1++;
        } else if (g2 > g1) {
          setsWonT2++;
        }
      }

      stand[t1Id].setsWon += setsWonT1;
      stand[t1Id].setsLost += setsWonT2;
      stand[t2Id].setsWon += setsWonT2;
      stand[t2Id].setsLost += setsWonT1;

      stand[t1Id].gamesWon += gamesWonT1;
      stand[t1Id].gamesLost += gamesWonT2;
      stand[t2Id].gamesWon += gamesWonT2;
      stand[t2Id].gamesLost += gamesWonT1;

      if (m.winner_id === t1Id) {
        stand[t1Id].won += 1;
        stand[t1Id].points += 3; // Win yields 3 pts
        stand[t2Id].lost += 1;
        stand[t2Id].points += 1; // Loss yields 1 pt
      } else if (m.winner_id === t2Id) {
        stand[t2Id].won += 1;
        stand[t2Id].points += 3;
        stand[t1Id].lost += 1;
        stand[t1Id].points += 1;
      }
    });

    // Pack into categorized group lists
    const groupedList: { [group: string]: typeof stand[string][] } = {};
    Object.values(stand).forEach(st => {
      if (!groupedList[st.group_name]) {
        groupedList[st.group_name] = [];
      }
      groupedList[st.group_name].push(st);
    });

    // Sort according to Padel/Beach rules
    Object.keys(groupedList).forEach(gp => {
      groupedList[gp].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.won !== a.won) return b.won - a.won;
        
        const setBalA = a.setsWon - a.setsLost;
        const setBalB = b.setsWon - b.setsLost;
        if (setBalB !== setBalA) return setBalB - setBalA;

        const gameBalA = a.gamesWon - a.gamesLost;
        const gameBalB = b.gamesWon - b.gamesLost;
        return gameBalB - gameBalA;
      });
    });

    return groupedList;
  }, [teams, matches, selectedCategory]);

  const uniqueGroupsOfCategory = React.useMemo(() => {
    const list = teams.filter(t => t.category === selectedCategory).map(t => t.group_name);
    return Array.from(new Set(list)).sort();
  }, [teams, selectedCategory]);

  const filteredMatchesToShow = React.useMemo(() => {
    let result = matches.filter(m => m.category === selectedCategory);
    if (selectedGroup !== 'all') {
      result = result.filter(m => m.stage === selectedGroup);
    }
    // Sort logic
    return result.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'em_andamento') return -1;
        if (b.status === 'em_andamento') return 1;
        if (a.status === 'agendado' && b.status === 'encerrado') return -1;
        if (b.status === 'agendado' && a.status === 'encerrado') return 1;
      }
      return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
    });
  }, [matches, selectedCategory, selectedGroup]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-3xl border text-center space-y-4">
        <Trophy className="mx-auto text-red-500" size={48} />
        <h3 className="font-black text-xl text-gray-900">Torneio não localizado</h3>
        <p className="text-gray-500 text-xs">O link acessado é inválido ou o torneio correspondente foi removido pelo organizador.</p>
        <button
          onClick={() => window.location.href = window.location.origin}
          className="px-4 py-2 bg-gray-900 text-white font-bold text-xs rounded-xl"
        >
          Ir para a Página Inicial
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Tournament Main Banner */}
      <div className="bg-gradient-to-br from-green-900 to-green-950 p-6 sm:p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 opacity-10">
          <Trophy size={200} />
        </div>

        <div className="relative space-y-3">
          <span className="px-3 py-1 bg-green-500 text-white rounded-full font-black text-[9px] uppercase tracking-widest bg-opacity-30 border border-green-400">
            {tournament.type === 'padel' ? 'Campeonato de Padel 🎾' : 'Torneio Beach Tennis 🏖️'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{tournament.name}</h2>
          <p className="text-green-200 text-xs font-semibold">Tabela oficial e classificação em tempo real</p>
        </div>
      </div>

      {/* Toolbar filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'matches' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Jogos e Placar
          </button>
          <button
            onClick={() => setActiveTab('standings')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'standings' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Classificação
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'rules' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Regulamento
          </button>
        </div>

        {/* Categoria filter selector */}
        {activeTab !== 'rules' && (
          <div className="flex gap-2 w-full sm:w-auto items-center">
            <ListFilter size={14} className="text-gray-400 hidden sm:inline" />
            <select
              className="w-full sm:w-auto bg-gray-50 border border-gray-150 px-3 py-2 rounded-xl text-xs font-bold font-sans cursor-pointer outline-none"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              {tournament.categories.map((c, i) => (
                <option key={i} value={c}>Categoria: {c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Render subtab views */}
      <div className="space-y-6">
        
        {/* VIEW 1: MATCH SCREEN */}
        {activeTab === 'matches' && (
          <div className="space-y-4">
            
            <div className="flex justify-between items-center px-1">
              <h3 className="font-bold text-gray-900 text-md">
                Tabela de Jogos
              </h3>

              <select
                className="bg-transparent border-none text-xs font-bold text-gray-500 cursor-pointer outline-none focus:ring-0"
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
              >
                <option value="all">Todas as Chaves</option>
                {uniqueGroupsOfCategory.map((g, idx) => (
                  <option key={idx} value={g}>{g}</option>
                ))}
                <option value="Quartas de Final">Quartas de Final</option>
                <option value="Semifinal">Semifinal</option>
                <option value="Final">Final</option>
              </select>
            </div>

            {filteredMatchesToShow.length === 0 ? (
              <div className="bg-white py-12 rounded-2xl border text-center text-gray-400">
                <Calendar className="mx-auto mb-2 text-gray-300" size={36} />
                <p className="text-xs font-bold">Nenhum jogo planejado nesta chave ainda.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMatchesToShow.map(m => {
                  const isFinished = m.status === 'encerrado';
                  const isLive = m.status === 'em_andamento';

                  return (
                    <div key={m.id} className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col md:flex-row shadow-sm justify-between gap-4 items-start md:items-center">
                      <div className="space-y-2 flex-1 w-full">
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-black rounded uppercase">
                            {m.stage}
                          </span>
                          <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase ${
                            isLive ? 'bg-red-650 text-white animate-pulse' :
                            isFinished ? 'bg-green-150 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {isLive ? 'AO VIVO' : isFinished ? 'ENCERRADO' : 'AGENDADO'}
                          </span>
                          
                          <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                            <Calendar size={10} /> {m.date}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                            <Clock size={10} /> {m.time}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                            <MapPin size={10} /> {m.location}
                          </span>
                        </div>

                        {/* Duels representation */}
                        <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-2 pt-1">
                          <div className={`sm:col-span-2 text-xs font-black p-2 rounded-xl border ${m.winner_id === m.team1_id && m.winner_id ? 'bg-green-50 border-green-200 text-green-950' : 'bg-white border-gray-100 text-gray-700'}`}>
                            {m.team1_name}
                          </div>
                          <div className="text-[10px] font-black text-gray-450 text-center uppercase sm:col-span-1 select-none">
                            VS
                          </div>
                          <div className={`sm:col-span-2 text-xs font-black p-2 rounded-xl border ${m.winner_id === m.team2_id && m.winner_id ? 'bg-green-50 border-green-200 text-green-950' : 'bg-white border-gray-100 text-gray-700'}`}>
                            {m.team2_name}
                          </div>
                        </div>

                        {/* score display */}
                        {isFinished && m.score1_text && (
                          <div className="text-xs font-black text-green-700 bg-green-50 p-2 rounded-xl flex items-center gap-2">
                            <Award size={14} /> Placar das parciais: {m.score1_text}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* VIEW 2: STANDINGS SCREEN */}
        {activeTab === 'standings' && (
          <div className="space-y-6">
            {Object.keys(groupStandingsMap).length === 0 ? (
              <div className="bg-white py-12 rounded-3xl shadow-sm border text-center text-gray-400">
                <Trophy className="mx-auto text-gray-300 mb-2" size={40} />
                <p className="text-xs font-bold">Nenhuma equipe registrada ou classificada.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupStandingsMap).map((group, idx) => {
                  const items = groupStandingsMap[group];
                  return (
                    <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                      
                      <h4 className="font-black text-sm text-gray-900 border-b pb-2 flex items-center gap-2">
                        <Award className="text-yellow-500" size={16} /> CLASSIFICAÇÃO: {group}
                      </h4>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[500px]">
                          <thead>
                            <tr className="border-b text-gray-400 uppercase text-[9px] font-black">
                              <th className="py-2 pl-2">POS</th>
                              <th className="py-2">DUPLA / EQUIPE</th>
                              <th className="py-2 text-center px-2">PTS</th>
                              <th className="py-2 text-center px-2">J</th>
                              <th className="py-2 text-center px-2">V</th>
                              <th className="py-2 text-center px-2">D</th>
                              <th className="py-2 text-center px-2">SETS PRO</th>
                              <th className="py-2 text-center px-2">SETS CONTRA</th>
                              <th className="py-2 text-center px-2">GAMES PRO</th>
                              <th className="py-2 text-center px-2">GAMES CONTRA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, itemIdx) => {
                              const isTopTwo = itemIdx < 2;
                              return (
                                <tr key={it.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${isTopTwo ? 'font-semibold' : ''}`}>
                                  <td className="py-3 pl-2 flex items-center gap-2">
                                    <span className={`h-5 w-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                                      itemIdx === 0 ? 'bg-yellow-100 text-yellow-850' :
                                      itemIdx === 1 ? 'bg-gray-100 text-gray-850' : 'bg-gray-50 text-gray-500'
                                    }`}>
                                      {itemIdx + 1}
                                    </span>
                                  </td>
                                  <td className="py-3 text-gray-900">{it.player1_name} / {it.player2_name}</td>
                                  <td className="py-3 text-center px-2 font-black text-green-700 bg-green-50/20">{it.points}</td>
                                  <td className="py-3 text-center px-2 text-gray-550">{it.played}</td>
                                  <td className="py-3 text-center px-2 text-green-600 font-bold">{it.won}</td>
                                  <td className="py-3 text-center px-2 text-red-500">{it.lost}</td>
                                  <td className="py-3 text-center px-2 text-gray-600">{it.setsWon}</td>
                                  <td className="py-3 text-center px-2 text-gray-600">{it.setsLost}</td>
                                  <td className="py-3 text-center px-2 text-gray-600">{it.gamesWon}</td>
                                  <td className="py-3 text-center px-2 text-gray-600">{it.gamesLost}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: TOURNAMENT RULES */}
        {activeTab === 'rules' && (
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h4 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2 text-md">
              <Info className="text-gray-500" size={18} /> Regulamento e Diretrizes Oficiais
            </h4>
            <div className="prose max-w-none text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed py-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              {tournament.rules}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
