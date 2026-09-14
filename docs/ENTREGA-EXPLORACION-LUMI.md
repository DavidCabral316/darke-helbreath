# Exploración, botín de prueba y una interfaz más clara

## Botín

La [tabla de drops](TABLA-DROPS.md) se genera usando `SpecialLoot.DropChance`,
`CandidateItemIds`, Adventure.json y el catálogo real. Incluye drops normales,
oro, grupos de objetos especiales, probabilidades por base y rarezas condicionadas.

Darkeruz **con permisos GM** tiene un 75 % de especial por muerte recompensada.
No aumenta el nivel ni la rareza del objeto: probá monstruos más fuertes para
ver equipo superior. No beneficia a otro GM ni a un personaje sin permisos.
La recompensa corresponde al mayor contribuyente elegible; no es una tirada por
cada atacante. Sólo se anuncia y suena un hallazgo si pudo colocarse en el suelo.

Regenerar desde la raíz del repositorio:

```powershell
..\.tools\dotnet\dotnet.exe run --project multiplayer/adventure-checks -- multiplayer/server --loot-report
```

## Poblaciones

Se mantienen los límites de los pits existentes y se triplica la población normal.
Dragon y Abaddon conservan sus cantidades. Las ciudades no se modifican.

| Mapa | Población configurada |
|---|---:|
| Promise Land | 1260 |
| Middleland | 933 |
| Aresden Dungeon 1 / Elvine Dungeon 1 | 273 cada uno |
| Middle Dungeon N / X | 255 / 174 |
| Abaddon | 125 |
| Icebound | 204 |
| Tower of Hell 1 / 2 | 150 / 141 |
| Dungeon 2 / 3 / 4 | 231 / 198 / 171 |

Las apariciones y reapariciones evitan diez casillas alrededor de entradas y cuatro
alrededor de una red de rutas transitables entre portales. Las rutas se calculan
con colisiones reales, sin atravesar paredes; no necesariamente coinciden con
cada camino dibujado en el mapa. Los monstruos pueden acercarse al caminar o perseguir:
son corredores sin aparición, no zonas seguras ni garantías de sobrevivir.
Los mapas vacíos pausan la IA de movimiento, conservando los temporizadores de
cadáveres, drops y respawn. Esta entrega no certifica capacidad para 200 jugadores.

## Lumi

Tres ilustraciones: alegría al subir de nivel, sorpresa por un especial y tristeza
al morir. Consejos breves, cerrables y con cierre automático a los 12 segundos;
esperan a que termine un diálogo/tienda. No roban el control del personaje.
Máximo dos eventos de cada tipo por personaje, guardados en este navegador
(`darke.lumi-events.v1.<id>`). Al borrar datos locales o usar otro navegador pueden
volver a aparecer; la sincronización entre dispositivos queda pendiente.

La habilidad de generación de imágenes se utilizó para crear variantes originales
de la guía, conservando su identidad y vestuario no sexualizado.
Recursos: `multiplayer/mp-client/public/assets/darke/ui/guide-lumi-{happy,surprised,sad}.png`.
Prompts: conservar cabello plateado, capa verde azulado y dorada, túnica cerrada,
medias opacas y botas; sonrisa y estrella para ascenso, sorpresa y gema para botín,
expresión empática triste para muerte; ilustración anime de fantasía sin texto.
La variante alegre se corrigió con un fondo oscuro sin damero incrustado.

## Interfaz y audio

- Tema obsidiana/jade, paneles translúcidos y tarjetas modernas para comerciantes.
- Buscador, categoría, orden por nivel/precio y filtro «A mi alcance» en las tiendas.
- Atajos independientes por personaje: 1 vida, 2 maná, ocho vacíos. La configuración
  antigua global se reemplaza por `darke.hotkeys.v3.<id>`. Podés asignar las seis
  pociones y sólo hechizos aprendidos. La selección nunca concede un hechizo.
- Sonido E21 del cliente clásico (NotifyMsg_MP y NotifyMsg_HP) al confirmar consumo.
  No suena en un rechazo ni al regenerar recursos naturalmente.
- Pasos C8/C10 al 35 % de su volumen relativo anterior; tono limitado a 0,85–1,15
  para evitar distorsión al correr. Respeta volumen general y atenuación espacial.

Servidor y navegador tienen pruebas automáticas de permisos del bono, niveles de
botín, corredores con paredes, economía, pociones, atajos, Lumi y distribución de
paneles. Las pruebas visuales usan una cuenta de QA o fixtures; no modifican a Darkeruz.
