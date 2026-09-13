# Sistema de botín especial

## Principio

La herrería vende equipo fiable para progresar. Las armas compradas conservan su aspecto metálico neutro; las armaduras mantienen el color de su rango. Los objetos realmente excepcionales nacen como ejemplares únicos al derrotar monstruos: comparten una silueta base, pero guardan afijos, requisito, rareza, color y brillo propios.

El diseño toma como referencia los prefijos clásicos de Helbreath (Agile, Critical, Poison, Sharp, Ancient y Strong), las calidades Superior/Exceptional y la idea de que los monstruos fuertes acceden a mejores bandas de propiedades. Nuestra versión amplía ese vocabulario sin copiar tablas de otro servidor.

## Escalado y seguridad

| Grado del monstruo | XP orientativa | Equipo base máximo | Probabilidad especial |
|---|---:|---:|---:|
| I | menos de 100 | nivel 10 | 0,25 % |
| II | 100–499 | nivel 30 | 0,35 % |
| III | 500–1.499 | nivel 50 | 0,50 % |
| IV | 1.500–4.999 | nivel 70 | 0,75 % |
| V | 5.000–9.999 | nivel 90 | 1,00 % |
| VI | 10.000–19.999 | nivel 110 | 1,40 % |
| VII | 20.000–39.999 | nivel 130 | 2,00 % |
| VIII | 40.000–79.999 | nivel 180 | 3,00 % |
| IX | 80.000 o más | nivel 190 | 4,50 % |

El generador sólo elige bases dentro de la banda del monstruo. Cada ejemplar conserva un requisito de nivel autoritativo; no alcanza con alterar la interfaz para equiparlo. La rareza (Superior, Excepcional, Heroico o Mítico) decide cuántos afijos puede recibir y cuánto escalan.

## Afijos y lenguaje visual

| Afijo | Efecto | Identidad visual |
|---|---|---|
| Afilado | daño plano | dorado |
| Ágil | menor demora de ataque | cian |
| Crítico | probabilidad de daño doble | amarillo |
| Venenoso | daño adicional por veneno | verde |
| Ígneo | daño adicional por quemadura | rojo |
| Glacial | probabilidad de congelación breve | azul hielo |
| Fulminante | probabilidad baja de parálisis | violeta |
| Vampírico | recupera un porcentaje del daño | carmesí |
| Arcano | recupera maná al golpear | azul real |
| Fortificado | defensa plana | plata |
| Vital | vida máxima | rosa rojizo |
| Sabio | maná máximo | azul |
| Próspero | oro adicional | ámbar |
| Iluminado | experiencia adicional | blanco astral |

El primer afijo define el tinte y el halo del objeto. El tooltip enumera todos los efectos y sus valores reales.

## Pociones

- Vida: pequeña +50 (nivel 1), grande +180 (nivel 12), superior +500 (nivel 55).
- Maná: pequeña +40 (nivel 1), grande +150 (nivel 12), superior +420 (nivel 55).
- Todas comparten dos segundos de reutilización para que el tamaño sea una decisión económica y no permita curación instantánea ilimitada.

## Referencias de diseño

- Helbreath Olympia, *Weapons*: prefijos y propiedades clásicas.
- Helbreath Olympia, *Rare Items*: robo de vida, regeneración y equipo singular.
- Helbreath Evolution, *Loot & Rarity*: calidades y bandas de propiedades según monstruo.
- Código de servidor HBX, `Item.h`: efectos, atributos y color como datos del objeto.
