using Server.Utils;

namespace Server.Helpers;

/// <summary>Keep spawn/respawn away from entrances and a connected, walkable transit network.
/// This does not grant immunity: monsters may pursue players into these corridors.</summary>
public static class TravelCorridors {
    public static readonly HashSet<string> DenseWorlds = new(StringComparer.Ordinal) {
        "promiseland", "middleland", "aresdend1", "elvined1", "middled1n", "middled1x",
        "abaddon", "icebound", "toh1", "toh2", "dglv2", "dglv3", "dglv4"
    };
    public static HashSet<(int X,int Y)> Build(GameWorldOccupancyTracker map, IEnumerable<(int X,int Y)> entrances) {
        var reserved = new HashSet<(int X,int Y)>();
        var anchors = entrances.Distinct().Where(p=>map.IsFree(p.X,p.Y)).ToArray();
        void Reserve((int X,int Y) p, int radius) {
            for(var y=Math.Max(0,p.Y-radius);y<=Math.Min(map.SizeY-1,p.Y+radius);y++)
                for(var x=Math.Max(0,p.X-radius);x<=Math.Min(map.SizeX-1,p.X+radius);x++) reserved.Add((x,y));
        }
        foreach(var p in anchors) Reserve(p,10);
        if(anchors.Length<2)return reserved;
        // One BFS per connected component; never draw corridors through walls or water.
        var visited = new HashSet<(int X,int Y)>();
        foreach(var root in anchors) {
            if(visited.Contains(root))continue;
            var parent=new Dictionary<(int X,int Y),(int X,int Y)>();
            var queue=new Queue<(int X,int Y)>(); queue.Enqueue(root);visited.Add(root);
            while(queue.TryDequeue(out var p)) {
                foreach(var n in new[]{(X:p.X+1,Y:p.Y),(X:p.X-1,Y:p.Y),(X:p.X,Y:p.Y+1),(X:p.X,Y:p.Y-1)}) {
                    if(!map.IsFree(n.X,n.Y)||!visited.Add(n))continue;
                    parent[n]=p;queue.Enqueue(n);
                }
            }
            foreach(var target in anchors.Where(parent.ContainsKey)) {
                var p=target;
                while(p!=root) {Reserve(p,4);p=parent[p];}
                Reserve(root,4);
            }
        }
        return reserved;
    }
}
