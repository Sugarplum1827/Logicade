"""Build the ten Relay Works layouts and their three difficulty profiles."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "game-platform"
NAMES = ["First Circuit", "Copper Diversion", "Elbow Foundry", "Northbound Relay", "Parallel Stores", "Return Channel", "Long Haul", "Signal Crossing", "Shared Power", "Orbital Supply"]
PATHS = [
 [(1,3),(11,3)], [(1,2),(7,2),(7,5),(11,5)], [(1,4),(5,4),(5,2),(11,2)],
 [(1,5),(4,5),(4,2),(11,2)], [(1,2),(5,2),(5,4),(11,4)],
 [(1,4),(7,4),(7,2),(11,2)], [(1,2),(4,2),(4,5),(9,5),(9,3),(11,3)],
 [(1,5),(5,5),(5,3),(8,3),(8,1),(11,1)], [(1,3),(4,3),(4,1),(8,1),(8,4),(11,4)],
 [(1,2),(4,2),(4,4),(8,4),(8,2),(11,2)],
]

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")

def main():
    registry = json.loads((ROOT / "registry.json").read_text(encoding="utf-8"))
    entry = next((game for game in registry.get("games", []) if game.get("slug") == "platformer"), None)
    if entry is None:
        entry = {"game_id": "canvas_platformer", "slug": "platformer", "entry": "index.html", "status": "implemented", "variations": []}
    entry.update(title="Relay Works · Automation", engine="automation", input_mode="automation", controls="Click machines / build cells · R rotate · select Wire then two machines · Run / Step / Reset in workbench")
    entry["variations"] = entry.get("variations", [])[:10]
    for i, vertices in enumerate(PATHS, 1):
        route = [vertices[0]]
        for tx, ty in vertices[1:]:
            x, y = route[-1]
            while (x, y) != (tx, ty):
                x += (tx > x) - (tx < x)
                y += (ty > y) - (ty < y)
                route.append((x, y))
        smelter, assembler = len(route)//2, len(route)-3
        machines = []
        for j, (x, y) in enumerate(route):
            kind = "extractor" if j == 0 else "controller" if j == 1 else "smelter" if j == smelter else "assembler" if j == assembler else "output" if j == len(route)-1 else "belt"
            dx,dy = (route[j+1][0]-x,route[j+1][1]-y) if j<len(route)-1 else (1,0)
            direction = {(1,0):"E",(0,1):"S",(-1,0):"W",(0,-1):"N"}[(dx,dy)]
            machines.append(dict(type=kind,x=x,y=y,dir=direction,fixed=kind!="belt"))
        generator = dict(type="generator",x=1,y=0,dir="E",fixed=True)
        machines.append(generator)
        wires = [[f"m{len(machines)-1}",f"m{j}"] for j,m in enumerate(machines[:-1]) if m["type"] in {"extractor","controller","smelter","assembler"}]
        belt_indices = [j for j,m in enumerate(machines) if m["type"]=="belt"]
        gaps = belt_indices[::max(1,len(belt_indices)//3)][:3]
        config = dict(id=f"relay_works_v{i:02}",title=NAMES[i-1],objective="Manufacture circuit components from finite ore. Build the missing conveyors, power the machines and program the controller's real output port.",controls=entry["controls"],hint="Select the controller and replace ROUTE W with its outgoing arrow. READ → ROUTE direction → COUNT → YIELD. Place the missing belts in the orange route; R rotates. Power wires are cyan.",width=1280,height=720,cols=13,rows=8,wireRange=20,machines=machines,wires=wires,ore=[dict(x=route[0][0],y=route[0][1])],route=route,blocked=[[10,6],[11,6]] if i%2 else [[9,0],[10,0]],product="circuit",gaps=gaps,mix=False,automation_version="relay-1")
        folder = ROOT / f"games/automation/variations/variation_{i:02}"
        write(folder/"config.json",config)
        for rank,name in enumerate(["needs_support","standard","advanced"]):
            write(folder/f"{name}.json",dict(id=name,label=["Easy / Needs Support","Normal / Standard","Hard / Advanced"][rank],target=[2,4,6][rank],ore=[20,20,20][rank],credits=[45,30,18][rank],power=[18,12,10][rank],instructionLimit=[12,8,6][rank],missingBelts=[gaps[:1],gaps,gaps+([belt_indices[-1]] if belt_indices[-1] not in gaps else [])][rank],disconnectPower=rank==2,branching=rank==2,timeLimit=0))
        while len(entry["variations"]) < i:
            entry["variations"].append({"variation_id": f"canvas_platformer_v{i:02}", "index": i})
        entry["variations"][i-1].update(variation_id=f"canvas_platformer_v{i:02}",index=i,title=NAMES[i-1],config=f"games/automation/variations/variation_{i:02}/config.json",difficulty_profiles=["needs_support","standard","advanced"],status="implemented")
        entry["variations"][i-1].pop("programming_config", None)
    registry["games"] = [entry]
    registry["planned_genres"] = []
    write(ROOT/"registry.json",registry)

if __name__ == "__main__":
    main()
