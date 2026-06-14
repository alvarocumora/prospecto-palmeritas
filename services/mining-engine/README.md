# mining-engine

Microservicio Python (FastAPI) para cómputo geocientífico que no puede correr en el runtime de Cloudflare Workers: desurvey de sondajes, compositing, variografía, kriging y optimización de pit.

## Stack

- **FastAPI** + **uvicorn** (HTTP)
- **numpy / pandas** (núcleo)
- **pygslib** (opcional, kriging — requiere build con gfortran, ver `Dockerfile.full`)
- **gempy** (opcional, modelado implícito 3D)

## Endpoints

| Método | Path         | Descripción                                    |
| ------ | ------------ | ---------------------------------------------- |
| GET    | `/health`    | Liveness probe                                 |
| POST   | `/desurvey`  | Minimum-curvature desurvey de un sondaje       |
| POST   | `/composite` | Compositing por longitud fija _(stub)_         |
| POST   | `/variogram` | Variograma experimental _(stub)_               |
| POST   | `/krige`     | Ordinary Kriging 3D _(stub, requiere pygslib)_ |

## Ejecutar local

```bash
cd services/mining-engine
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8088
```

## Desplegar

Cualquier host de contenedores: Fly.io, Railway, Render, Google Cloud Run.
La URL final se inyecta en Lovable Cloud como secreto `MINING_ENGINE_URL`
(y `MINING_ENGINE_TOKEN` para autenticar).

## Contrato con TanStack

Server functions en `src/lib/mining/*.functions.ts` hacen fetch a este
servicio, validan con Zod y persisten resultados en Supabase. Nunca se
expone la URL al cliente.
