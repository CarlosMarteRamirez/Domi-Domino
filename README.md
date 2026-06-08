# Dominó Online

Plataforma web para jugar **dominó por parejas en tiempo real**, construida con Next.js 15 (App Router), un *custom server* con Socket.io, PostgreSQL/Prisma y Auth.js. La lógica del juego vive en un dominio puro y desacoplado para facilitar futuras versiones (móvil).

## Stack

- **Frontend:** Next.js 15, React 19, TypeScript, TailwindCSS v4, componentes estilo shadcn/ui, Zustand-ready, TanStack Query.
- **Backend:** Custom server Node (Next + Socket.io en el mismo proceso), Server Actions y Route Handlers.
- **Tiempo real:** Socket.io (movimientos, turnos, puntuación, chat, presencia, invitaciones).
- **Base de datos:** PostgreSQL + Prisma ORM.
- **Auth:** Auth.js / NextAuth v5 (email+contraseña y Google OAuth), sesiones JWT + adaptador Prisma.

## Arquitectura (Clean Architecture / DDD)

```
src/
  domain/        # PURO: motor de dominó, entidades, reglas (sin Next/Prisma/Socket)
  application/   # casos de uso (users, friends, rooms, invitations)
  infrastructure/# Prisma, Auth.js, realtime (RoomManager), token de socket
  presentation/  # componentes, hooks, stores, gateways de socket, server actions
  app/           # rutas del App Router (login, register, dashboard, room/[code], api)
  shared/        # contrato de Socket.io, utilidades (código de sala, random)
  config/        # validación de entorno (env.ts)
server.ts        # custom server: Next + Socket.io
```

Regla de dependencias: `presentation -> application -> domain`. `infrastructure` implementa los puertos. El dominio del dominó no importa nada externo (probado con Vitest).

## Reglas del dominó implementadas

- Set doble-seis (28 fichas); 2 o 4 jugadores (parejas: asientos 0/2 vs 1/3).
- Validación de jugadas en servidor (turno, posesión de ficha, extremo válido).
- Fin de ronda por **cierre normal** (suma de pips de los oponentes).
- **Tranque** configurable: `individual` (gana la mano más baja) o `parejas` (gana la pareja con menor suma).
- **Bono por pase completo** (0/25/30): si los 3 rivales pasan y el turno vuelve a quien colocó la última ficha.
- Objetivo de puntos configurable (100/200/400/500); gana el primer equipo en alcanzarlo.
- Reparto **determinista** por semilla inyectada (reproducible y testeable).

## Puesta en marcha

```bash
# 1. Dependencias
pnpm install

# 2. Variables de entorno
cp .env.example .env   # ajusta DATABASE_URL, AUTH_SECRET, Google OAuth (opcional)

# 3. Base de datos (requiere Docker)
docker compose up -d
pnpm db:migrate        # crea el esquema
pnpm db:seed           # usuarios de prueba (contraseña: password123)

# 4. Desarrollo (custom server con Socket.io)
pnpm dev               # http://localhost:3000

# 5. Producción
pnpm build && pnpm start
```

## Scripts

| Script            | Descripción                              |
| ----------------- | ---------------------------------------- |
| `pnpm dev`        | Custom server en modo desarrollo         |
| `pnpm build`      | Build de producción de Next.js           |
| `pnpm start`      | Custom server en producción              |
| `pnpm test`       | Suite de Vitest (dominio del dominó)     |
| `pnpm typecheck`  | Comprobación de tipos                    |
| `pnpm db:migrate` | Migraciones de Prisma                    |
| `pnpm db:seed`    | Datos de prueba                          |
| `pnpm db:studio`  | Prisma Studio                            |

## Notas de despliegue

El tiempo real usa un servidor persistente (Socket.io en el mismo proceso que Next), por lo que **no es compatible con el runtime serverless de Vercel**. Despliega en Railway, Render, Fly.io o un VPS. Para escalar horizontalmente, añade el adaptador de Redis de Socket.io (pendiente, opcional).
