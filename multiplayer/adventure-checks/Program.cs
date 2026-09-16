using System.Reflection;
using System.Text.Json;
using Mmorpg.Network;
using Server;
using Server.Helpers;
using Server.Portal;
using Server.Utils;
using Server.World.Game;

Directory.SetCurrentDirectory(args.Length > 0 ? args[0] : "../server");
var passed = 0;
void Check(bool condition, string description) { if (!condition) throw new Exception("FAILED: " + description); Console.WriteLine("PASS: " + description); passed++; }
var settings = await Config.LoadSettings();
var monsters = Config.BuildMonsterCatalog(await Config.LoadMonstersConfig());
var spells = Config.BuildSpellCatalog(await Config.LoadSpellsConfig());
var items = Config.BuildItemCatalog(await Config.LoadItemsConfig());
PortalEndpoints.ItemCatalog = items;
if(args.Contains("--loot-report")) {
    var report = new List<string> {"# Botín de Darke Helbreath", "", "Generado desde las reglas que utiliza el servidor. Probabilidades por muerte con recompensa; cada drop normal es una tirada independiente. El oro se otorga directamente. El especial es una tirada adicional, no reemplaza los objetos normales.", "", "Sólo **Darkeruz autenticado como GM** tiene 75 % de especial. No cambia el nivel de los objetos, sus requisitos, sus rarezas ni el botín de otros jugadores. En combate compartido cuenta quien recibe la recompensa (mayor daño elegible). Sin sitio libre en el suelo no se materializa el objeto.", "", "## Monstruos", "", "| Monstruo | XP | Oro | Drops normales (cantidad; probabilidad) | Especial | Grupo |", "|---|---:|---:|---|---:|---|"};
    string P(double p)=> (p*100).ToString("0.#####",System.Globalization.CultureInfo.InvariantCulture)+" %";
    foreach(var (name,r) in Adventure.Rules.Monsters.OrderBy(m=>m.Value.Experience)) {
        var range=SpecialLoot.LevelRange(r.Experience);
        var drops=string.Join("; ",r.Drops.Select(d=>$"{items[d.ItemId].Name} (×{d.Min}–{d.Max}; {P(d.Chance)})"));
        report.Add($"| {name} | {r.Experience} | {r.GoldMin}–{r.GoldMax} | {drops} | {P(SpecialLoot.DropChance(r.Experience))} | [Base {range.Min}–{range.Max}](#grupo-{range.Max}) |");
    }
    report.AddRange(new[]{"", "## Objetos especiales posibles", "", "Cada base del grupo tiene la misma probabilidad de elección. La columna normal ya incluye la probabilidad de que caiga un especial; no es sólo una probabilidad condicional. El objeto recibe de 1 a 4 afijos. Su requisito final de nivel aumenta en 2 por cada rareza por encima de Superior (máximo +6).", ""});
    foreach(var xp in new[]{1,100,500,1500,5000,10000,20000,40000,80000}) {
        var range=SpecialLoot.LevelRange(xp);var pool=SpecialLoot.CandidateItemIds(xp,items);
        report.AddRange(new[]{ $"## Grupo {range.Max}", "", $"Niveles base {range.Min}–{range.Max}; {pool.Length} bases; elección condicional por base: {P(1d/pool.Length)}.", "", "| Base | Nivel | Normal por muerte | Darkeruz GM por muerte |", "|---|---:|---:|---:|"});
        foreach(var id in pool.OrderBy(id=>Adventure.Rules.Equipment[id].Level))report.Add($"| {items[id].Name} | {Adventure.Rules.Equipment[id].Level} | {P(SpecialLoot.DropChance(xp)/pool.Length)} | {P(.75/pool.Length)} |");
        report.Add("");
    }
    report.AddRange(new[]{"## Rareza condicionada a conseguir un especial", "", "| XP base del monstruo | Superior (1 afijo) | Excepcional (2) | Heroico (3) | Mítico (4) |", "|---|---:|---:|---:|---:|", "| Menos de 5.000 | 52 % | 48 % | 0 % | 0 % |", "| 5.000–39.999 | 52 % | 32 % | 16 % | 0 % |", "| 40.000 o más | 52 % | 32 % | 12 % | 4 % |", "", "Armas: daño, velocidad, crítico, veneno, fuego, hielo, parálisis, robo de vida/maná, oro o experiencia. Armaduras: defensa, vida, maná, oro o experiencia. Los afijos se eligen sin repetir dentro de sus grupos; el primero decide el color y brillo. No todos los monstruos pueden generar todas las rarezas.", "", "La tirada no garantiza una caída tras cierto número de intentos: son eventos aleatorios independientes. Las cifras mostradas pueden tener redondeo."});
    File.WriteAllLines("../../docs/TABLA-DROPS.md",report);
    Console.WriteLine("Generated docs/TABLA-DROPS.md");return;
}
Check(SpecialLoot.DropChance(20,true,"Darkeruz")==.75,"Darkeruz GM receives 75 percent special loot chance");
Check(SpecialLoot.DropChance(20,false,"Darkeruz")==.0025 && SpecialLoot.DropChance(20,true,"Other")==.0025,"name alone or another GM cannot gain test loot boost");
Check(SpecialLoot.CandidateItemIds(20,items).All(id=>Adventure.Rules.Equipment[id].Level<=10),"weak monsters cannot drop high-level special bases");
var plainItemLevel=SpecialLoot.CalculateItemLevel(Adventure.Rules.Equipment[53]);
var enchantedItemLevel=SpecialLoot.CalculateItemLevel(Adventure.Rules.Equipment[53],[new(SpecialLoot.FreezeChance,50),new(SpecialLoot.Health,40)]);
Check(plainItemLevel>0&&enchantedItemLevel>plainItemLevel&&SpecialLoot.CalculateItemLevel(Adventure.Rules.Equipment[401])>plainItemLevel,"item level compares base stats and weighted special powers without using required level");
var lowGlow = SpecialLoot.NormalizeProceduralEffects(53,[new(SpecialLoot.FreezeChance,50),new(4,0x55ccff),new(3,0x55ccff),new(SpecialLoot.ItemLevel,99)])!;
var highGlow = SpecialLoot.NormalizeProceduralEffects(53,[new(SpecialLoot.FreezeChance,50),new(4,0x55ccff),new(SpecialLoot.ItemLevel,100)])!;
Check(!lowGlow.Any(effect=>effect.Effect==3)&&highGlow.Any(effect=>effect.Effect==3)&&SpecialLoot.Value(highGlow,SpecialLoot.ItemLevel)==100,"special equipment glows only from iLvl 100 while preserving its special tint");
Check(PortalEndpoints.CharacterRecoveryDays==3,"deleted characters reserve their slot for three days");
Check(Adventure.ExperienceShare(100,false)==100 && Adventure.ExperienceShare(100,true)==60,
    "two-player parties grant 60 percent XP each and preserve full solo XP");Check(LanAccess.IsAllowedWebSocketOrigin("http://192.168.1.80:8080","192.168.1.80","http://localhost:8080",true)
    && LanAccess.IsAllowedWebSocketOrigin("http://192.168.1.80:8080","127.0.0.1","http://localhost:8080",true)
    && !LanAccess.IsAllowedWebSocketOrigin("http://8.8.8.8:8080","127.0.0.1","http://localhost:8080",true)
    && !LanAccess.IsAllowedWebSocketOrigin("http://192.168.1.80:8080","192.168.1.80","http://localhost:8080",false),"LAN mode accepts only the same web host and keeps local mode strict");
var corridorMap=new GameWorldOccupancyTracker(40,40,Enumerable.Range(0,39).Select(y=>(20,y)));
var corridors=TravelCorridors.Build(corridorMap,new[]{(2,2),(37,2)});
Check(corridors.Contains((20,39))&&corridors.Contains((2,2))&&corridors.Contains((37,2)),"transit routes go around walls and protect entrances");
Check(Adventure.MaxLevel==200 && Adventure.Rules.LevelThresholds[^1]==195235276,"hardcore curve defines exactly 200 levels");
Check(Adventure.Rules.Spells.Count==27 && Adventure.Rules.Spells[23].Intelligence==260 && Adventure.Rules.Spells[26].Level==1,"all executable spells, including early Recall, have progression requirements");
Check(Economy.Rules.Offers.Single(o=>o.SpellId==Casting.RecallSpellId) is {Level:1,Intelligence:10,Price:250},"Recall is an inexpensive early magic-shop spell");
Check(items.Keys.Count(id=>id>=329&&id<=408)==80 && Adventure.Rules.Equipment[408].Level==190,"ten colour tiers provide eighty level-gated equipment pieces");
var npcs = Config.BuildNpcCatalog(await Config.LoadNpcsConfig());
var worldConfigs = await Config.LoadGameWorldsConfig();
var training = worldConfigs.Single(w=>w.Id==Adventure.TrainingWorld);
var occupancy = new GameWorldOccupancyTracker(300,300,Array.Empty<(int,int)>());
var world = new GameWorld("training","aresden",null,occupancy,settings,monsters.BySprite,monsters.ById,spells,items,new Dictionary<int,NpcConfig>(),training.DwellAreas);
var flags = BindingFlags.Instance | BindingFlags.NonPublic;
var wr = (GameWorldRef)typeof(GameWorld).GetField("gameWorldRef",flags)!.GetValue(world)!;
// Isolated single-thread world fixture, without a network listener, worker or production admin endpoint.
void Dispatch(GameWorldMessage message) => typeof(GameWorld).GetMethod("HandleMessage",flags)!.Invoke(world,new object[]{message});
PlayerPersistenceState State(string name,int x=137,int y=140) => new("training",x,y,220,1200,600,1,16,500,2,true,true,true,
    BagItems:new[]{new PersistedInventoryItem(36,100,0,0,5,0,null),new PersistedInventoryItem(165,101,35,0,3,1,null)},
    EquippedItems:new[]{new PersistedEquippedInventoryItem("weapon",new PersistedEquippedItem(3,102,null,null,null))},CharacterName:name,Hp:100,MaxHp:100,Progress:new());
GameWorldPlayer Join(string name,PlayerPersistenceState? state=null) {
    var session=Guid.NewGuid(); Dispatch(new PlayerConnectedMessage(session,_=>{},_=>{},_=>{},state??State(name),name,()=>{}));
    if(!world.TryGetPlayerBySessionId(session,out var player))throw new Exception("join failed");
    player.SetSpawnProtection(false);return player;
}
void Packet(GameWorldPlayer p, ClientMessage message) => Dispatch(new ClientPacketMessage(p.SessionId,message));
var player=Join("CheckOne");
Check(player.Progress.Level==1 && player.MaxHp==100 && player.Damage==16,"level-one derived stats and starter weapon");
Check(!player.TryAllocateAttribute("strength") && !player.TryAllocateAttribute("invalid"),"no free or unknown attribute points");
var slimes=wr.MonstersByMonsterId.Values.Where(m=>m.Name=="Slime de entrenamiento").ToArray();
Check(slimes.Length==5,"training pit stays spacious for new players");
foreach(var slime in slimes.Take(4)) {
    while(!slime.Dead) Combat.ApplyPlayerDamageToMonster(wr,player,slime,AttackType.NoInterrupt);
    var xp=player.Progress.Experience; Adventure.RecordHit(wr,slime,player,99999);
    Check(player.Progress.Experience==xp,"replayed monster death cannot duplicate XP");
}
Check(player.Progress.Level==2 && player.Progress.Experience==80 && player.Progress.Points==3,"four slime kills grant level two and three points");
Check(player.Progress.Gold>=12 && player.Progress.Gold<=20,"slimes award bounded server-side gold");
Check(player.TryAllocateAttribute("vitality") && player.MaxHp==117 && player.Progress.Points==2,"vitality modifies maximum HP and consumes one point");
Check(player.TryAllocateAttribute("strength") && player.TryAllocateAttribute("intelligence") && !player.TryAllocateAttribute("agility"),"cannot overspend attribute budget");
Check(player.CanUseSpell(0) && !player.CanUseSpell(2),"spell level requirements");
var mana=player.Progress.Mana;
Check(player.SpendSpellMana(0) && player.Progress.Mana==mana-10,"mana cost is server-side");
player.ApplyDamage(70);
var potion=player.InventoryManager.BagItems.Single(i=>i.ItemId==36);
var oldHp=player.Hp;
Inventory.HandleConsumeItemRequest(wr,player,new ConsumeItemRequest{ItemUid=potion.ItemUid});
Check(player.Hp==oldHp+50 && potion.Quantity==4,"red potion heals and consumes exactly one");
Inventory.HandleConsumeItemRequest(wr,player,new ConsumeItemRequest{ItemUid=potion.ItemUid});
Check(potion.Quantity==4,"potion cooldown rejects a repeated request");
var snapshot=JsonSerializer.Deserialize<PlayerPersistenceState>(JsonSerializer.Serialize(player.CreatePersistenceState("training")))!;
var restored=Join("Restored",snapshot with {X=180,Y=180});
Check(restored.Progress==player.Progress && restored.Hp==player.Hp && restored.Damage==player.Damage,"snapshot round-trip preserves XP, attributes, resources and equipment");
var experience=player.Progress.Experience; var equipmentUid=player.InventoryManager.EquippedItems["weapon"].ItemUid;
player.ApplyDamage(99999);world.HandlePlayerDeath(wr,player);
Packet(player,new ClientMessage{PlayerResurrectedRequest=new()});
Check(!player.IsDead && player.Hp==player.MaxHp && Math.Abs(player.PosX-150)<=2 && Math.Abs(player.PosY-150)<=2,"death returns player alive to sanctuary");
Check(player.Progress.Experience==experience && player.InventoryManager.EquippedItems["weapon"].ItemUid==equipmentUid,"death preserves XP and item identity");
var dungeonConfig=worldConfigs.Single(w=>w.Id=="aresdend1");
var dungeonTeleports=dungeonConfig.TeleportLocs!.Select(t=>new GameWorldTeleportSet(t.Locs,new GameWorldTeleportTarget(t.Target.WorldId,worldConfigs.Single(w=>w.Id==t.Target.WorldId).Map,t.Target.Loc))).ToArray();
var dungeonMap=Map.LoadOccupancy("Config/maps",dungeonConfig.Map,dungeonConfig.TeleportLocs!.SelectMany(t=>t.Locs));
var dungeonWorld=new GameWorld(dungeonConfig.Id,dungeonConfig.Map,null,dungeonMap,settings,monsters.BySprite,monsters.ById,spells,items,npcs,null,dungeonTeleports);
var dungeonSession=Guid.NewGuid();
void DungeonDispatch(GameWorldMessage message)=>typeof(GameWorld).GetMethod("HandleMessage",flags)!.Invoke(dungeonWorld,new object[]{message});
DungeonDispatch(new PlayerConnectedMessage(dungeonSession,_=>{},_=>{},_=>{},State("DungeonWalker",55,28) with {GameWorldId="aresdend1"},"DungeonWalker",()=>{}));
Check(dungeonWorld.TryGetPlayerBySessionId(dungeonSession,out var dungeonPlayer),"dungeon resurrection fixture joins");
dungeonPlayer.SetSpawnProtection(false);dungeonPlayer.ApplyDamage(99999);
var dungeonWr=(GameWorldRef)typeof(GameWorld).GetField("gameWorldRef",flags)!.GetValue(dungeonWorld)!;
dungeonWorld.HandlePlayerDeath(dungeonWr,dungeonPlayer);
DungeonDispatch(new ClientPacketMessage(dungeonSession,new ClientMessage{PlayerResurrectedRequest=new()}));
Check(!dungeonPlayer.IsDead&&dungeonConfig.TeleportLocs![0].Locs.Min(loc=>Math.Abs(loc.X-dungeonPlayer.PosX)+Math.Abs(loc.Y-dungeonPlayer.PosY))<=2,"dungeon death returns beside the configured entrance portal");
var safeHp=player.Hp;
MonsterVisibility.BroadcastPlayerReceiveDamage(wr,player.PlayerId,99999,slimes[0].MonsterId,AttackType.NoInterrupt,0);
Check(player.Hp==safeHp,"sanctuary rejects monster damage");
MonsterVisibility.BroadcastPlayerTakeDamage(wr,player.PlayerId,99999,restored.PlayerId,AttackType.NoInterrupt,0);
Check(player.Hp==safeHp,"training rejects PvP damage");
var ordinaryLevel=player.Progress.Level;
Packet(player,new ClientMessage{ChatMessageSendRequest=new(){Message="/gm level 30"}});
Check(player.Progress.Level==ordinaryLevel,"ordinary character cannot execute GM commands");
var gmPlayer=Join("GameMaster",State("GameMaster",210,210) with {IsGameMaster=true});
Check(!Server.World.Global.GlobalPacketRouting.ShouldRouteToGlobalWorld(new ClientMessage{ChatMessageSendRequest=new(){Message="/gm heal"}}),"GM command envelope routes to the authoritative game world");
Packet(gmPlayer,new ClientMessage{ChatMessageSendRequest=new(){Message="/gm level 30"}});
Check(gmPlayer.Progress.Level==30&&gmPlayer.Progress.Points==87,"GM can raise level with the correct attribute budget");
Packet(gmPlayer,new ClientMessage{ChatMessageSendRequest=new(){Message="/gm god"}});var gmHp=gmPlayer.Hp;gmPlayer.ApplyDamage(99999);
Check(gmPlayer.Hp==gmHp&&gmPlayer.GameMasterInvulnerable,"GM invulnerability rejects lethal damage");
Packet(gmPlayer,new ClientMessage{ChatMessageSendRequest=new(){Message="/gm spells"}});
Check(Adventure.Rules.Spells.Keys.All(id=>(gmPlayer.Progress.KnownSpellsMask&(1<<id))!=0),"GM can unlock all test spells");
var gmMana=gmPlayer.Progress.Mana;
Check(gmPlayer.CanUseSpell(23)&&gmPlayer.SpendSpellMana(23)&&gmPlayer.Progress.Mana==gmMana,"GM can cast every unlocked spell without progression or mana restrictions");
var magicBeforeStrength=gmPlayer.MagicDamage;gmPlayer.TryAllocateAttribute("strength");
Check(gmPlayer.MagicDamage==magicBeforeStrength,"Strength allocation never increases magic damage");
WorldTransferDestination? recallTransfer=null;var recallSession=Guid.NewGuid();
Dispatch(new PlayerConnectedMessage(recallSession,_=>{},_=>{},d=>recallTransfer=d,
    State("Recaller",195,195) with {HomeTown="elvine",Progress=new(KnownSpellsMask:1<<Casting.RecallSpellId)},"Recaller",()=>{}));
Check(world.TryGetPlayerBySessionId(recallSession,out var recaller),"Recall fixture joins");
typeof(Casting).GetMethod("ResolveRecall",BindingFlags.Static|BindingFlags.NonPublic)!.Invoke(null,new object[]{wr,recaller!});
var elvineRecallPoints=new HashSet<(int,int)>{(170,146),(158,58),(158,250),(242,130),(110,90)};
Check(recallTransfer is not null&&recallTransfer.WorldId=="elvine"&&recallTransfer.SpawnX.HasValue&&recallTransfer.SpawnY.HasValue&&elvineRecallPoints.Contains((recallTransfer.SpawnX.Value,recallTransfer.SpawnY.Value)),"Recall selects one classic portal in the protected home city");
var legacySpecialState=State("LegacySpecial",225,225) with {BagItems=[new PersistedInventoryItem(53,9001,0,0,1,0,[new ItemEffectConfig(SpecialLoot.FreezeChance,50)])]};
var legacySpecial=Join("LegacySpecial",legacySpecialState);
Check(SpecialLoot.Value(legacySpecial.InventoryManager.BagItems.Single().EffectOverrides,SpecialLoot.ItemLevel)>plainItemLevel,"older procedural items receive their missing iLvl while loading");
// Ground ownership survives reconnect via a stable character key, not ephemeral player ID.
var loot=new GroundItemState(53,555,1,null,180,180){OwnerKey="owner",ReservedUntil=DateTimeOffset.UtcNow.AddSeconds(60)};
wr.GroundStateTracker.TryAddGroundItem(loot,out _,out _);
Packet(restored,new ClientMessage{PlayerItemPickupRequested=new()});
Check(wr.GroundStateTracker.TryGetTopGroundItem(555,out _),"another character cannot take reserved loot");
wr.GroundStateTracker.RemoveDroppedItem(555,180,180,out _,out _);
var publicLoot=new GroundItemState(53,556,1,null,180,180){OwnerKey="owner",ReservedUntil=DateTimeOffset.UtcNow.AddSeconds(-1)};
wr.GroundStateTracker.TryAddGroundItem(publicLoot,out _,out _);
Packet(restored,new ClientMessage{PlayerItemPickupRequested=new()});
Packet(restored,new ClientMessage{PlayerItemPickupRequested=new()});
Check(restored.InventoryManager.BagItems.Count(i=>i.ItemUid==556)==1 && !wr.GroundStateTracker.TryGetTopGroundItem(556,out _),"expired reservation permits pickup exactly once");
var partyOne = Join("PartyOne", State("PartyOne",137,140) with { PersistenceKey = "party-key-one" });
var partyTwo = Join("PartyTwo", State("PartyTwo",139,140) with { PersistenceKey = "party-key-two" });
Packet(partyOne,new ClientMessage{ChatMessageSendRequest=new(){Message="/party invitar PartyTwo"}});
Packet(partyTwo,new ClientMessage{ChatMessageSendRequest=new(){Message="/party aceptar"}});
Check(world.IsInSameParty(partyOne.PlayerId,partyTwo.PlayerId),"party invite and accept link both players");
Check(world.CanPickupSharedLoot(partyOne.PersistenceKey,partyTwo) && world.CanPickupSharedLoot(partyTwo.PersistenceKey,partyOne),"party partners share reserved loot");
Check(!world.CanPickupSharedLoot("unknown-key",partyTwo),"strangers still cannot take reserved loot");
var partyHp=partyTwo.Hp;
Combat.ApplyPlayerDamageToPlayer(wr,partyOne,partyTwo,AttackType.NoInterrupt);
Check(partyTwo.Hp==partyHp,"party members cannot damage each other");
Packet(partyOne,new ClientMessage{ChatMessageSendRequest=new(){Message="/party salir"}});
Check(!world.IsInSameParty(partyOne.PlayerId,partyTwo.PlayerId) && !world.CanPickupSharedLoot(partyOne.PersistenceKey,partyTwo),"leaving the party ends shared loot");
Inventory.HandleEquipItemRequest(wr,restored,new EquipItemRequest{ItemUid=556,TargetSlot="weapon"});
Check(restored.InventoryManager.EquippedItems["weapon"].ItemId==3,"cannot equip level-three sword at level two");
restored.AwardExperience(120);
Inventory.HandleEquipItemRequest(wr,restored,new EquipItemRequest{ItemUid=556,TargetSlot="weapon"});
Check(restored.InventoryManager.EquippedItems["weapon"].ItemId==53 && restored.Damage>player.Damage,"valid equipment changes derived damage");
restored.AwardExperience((int)Adventure.Rules.LevelThresholds[^1]);
Check(restored.Progress.Level==200 && restored.Progress.Experience==Adventure.Rules.LevelThresholds[^1],"configurable progression caps safely at level 200");
Check(restored.Progress.Points+(restored.Progress.Strength+restored.Progress.Vitality+restored.Progress.Intelligence+restored.Progress.Agility-40)==597,"all 200 levels conserve the attribute budget");
// Full body equipment participates in authoritative defense, not only shields.
Check(restored.InventoryManager.TryCreateItem(130,null,out var armorCreated),"catalog creates leather armor");
Inventory.ApplyInventoryMutation(wr,restored,armorCreated);var beforeArmor=restored.Defense;
var armorItem=restored.InventoryManager.BagItems.Single(i=>i.ItemId==130);
Inventory.HandleEquipItemRequest(wr,restored,new EquipItemRequest{ItemUid=armorItem.ItemUid,TargetSlot="armor"});
Check(restored.InventoryManager.EquippedItems["armor"].ItemId==130&&restored.Defense==beforeArmor+2,"body armor equips and adds defense");
for(var i=0;i<settings.MaxDroppedItemsInStack;i++)wr.GroundStateTracker.TryAddGroundItem(new GroundItemState(3,1000+i,1,null,200,200),out _,out _);
Check(!wr.GroundStateTracker.CanDropAt(200,200),"full ground stack refuses to overwrite valuable items");
Check(wr.GroundStateTracker.RemoveDroppedItem(1000,200,200,out _,out var top) && top?.ItemUid==1000+settings.MaxDroppedItemsInStack-1,"expiration removes a buried item without losing the newest");
// Verify the actual map has a walkable path from the sanctuary to each training enclosure.
var map=Map.LoadOccupancy("Config/maps","aresden");
var visited=new HashSet<(int,int)>{(150,150)};var queue=new Queue<(int,int)>();queue.Enqueue((150,150));
while(queue.TryDequeue(out var pos))foreach(var delta in new[]{(-1,0),(1,0),(0,-1),(0,1)}) {
    var next=(pos.Item1+delta.Item1,pos.Item2+delta.Item2);
    if(map.IsFreeAndNotTeleportCell(next.Item1,next.Item2)&&visited.Add(next))queue.Enqueue(next);
}
foreach(var area in training.DwellAreas!) { var bounds=area.Area!; Check(visited.Any(p=>p.Item1>=Math.Min(bounds.X1,bounds.X2)&&p.Item1<=Math.Max(bounds.X1,bounds.X2)&&p.Item2>=Math.Min(bounds.Y1,bounds.Y2)&&p.Item2<=Math.Max(bounds.Y1,bounds.Y2)),"reachable training area "+area.MonsterId); }
// World graph preserves the classic two-route city topology and physical service doors.
var aresdenConfig=worldConfigs.Single(w=>w.Id=="aresden");var elvineConfig=worldConfigs.Single(w=>w.Id=="elvine");var middlelandConfig=worldConfigs.Single(w=>w.Id=="middleland");
Check(aresdenConfig.TeleportLocs!.Count(t=>t.Target.WorldId=="middleland")==2&&elvineConfig.TeleportLocs!.Count(t=>t.Target.WorldId=="middleland")==2,"Aresden and Elvine retain both classic roads to Middleland");
Check(middlelandConfig.TeleportLocs!.Count(t=>t.Target.WorldId=="aresden")==2&&middlelandConfig.TeleportLocs!.Count(t=>t.Target.WorldId=="elvine")==2,"Middleland has bidirectional city gates");
Check(aresdenConfig.DwellAreas!.Length>=17&&elvineConfig.DwellAreas!.Length>=17&&aresdenConfig.DwellAreas.Sum(p=>p.Count)>=850&&elvineConfig.DwellAreas.Sum(p=>p.Count)>=850&&aresdenConfig.DwellAreas.Concat(elvineConfig.DwellAreas).All(p=>p.Area!.X2<=69||p.Area.X1>=250||p.Area.Y2<=48||p.Area.Y1>=240),"Aresden and Elvine have x4-density beginner hunting pits exclusively around their outer perimeters");
Check(middlelandConfig.DwellAreas!.Length>=22&&middlelandConfig.DwellAreas.Sum(p=>p.Count)>=300&&worldConfigs.Count(w=>w.DwellAreas?.Length>0)>=16&&new[]{"areshop","arewrus","arebsmith","arewzdtwr","elvshop","elvwrus","elvbsmith","elvwzdtwr"}.All(id=>worldConfigs.Single(w=>w.Id==id).Npcs?.Length==1),"Middleland density, sixteen populated worlds and NPC interiors are configured");
var tutorialShopPortal=training.TeleportLocs!.Single(t=>t.Target.WorldId=="darke-shop");
var runtimeShopPortal=new GameWorldTeleportSet(tutorialShopPortal.Locs,new GameWorldTeleportTarget("darke-shop","gshop_1",tutorialShopPortal.Target.Loc));
var portalMap=Map.LoadOccupancy("Config/maps","aresden",tutorialShopPortal.Locs);
var portalWorld=new GameWorld("training","aresden",null,portalMap,settings,monsters.BySprite,monsters.ById,spells,items,npcs,null,new[]{runtimeShopPortal});
WorldTransferDestination? capturedTransfer=null;var portalSession=Guid.NewGuid();
typeof(GameWorld).GetMethod("HandleMessage",flags)!.Invoke(portalWorld,new object[]{new PlayerConnectedMessage(portalSession,_=>{},_=>{},d=>capturedTransfer=d,State("PortalWalker",126,166),"PortalWalker",()=>{})});
typeof(GameWorld).GetMethod("HandleMessage",flags)!.Invoke(portalWorld,new object[]{new ClientPacketMessage(portalSession,new ClientMessage{WorldChangeRequest=new(){WorldId="darke-shop",GameWorldId="training",ValidateTeleport=true}})});
Check(capturedTransfer is {WorldId:"darke-shop",SpawnX:50,SpawnY:39},"walking onto a configured door authorizes its exact server-side destination");
// Blacksmith fixture: proximity gates commerce; a purchase is atomic and replay-safe.
var shopMap=Map.LoadOccupancy("Config/maps","bsmith_1");
var shopWorld=new GameWorld("darke-bsmith","bsmith_1",null,shopMap,settings,monsters.BySprite,monsters.ById,spells,items,npcs,null,null,new[]{new GameWorldNpcPlacementConfig(3,49,33,7)});
var shopWr=(GameWorldRef)typeof(GameWorld).GetField("gameWorldRef",flags)!.GetValue(shopWorld)!;
var buyerSession=Guid.NewGuid();var buyerState=State("Buyer",49,37) with { Progress=new ProgressState(Level:2,Gold:500,KnownSpellsMask:1) };
typeof(GameWorld).GetMethod("HandleMessage",flags)!.Invoke(shopWorld,new object[]{new PlayerConnectedMessage(buyerSession,_=>{},_=>{},_=>{},buyerState,"Buyer",()=>{})});
Check(shopWorld.TryGetPlayerBySessionId(buyerSession,out var buyer),"buyer joins shop interior");
var liveBuyer=buyer!;
Check(Economy.ServiceAt(shopWr,liveBuyer)=="blacksmith","merchant service requires proximity to its NPC");
Economy.Handle(shopWr,liveBuyer,new EconomyRequest{Action="buy",OfferId="leather",Revision=0,RequestId="one"});
Check(liveBuyer.Progress.Gold==450&&liveBuyer.Progress.TradeRevision==1&&liveBuyer.InventoryManager.BagItems.Any(i=>i.ItemId==130),"blacksmith deducts authoritative price and grants armor");
var itemCount=liveBuyer.InventoryManager.BagItems.Count;
Economy.Handle(shopWr,liveBuyer,new EconomyRequest{Action="buy",OfferId="leather",Revision=0,RequestId="replay"});
Check(liveBuyer.Progress.Gold==450&&liveBuyer.InventoryManager.BagItems.Count==itemCount,"stale purchase replay cannot duplicate an item");
liveBuyer.SetEconomyProgress(liveBuyer.Progress with {Kills=10});
Economy.Handle(shopWr,liveBuyer,new EconomyRequest{Action="quest-claim",OfferId="forge-trial",Revision=1,RequestId="quest"});
Check(liveBuyer.Progress.Gold==630&&(liveBuyer.Progress.QuestRewardsMask&2)!=0&&liveBuyer.InventoryManager.BagItems.Any(i=>i.ItemId==52),"NPC quest reward is persistent, proximity-gated and grants its exact item");
Economy.Handle(shopWr,liveBuyer,new EconomyRequest{Action="quest-claim",OfferId="forge-trial",Revision=2,RequestId="quest-replay"});
Check(liveBuyer.Progress.Gold==630,"completed quest cannot be claimed twice");
Console.WriteLine($"Adventure checks: {passed} passed.");
