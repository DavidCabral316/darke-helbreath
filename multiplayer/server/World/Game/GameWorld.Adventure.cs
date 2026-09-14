using Server.Helpers;
using Server.Utils;

namespace Server.World.Game;

public sealed partial class GameWorld {
    private DateTimeOffset nextAdventureTick;
    public bool DropAdventureLoot(GameWorldMonster monster, GameWorldPlayer winner, int itemId, int quantity, ItemEffectConfig[]? effects = null) {
        if (!gameWorldRef.ItemsById.ContainsKey(itemId)) throw new InvalidOperationException($"Unknown loot item {itemId}");
        var location = Location.FindNearestFreeLocation((x,y) => occupancyTracker.IsFreeAndNotTeleportCell(x,y) && groundStateTracker.CanDropAt(x,y), monster.PosX, monster.PosY, 5);
        if (location is null) return false;
        var item = new GroundItemState(itemId, BitConverter.ToInt64(Guid.NewGuid().ToByteArray()) & long.MaxValue,
            quantity, effects, location.Value.X, location.Value.Y) { OwnerKey = winner.PersistenceKey, ReservedUntil = DateTimeOffset.UtcNow.AddSeconds(60) };
        if (!groundStateTracker.TryAddGroundItem(item, out var previous, out var added)) return false;
        GroundStateVisibility.BroadcastGroundItemTopStateChanged(gameWorldRef, previous, added);
        scheduler.SetTimeout(180000, () => {
            if (groundStateTracker.RemoveDroppedItem(item.ItemUid, item.PosX, item.PosY, out var oldTop, out var newTop))
                GroundStateVisibility.BroadcastGroundItemTopStateChanged(gameWorldRef, oldTop, newTop);
        });
        return true;
    }
}
