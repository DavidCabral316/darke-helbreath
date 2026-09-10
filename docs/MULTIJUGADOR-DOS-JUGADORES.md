# Mapa de trabajo multijugador: de Darkeruz + Mary a una alfa compartida

## Objetivo inmediato

Permitir que Darkeruz y Mary entren desde dos computadoras con cuentas y personajes separados, se vean en el mismo mapa, se muevan, combatan, conversen, cambien de mapa y conserven su progreso.

La primera meta no es publicar un MMORPG abierto en Internet. Es obtener una sesión privada, reproducible y segura para dos jugadores. Después podremos ampliar exactamente la misma arquitectura a un pequeño grupo de pruebas.

## Qué ya está construido

El proyecto no es actualmente un juego de un solo jugador. La partida que corre en este equipo ya utiliza una arquitectura multijugador real:

| Componente | Estado actual |
|---|---|
| Cliente | React + Phaser en navegador |
| Comunicación | WebSocket binario en `/ws` con Protobuf |
| Servidor | C#/.NET 10 autoritativo |
| Cuentas | ASP.NET Identity, contraseñas protegidas y bloqueo por intentos |
| Sesiones | Cookie HTTP-only, CSRF y validación estricta de origen |
| Personajes | Hasta tres por cuenta, con nombres únicos y estado persistente |
| Persistencia | PostgreSQL local |
| Mundo compartido | Jugadores, monstruos, NPC, objetos, chat y portales sincronizados |
| Seguridad jugable | Movimiento, alcance, daño, ataques y hechizos validados por servidor |
| Reconexión | Gracia de 20 segundos y restauración del estado guardado |

La ruta actual es:

```text
Navegador ── HTTP /api ──┐
                         ├── mismo origen :8080 ── proxy ── servidor .NET :1337
Navegador ── WS /ws ─────┘                              │
                                                        └── PostgreSQL :55432
```

Los tres servicios están enlazados a `127.0.0.1`. Además, el servidor solo acepta el origen exacto `http://localhost:8080`. Esto es correcto para desarrollo individual, pero impide que otra computadora entre.

## Decisión recomendada

### Si ambas computadoras están en la misma casa

Usar la red local. Mary abrirá una dirección como `http://192.168.1.50:8080`. Solo se expondrá el puerto web `8080` en el perfil privado de Windows; PostgreSQL y el puerto interno del servidor seguirán inaccesibles desde la red.

### Si Mary está en otra red

Usar Tailscale como primera solución. Crea una red privada cifrada entre las dos computadoras sin abrir puertos del router ni publicar el servidor a todo Internet. El flujo del juego será idéntico al de una LAN.

### Lo que no conviene todavía

No abrir directamente los puertos 8080, 1337 o 55432 en el router. El servidor de desarrollo usa Vite, HTTP sin TLS y recuperación de contraseña local; no es un despliegue público endurecido.

## Entrega M1: perfil privado para dos jugadores

### 1. Configuración de red

- Añadir perfiles `Local`, `LAN` y posteriormente `Production`.
- Hacer configurable la interfaz del frontend: `0.0.0.0` en LAN y `127.0.0.1` en local.
- Mantener servidor .NET y PostgreSQL en loopback. Vite recibirá `/api` y `/ws` y los reenviará internamente.
- Sustituir el único `Portal:Origin` por una lista explícita de orígenes permitidos. No usar comodines.
- Conservar las conexiones relativas del cliente (`/api` y `/ws`), que ya permiten cambiar de host sin recompilar.

Resultado esperado: una segunda computadora carga el portal sin tener acceso directo a la base de datos ni al backend interno.

### 2. Lanzador LAN

Crear `scripts/Start-WebMultiplayerLan.ps1` para:

1. Detectar la IPv4 privada activa del anfitrión.
2. Compilar servidor y cliente con las fuentes actuales.
3. Inicializar PostgreSQL y ejecutar migraciones.
4. Configurar el origen LAN exacto.
5. Iniciar el frontend en todas las interfaces y mantener backend/DB en loopback.
6. Mostrar claramente la dirección para Mary:

   ```text
   Darke Helbreath disponible para Mary:
   http://192.168.1.50:8080
   ```

7. Comprobar `/api/status` mediante esa misma dirección.
8. Guardar procesos y registros en `.run`, igual que el lanzador local.

El script de parada existente seguirá cerrando toda la pila ordenadamente y guardando personajes.

### 3. Firewall limitado

- Crear una regla de entrada para TCP 8080.
- Aplicarla únicamente al perfil de red **Privado**.
- Limitarla, si es posible, a la subred local o interfaz de Tailscale.
- No abrir 1337 ni 55432.
- Incluir un comando para eliminar la regla y revertir la configuración.

### 4. Cuenta propia de Mary

Mary utilizará el portal normal:

1. Abrir la URL compartida.
2. Crear una cuenta con correo distinto y contraseña de al menos 12 caracteres.
3. Crear su personaje.
4. Entrar al mundo.

No se debe compartir la cuenta `player` ni convertir su personaje en GM. Las identidades separadas permiten validar correctamente sesiones, inventario, propiedad de objetos y persistencia.

## Entrega M2: prueba real de dos jugadores

Crear una prueba manual guiada y una automatizada con dos navegadores/contextos independientes.

| Área | Prueba | Resultado esperado |
|---|---|---|
| Cuenta | Darkeruz y Mary inician sesión | Sesiones independientes |
| Aparición | Ambos entran al mismo mapa | Se ven con nombre y equipo correcto |
| Movimiento | Se cruzan y ocupan celdas cercanas | Sin duplicados ni superposición inválida |
| Chat | Cada uno envía mensajes | Ambos reciben chat y texto flotante correcto |
| Equipo | Uno cambia casco o armadura | El otro ve el cambio sin parpadeos |
| PvE | Atacan el mismo monstruo | Vida, muerte, XP y botín son autoritativos |
| Botín | Ambos intentan recoger un objeto | Solo uno obtiene el objeto |
| Magia | Lanzan hechizos frente al otro | Efecto, daño, maná y cooldown coinciden |
| Portal | Viajan juntos entre mapas e interiores | Ambos cargan el destino correcto |
| Muerte | Uno muere y revive | El otro ve la secuencia y posición final |
| Reconexión | Mary cierra y vuelve | Recupera el personaje sin duplicarlo |
| Persistencia | Se reinicia toda la pila | Nivel, ubicación, oro, inventario y equipo sobreviven |

### Observabilidad necesaria

- Registrar conexiones, desconexiones, autenticaciones y transferencias sin contraseñas ni tokens.
- Mostrar la cantidad real de jugadores en `/api/status` y la portada.
- Añadir un identificador de sesión a errores para correlacionarlos.
- Mantener separados logs de cliente, servidor y PostgreSQL en `.run`.
- Documentar un paquete de diagnóstico que excluya secretos.

## Entrega M3: estabilidad para un pequeño grupo

- Probar 5, 10 y 25 clientes simulados, además de dos navegadores reales.
- Verificar pits y respawns con jugadores repartidos entre mapas.
- Medir tick, CPU, memoria, cola de mensajes y latencia WebSocket.
- Confirmar límites de chat, economía y movimientos bajo concurrencia.
- Evitar dos sesiones activas con el mismo personaje y definir el comportamiento de pestañas duplicadas.
- Añadir apagado con aviso y guardado consistente de todos los personajes.
- Automatizar backups de PostgreSQL y ensayar una restauración.
- Versionar el protocolo cliente/servidor para rechazar clientes incompatibles con un mensaje claro.

Para dos jugadores, un proceso y un worker de mundos son suficientes. No hace falta distribuir servidores ni incorporar SpacetimeDB en esta etapa.

## Entrega M4: jugar desde redes distintas

Camino recomendado: Tailscale.

- Instalar Tailscale en ambos equipos y autorizar solo las identidades necesarias.
- Usar su IP o nombre privado como origen permitido.
- Restringir el firewall a la interfaz de Tailscale.
- Probar latencia, pérdida temporal y reconexión.
- Mantener el servidor disponible solo mientras se quiera jugar.

Criterio: Mary puede entrar desde otra red sin publicar ningún puerto en Internet.

## Entrega M5: futura alfa pública

Esta etapa es distinta de “jugar con Mary” y debe abordarse después:

- VPS o servidor dedicado con Linux.
- Cliente compilado como archivos estáticos, sin Vite de desarrollo.
- Caddy o Nginx como único punto público para HTTPS/WSS.
- Dominio propio y certificado TLS automático.
- Servidor .NET y PostgreSQL en red privada.
- Secretos mediante variables de entorno o almacén de secretos.
- `Portal:LocalDevelopment=false`, cookies `Secure` y origen HTTPS exacto.
- SMTP real para recuperar contraseñas.
- Backups cifrados fuera del servidor y restauraciones ensayadas.
- Logs rotados, métricas y alertas de caída.
- Revisión de reglas, privacidad, licencia de recursos y moderación.
- Pipeline que ejecute build, migraciones y pruebas antes de publicar.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Exponer PostgreSQL | Mantener 55432 en loopback y sin firewall |
| Exponer backend interno | Publicar solo el proxy web |
| WebSocket rechazado | Lista exacta de orígenes permitidos |
| IP local cambiante | Mostrarla al iniciar o reservarla en el router |
| Pérdida de datos | Backup antes/después y restauración comprobada |
| Cliente incompatible | Versión de protocolo y despliegue conjunto |
| Cuenta GM expuesta | Darkeruz sigue siendo el único personaje GM |
| Mapa deja a alguien atrapado | Validación al arrancar y recuperación de ubicación |
| Vite expuesto públicamente | Limitarlo a LAN/Tailscale |

## Orden recomendado

1. Perfil LAN configurable y lista de orígenes.
2. Lanzador/parada LAN y firewall reversible.
3. Validación automática y URL compartible.
4. Cuenta y personaje de Mary.
5. Prueba manual Darkeruz + Mary.
6. Prueba automatizada con dos sesiones.
7. Backup/restauración y mejores registros.
8. Tailscale si jugarán desde redes distintas.
9. Prueba con un grupo pequeño.
10. Después, alfa pública con HTTPS.

## Definición de “listo para jugar con Mary”

- Mary abre una única URL desde su equipo.
- Registra su cuenta y crea un personaje.
- Ambos entran simultáneamente y se ven.
- Chat, movimiento, combate, botín, equipo, muerte y portales se sincronizan.
- Ambos reconectan sin perder ni duplicar datos.
- Reiniciar conserva correctamente a los dos personajes.
- Solo el puerto web es accesible y existe una forma documentada de cerrarlo.
- Hay un backup restaurable antes de ampliar el grupo.
