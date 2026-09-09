# Herramientas de Game Master

El permiso GM pertenece al personaje, no al nombre visible ni a toda la cuenta. El servidor lo lee del snapshot persistido y vuelve a validarlo antes de ejecutar cada acción administrativa. Actualmente el único personaje de producción local con este permiso es **Darkeruz**.

## Panel privado

Al entrar al mundo con un personaje autorizado aparece `★ PANEL GM` dentro del HUD. Incluye:

- aumentar uno o diez niveles, o alcanzar como mínimo el nivel 30;
- restaurar vida, maná y energía;
- añadir 10.000 de oro para pruebas;
- habilitar todos los hechizos implementados;
- activar o desactivar invulnerabilidad;
- alternar entre velocidad normal y supervelocidad;
- seleccionar una celda del mundo para teletransportarse;
- abrir el selector administrativo de mapas.

El menú general también muestra las herramientas preexistentes de creación de objetos, monstruos y NPC, clima y depuración solamente mientras el personaje autorizado está activo.

## Teletransporte desde el minimapa

Con un GM activo, el clic derecho sobre el minimapa convierte la posición visual a coordenadas del mapa y solicita el movimiento al servidor. El servidor solo acepta una celda libre del mundo actual; una pared, objeto ocupado o coordenada inválida se rechaza sin mover al personaje.

## Seguridad

- Un jugador normal no obtiene permisos por cambiar el HTML o revelar botones ocultos.
- Los comandos se verifican otra vez contra el permiso persistido del personaje.
- El teletransporte y los cambios de velocidad siguen siendo autoritativos en el servidor.
- El modo invulnerable es temporal y se desactiva al eliminarse la sesión del mundo.
