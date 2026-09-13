# Darke Helbreath: progresión 1–200

## Objetivo de diseño

El nivel 200 es un logro de largo plazo. La curva no usa resets y cada nivel exige
más experiencia que el anterior. El total acumulado es 195.235.276 XP; el servidor
calcula niveles y recompensas de forma autoritativa y conserva el progreso existente.

| Hito | XP acumulada aproximada | Zona sugerida |
|---:|---:|---|
| 10 | 6.000 | Patio de iniciación y ciudad |
| 30 | 466.447 | Aresden o Elvine exterior |
| 50 | 2.412.123 | Ciudad avanzada y primeras rutas |
| 70 | 7.039.364 | Middleland exterior |
| 100 | 21.814.352 | Pits avanzados de Middleland |
| 130 | 50.042.216 | Dungeon 1 y Tower of Hell |
| 155 | 87.265.124 | Dungeons 2–3 e Icebound |
| 180 | 139.969.704 | Dungeons profundos y dragones |
| 190 | 166.036.660 | Contenido Astral |
| 200 | 195.235.276 | Meta máxima; equipo de nivel 200 pendiente |

La vida, el maná, la energía y el daño obtienen crecimiento adicional al cruzar
los niveles 50, 100 y 150. Cada nivel otorga tres puntos de atributo.

## Familias visuales de equipo

Cada familia tiene ocho piezas: espadón, escudo, coraza, camisote, grebas, yelmo,
botas y capa. Son 80 objetos nuevos. Los tintes se aplican tanto al icono como a
la apariencia equipada.

| Familia | Color | Nivel mínimo | Identidad |
|---|---|---:|---|
| Hierro | 🩶 Gris | 10 | iniciación militar |
| Azur | 🟦 Azul | 30 | explorador |
| Esmeralda | 🟩 Verde | 50 | veterano de ciudad |
| Carmesí | 🟥 Rojo | 70 | combatiente de frontera |
| Amatista | 🟪 Violeta | 90 | élite de Middleland |
| Obsidiana | ⬛ Grafito | 110 | dungeon inicial |
| Marfil | ⬜ Marfil | 130 | cazador veterano |
| Solar | 🟨 Dorado | 155 | élite de dungeon |
| Astral | 🩵 Cian | 180 | contenido mítico |
| Eclipse | 🩷 Magenta | 190 | antesala del nivel máximo |

El equipo especial de nivel 200 queda deliberadamente fuera de esta entrega para
diseñarlo como recompensa única de raids/bosses y no como una compra de herrería.

## Magia

La tienda ofrece las 26 magias que el motor web ejecuta realmente: proyectiles,
ataques de celda, líneas, conos, áreas, campos persistentes, invisibilidad y berserk.
Cada hechizo exige nivel, INT, maná y oro. Su potencia escala por hechizo y por los
atributos del personaje. Los hechizos de soporte del catálogo clásico que requieren
sistemas aún inexistentes —invocaciones, curación dirigida, recall, detección y
resurrección de terceros— no se venden como opciones falsas; serán la siguiente
ampliación del motor mágico.

## Población y dificultad

| Mundo | Pits | Población configurada | Función |
|---|---:|---:|---|
| Patio de iniciación | 4 | 17 | tutorial seguro y despejado |
| Aresden | 17 | 864 | nivel bajo; perímetro exterior de alta densidad (x4) |
| Elvine | 17 | 864 | nivel bajo; perímetro exterior de alta densidad (x4) |
| Middleland | 22 | 311 | mapa compartido de riesgo creciente |
| Dungeons de ciudad | 14 | 182 | nivel medio |
| Middleland dungeons | 12 | 143 | nivel medio/alto |
| Tower of Hell 1–2 | 8 | 97 | nivel alto |
| Dungeon 2–4 | 15 | 202 | élite |
| Icebound | 5 | 70 | élite elemental |
| Abaddon | 5 | 45 | boss/endgame experimental |

La densidad está planteada para repartir jugadores entre varios pits. No constituye
todavía una certificación de 200 conexiones simultáneas: eso requiere una prueba de
carga separada con métricas de CPU, memoria, latencia y tráfico WebSocket.

## Botín y economía

- Todos los monstruos relevantes conceden oro dentro de un rango controlado.
- Criaturas comunes entregan consumibles y materiales con probabilidades moderadas.
- El equipo de color aparece con probabilidades bajas y coherentes con la dificultad.
- Werewolf, Ogre y criaturas de ciudad no pueden entregar equipo de boss/endgame.
- Dragon y Abaddon son las únicas fuentes actuales de drops Astral/Eclipse, con tasas
  muy bajas; la herrería ofrece alternativas caras para que el oro conserve utilidad.
- El precio y los requisitos se validan en el servidor, nunca en el navegador.

## Fuente de verdad y regeneración

- `multiplayer/server/Config/Adventure.json`: curva, stats, recompensas y magia.
- `multiplayer/server/Config/Economy.json`: catálogo y precios.
- `multiplayer/server/Config/GameWorlds.json`: pits y población.
- `multiplayer/server/Config/Monsters.json`: vida, ataque y respawn.
- `multiplayer/tools/generate-darke-progression.mjs`: generador reproducible de esta entrega.

Después de modificar las tablas del generador, ejecútalo desde la raíz del repositorio:

```powershell
node multiplayer/tools/generate-darke-progression.mjs
```
