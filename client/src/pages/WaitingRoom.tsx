import { useEffect, useState } from 'react'
import { useGame } from '../store/useGame'
import { useAuth } from '../store/useAuth'
import { useSocket } from '../hooks/useSocket'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { RoundStatePayload } from 'server/types/game-events'

interface Player {
  id: number
  name: string
  isReady: boolean
  characterId?: number
}

const CHARACTERS: Record<number, { name: string; avatar: string; color: string }> = {
  1: { name: 'Ana', avatar: '/images/characters/personaje1.png', color: 'from-pink-500/40 via-pink-500/20 to-transparent' },
  2: { name: 'Carlos', avatar: '/images/characters/personaje2.png', color: 'from-blue-500/40 via-blue-500/20 to-transparent' },
  3: { name: 'María', avatar: '/images/characters/personaje3.png', color: 'from-green-500/40 via-green-500/20 to-transparent' },
  4: { name: 'Luis', avatar: '/images/characters/personaje4.png', color: 'from-purple-500/40 via-purple-500/20 to-transparent' },
  5: { name: 'Sofia', avatar: '/images/characters/personaje5.png', color: 'from-orange-500/40 via-orange-500/20 to-transparent' },
  6: { name: 'Alex', avatar: '/images/characters/personaje6.png', color: 'from-red-500/40 via-red-500/20 to-transparent' }
};

export default function WaitingRoom() {
  const { startGame } = useGame()
  const { user } = useAuth()
  const socket = useSocket()
  const [players, setPlayers] = useState<Player[]>([])
  const [gameTimer, setGameTimer] = useState(0)
  const [isGameStarting, setIsGameStarting] = useState(false)
  const [gameStatus, setGameStatus] = useState<'waiting' | 'ready' | 'starting'>('waiting')
  const [playMode, setPlayMode] = useState<'single' | 'multi' | null>(null)
  const [receivedPlayMode, setReceivedPlayMode] = useState<'single' | 'multi' | null>(null)
  const nav = useNavigate()
  
  // Usar el playMode recibido más reciente o el estado local
  const currentPlayMode = receivedPlayMode || playMode

  useEffect(() => {
    if (!socket) return

    // El usuario ya debería estar en una sala desde el lobby
    console.log('WaitingRoom mounted, user should already be in a room')
    
    // Verificar si estamos en una sala
    console.log('WaitingRoom: Checking room status...')
    socket.emit('checkRoomStatus')
    
    // Si se reconecta, verificar estado de la sala
    socket.on('connect', () => {
      console.log('Socket reconnected, checking room status')
      socket.emit('checkRoomStatus')
    })

    // Escuchar el evento roomPlayMode primero para establecer el modo antes de otros eventos
    socket.on('roomPlayMode', (data: { playMode: 'single' | 'multi' }) => {
      console.log('Room playMode received:', data.playMode)
      setPlayMode(data.playMode)
      setReceivedPlayMode(data.playMode)
    })

    // Escuchar eventos del socket
    socket.on('playersUpdate', (playersList: Player[]) => {
      setPlayers(playersList)
      // En modo single player, NO cambiar automáticamente a 'ready'
      // El usuario debe presionar el botón manualmente
      // Usar el playMode más reciente (receivedPlayMode o playMode)
      const modeToUse = receivedPlayMode || playMode
      if (modeToUse === 'multi') {
        const minPlayers = 5
        if (playersList.length === minPlayers) {
          setGameStatus('ready')
        } else {
          setGameStatus('waiting')
        }
      } else if (modeToUse === 'single') {
        // Modo single: mantener en 'waiting' hasta que el usuario presione el botón
        setGameStatus('waiting')
      }
    })

    socket.on('gameStartCountdown', (seconds: number) => {
      setGameTimer(seconds)
      setGameStatus('starting')
      setIsGameStarting(true)
      // Cuando el countdown llega a 0, el juego debería iniciar automáticamente
      if (seconds === 0) {
        // El backend emitirá 'gameStarted' inmediatamente después
      }
    })

    socket.on('gameStarted', () => {
      nav('/game')
    })

    socket.on('roomStatus', (data: { inRoom: boolean; playersList?: Player[]; playMode?: 'single' | 'multi' }) => {
      if (!data.inRoom) {
        nav('/')
      } else {
        // Actualizar modo de juego PRIMERO - esto es crítico
        // SIEMPRE establecer el playMode si viene en la respuesta
        if (data.playMode) {
          console.log('WaitingRoom: Setting playMode from roomStatus:', data.playMode)
          setPlayMode(data.playMode)
          setReceivedPlayMode(data.playMode) // Guardar también aquí para uso inmediato
        } else {
          console.warn('WaitingRoom: No playMode received in roomStatus!')
        }
        
        // Actualizar lista de jugadores
        if (data.playersList) {
          setPlayers(data.playersList)
          // Usar el playMode de la respuesta PRIMERO, luego el estado actual como fallback
          const modeToUse = data.playMode || receivedPlayMode || playMode
          console.log('Current playMode:', modeToUse, 'Players:', data.playersList.length)
          
          // En modo single player, NO cambiar automáticamente a 'ready'
          // El usuario debe presionar el botón manualmente
          if (modeToUse === 'single') {
            // Modo single: mantener en 'waiting' hasta que el usuario presione el botón
            setGameStatus('waiting')
          } else if (modeToUse === 'multi') {
            // Modo multi: cambiar a 'ready' solo cuando hay 5 jugadores
            const minPlayers = 5
            if (data.playersList.length === minPlayers) {
              setGameStatus('ready')
            } else {
              setGameStatus('waiting')
            }
          }
          // Si modeToUse es null, mantener el estado actual
        }
        // Si ya estamos en una sala, solicitar el estado actual
        socket.emit('requestRoundState')
      }
    })

    socket.on('roundState', (data: RoundStatePayload) => {
      if (data.status === 'playing') {
        nav('/game')
        return
      }

      if (data.status === 'starting') {
        setGameStatus('starting')
        setIsGameStarting(true)
        setGameTimer(data.timer ?? 0)
      } else {
        setGameStatus('waiting')
        setIsGameStarting(false)
        if (typeof data.timer === 'number') {
          setGameTimer(data.timer)
        }
      }
    })

    socket.on('playerJoined', (data: { players: Player[]; playMode?: 'single' | 'multi' }) => {
      setPlayers(data.players)
      if (data.playMode) {
        setPlayMode(data.playMode)
        setReceivedPlayMode(data.playMode)
      }
      const currentPlayMode = data.playMode || receivedPlayMode || playMode
      // En modo single player, NO cambiar automáticamente a 'ready'
      // El usuario debe presionar el botón manualmente
      if (currentPlayMode === 'multi') {
        const minPlayers = 5
        if (data.players.length === minPlayers) {
          setGameStatus('ready')
        } else {
          setGameStatus('waiting')
        }
      } else if (currentPlayMode === 'single') {
        // Modo single: mantener en 'waiting' hasta que el usuario presione el botón
        setGameStatus('waiting')
      }
    })

    return () => {
      socket.off('playersUpdate')
      socket.off('gameStartCountdown')
      socket.off('gameStarted')
      socket.off('roomStatus')
      socket.off('roundState')
      socket.off('playerJoined')
      socket.off('roomPlayMode')
      socket.off('connect')
    }
  }, [socket, user, nav])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getPlayerSlots = () => {
    const slots = []
    const maxSlots = playMode === 'single' ? 1 : 5
    for (let i = 0; i < maxSlots; i++) {
      const player = players[i]
      const character = player?.characterId ? CHARACTERS[player.characterId] : undefined
      slots.push(
        <motion.div
          key={i}
          className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
            player
              ? 'border-green-400/60 bg-slate-800/70 text-green-200 shadow-lg shadow-green-500/10'
              : 'border-slate-700 bg-slate-800/40 text-slate-400'
          }`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08 }}
        >
          {player && character && (
            <div className={`absolute inset-0 bg-gradient-to-br ${character.color}`} />
          )}
          <div className="relative p-4 flex items-center space-x-4">
            <div className="flex-shrink-0">
              {player && character ? (
                <div className="relative">
                  <div className="absolute -inset-1 bg-green-400/30 blur-md" />
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="relative z-10 w-16 h-16 rounded-full border-2 border-white/70 object-cover shadow-lg"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-2xl">
                  ⏳
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-lg font-semibold text-white">
                    {player ? player.name : `Esperando jugador ${i + 1}`}
                  </div>
                  {player && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-400 font-medium">
                        Conectado
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-1 text-sm text-white/80">
                {player
                  ? isGameStarting
                    ? 'Preparado para iniciar'
                    : 'Listo en sala'
                  : 'Disponible'}
              </div>
              {!player && (
                <motion.div
                  className="mt-3 h-1.5 rounded-full bg-slate-700 overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    className="h-full w-1/2 bg-slate-400"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                  />
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )
    }
    return slots
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="text-2xl">🏦</div>
          <div>
            <h1 className="text-2xl font-bold text-white">El Juego de la Bolsa</h1>
            <p className="text-slate-400">Sala de Espera</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm text-slate-400">Jugadores conectados</div>
            <div className="text-xl font-bold text-white">
              {currentPlayMode === 'single' ? `${players.length}/1` : currentPlayMode === 'multi' ? `${players.length}/5` : `${players.length}/?`}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Game Status */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {gameStatus === 'waiting' && (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-yellow-400">
                {currentPlayMode === 'single' ? 'Listo para comenzar' : currentPlayMode === 'multi' ? 'Esperando jugadores...' : 'Cargando...'}
              </div>
              <div className="text-slate-300">
                {currentPlayMode === 'single' 
                  ? 'Presiona el botón para iniciar la partida'
                  : currentPlayMode === 'multi'
                    ? players.length < 5 
                      ? `Se necesitan ${5 - players.length} jugadores más para comenzar`
                      : 'Esperando a que se conecten más jugadores...'
                    : 'Verificando estado de la sala...'}
              </div>
            </div>
          )}
          
          {gameStatus === 'ready' && !isGameStarting && currentPlayMode === 'multi' && (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-400">
                ¡Todos los jugadores conectados!
              </div>
              <div className="text-slate-300">
                El juego comenzará automáticamente en breve...
              </div>
            </div>
          )}
          
          {gameStatus === 'starting' && (
            <div className="space-y-4">
              <div className="text-4xl font-bold text-blue-400">
                ¡Iniciando en {gameTimer}!
              </div>
              <div className="text-slate-300">
                Prepárate para el campanazo de inicio 🔔
              </div>
              <motion.div 
                className="w-32 h-32 mx-auto bg-blue-500 rounded-full flex items-center justify-center text-4xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                🔔
              </motion.div>
            </div>
          )}
        </motion.div>

        {/* Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {playMode === 'single' ? getPlayerSlots().slice(0, 1) : getPlayerSlots()}
        </div>

        {/* Botón de inicio manual para modo single player */}
        {playMode === 'single' && gameStatus === 'waiting' && players.length >= 1 && !isGameStarting && (
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => {
                if (socket) {
                  socket.emit('startSinglePlayerGame')
                  setIsGameStarting(true)
                  setGameStatus('starting')
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all transform hover:scale-105 shadow-lg"
            >
              🎮 Iniciar Partida
            </button>
          </motion.div>
        )}

        {/* Instructions */}
        <motion.div 
          className="bg-slate-800/50 p-6 rounded-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-white mb-4">📋 Instrucciones del Juego</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <ul className="space-y-2">
              <li>• <strong>{currentPlayMode === 'single' ? '1 jugador' : '5 jugadores'}</strong> {currentPlayMode === 'single' ? 'juega solo' : 'compiten simultáneamente'}</li>
              <li>• <strong>$10,000</strong> iniciales para invertir</li>
              <li>• <strong>5 rondas</strong> de 1 minuto cada una</li>
              <li>• Observa las <strong>noticias</strong> antes de cada ronda</li>
            </ul>
            <ul className="space-y-2">
              <li>• Compra y vende <strong>acciones</strong> estratégicamente</li>
              <li>• Las noticias <strong>afectan los precios</strong></li>
              <li>• {currentPlayMode === 'single' ? 'Mejora tu <strong>portafolio</strong>' : 'Gana quien tenga el <strong>mayor portafolio</strong>'}</li>
              <li>• Recibe un <strong>certificado</strong> al finalizar</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
