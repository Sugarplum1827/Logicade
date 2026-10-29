const successful=s=>s.programHistory.filter(r=>r.ok);
const acts=(run,name)=>run.actions.filter(a=>a.ok&&a.name===name);
const uniquePlots=events=>new Set(events.map(a=>`${a.args[0]},${a.args[1]}`)).size;
export const FIELD_MISSIONS=[
  {
    name:'The first planting',topic:'Variables & assignment',brief:'Use a named row variable to send your helper to plant at least three different plots. Seeds come out of your shared bag.',
    starter:'int row = 0;\nplant(row, 0);\n// Continue planting this row.\n',
    guide:'A variable stores a value. The row argument chooses where the helper walks and plants. You can use assignments and different variable names.',
    done:s=>successful(s).some(r=>r.stats.declarations>0&&uniquePlots(acts(r,'plant').filter(a=>a.dependencies.length))>=3),
  },
  {
    name:'Water a whole row',topic:'For loops',brief:'Plant row 0, then use one for-loop run to water its five different plots. The helper must travel, refill if needed, and spend real water.',
    starter:'refill();\nfor (int col = 0; col < 3; col++) {\n    water(0, col);\n}\n',
    guide:'The row has columns 0 through 4. Change the loop bound so every planted plot is reached. Missing plants are a farm condition to fix, not a wrong-answer penalty.',
    done:s=>successful(s).some(r=>r.stats.forIterations>=5&&uniquePlots(acts(r,'water').filter(a=>a.loopDepth>0))>=5),
  },
  {
    name:'Harvest what is ready',topic:'If statements',brief:'Use ripe(row, col) to harvest three ready crops conditionally. Unripe crops stay in the ground. No quiz interrupts the harvest.',
    starter:'for (int col = 0; col < 5; col++) {\n    if (ripe(0, col)) {\n        // Harvest this crop.\n    }\n}\n',
    guide:'ripe returns 1 only when a crop has actually finished growing. Water crops and let time pass, or rest at home. Put harvest(0, col); inside the condition.',
    done:s=>successful(s).some(r=>uniquePlots(acts(r,'harvest').filter(a=>a.branchDepth>0))>=3),
  },
  {
    name:'A can that never runs dry',topic:'While loops & conditions',brief:'Water five planted plots with a while loop. Add a water_left() condition so the helper can refill before running out.',
    starter:'int col = 0;\nwhile (col < 5) {\n    if (water_left() == 0) {\n        refill();\n    }\n    water(0, col);\n    // Advance the column.\n}\n',
    guide:'The counter must change each iteration. col++; advances it. Conditions read current inventory during execution, including water spent earlier in the same run.',
    done:s=>successful(s).some(r=>r.stats.whileIterations>=5&&r.stats.branches>=5&&uniquePlots(acts(r,'water').filter(a=>a.loopDepth>0))>=5),
  },
  {
    name:'Choose the planting order',topic:'Arrays & traversal',brief:'Store five column indices in an array and use them to water a row. The helper must follow your actual array order.',
    starter:'int route[5] = {4, 2, 0, 1, 3};\nrefill();\nfor (int i = 0; i < 5; i++) {\n    // Water the column stored in route[i].\n}\n',
    guide:'An array holds an ordered list. water(0, route[i]); reads an element and chooses that destination. Any valid order that covers the row works.',
    done:s=>successful(s).some(r=>r.stats.arrayReads>=5&&uniquePlots(acts(r,'water'))>=5),
  },
  {
    name:'Build lasting automation',topic:'Loops & sequencing',brief:'Gather four wood and two stone, craft a sprinkler, and place it on an empty plot. It will irrigate nearby crops without another program run.',
    starter:'for (int i = 0; i < 4; i++) {\n    gather("wood");\n}\n// Gather stone, craft a sprinkler, then place it.\n',
    guide:'craft("sprinkler"); consumes 4 wood and 2 stone at the workbench. place("sprinkler", 1, 2); installs it on an empty plot. The sprinkler covers the surrounding 3×3 area.',
    done:s=>s.devices.some(d=>d.type==='sprinkler')&&successful(s).some(r=>r.stats.forIterations>=4&&acts(r,'craft').some(a=>a.args[0]==='sprinkler')&&acts(r,'place').some(a=>a.args[0]==='sprinkler')),
  },
  {
    name:'Supply-aware crafting',topic:'Comparison & logical operators',brief:'Write conditions that check wood and stone stocks before crafting. Build a scarecrow to protect the field from birds.',
    starter:'if (stock("wood") >= 5 && stock("stone") >= 1) {\n    // Craft and install the scarecrow.\n}\n',
    guide:'Gather missing materials in the world or in your program. craft("scarecrow"); uses 5 wood and 1 stone. A failed condition does not consume anything.',
    done:s=>s.devices.some(d=>d.type==='scarecrow')&&successful(s).some(r=>acts(r,'craft').some(a=>a.args[0]==='scarecrow'&&a.branchDepth>0)),
  },
  {
    name:'Two rows, one routine',topic:'Nested loops',brief:'Use nested loops to work on at least eight distinct plots. Plant, water or harvest according to the field’s current state.',
    starter:'for (int row = 0; row < 2; row++) {\n    for (int col = 0; col < 5; col++) {\n        if (empty(row, col)) {\n            plant(row, col);\n        }\n    }\n}\n',
    guide:'The outer loop chooses the row; the inner loop visits columns. Installed devices occupy plots and must be skipped or placed elsewhere. You can harvest or water existing crops instead.',
    done:s=>successful(s).some(r=>uniquePlots(r.actions.filter(a=>a.ok&&['plant','water','harvest'].includes(a.name)&&a.loopDepth>=2))>=8),
  },
  {
    name:'Debug the boundary',topic:'Logic errors & bounds',brief:'Repair this loop so it waters exactly the five valid plots in row 0 and finishes without a runtime error.',
    starter:'refill();\nfor (int col = 0; col <= 5; col++) {\n    water(0, col);\n}\n',
    guide:'A five-column row is indexed 0–4. Programs preserve actions completed before an error. Fix the bound, refill, and rerun; do not reset your farm.',
    done:s=>successful(s).some(r=>r.stats.forIterations===5&&uniquePlots(acts(r,'water').filter(a=>a.args[0]===0))===5),
  },
  {
    name:'The community kitchen',topic:'Functions, conditions & sequencing',brief:'Program a harvest and deliver three turnips to Ada. Delivery consumes actual inventory, pays coins, and increases your relationship.',
    starter:'for (int col = 0; col < 5; col++) {\n    if (ripe(0, col)) {\n        harvest(0, col);\n    }\n}\nif (stock("turnip") >= 3) {\n    // Deliver the order.\n}\n',
    guide:'deliver(); sends the helper to Ada and exchanges 3 turnips for 50 coins and 1 friendship. The functions here are game commands with real effects, not answer tokens.',
    done:s=>s.orders.friendship>0&&successful(s).some(r=>acts(r,'deliver').length&&acts(r,'harvest').length>=1),
  },
];
export function updateMissions(farm){
  const newly=[];for(let i=0;i<FIELD_MISSIONS.length;i++)if(!farm.completed.includes(i)&&FIELD_MISSIONS[i].done(farm)){farm.completed.push(i);newly.push(i);}
  return newly;
}
