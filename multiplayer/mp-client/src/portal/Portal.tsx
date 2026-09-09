import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, setActiveCharacterGameMaster, setActiveCharacterName, type Account, type Character } from './api';
import { CharacterPreview } from './Preview';
import './portal.css';

const Game = lazy(() => import('../App'));

function Message({ children }: { children: ReactNode }) { return <div className="notice" role="status">{children}</div>; }
function Loading() { return <div className="portal-loading" role="status">Preparando tu aventura…</div>; }
function Shell() {
    const [account, setAccount] = useState<Account | null | undefined>();
    const [status, setStatus] = useState<{ online: boolean; players: number } | null>(null);
    const location = useLocation();
    const [error, setError] = useState('');
    useEffect(() => { api<Account>('/account/me').then(setAccount).catch(() => setAccount(null)); }, [location.pathname]);
    useEffect(() => {
        const refresh = () => api<{ online: boolean; players: number }>('/status').then(setStatus).catch(() => setStatus(null));
        refresh(); const timer = setInterval(refresh, 30000); return () => clearInterval(timer);
    }, []);
    const logout = async () => { try { await api('/account/logout', {}); window.location.assign('/'); } catch (e) { setError(String((e as Error).message)); } };
    const protect = (node: ReactNode) => account === undefined ? <Loading /> : account ? node : <Navigate to="/login" replace />;
    if (location.pathname.startsWith('/play/')) return protect(<Play account={account!} />);
    return <div className="portal">
        <header className="portal-header">
            <Link className="brand" to="/" aria-label="Darke Helbreath, inicio"><span className="brand-mark">D</span><span>DARKE<small>HELBREATH</small></span></Link>
            <nav aria-label="Principal"><Link to="/">El mundo</Link><Link to="/guide">Cómo jugar</Link><Link to="/rules">Reglas</Link></nav>
            <div className="header-account">{account ? <><Link to="/characters">{account.userName}</Link><button className="text-button" onClick={logout}>Salir</button></> : <><Link to="/login">Ingresar</Link><Link className="button small" to="/register">Crear cuenta</Link></>}</div>
        </header>
        {error && <Message>{error}</Message>}
        <main><Routes>
            <Route path="/" element={<Home account={account} status={status} />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/forgot-password" element={<Auth mode="forgot" />} />
            <Route path="/reset-password" element={<Auth mode="reset" />} />
            <Route path="/characters" element={protect(<Characters />)} />
            <Route path="/characters/new" element={protect(<CreateCharacter />)} />
            <Route path="/account" element={protect(<section className="content-page"><p className="eyebrow">TU CUENTA</p><h1>{account?.userName}</h1><p>{account?.email}</p><Link to="/forgot-password">Cambiar contraseña</Link></section>)} />
            <Route path="/guide" element={<section className="content-page"><p className="eyebrow">PRIMEROS PASOS</p><h1>Tu camino comienza aquí.</h1><ol><li>Creá una cuenta y un personaje. Aresden o Elvine será tu ciudad de origen; ambas empiezan esta alfa en un patio de entrenamiento compartido.</li><li>Aparecés en el refugio (150,150), con espada, pociones y nivel 1.</li><li>Buscá slimes cerca de 141,140. Movete con clic en el suelo y atacá haciendo clic sobre una criatura.</li><li>Recogé botín, ganá experiencia y repartí tres puntos por nivel desde Atributos. La asignación es permanente en esta alfa.</li><li>Probá después hormigas (132,141), serpientes (141,132) y orcos (132,132). Las dos últimas especies son hostiles.</li><li>Usá Inventario, Magia y los botones de pociones. Hay una espera de dos segundos entre pociones.</li><li>Al morir, elegí «Volver al refugio». Conservás XP y objetos. Para cerrar, usá «Log Out» o «Volver a personajes».</li></ol><Message>Esta entrega permite progresar del nivel 1 al 10. El nivel 10 es el límite configurable del tramo de prueba, no una decisión definitiva para el juego. Las misiones y la economía todavía están pendientes.</Message><Link className="button" to="/characters">Mis personajes</Link></section>} />
            <Route path="/rules" element={<section className="content-page"><p className="eyebrow">NUESTRA COMUNIDAD</p><h1>Un mundo compartido.</h1><p>Respetá a otros jugadores. No uses trampas, automatizaciones abusivas ni exploits. Si encontrás un error, reportalo antes de aprovecharlo.</p><p>Elegí nombres apropiados y protegé tu contraseña. El servidor registra acciones de cuenta y personaje para diagnóstico y moderación.</p><h2>Privacidad de la alfa local</h2><p>Se almacenan usuario, correo, contraseña protegida, personajes y actividad técnica en este equipo. No se incluye analítica publicitaria. La recuperación de contraseña se entrega en el buzón local de desarrollo hasta configurar correo real.</p><p>Proyecto comunitario experimental, sin afiliación oficial con Helbreath. Reglas y política de privacidad deberán revisarse antes de abrir un servicio público.</p></section>} />
            <Route path="*" element={<section className="content-page"><h1>Camino desconocido.</h1><Link to="/">Volver al inicio</Link></section>} />
        </Routes></main>
        <footer className="portal-footer"><span>DARKE HELBREATH <small>Un viejo mundo. Una nueva historia.</small></span><span>ALFA LOCAL · <Link to="/rules">Reglas y privacidad</Link></span></footer>
    </div>;
}

function Home({ account, status }: { account: Account | null | undefined; status: { online: boolean; players: number } | null }) {
    return <><section className="hero">
        <div className="hero-art" aria-hidden="true" />
        <div className="hero-copy"><p className="eyebrow">EL LEGADO VUELVE A VIVIR</p><h1>Volvé a un mundo<br />que nunca<br /><em>olvidaste.</em></h1>
            <p className="hero-description">Dos ciudades. Viejas rivalidades. Nuevas aventuras.<br />Tu historia en Helbreath continúa, ahora desde el navegador.</p>
            <div className="hero-actions"><Link className="button" to={account ? '/characters' : '/register'}>Comenzar aventura <span>↗</span></Link><Link className="secondary-link" to="/guide">Explorar el juego →</Link></div>
            <div className="server-status"><i className={status ? 'online' : ''} />{status ? 'Mundo disponible' : 'Servidor no disponible'}<span>·</span>{status ? `${status.players} aventureros conectados` : 'Volvé a intentarlo en unos instantes'}</div>
        </div><span className="hero-caption">ARES DEN / ELVINE &nbsp; · &nbsp; UN MUNDO POR REDESCUBRIR</span>
    </section>
    <section className="feature-strip"><article><span>01 / SIN DESCARGAS</span><h2>Tu navegador es el portal.</h2><p>Creá tu cuenta, elegí tu personaje y entrá directamente al mundo.</p></article><article><span>02 / DOS DESTINOS</span><h2>Elegí tu ciudad.</h2><p>Aresden o Elvine. Un punto de partida para escribir tu propia historia.</p></article><article><span>03 / TU HISTORIA</span><h2>Un lugar al que volver.</h2><p>Tu apariencia, ubicación y equipo permanecen cuando cerrás el juego.</p></article></section>
    <section className="news"><div><p className="eyebrow">DIARIO DEL SERVIDOR</p><h2>El primer capítulo.</h2></div><article><span className="tag">DESARROLLO · ALFA LOCAL</span><h3>Las puertas de Darke están abiertas.</h3><p>Estrenamos portal, cuentas y creación de personajes. Empezamos de a poco, construyendo cada parte de esta nueva aventura.</p><Link to="/guide">Conocer los primeros pasos →</Link></article></section></>;
}

function Auth({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
    const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate(); const [query] = useSearchParams();
    useEffect(() => { setMessage(''); }, [mode]);
    const titles = { login: 'Bienvenido de vuelta.', register: 'Tu historia empieza hoy.', forgot: 'Recuperá tu acceso.', reset: 'Una nueva contraseña.' };
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage('');
        try {
            const password = String(form.get('password') ?? '');
            if ((mode === 'register' || mode === 'reset') && password !== form.get('confirm')) throw new Error('Las contraseñas no coinciden.');
            if (mode === 'register') {
                await api('/account/register', { username: form.get('username'), email: form.get('email'), password, acceptRules: form.get('rules') === 'on' });
                navigate('/login?created=1');
            } else if (mode === 'login') {
                await api('/account/login', { username: form.get('username'), password, remember: form.get('remember') === 'on' }); window.location.assign('/characters');
            } else if (mode === 'forgot') {
                const result = await api<{ message: string }>('/account/forgot', { email: form.get('email') }); setMessage(result.message);
            } else { await api('/account/reset', { email: query.get('email'), token: query.get('token'), password }); navigate('/login?reset=1'); }
        } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
    }
    return <section className="auth-layout"><aside><p className="eyebrow">DARKE HELBREATH</p><h2>Tu próxima aventura<br />está del otro lado.</h2><p>Un mundo conocido.<br />Una historia que todavía es tuya.</p><Link to="/">← Volver al inicio</Link></aside>
        <form className="auth-card" onSubmit={submit} key={mode}><p className="eyebrow">{mode === 'register' ? 'CREAR CUENTA' : 'TU CUENTA'}</p><h1>{titles[mode]}</h1>
            {query.has('created') && mode === 'login' && <Message>Cuenta creada. Ya podés iniciar sesión.</Message>}{query.has('reset') && mode === 'login' && <Message>Contraseña actualizada. Iniciá sesión nuevamente.</Message>}
            {message && <Message>{message}</Message>}
            {(mode === 'login' || mode === 'register') && <label>{mode === 'login' ? 'Usuario o correo' : 'Nombre de usuario'}<input name="username" autoComplete="username" required minLength={3} maxLength={mode === 'register' ? 24 : 254} pattern={mode === 'register' ? '[a-zA-Z0-9_]{3,24}' : undefined} placeholder={mode === 'login' ? 'Tu usuario o correo' : 'Elegí tu nombre de cuenta'} /></label>}
            {(mode === 'register' || mode === 'forgot') && <label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="vos@ejemplo.com" /></label>}
            {mode !== 'forgot' && <label>Contraseña<input name="password" type="password" required minLength={mode === 'login' ? 1 : 12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Tu contraseña' : 'Al menos 12 caracteres'} /></label>}
            {(mode === 'register' || mode === 'reset') && <label>Repetir contraseña<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>}
            {mode === 'register' && <label className="check"><input name="rules" type="checkbox" required />Acepto las <Link to="/rules">reglas y privacidad</Link>.</label>}
            {mode === 'login' && <div className="form-inline"><label className="check"><input name="remember" type="checkbox" />Recordarme</label><Link to="/forgot-password">Olvidé mi contraseña</Link></div>}
            <button className="button full" disabled={busy}>{busy ? 'Un momento…' : mode === 'register' ? 'Crear mi cuenta' : mode === 'login' ? 'Entrar a mi cuenta' : mode === 'forgot' ? 'Solicitar recuperación' : 'Guardar contraseña'} <span>→</span></button>
            <p className="form-footer">{mode === 'login' ? <>¿Primera vez por aquí? <Link to="/register">Creá una cuenta</Link></> : <Link to="/login">Ya tengo cuenta · Iniciar sesión</Link>}</p>
        </form></section>;
}

function Characters() {
    const [characters, setCharacters] = useState<Character[]>([]); const [error, setError] = useState(''); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState<Character | null>(null);
    const refresh = () => api<Character[]>('/characters').then(setCharacters).catch(e => setError(e.message)).finally(() => setReady(true));
    useEffect(() => { refresh(); }, []);
    async function change(id: string, action: string, body: unknown = {}) { setBusy(true); setError(''); try { await api(`/characters/${id}/${action}`, body); setDeleting(null); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
    return <section className="characters-page"><div className="section-heading"><div><p className="eyebrow">ELEGÍ TU DESTINO</p><h1>Tus personajes.</h1><p>Tres historias posibles. ¿Cuál vas a continuar hoy?</p></div><Link to="/account">Mi cuenta →</Link></div>
        {error && <Message>{error}</Message>}{!ready ? <Loading /> : <div className="character-grid">{characters.map(c => <article className={`character-card ${c.deletedAt ? 'deleted' : ''}`} key={c.id}>
            <span className="tag">{c.town.toUpperCase()} · NIVEL {c.level}</span><CharacterPreview gender={c.gender} skin={c.skin} hair={c.hair} clothes={c.clothes} /><h2>{c.name}</h2><p>{c.deletedAt ? 'Eliminación pendiente · recuperable por 7 días' : `Última ubicación: ${c.world}`}</p>
            {c.deletedAt ? <button className="button" disabled={busy} onClick={() => change(c.id, 'restore')}>Restaurar personaje</button> : <><Link className="button" to={`/play/${c.id}`}>Entrar al mundo →</Link><button className="text-button delete-button" onClick={() => setDeleting(c)}>Eliminar personaje</button></>}
        </article>)}{Array.from({ length: Math.max(0, 3 - characters.length) }, (_, i) => <Link className="empty-character" key={i} to="/characters/new"><span>＋</span><h2>Una historia por escribir.</h2><p>Crear nuevo personaje</p></Link>)}</div>}
        {deleting && <div className="modal-backdrop"><form className="auth-card" role="dialog" aria-modal="true" aria-label="Eliminar personaje" onSubmit={e => { e.preventDefault(); change(deleting.id, 'delete', { name: new FormData(e.currentTarget).get('name') }); }}><h2>Eliminar {deleting.name}</h2><p>Podrás restaurarlo durante siete días. La ranura queda reservada durante ese plazo.</p><label>Escribí el nombre exacto<input autoFocus name="name" required /></label><button className="button" disabled={busy}>Confirmar eliminación</button><button className="text-button" type="button" onClick={() => setDeleting(null)}>Cancelar</button>{error && <Message>{error}</Message>}</form></div>}
    </section>;
}

function CreateCharacter() {
    const [gender, setGender] = useState(0); const [skin, setSkin] = useState(0); const [hair, setHair] = useState(0); const [clothes, setClothes] = useState(0); const [town, setTown] = useState('aresden');
    const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const navigate = useNavigate();
    async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setBusy(true); setError(''); try { await api('/characters', { name: new FormData(e.currentTarget).get('name'), town, gender, skin, hair, clothes }); navigate('/characters'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
    return <section className="create-page"><Link to="/characters">← Mis personajes</Link><p className="eyebrow">UN NUEVO COMIENZO</p><h1>Dale vida a tu historia.</h1><div className="create-layout"><div className="preview-stage"><CharacterPreview gender={gender} skin={skin} hair={hair} clothes={clothes} /><h2>Un aventurero de {town === 'aresden' ? 'Aresden' : 'Elvine'}</h2><p>Nivel 1 · Tu viaje está por comenzar</p></div>
        <form className="auth-card" onSubmit={submit}>{error && <Message>{error}</Message>}<label>Nombre del personaje<input name="name" required minLength={3} maxLength={16} pattern="[a-zA-Z][a-zA-Z0-9]{2,15}" placeholder="¿Cómo te conocerá el mundo?" /></label>
            <fieldset><legend>Tu ciudad de origen</legend><div className="town-choice">{['aresden','elvine'].map(t => <button type="button" key={t} aria-pressed={town === t} onClick={() => setTown(t)}><strong>{t === 'aresden' ? 'Aresden' : 'Elvine'}</strong><small>{t === 'aresden' ? 'El llamado del acero' : 'La senda de la magia'}</small></button>)}</div></fieldset>
            <div className="appearance-fields"><label>Cuerpo<select value={gender} onChange={e => setGender(+e.target.value)}><option value={0}>Masculino</option><option value={1}>Femenino</option></select></label><label>Piel<select value={skin} onChange={e => setSkin(+e.target.value)}>{['Clara','Bronceada','Oscura'].map((s,i) => <option key={i} value={i}>{s}</option>)}</select></label><label>Cabello<select value={hair} onChange={e => setHair(+e.target.value)}>{Array.from({length:8},(_,i) => <option key={i} value={i}>{i === 2 ? 'Sin cabello' : `Estilo ${i+1}`}</option>)}</select></label><label>Ropa<select value={clothes} onChange={e => setClothes(+e.target.value)}>{Array.from({length:8},(_,i) => <option key={i} value={i}>Color {i+1}</option>)}</select></label></div>
            <button className="button full" disabled={busy}>{busy ? 'Creando…' : 'Crear personaje'} <span>→</span></button>
        </form></div></section>;
}

function Play({ account }: { account: Account }) {
    const location = useLocation(); const id = location.pathname.split('/')[2]; const [character, setCharacter] = useState<Character | null | undefined>(); const [error, setError] = useState('');
    useEffect(() => { api<Character[]>('/characters').then(cs => setCharacter(cs.find(c => c.id === id && !c.deletedAt) ?? null)).catch(e => setError(e.message)); }, [id]);
    useEffect(() => {
        const isGameMaster = account.isGameMaster || character?.isGameMaster === true;
        setActiveCharacterGameMaster(isGameMaster);
        document.body.classList.toggle('portal-player', !isGameMaster);
        return () => document.body.classList.remove('portal-player');
    }, [account.isGameMaster, character]);
    useEffect(() => {
        const failed = () => setError('No se pudo entrar al mundo. Si el personaje está conectado en otra pestaña, cerrala y esperá unos segundos.');
        window.addEventListener('portal-connection-error', failed);
        return () => window.removeEventListener('portal-connection-error', failed);
    }, []);
    if (error) return <div className="portal"><Message>{error}</Message><Link to="/characters">Volver a personajes</Link></div>;
    if (character === undefined) return <Loading />;
    if (!character) return <Navigate to="/characters" replace />;
    const isGameMaster = account.isGameMaster || character.isGameMaster;
    setActiveCharacterName(character.name);
    return <div className={isGameMaster ? 'game-shell' : 'game-shell player-mode'}><div className="game-topbar"><span>{character.name} · Origen: {character.town}{isGameMaster ? ' · GM' : ''}</span><a href="/characters">Volver a personajes</a></div><Suspense fallback={<Loading />}><Game /></Suspense></div>;
}

export default function Portal() { return <BrowserRouter><Shell /></BrowserRouter>; }
