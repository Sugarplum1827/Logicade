/* Safe CP1 C subset: parsed source only. No eval, native execution or file access. */
(() => {
  'use strict';
  const fail=(ok,message)=>{if(!ok)throw Error(message);};
  const keywords=new Set('auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while _Bool _Complex _Imaginary'.split(' '));
  const validName=name=>/^[A-Za-z_]\w*$/.test(name)&&!keywords.has(name)&&!['__proto__','constructor','prototype','main','printf','readInput','writeOutput','observe','moveRight','moveLeft','moveUp','moveDown'].includes(name);
  function parse(source){
    fail(typeof source==='string'&&source.length<=12000,'C source limit exceeded.');
    const tokens=[],pattern=/\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|\#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])'|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fF]?|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||[{}();,=+*/%<>!\-]/gy;
    let at=0;
    while(at<source.length){pattern.lastIndex=at;const match=pattern.exec(source);fail(match&&match.index===at,'Unsupported C token near '+source.slice(at,at+20));at=pattern.lastIndex;if(!/^\s|^\/\//.test(match[0])&&!match[0].startsWith('/*'))tokens.push(match[0]);}
    fail(tokens.length<=2200,'C token limit exceeded.');
    let i=0,count=0;const headers=new Set(),macros=new Map(),globals=[];
    const take=t=>{fail(tokens[i]===t,'Expected '+t+'; found '+(tokens[i]??'end of source'));i++;};
    const precedence={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
    function expr(min=0,depth=0){
      fail(depth<24,'C expression nesting limit exceeded.');let node,t=tokens[i++];
      if(t==='-'||t==='!')node={kind:'unary',op:t,value:expr(7,depth+1)};
      else if(t==='('){node=expr(0,depth+1);take(')');}
      else if(/^\d/.test(t||''))node={kind:'number',value:Number(t.replace(/[fF]$/,'')),type:/[fF]$/.test(t)?'float':/[.eE]/.test(t)?'double':'int'};
      else if(t?.startsWith("'")){const char=t.slice(1,-1);const value=char==='\\n'?10:char==='\\t'?9:char==='\\0'?0:char==='\\\''?39:char==='\\\\'?92:char.length===1?char.charCodeAt(0):NaN;fail(Number.isFinite(value),'Unsupported character escape.');node={kind:'number',value,type:'int'};}
      else if(t?.startsWith('"')){fail(!/[\r\n]/.test(t),'Use an escape such as \\n inside a C string.');try{node={kind:'string',value:JSON.parse(t)};}catch{throw Error('Unsupported string escape.');}}
      else {fail(/^[A-Za-z_]\w*$/.test(t||''),'Expected an expression.');if(tokens[i]==='('){i++;const args=[];if(tokens[i]!==')'){do{args.push(expr());if(tokens[i]!==',')break;i++;}while(true);}take(')');node={kind:'call',name:t,args};}else node={kind:'name',name:t};}
      while((precedence[tokens[i]]||0)>min){const op=tokens[i++];node={kind:'binary',op,left:node,right:expr(precedence[op],depth+1)};}
      return node;
    }
    function declaration(){const type=tokens[i++],name=tokens[i++];fail(validName(name),'Use a non-keyword name that does not hide main or a runtime helper.');let value=null;if(tokens[i]==='='){i++;value=expr();}take(';');return {kind:'declare',type,name,value};}
    function block(depth=0){fail(depth<12,'C block nesting limit exceeded.');take('{');const statements=[];while(tokens[i]!=='}'){fail(i<tokens.length&&++count<=400,'Missing closing brace or C statement limit exceeded.');let node;
      if(tokens[i]==='{')node=block(depth+1);
      else if(['int','float','double','char'].includes(tokens[i]))node=declaration();
      else if(tokens[i]==='return'){i++;node={kind:'return',value:expr()};take(';');}
      else if(tokens[i+1]==='='){const name=tokens[i++];i++;node={kind:'assign',name,value:expr()};take(';');}
      else{node={kind:'expression',value:expr()};take(';');}
      statements.push(node);
    }take('}');return {kind:'block',statements};}
    while(tokens[i]?.startsWith('#')){
      const directive=tokens[i++];let match;
      if((match=directive.match(/^#\s*include\s*(<stdio\.h>|"logicade\.h")\s*$/)))headers.add(match[1]);
      else if((match=directive.match(/^#\s*define\s+([A-Za-z_]\w*)\s+(-?\d+)\s*$/))){fail(validName(match[1])&&!macros.has(match[1])&&Number.isFinite(Number(match[2]))&&Math.abs(Number(match[2]))<=1e9,'Invalid, duplicate or oversized macro.');macros.set(match[1],{type:'int',value:Number(match[2])});}
      else throw Error('Supported directives: #include <stdio.h>, #include "logicade.h", #define NAME integer.');
    }
    while(i<tokens.length&&!(tokens[i]==='int'&&tokens[i+1]==='main')){fail(['int','float','double','char'].includes(tokens[i]),'Only declarations may appear before main.');globals.push(declaration());}
    take('int');take('main');take('(');take('void');take(')');const main=block();fail(i===tokens.length,'Unexpected code after main.');
    return {headers,macros,globals,main};
  }
  function run(source,options={}){
    const program=parse(source),scopes=[new Map()],outputs=[],stdout=[],trace=[],input=(options.inputs||[]).slice();let steps=0,returned=false,lastLocals={};
    const maxSteps=Math.min(5000,options.max_steps||1500);
    const tick=()=>fail(++steps<=maxSteps,'C execution limit exceeded.');
    const cast=(type,value)=>{fail(Number.isFinite(value)&&Math.abs(value)<=1e9,'C numeric practice limit exceeded.');if(type==='int')value=Math.trunc(value);if(type==='char'){value=Math.trunc(value);fail(value>=0&&value<=127,'This character exercise supports ASCII 0–127.');}if(type==='float')value=Math.fround(value);return {type,value};};
    const find=name=>{for(let j=scopes.length-1;j>=0;j--)if(scopes[j].has(name))return scopes[j];throw Error('Variable '+name+' is not declared in this scope.');};
    const lookup=name=>{if(program.macros.has(name))return program.macros.get(name);const variable=find(name).get(name);fail(variable.value!==null,'Variable '+name+' is uninitialized.');return variable;};
    const snapshot=()=>{const variables={},types={};for(const scope of scopes)for(const [name,item] of scope){variables[name]=item.value;types[name]=item.type;}const globals=Object.fromEntries([...scopes[0]].map(([name,item])=>[name,item.value]));return {variables,types,globals,locals:Object.fromEntries([...scopes.at(-1)].map(([name,item])=>[name,item.value])),outputs:outputs.slice(),stdout:stdout.join('')};};
    function evaluate(node,globalInit=false){
      tick();if(node.kind==='number')return cast(node.type,node.value);
      if(node.kind==='string')return {type:'string',value:node.value};
      if(node.kind==='name'){fail(!globalInit||program.macros.has(node.name),'A file-scope initializer must be constant in this subset.');return lookup(node.name);}
      if(node.kind==='unary'){const a=evaluate(node.value,globalInit);return cast(node.op==='!'?'int':a.type,node.op==='!'?Number(!a.value):-a.value);}
      if(node.kind==='binary'){
        const a=evaluate(node.left,globalInit),op=node.op;
        if(op==='&&'&&!a.value)return cast('int',0);if(op==='||'&&a.value)return cast('int',1);
        const b=evaluate(node.right,globalInit);fail(a.type!=='string'&&b.type!=='string','Numeric operands are required.');
        const type=[a.type,b.type].includes('double')?'double':[a.type,b.type].includes('float')?'float':'int';let value;
        if(op==='+')value=a.value+b.value;else if(op==='-')value=a.value-b.value;else if(op==='*')value=a.value*b.value;
        else if(op==='/'||op==='%'){fail(b.value!==0,'Division by zero.');fail(op!=='%'||type==='int','Remainder requires integer operands.');value=op==='%'?a.value%b.value:type==='int'?Math.trunc(a.value/b.value):a.value/b.value;}
        else return cast('int',Number(op==='=='?a.value===b.value:op==='!='?a.value!==b.value:op==='<'?a.value<b.value:op==='>'?a.value>b.value:op==='<='?a.value<=b.value:op==='>='?a.value>=b.value:op==='&&'?Boolean(a.value&&b.value):Boolean(a.value||b.value)));
        return cast(type,value);
      }
      fail(!globalInit,'Function calls cannot initialize file-scope variables here.');
      const name=node.name,args=node.args.map(n=>evaluate(n));
      if(name==='printf'){
        fail(program.headers.has('<stdio.h>'),'Include stdio.h before calling printf.');fail(args[0]?.type==='string','printf requires a literal format.');const format=args[0].value,match=format.match(/^%(?:\.(\d))?([difc])\n?$/);
        if(!match){fail(args.length===1&&!format.includes('%'),'Use one supported printf format and value.');outputs.push(format.replace(/\n$/,''));stdout.push(format);}
        else{fail(args.length===2,'printf needs one value for the format.');const value=args[1];let rendered,result;
          if(['d','i','c'].includes(match[2]))fail(['int','char'].includes(value.type),'Integer/character format requires an integer value.');else fail(['float','double'].includes(value.type),'The floating format requires float or double.');
          if(match[2]==='c')rendered=result=String.fromCharCode(value.value);else if(match[2]==='f'){rendered=value.value.toFixed(match[1]?Number(match[1]):6);result=Number(rendered);}else{rendered=String(value.value);result=value.value;}
          outputs.push(result);stdout.push(rendered+(format.endsWith('\n')?'\n':''));
        }return cast('int',stdout.at(-1).length);
      }
      fail(program.headers.has('"logicade.h"'),'Game helpers require #include "logicade.h".');
      if(name==='readInput'){fail(!args.length&&input.length,'No game-port input is available.');return cast('int',input.shift());}
      if(name==='writeOutput'){fail(args.length===1,'writeOutput requires one value.');outputs.push(args[0].value);return cast('int',0);}
      if(['moveRight','moveLeft','moveUp','moveDown','observe'].includes(name)){fail(args.length===1&&options.command,'This game helper is unavailable here.');options.command(name,args[0].value,snapshot());return cast('int',0);}
      throw Error('Unsupported function '+name+'. Use the documented C subset.');
    }
    function declare(node,global=false){const scope=scopes.at(-1);fail(!scope.has(node.name)&&!program.macros.has(node.name),'Duplicate variable or macro name '+node.name);scope.set(node.name,{type:node.type,value:null});if(node.value)scope.set(node.name,cast(node.type,evaluate(node.value,global).value));else if(global)scope.set(node.name,cast(node.type,0));}
    function execute(block,main=false){scopes.push(new Map());for(const node of block.statements){if(returned)break;tick();if(node.kind==='block')execute(node);else if(node.kind==='declare')declare(node);else if(node.kind==='assign'){const scope=find(node.name),target=scope.get(node.name);scope.set(node.name,cast(target.type,evaluate(node.value).value));}else if(node.kind==='return'){fail(evaluate(node.value).value===0,'This practice program must return 0.');returned=true;}else evaluate(node.value);const state=snapshot();trace.push(state);options.step?.(state);}if(main)lastLocals=Object.fromEntries(scopes.at(-1));scopes.pop();}
    for(const node of program.globals)declare(node,true);execute(program.main,true);
    const globals=Object.fromEntries([...scopes[0]].map(([name,item])=>[name,item.value]));
    return {outputs,stdout:stdout.join(''),trace,globals,variables:{...globals,...Object.fromEntries(Object.entries(lastLocals).map(([name,item])=>[name,item.value]))},types:Object.fromEntries([...scopes[0],...Object.entries(lastLocals)].map(([name,item])=>[name,item.type])),steps};
  }
  function sourceCheck(exercise,order,categories={}){
    fail(Array.isArray(order)&&order.length===exercise.parts.length&&new Set(order).size===order.length,'Place each source block once.');
    const parts=new Map(exercise.parts.map(p=>[p.id,p]));fail(order.every(id=>parts.has(id)),'Unknown source block.');
    for(const [token,expected] of Object.entries(exercise.categories||{}))fail(categories[token]===expected,'Classify '+token+' as '+expected+'.');
    const result=run(order.map(id=>parts.get(id).code).join('\n'));
    fail(JSON.stringify(result.outputs)===JSON.stringify(exercise.expected),'The C source prints the wrong value.');return result;
  }
  globalThis.LogiCadeC={parse,run,sourceCheck};
})();
