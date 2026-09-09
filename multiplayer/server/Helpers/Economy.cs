using System.Text.Json;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

public sealed record ShopOffer(string Id, string Name, string Service, int Price, int ItemId = 0, int SpellId = -1, int Level = 1, int Intelligence = 10);
public sealed record EconomyRules(ShopOffer[] Offers);

// All operations execute inside the owning world's serial mailbox. Gold, inventory,
// learned spells and personal warehouse share one versioned JSONB snapshot.
public static class Economy {
    public static EconomyRules Rules { get; } = Load();
    private static EconomyRules Load() {
        var rules = JsonSerializer.Deserialize<EconomyRules>(File.ReadAllText("Config/Economy.json"), new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        if (rules.Offers.Select(o => o.Id).Distinct().Count() != rules.Offers.Length ||
            rules.Offers.Any(o => o.Price < 1 || o.Price > 100000000 || o.Level < 1 || o.Intelligence < 10 || (o.ItemId > 0) == (o.SpellId >= 0)))
            throw new InvalidOperationException("Invalid economy offers.");
        return rules;
    }
    public static bool IsInterior(string id) => id is
        "darke-shop" or "darke-vault" or "darke-bsmith" or "darke-magic" or
        "areshop" or "arewrus" or "arebsmith" or "arewzdtwr" or
        "elvshop" or "elvwrus" or "elvbsmith" or "elvwzdtwr";

    // Entering a building is not enough to trade: the authoritative server also
    // requires the player to stand beside that building's merchant NPC.
    public static string ServiceAt(GameWorldRef wr, GameWorldPlayer p) {
        var (service, npcId) = wr.WorldId switch {
            "darke-shop" or "areshop" or "elvshop" => ("shop", 0),
            "darke-vault" or "arewrus" or "elvwrus" => ("warehouse", 2),
            "darke-bsmith" or "arebsmith" or "elvbsmith" => ("blacksmith", 3),
            "darke-magic" or "arewzdtwr" or "elvwzdtwr" => ("magic", 1),
            _ => ("", -1)
        };
        if (npcId < 0) return "";
        return wr.NpcsByNpcId.Values.Any(n => n.CatalogNpcId == npcId &&
            Math.Max(Math.Abs(n.PosX - p.PosX), Math.Abs(n.PosY - p.PosY)) <= 4) ? service : "";
    }
    public static void Handle(GameWorldRef wr, GameWorldPlayer player, EconomyRequest request) {
        var service = ServiceAt(wr, player);
        void Reject(string text) => Adventure.Send(wr, player, text);
        if (!player.CanTrade || service == "") { Reject("Acercate al comerciante y esperá 8 segundos fuera de combate."); return; }
        // A monotonically increasing persisted revision makes replays stale, even
        // after reconnect or after many other purchases. Never trust client prices.
        if (request.Revision != player.Progress.TradeRevision) { Reject("La operación ya cambió. Revisá tu saldo e intentá nuevamente."); return; }
        var progress = player.Progress;
        var bag = player.InventoryManager;
        string notice;
        if (request.Action == "buy") {
            var offer = Rules.Offers.FirstOrDefault(o => o.Id == request.OfferId && o.Service == service);
            if (offer is null || progress.Level < offer.Level || progress.Intelligence < offer.Intelligence || progress.Gold < offer.Price) { Reject("No tenés el oro, el nivel o la inteligencia requerida para esa compra."); return; }
            if (offer.SpellId >= 0) {
                if ((progress.KnownSpellsMask & (1 << offer.SpellId)) != 0) { Reject("Ya conocés ese hechizo."); return; }
                progress = progress with { KnownSpellsMask = progress.KnownSpellsMask | (1 << offer.SpellId) };
            } else {
                if (bag.BagItems.Count >= 80 || !bag.TryCreateItem(offer.ItemId, null, out _)) { Reject("Necesitás espacio en la mochila (máximo de compra: 80 entradas)."); return; }
            }
            progress = progress with { Gold = progress.Gold - offer.Price };
            notice = $"Compra: {offer.Name} · -{offer.Price} oro.";
        } else if (request.Action == "sell" && service is "shop" or "blacksmith") {
            var item = bag.BagItems.FirstOrDefault(i => i.ItemUid == request.ItemUid);
            var offer = Rules.Offers.FirstOrDefault(o => o.ItemId == item?.ItemId && o.Service == service);
            if (item is null || offer is null) { Reject("Ese objeto no se puede vender. Desequipalo antes de venderlo."); return; }
            var price = (long)Math.Max(1, offer.Price / 5) * item.Quantity;
            if (price + progress.Gold > 1000000000 || !bag.TryRemoveItemFromBagForGroundDrop(item.ItemUid, out _, out _)) { Reject("No se pudo vender esa pila."); return; }
            progress = progress with { Gold = progress.Gold + (int)price };
            notice = $"Venta de pila: {offer.Name} · +{price} oro.";
        } else if (request.Action == "deposit" && service == "warehouse") {
            var vault = progress.Warehouse ?? Array.Empty<PersistedInventoryItem>();
            if (vault.Length >= 40 || !bag.TryRemoveItemFromBagForGroundDrop(request.ItemUid, out var item, out _) || item is null) { Reject("Depósito lleno (40 entradas) u objeto no disponible en la mochila."); return; }
            progress = progress with { Warehouse = vault.Append(item.ToPersistedItem()).ToArray() };
            notice = "Objeto guardado en tu almacén personal.";
        } else if (request.Action == "withdraw" && service == "warehouse") {
            var vault = progress.Warehouse ?? Array.Empty<PersistedInventoryItem>();
            var item = vault.FirstOrDefault(i => i.ItemUid == request.ItemUid);
            if (item is null || bag.BagItems.Count >= 80) { Reject("No hay espacio o ese objeto ya fue retirado."); return; }
            // Restore the exact instance, quantity and effects without an intermediate ground item.
            bag.LoadFromPersistence(bag.CreatePersistedBagItems().Append(item with { BagX = null, BagY = null }).ToArray(), bag.CreatePersistedEquippedItems());
            progress = progress with { Warehouse = vault.Where(i => i.ItemUid != item.ItemUid).ToArray() };
            notice = "Objeto retirado del almacén.";
        } else { Reject("Operación no disponible en este servicio."); return; }
        player.SetEconomyProgress(progress with { TradeRevision = progress.TradeRevision + 1 });
        // A failed acknowledgement stays pending as one atomic state, never roll
        // money back alone (the database may have committed before a network failure).
        var saved = Adventure.Checkpoint(wr, player);
        Spawn.SendInitialState(wr, player, includeSpells: true);
        Adventure.Send(wr, player, saved ? notice : "Operación pendiente de guardado. No la repitas; revisá el inventario y el saldo.");
    }
}
