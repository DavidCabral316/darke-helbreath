import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'server', 'Config');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(root, name), `${JSON.stringify(value, null, 2)}\n`);

const tiers = [
  ['Hierro', 10, 0x9aa0a6], ['Azur', 30, 0x4d8dff], ['Esmeralda', 50, 0x35b85a],
  ['Carmesí', 70, 0xd84a4a], ['Amatista', 90, 0x9b59e6], ['Obsidiana', 110, 0x55596b],
  ['Marfil', 130, 0xefe6cf], ['Solar', 155, 0xf4c542], ['Astral', 180, 0x52e5ff],
  ['Eclipse', 190, 0xff7ae5],
];
const slots = [
  ['Espadón', 62, 'weapon'], ['Escudo', 4, 'shield'], ['Coraza', 133, 'armor'],
  ['Camisote', 129, 'hauberk'], ['Grebas', 137, 'leggings'], ['Yelmo', 144, 'helmet'],
  ['Botas', 127, 'boots'], ['Capa', 126, 'cape'],
];
const tierId = (tier, slot) => 329 + tier * slots.length + slot;

const items = read('Items.json').filter((item) => item.id < 329);
for (const [tierIndex, [tierName, , colour]] of tiers.entries()) {
  for (const [slotIndex, [slotName, , itemType]] of slots.entries()) {
    items.push({
      id: tierId(tierIndex, slotIndex), name: `${slotName} ${tierName}`, itemType,
      effects: [{ effect: 4, effectColor: colour }, { effect: 5, effectColor: colour }],
    });
  }
}
write('Items.json', items);

const thresholds = [0, 80, 200, 400, 700, 1150, 1800, 2750, 4100, 6000];
let total = thresholds.at(-1);
for (let level = 10; level < 200; level++) {
  total += Math.round(35 * level ** 2.15);
  thresholds.push(total);
}

const adventure = read('Adventure.json');
adventure.levelThresholds = thresholds;
adventure.equipment = Object.fromEntries(Object.entries(adventure.equipment).filter(([id]) => Number(id) < 329));
for (const [tierIndex, [, level]] of tiers.entries()) {
  const t = tierIndex + 1;
  const bonuses = [
    { damage: 14 + tierIndex * 13 }, { defense: 4 + tierIndex * 4 }, { defense: 5 + tierIndex * 4 },
    { defense: 3 + tierIndex * 2 }, { defense: 4 + tierIndex * 3 }, { defense: 2 + tierIndex * 2 },
    { defense: 1 + tierIndex }, { defense: 1 + tierIndex },
  ];
  bonuses.forEach((bonus, slotIndex) => {
    adventure.equipment[tierId(tierIndex, slotIndex)] = { ...bonus, level };
  });
}

const spellProgression = [
  [1,10,100],[8,20,108],[18,28,118],[25,35,110],[32,42,105],[40,50,125],[48,60,132],
  [56,70,110],[64,80,112],[72,90,120],[80,100,140],[90,112,150],[100,125,145],[110,138,135],
  [120,150,155],[130,160,100],[140,170,165],[150,180,160],[160,190,178],[170,205,195],
  [178,220,185],[184,235,205],[188,245,215],[192,260,225],[95,120,100],[115,140,100],
];
const mana = [10,18,25,30,38,42,48,58,65,72,80,88,98,110,122,130,145,160,175,190,210,230,250,290,90,110];
adventure.spells = Object.fromEntries(spellProgression.map(([level, intelligence, powerPercent], id) => [id, { level, mana: mana[id], intelligence, powerPercent }]));

const loot = (itemId, chance) => ({ itemId, chance, min: 1, max: 1 });
const rewards = {
  'Slime de entrenamiento':[20,3,5,[loot(36,1)]], 'Hormiga de entrenamiento':[40,4,7,[loot(36,.3),loot(165,.12)]],
  'Serpiente de entrenamiento':[70,7,11,[loot(36,.28),loot(165,.18)]], 'Orco de entrenamiento':[110,11,17,[loot(36,.3),loot(165,.2),loot(128,.02)]],
  Slime:[18,1,3,[loot(36,.08),loot(208,.2)]], Ant:[28,2,5,[loot(36,.1),loot(181,.16)]], Snake:[42,3,7,[loot(165,.08),loot(177,.15)]],
  Scorpion:[70,5,11,[loot(36,.12),loot(203,.15)]], Orc:[105,8,16,[loot(36,.14),loot(194,.14),loot(tierId(0,6),.004)]],
  Skeleton:[145,12,22,[loot(165,.13),loot(207,.18),loot(tierId(0,5),.004)]], Zombie:[175,15,27,[loot(36,.16),loot(tierId(0,3),.003)]],
  Ogre:[360,28,48,[loot(36,.18),loot(197,.16),loot(tierId(0,2),.006),loot(tierId(0,0),.004)]],
  'Master Mage Orc':[480,38,62,[loot(165,.22),loot(tierId(1,3),.004),loot(tierId(1,7),.003)]],
  Werewolf:[720,58,92,[loot(36,.2),loot(257,.18),loot(tierId(1,2),.004),loot(tierId(1,4),.003)]],
  Cyclops:[1150,90,145,[loot(36,.24),loot(183,.18),loot(tierId(2,1),.0035),loot(tierId(2,5),.003)]],
  Stalker:[1800,145,230,[loot(165,.25),loot(tierId(3,6),.0025),loot(tierId(3,7),.002)]],
  Hellclaw:[3200,260,410,[loot(36,.3),loot(165,.3),loot(187,.2),loot(tierId(4,2),.0018),loot(tierId(4,0),.0012)]],
  'Clay Golem':[2400,190,310,[loot(193,.25),loot(tierId(2,2),.0025)]], Troll:[4200,340,540,[loot(210,.2),loot(tierId(3,3),.002)]],
  'Stone Golem':[6500,520,820,[loot(209,.25),loot(tierId(4,1),.0018)]], Hellhound:[8500,680,1050,[loot(tierId(4,6),.0016)]],
  Beholder:[12000,950,1450,[loot(tierId(5,5),.0014)]], Lich:[18000,1450,2200,[loot(tierId(6,3),.0012),loot(tierId(6,7),.001)]],
  Frost:[9000,720,1150,[loot(tierId(5,6),.0015)]], 'Ice Golem':[14000,1100,1750,[loot(tierId(6,1),.0012)]],
  Demon:[30000,2400,3600,[loot(249,.22),loot(tierId(7,2),.0009),loot(tierId(7,0),.0007)]],
  'Dark Elf':[22000,1750,2700,[loot(tierId(6,0),.001),loot(tierId(6,4),.001)]],
  Dragon:[65000,5200,7800,[loot(tierId(8,2),.0007),loot(tierId(8,0),.0005)]],
  'Abaddon (incomplete)':[180000,14000,22000,[loot(tierId(9,2),.00035),loot(tierId(9,0),.00025)]],
};
adventure.monsters = Object.fromEntries(Object.entries(rewards).map(([name,[experience,goldMin,goldMax,drops]]) => [name,{experience,goldMin,goldMax,drops}]));
write('Adventure.json', adventure);

const economy = { offers: [
  {id:'red',name:'Poción de vida (+50)',service:'shop',price:8,itemId:36},
  {id:'blue',name:'Poción de maná (+40)',service:'shop',price:10,itemId:165},
  {id:'short',name:'Espada corta · daño +5',service:'blacksmith',price:25,itemId:3},
  {id:'long',name:'Espada larga · daño +9',service:'blacksmith',price:90,itemId:53,level:3},
  {id:'sabre',name:'Sable · daño +13',service:'blacksmith',price:180,itemId:54,level:5},
  {id:'broad',name:'Espada ancha · daño +18',service:'blacksmith',price:320,itemId:59,level:7},
  {id:'shield1',name:'Escudo de cuero · defensa +2',service:'blacksmith',price:35,itemId:7},
  {id:'shield2',name:'Escudo de caballero · defensa +4',service:'blacksmith',price:120,itemId:5,level:4},
  {id:'shield3',name:'Escudo torre · defensa +6',service:'blacksmith',price:240,itemId:4,level:7},
  {id:'shirt',name:'Camisa · defensa +1',service:'blacksmith',price:15,itemId:128},
  {id:'shoes',name:'Zapatos · defensa +1',service:'blacksmith',price:20,itemId:127},
  {id:'trousers',name:'Pantalones · defensa +1',service:'blacksmith',price:25,itemId:134},
  {id:'leather',name:'Armadura de cuero · defensa +2',service:'blacksmith',price:50,itemId:130,level:2},
  {id:'helmet',name:'Casco · defensa +1',service:'blacksmith',price:45,itemId:143,level:3},
  {id:'chain',name:'Cota de malla · defensa +3',service:'blacksmith',price:140,itemId:131,level:5},
  {id:'hose',name:'Calzas de malla · defensa +2',service:'blacksmith',price:100,itemId:136,level:5},
  {id:'hauberk',name:'Camisote · defensa +2',service:'blacksmith',price:110,itemId:129,level:6},
  {id:'plate',name:'Armadura de placas · defensa +4',service:'blacksmith',price:280,itemId:133,level:8},
  {id:'legs',name:'Grebas · defensa +3',service:'blacksmith',price:190,itemId:137,level:8},
  {id:'fullhelm',name:'Casco completo · defensa +2',service:'blacksmith',price:130,itemId:144,level:7},
  {id:'cape',name:'Capa · defensa +1',service:'blacksmith',price:90,itemId:125,level:4},
  {id:'robe',name:'Túnica · defensa +1, magia +3, maná +15',service:'blacksmith',price:120,itemId:142,level:4},
  {id:'wizardcap',name:'Gorro de mago · magia +2, maná +10',service:'blacksmith',price:80,itemId:152,level:3},
] };
for (const [tierIndex, [tierName, level]] of tiers.entries()) {
  for (const [slotIndex, [slotName]] of slots.entries()) {
    const multiplier = [1.25,.8,1,.65,.8,.55,.45,.5][slotIndex];
    const price = Math.round(250 * (tierIndex + 1) ** 4 * multiplier);
    economy.offers.push({ id:`tier-${tierIndex + 1}-${slotIndex}`, name:`${slotName} ${tierName}`, service:'blacksmith', price, itemId:tierId(tierIndex,slotIndex), level });
  }
}
const spellNames = read('Spells.json').sort((a,b) => a.id-b.id).map((spell) => spell.name);
for (const [id, [level, intelligence]] of spellProgression.entries()) {
  if (id === 0) continue;
  const price = Math.min(7500000, Math.round(80 * (id + 1) ** 3.15));
  economy.offers.push({ id:`spell-${id}`, name:`Aprender ${spellNames[id]} · ${mana[id]} maná`, service:'magic', price, spellId:id, level, intelligence });
}
economy.offers = economy.offers.map((offer) => ({
  ...offer,
  itemId: offer.itemId ?? 0,
  spellId: offer.spellId ?? -1,
  level: offer.level ?? 1,
  intelligence: offer.intelligence ?? 10,
}));
write('Economy.json', economy);

const monsters = read('Monsters.json');
const tuning = {
  1:[35,2,4,7000],2:[50,3,6,8000],3:[70,4,8,9000],50:[110,7,12,10000],40:[160,10,17,11000],51:[220,13,22,12000],61:[260,16,27,12000],
  47:[550,28,40,16000],36:[450,24,38,18000],60:[850,38,55,20000],14:[1300,50,75,24000],53:[1900,65,90,26000],33:[3500,90,125,35000],
  12:[1200,40,65,22000],58:[2500,80,115,30000],28:[4200,110,155,40000],32:[5000,130,180,45000],7:[6500,150,210,50000],
  46:[9500,180,250,60000],18:[15000,230,320,75000],15:[8000,150,220,55000],20:[7000,145,205,50000],34:[11000,190,270,65000],5:[35000,320,450,120000],62:[100000,600,850,300000],
};
for (const monster of monsters) {
  const row = tuning[monster.id];
  if (!row) continue;
  [monster.hp, monster.attackDamageMin, monster.attackDamageMax, monster.respawnTime] = row;
  monster.attackSpeed ??= 1100;
  monster.chaseDistance ??= 6;
  monster.chaseMaxDistance ??= 10;
  monster.attackRange ??= 1;
  monster.movementSpeed = Math.max(520, monster.movementSpeed ?? 750);
  monster.allegiance = 0;
}
write('Monsters.json', monsters);

const worlds = read('GameWorlds.json');
const area = (monsterId,count,x1,y1,x2,y2) => ({monsterId,count,area:{x1,y1,x2,y2}});
const setPits = (id,pits) => { const world=worlds.find((entry)=>entry.id===id); if(world) world.dwellAreas=pits; };
// The tutorial deliberately stays spacious; high-density populations begin in the two cities.
setPits('training',[area(63,5,138,138,144,142),area(64,5,128,138,136,145),area(65,4,138,128,144,136),area(66,3,128,128,136,136)]);
setPits('aresden',[area(1,16,240,200,270,220),area(1,16,120,230,155,255),area(2,14,95,150,145,200),area(3,14,95,28,132,48),area(3,14,148,30,180,52),area(50,14,185,225,235,250),area(40,12,215,100,270,205),area(51,10,32,32,85,90),area(61,8,200,40,260,85)]);
setPits('elvine',[area(1,16,145,25,172,52),area(1,16,248,170,272,202),area(2,14,188,100,240,160),area(3,14,125,222,152,250),area(3,14,130,255,168,275),area(50,14,225,200,264,228),area(40,12,78,138,132,202),area(51,10,32,32,88,92),area(61,8,185,225,245,265)]);
setPits('middleland',[
  area(47,14,130,330,180,365),area(47,14,410,300,470,360),area(47,16,34,69,100,86),area(47,14,400,180,460,240),
  area(61,18,157,460,190,492),area(61,18,309,40,342,72),area(50,18,275,458,308,492),area(50,18,78,108,113,133),
  area(51,18,78,386,124,414),area(40,20,280,175,345,235),area(36,10,292,188,333,223),area(60,14,318,418,373,473),
  area(14,12,226,336,284,394),area(53,22,107,202,210,270),area(53,22,315,235,418,304),area(33,5,162,256,227,299),
  area(12,14,35,300,105,365),area(58,12,350,85,420,145),area(28,10,210,80,270,135),area(32,8,430,390,485,455),
  area(7,6,35,165,90,225),area(15,8,250,255,310,310)
]);
setPits('aresdend1',[area(47,18,20,20,70,65),area(60,15,75,20,125,65),area(14,14,130,20,180,70),area(12,16,20,75,75,125),area(58,12,80,75,135,130),area(28,10,140,80,190,135),area(33,6,45,135,105,180)]);
setPits('elvined1',[area(47,18,20,20,70,65),area(60,15,75,20,125,65),area(14,14,130,20,180,70),area(12,16,20,75,75,125),area(58,12,80,75,135,130),area(28,10,140,80,190,135),area(33,6,45,135,105,180)]);
setPits('middled1n',[area(60,18,15,15,65,55),area(14,16,70,15,125,60),area(12,18,130,15,185,65),area(58,14,20,70,80,125),area(28,12,90,70,145,130),area(33,7,150,75,195,130)]);
setPits('middled1x',[area(28,14,15,15,60,60),area(32,12,65,15,120,60),area(7,10,20,70,70,120),area(46,8,75,70,130,125),area(18,6,25,130,85,180),area(15,8,90,130,140,185)]);
setPits('toh1',[area(28,16,20,20,80,80),area(32,14,90,20,150,80),area(7,12,30,90,90,150),area(46,8,100,90,160,155)]);
setPits('toh2',[area(32,15,20,20,80,80),area(7,14,90,20,150,80),area(46,10,30,90,90,150),area(18,8,100,90,160,155)]);
setPits('dglv2',[area(12,22,30,30,150,150),area(58,18,170,30,300,150),area(28,15,320,30,450,160),area(32,12,80,260,220,400),area(7,10,270,270,420,420)]);
setPits('dglv3',[area(28,18,30,30,160,160),area(32,16,180,30,320,170),area(7,14,340,30,470,170),area(46,10,80,280,230,430),area(18,8,270,280,430,440)]);
setPits('dglv4',[area(7,18,30,30,160,160),area(46,14,180,30,320,170),area(18,12,340,30,470,170),area(15,12,80,280,230,430),area(5,3,270,280,430,440)]);
setPits('icebound',[area(20,24,28,23,81,59),area(34,18,179,217,226,260),area(32,15,174,26,236,83),area(46,10,102,219,164,277),area(5,3,198,170,243,206)]);
setPits('abaddon',[area(18,16,25,25,100,100),area(46,12,110,25,190,105),area(15,12,25,115,105,195),area(5,4,115,115,195,195),area(62,1,90,90,130,130)]);
write('GameWorlds.json', worlds);

console.log(`Generated ${thresholds.length} levels, ${items.length} items, ${economy.offers.length} offers and populated ${worlds.filter(w => w.dwellAreas?.length).length} worlds.`);
