'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useGameStore } from '@/lib/game/store';
import {
  Settings, Users, BookOpen, BarChart3, Shield, Plus, Trash2, 
  Check, X, RefreshCw, Home, Eye, EyeOff, Ban, Award, Search,
  Gamepad2, TrendingUp, Hash, Trophy, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminState {
  stats: any;
  approvedWords: any[];
  bannedWords: any[];
  recentGames: any[];
  topMoves: any[];
  rooms: any[];
  wordFilter: string;
}

// Admin token lives only in memory for the lifetime of the AdminPanel mount.
// It is NOT persisted to localStorage (localStorage is bypassable and
// survives logout). The cookie set by /api/admin is HttpOnly+SameSite=Strict
// and is sent automatically with `credentials: 'same-origin'` requests.
let adminToken: string | null = null;

async function bounceToLoginOn401(res: Response): Promise<Response> {
  if (res.status === 401) {
    adminToken = null;
    useGameStore.setState({ screen: 'admin-login' } as any);
    toast.error('Sessão expirada. Faça login novamente.');
  }
  return res;
}

export function AdminLoginScreen() {
  const { setScreen } = useGameStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        // Token is kept in memory only; the HttpOnly cookie is the real
        // session bearer. We don't store anything in localStorage.
        adminToken = (data as { token?: string }).token ?? null;
        useGameStore.setState({ screen: 'admin' } as any);
        toast.success('Login realizado!');
      } else {
        toast.error(data.error || 'Credenciais inválidas');
      }
    } catch (err) {
      toast.error('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
      <Card className="w-full max-w-sm shadow-2xl border-0 animate-slide-up">
        <CardHeader className="text-center">
          <Shield className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-2xl">Painel Admin</CardTitle>
          <CardDescription>Acesso restrito</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Usuário</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuário" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Senha</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" 
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
          </div>
          <Button onClick={handleLogin} disabled={loading || !username || !password} className="w-full">
            {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            Entrar
          </Button>
          <Button variant="ghost" onClick={() => setScreen('home')} className="w-full">
            <Home className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminPanel() {
  const { setScreen } = useGameStore();
  const [state, setState] = useState<AdminState>({
    stats: null,
    approvedWords: [],
    bannedWords: [],
    recentGames: [],
    topMoves: [],
    rooms: [],
    wordFilter: '',
  });

  const [newWord, setNewWord] = useState('');
  const [wordAction, setWordAction] = useState<'approve' | 'ban'>('approve');

  const fetchStats = useCallback(async () => {
    try {
      const res = await bounceToLoginOn401(await fetch('/api/stats', { credentials: 'same-origin' }));
      const data = await res.json();
      setState(s => ({ ...s, stats: data, recentGames: data.recentGames || [], topMoves: data.topMoves || [] }));
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  }, []);

  const fetchWords = useCallback(async () => {
    try {
      const res = await bounceToLoginOn401(await fetch('/api/words', { credentials: 'same-origin' }));
      const data = await res.json();
      setState(s => ({ ...s, approvedWords: data.approved || [], bannedWords: data.banned || [] }));
    } catch (err) {
      console.error('Failed to fetch words');
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      // Connect to the game-server with the admin token so the socket-level
      // requireAdmin() guard accepts us. The token comes from POST /api/admin.
      const { io } = await import('socket.io-client');
      const socket = io('/', {
        transports: ['websocket'],
        query: { XTransformPort: '3003' },
        withCredentials: true,
        auth: { token: adminToken },
      });
      socket.on('connect', () => {
        socket.emit('admin:list-rooms', (rooms: unknown) => {
          setState(s => ({ ...s, rooms: Array.isArray(rooms) ? rooms : [] }));
          socket.disconnect();
        });
      });
      socket.on('connect_error', () => {
        // Likely 401 (admin token missing/invalid) — bounce to login.
        adminToken = null;
        useGameStore.setState({ screen: 'admin-login' } as any);
        toast.error('Sessão admin expirada.');
        socket.disconnect();
      });
    } catch (err) {
      console.error('Failed to fetch rooms');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchStats(), fetchWords(), fetchRooms()]);
    };
    load();
  }, []);

  const handleWordAction = async () => {
    if (!newWord.trim()) return;
    try {
      const res = await bounceToLoginOn401(await fetch('/api/words', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord, action: wordAction }),
      }));
      const data = await res.json();
      if (data.success) {
        toast.success(`Palavra ${wordAction === 'approve' ? 'aprovada' : 'banida'}!`);
        setNewWord('');
        fetchWords();
      } else {
        toast.error(data.error || 'Erro');
      }
    } catch (err) {
      toast.error('Erro ao processar palavra');
    }
  };

  const handleDeleteWord = async (word: string) => {
    try {
      await bounceToLoginOn401(await fetch('/api/words', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, action: 'delete' }),
      }));
      toast.success('Palavra removida');
      fetchWords();
    } catch (err) {
      toast.error('Erro ao remover');
    }
  };

  const filteredApproved = state.approvedWords.filter((w: any) => 
    w.word.toLowerCase().includes(state.wordFilter.toLowerCase())
  );
  const filteredBanned = state.bannedWords.filter((w: any) => 
    w.word.toLowerCase().includes(state.wordFilter.toLowerCase())
  );

  const stats = state.stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
      {/* Top bar */}
      <div className="bg-slate-900/80 backdrop-blur px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Shield className="text-primary" size={20} />
          <span className="font-bold text-white">LetraMestre Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-white" onClick={() => { fetchStats(); fetchWords(); fetchRooms(); }}>
            <RefreshCw size={16} />
          </Button>
          <Button size="sm" variant="ghost" className="text-white" onClick={() => setScreen('home')}>
            <Home size={16} />
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <BarChart3 size={14} className="mr-1" /> Visão Geral
            </TabsTrigger>
            <TabsTrigger value="games" className="text-xs sm:text-sm">
              <Gamepad2 size={14} className="mr-1" /> Partidas
            </TabsTrigger>
            <TabsTrigger value="words" className="text-xs sm:text-sm">
              <BookOpen size={14} className="mr-1" /> Palavras
            </TabsTrigger>
            <TabsTrigger value="rooms" className="text-xs sm:text-sm">
              <Users size={14} className="mr-1" /> Salas Ativas
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-4 text-center">
                  <Gamepad2 size={24} className="mx-auto mb-2 text-amber-400" />
                  <p className="text-2xl font-bold">{stats?.totalGames || 0}</p>
                  <p className="text-xs text-white/60">Partidas</p>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-4 text-center">
                  <Users size={24} className="mx-auto mb-2 text-green-400" />
                  <p className="text-2xl font-bold">{stats?.totalPlayers || 0}</p>
                  <p className="text-xs text-white/60">Jogadores</p>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-4 text-center">
                  <Hash size={24} className="mx-auto mb-2 text-blue-400" />
                  <p className="text-2xl font-bold">{stats?.totalMoves || 0}</p>
                  <p className="text-xs text-white/60">Jogadas</p>
                </CardContent>
              </Card>
              <Card className="bg-white/10 border-white/20 text-white">
                <CardContent className="p-4 text-center">
                  <TrendingUp size={24} className="mx-auto mb-2 text-purple-400" />
                  <p className="text-2xl font-bold">{stats?.avgScore || 0}</p>
                  <p className="text-xs text-white/60">Média Pontos</p>
                </CardContent>
              </Card>
            </div>

            {/* Status badges */}
            <div className="flex gap-2 flex-wrap mb-4">
              <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/40">
                {stats?.activeGames || 0} em andamento
              </Badge>
              <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40">
                {stats?.waitingGames || 0} aguardando
              </Badge>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/40">
                {stats?.finishedGames || 0} finalizadas
              </Badge>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                {stats?.approvedWords || 0} palavras aprovadas
              </Badge>
              <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/40">
                {stats?.bannedWords || 0} palavras banidas
              </Badge>
            </div>

            {/* Top scoring moves */}
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Trophy size={18} /> Melhores Jogadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {state.topMoves.length === 0 ? (
                  <p className="text-white/60 text-center py-4">Nenhuma jogada registrada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/20 hover:bg-transparent">
                        <TableHead className="text-white/60">Jogador</TableHead>
                        <TableHead className="text-white/60">Palavra</TableHead>
                        <TableHead className="text-white/60 text-right">Pontos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.topMoves.map((move: any) => (
                        <TableRow key={move.id} className="border-white/10 hover:bg-white/5">
                          <TableCell className="text-white">{move.playerName}</TableCell>
                          <TableCell className="text-amber-300 font-bold">{move.word}</TableCell>
                          <TableCell className="text-white text-right font-bold">{move.score}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Games Tab */}
          <TabsContent value="games">
            <Card className="bg-white/10 border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-lg">Partidas Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                {state.recentGames.length === 0 ? (
                  <p className="text-white/60 text-center py-4">Nenhuma partida registrada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/20 hover:bg-transparent">
                        <TableHead className="text-white/60">Código</TableHead>
                        <TableHead className="text-white/60">Status</TableHead>
                        <TableHead className="text-white/60">Jogadores</TableHead>
                        <TableHead className="text-white/60">Host</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.recentGames.map((game: any) => (
                        <TableRow key={game.id} className="border-white/10 hover:bg-white/5">
                          <TableCell className="text-amber-300 font-mono">{game.gameCode || game.code}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              game.status === 'playing' ? 'bg-green-500/20 text-green-300 border-green-500/40' :
                              game.status === 'waiting' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                              'bg-slate-500/20 text-slate-300 border-slate-500/40'
                            }>
                              {game.status === 'playing' ? 'Em jogo' : game.status === 'waiting' ? 'Aguardando' : 'Finalizada'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white">{game.players?.length || game.playerCount || 0}</TableCell>
                          <TableCell className="text-white">{game.hostName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Words Tab */}
          <TabsContent value="words">
            <div className="space-y-4">
              {/* Add word */}
              <Card className="bg-white/10 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white text-lg flex items-center gap-2">
                    <Plus size={18} /> Gerenciar Palavras
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      value={newWord}
                      onChange={(e) => setNewWord(e.target.value.toUpperCase())}
                      placeholder="Digite a palavra..."
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      onKeyDown={(e) => e.key === 'Enter' && handleWordAction()}
                    />
                    <Button
                      onClick={() => setWordAction('approve')}
                      variant={wordAction === 'approve' ? 'default' : 'outline'}
                      size="sm"
                      className={wordAction === 'approve' ? 'bg-green-600 text-white' : 'border-white/20 text-white'}
                    >
                      <Award size={14} /> Aprovar
                    </Button>
                    <Button
                      onClick={() => setWordAction('ban')}
                      variant={wordAction === 'ban' ? 'default' : 'outline'}
                      size="sm"
                      className={wordAction === 'ban' ? 'bg-red-600 text-white' : 'border-white/20 text-white'}
                    >
                      <Ban size={14} /> Banir
                    </Button>
                    <Button onClick={handleWordAction} className="bg-primary">
                      <Plus size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                <Input
                  value={state.wordFilter}
                  onChange={(e) => setState(s => ({ ...s, wordFilter: e.target.value }))}
                  placeholder="Buscar palavras..."
                  className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Approved words */}
                <Card className="bg-white/10 border-white/20">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Award size={16} className="text-green-400" /> Aprovadas ({filteredApproved.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                      {filteredApproved.map((w: any) => (
                        <div key={w.id} className="flex items-center justify-between px-2 py-1 bg-green-500/10 rounded">
                          <span className="text-white font-mono">{w.word}</span>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => handleDeleteWord(w.word)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Banned words */}
                <Card className="bg-white/10 border-white/20">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Ban size={16} className="text-red-400" /> Banidas ({filteredBanned.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                      {filteredBanned.map((w: any) => (
                        <div key={w.id} className="flex items-center justify-between px-2 py-1 bg-red-500/10 rounded">
                          <span className="text-white font-mono">{w.word}</span>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-300" onClick={() => handleDeleteWord(w.word)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms">
            <Card className="bg-white/10 border-white/20">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Users size={18} /> Salas Ativas
                </CardTitle>
                <Button size="sm" variant="ghost" className="text-white" onClick={fetchRooms}>
                  <RefreshCw size={14} />
                </Button>
              </CardHeader>
              <CardContent>
                {state.rooms.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle size={32} className="mx-auto text-white/40 mb-2" />
                    <p className="text-white/60">Nenhuma sala ativa no momento</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {state.rooms.map((room: any) => (
                      <div key={room.gameId} className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-amber-300 font-mono font-bold">{room.gameCode}</span>
                          <Badge variant="outline" className={
                            room.status === 'IN_PROGRESS' ? 'bg-green-500/20 text-green-300 border-green-500/40' :
                            room.status === 'WAITING_FOR_PLAYERS' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            'bg-slate-500/20 text-slate-300 border-slate-500/40'
                          }>
                            {room.status === 'IN_PROGRESS' ? 'Em jogo' : 
                             room.status === 'WAITING_FOR_PLAYERS' ? 'Aguardando' : room.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {room.players?.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <span className="text-white">{p.name} {p.isHost && '👑'}</span>
                              <span className="text-white/60">{p.score} pts</span>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-white/40 mt-2">
                          Peças no saco: {room.tileBagCount}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
