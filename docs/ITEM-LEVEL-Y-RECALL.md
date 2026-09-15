# Item Level y Recall

## Item Level (iLvl)

`iLvl` mide la potencia efectiva de un objeto; **no** es el nivel requerido para equiparlo. El servidor lo calcula y es la única fuente de verdad. La comparación del tooltip usa el iLvl de la pieza observada contra la pieza que ocupa actualmente la misma ranura.

| Aporte | Peso al iLvl |
|---|---:|
| Daño | 2 por punto |
| Defensa | 4 por punto |
| Magia | 3 por punto |
| Maná | 0,20 por punto |
| Tiempo de ataque | −0,10 por ms (una reducción de tiempo mejora el resultado) |
| Daño / defensa especial | 2 / 4 por punto |
| Velocidad especial | 0,40 por punto |
| Crítico / veneno / fuego | 0,18 / 0,12 / 0,14 por ‰ |
| Congelar / paralizar | 0,20 / 0,25 por ‰ |
| Robo de vida / maná | 2,5 / 1,2 por punto |
| Vida / maná especial | 0,10 / 0,08 por punto |
| Oro / experiencia adicional | 0,25 / 0,40 por punto porcentual |

El resultado se redondea y se limita entre 1 y 999. Rareza, color, brillo y nivel requerido no suman por sí solos: evitan inflar dos veces la valoración de los atributos que representan. Los objetos especiales antiguos reciben el campo automáticamente al cargarse.

## Recall

Recall se aprende en la casa de magia desde nivel 1 por 250 de oro, requiere 10 INT y consume 12 de maná. No necesita elegir un objetivo: al terminar la animación, el servidor elige al azar uno de los cinco círculos clásicos de reaparición de la ciudad natal del personaje.

- Aresden: `(170,146)`, `(140,206)`, `(140,50)`, `(116,246)`, `(68,126)`.
- Elvine: `(170,146)`, `(158,58)`, `(158,250)`, `(242,130)`, `(110,90)`.

Funciona en interiores, la propia ciudad y otros mapas. Si el punto exacto está ocupado, busca una celda libre cercana; un cambio de mapa conserva inventario, efectos y progresión mediante el traspaso autoritativo existente.
