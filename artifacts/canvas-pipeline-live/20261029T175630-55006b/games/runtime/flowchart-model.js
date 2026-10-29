(() => {
  'use strict';
  const validName = name => typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
  function value(expression, variables, depth=0) {
    if(depth>20)throw Error('Expression is too deep.');
    if(expression===null||['number','string','boolean'].includes(typeof expression))return expression;
    if(!expression||typeof expression!=='object')throw Error('Unsupported expression.');
    if(Object.hasOwn(expression,'var')){
      const name=expression.var;
      if(!validName(name)||!Object.hasOwn(variables,name))throw Error(`Read or initialize ${name} before using it.`);
      return variables[name];
    }
    const args=expression.args;
    if(!Array.isArray(args)||args.length!==2)throw Error('A binary operation requires two values.');
    const a=value(args[0],variables,depth+1),b=value(args[1],variables,depth+1);
    switch(expression.op){
      case '+':return a+b; case '-':return a-b;case '*':return a*b;
      case '/':if(b===0)throw Error('Division by zero.');return a/b;
      case '%':if(b===0)throw Error('Division by zero.');return a%b;
      case '<':return a<b;case '<=':return a<=b;case '>':return a>b;case '>=':return a>=b;
      case '==':return a===b;case '!=':return a!==b;
      default:throw Error('This operation is not supported by the flowchart runner.');
    }
  }
  function inspect(puzzle, placements) {
    const pieces=new Map(puzzle.pieces.map(piece=>[piece.id,piece])),errors=[],missing=[],used=new Set();
    for(const slot of puzzle.slots){
      const identity=placements[slot.id],piece=pieces.get(identity);
      if(!piece){missing.push(slot.id);continue;}
      if(used.has(identity))errors.push({slot:slot.id,message:'Each block can be used only once.'});
      used.add(identity);
      const exits=puzzle.edges.filter(edge=>edge.from===slot.id);
      if(slot.id===puzzle.entry&&piece.kind!=='start')errors.push({slot:slot.id,message:'The first block must be Start.'});
      if(piece.kind==='end'&&exits.length)errors.push({slot:slot.id,message:'End cannot lead to another step.'});
      else if(piece.kind==='decision'&&(exits.length!==2||!exits.some(edge=>edge.label==='Yes')||!exits.some(edge=>edge.label==='No')))
        errors.push({slot:slot.id,message:'A decision needs Yes and No branches.'});
      else if(piece.kind!=='decision'&&piece.kind!=='end'&&exits.length!==1)
        errors.push({slot:slot.id,message:'Use a decision at a branch and End at the final step.'});
      if(piece.kind==='start'&&slot.id!==puzzle.entry)errors.push({slot:slot.id,message:'Start belongs at the entry of the chart.'});
    }
    return {pieces,errors,missing};
  }
  function runCase(puzzle,placements,testCase) {
    const {pieces,errors,missing}=inspect(puzzle,placements);
    if(missing.length||errors.length)return {passed:false,outputs:[],trace:[],error:missing.length?'Fill every numbered position first.':errors[0].message};
    const variables=Object.create(null),outputs=[],trace=[];
    let slot=puzzle.entry;
    const limit=Math.min(5000,Math.max(1,Number(puzzle.max_steps)||1000));
    try{
      for(let i=0;i<limit;i++){
        const piece=pieces.get(placements[slot]);if(!piece)throw Error('The chart has a missing block.');
        trace.push(slot);
        const action=piece.action||{};
        if(piece.kind==='end'){
          const expected=testCase.expected||[];
          const passed=outputs.length===expected.length&&outputs.every((item,index)=>typeof item==='number'&&typeof expected[index]==='number'
            ?Number.isFinite(item)&&Math.abs(item-expected[index])<1e-9:item===expected[index]);
          return {passed,outputs,trace,error:passed?'':'The chart finishes, but its output does not match the task.'};
        }
        if(piece.kind==='input'){
          if(!Array.isArray(action.names))throw Error('This input block has no variables.');
          for(const name of action.names){
            if(!validName(name)||!Object.hasOwn(testCase.inputs||{},name))throw Error(`The task does not provide an input named ${name}.`);
            variables[name]=testCase.inputs[name];
          }
        }else if(piece.kind==='process'){
          if(!Array.isArray(action.values))throw Error('An assignment needs a process rectangle.');
          for(const assignment of action.values){
            if(!validName(assignment.name))throw Error('Invalid variable name.');
            const result=value(assignment.value,variables);
            if(typeof result==='number'&&!Number.isFinite(result))throw Error('The calculation produced an invalid number.');
            variables[assignment.name]=result;
          }
        }else if(piece.kind==='output')outputs.push(value(action.value,variables));
        else if(piece.kind!=='start'&&piece.kind!=='decision')throw Error('Unsupported flowchart symbol.');
        const exits=puzzle.edges.filter(edge=>edge.from===slot);
        const next=piece.kind==='decision'?exits.find(edge=>edge.label===(value(action.test,variables)?'Yes':'No')):exits[0];
        if(!next)throw Error('A required connector is missing.');
        slot=next.to;
      }
      throw Error('The loop did not finish. Check its condition and update step.');
    }catch(error){return {passed:false,outputs,trace,error:error.message};}
  }
  function check(puzzle,placements){
    const structure=inspect(puzzle,placements);
    const results=(puzzle.cases||[]).map(testCase=>({id:testCase.id,...runCase(puzzle,placements,testCase)}));
    return {complete:structure.missing.length===0,errors:structure.errors,missing:structure.missing,
      results,passed:results.length>0&&results.every(result=>result.passed),
      passedCases:results.filter(result=>result.passed).length,totalCases:results.length};
  }
  globalThis.LogiCadeFlowchartModel={check,runCase};
})();
