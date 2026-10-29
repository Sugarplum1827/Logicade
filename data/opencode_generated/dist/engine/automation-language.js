// Small, bounded C-style automation language. Programs call game operations;
// they are never evaluated as JavaScript and never compared with answer text.
export class ProgramError extends Error {
  constructor(message,line=1){super(`Line ${line}: ${message}`);this.name='ProgramError';this.line=line;}
}
const types=new Set(['int','float','double','bool','char']);
export function tokenizeProgram(source){
  if(source.length>12000)throw new ProgramError('Program is too long (12,000 characters maximum).');
  const tokens=[];let i=0,line=1;
  while(i<source.length){
    if(/\s/.test(source[i])){if(source[i]==='\n')line++;i++;continue;}
    if(source.slice(i,i+2)==='//'){while(i<source.length&&source[i]!=='\n')i++;continue;}
    if(source.slice(i,i+2)==='/*'){i+=2;while(i<source.length&&source.slice(i,i+2)!=='*/'){if(source[i]==='\n')line++;i++;}if(i>=source.length)throw new ProgramError('Unclosed comment.',line);i+=2;continue;}
    const start=line,c=source[i];
    if(c==='"'||c==="'"){const quote=c;let text='';i++;while(i<source.length&&source[i]!==quote){if(source[i]==='\\'){i++;const escaped={n:'\n',t:'\t','\\':'\\','"':'"',"'":"'"};if(!(source[i] in escaped))throw new ProgramError('Unsupported escape sequence.',line);text+=escaped[source[i++]];}else{if(source[i]==='\n')throw new ProgramError('String cannot cross a line.',line);text+=source[i++];}}if(source[i++]!==quote)throw new ProgramError('Unclosed string.',line);tokens.push({kind:'literal',value:text,type:'string',line:start});continue;}
    const number=source.slice(i).match(/^(?:\d+\.\d*|\.\d+|\d+)/);if(number){const raw=number[0];tokens.push({kind:'literal',value:Number(raw),type:raw.includes('.')?'float':'int',line});i+=raw.length;continue;}
    const word=source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(word){tokens.push({kind:'word',value:word[0],line});i+=word[0].length;continue;}
    const pair=source.slice(i,i+2);if(['++','--','+=','-=','*=','/=','==','!=','<=','>=','&&','||'].includes(pair)){tokens.push({kind:'symbol',value:pair,line});i+=2;continue;}
    if('{}()[];,+-*/%<>=!'.includes(c)){tokens.push({kind:'symbol',value:c,line});i++;continue;}
    throw new ProgramError(`Unexpected character ${JSON.stringify(c)}.`,line);
  }
  if(tokens.length>4000)throw new ProgramError('Program contains too many tokens.');
  tokens.push({kind:'end',value:'<end>',line});return tokens;
}
const precedence={'=':1,'+=':1,'-=':1,'*=':1,'/=':1,'||':2,'&&':3,'==':4,'!=':4,'<':5,'<=':5,'>':5,'>=':5,'+':6,'-':6,'*':7,'/':7,'%':7};
export function compileProgram(source){
  const tokens=tokenizeProgram(source);let cursor=0,depth=0;
  const current=()=>tokens[cursor],is=value=>current().value===value;
  const take=()=>tokens[cursor++];
  const expect=value=>{if(!is(value))throw new ProgramError(`Expected ${value}, found ${current().value}.`,current().line);return take();};
  const name=()=>{const t=take();if(t.kind!=='word'||types.has(t.value)||['for','if','else','while','do'].includes(t.value))throw new ProgramError('Expected a variable name.',t.line);return t;};
  function expression(min=1){
    if(++depth>80)throw new ProgramError('Expression is nested too deeply.',current().line);
    let left;const token=take();
    if(token.kind==='literal')left={kind:'literal',...token};
    else if(token.value==='true'||token.value==='false')left={kind:'literal',value:token.value==='true'?1:0,type:'int',line:token.line};
    else if(['!','-','+'].includes(token.value))left={kind:'unary',op:token.value,arg:expression(8),line:token.line};
    else if(token.value==='('){left=expression();expect(')');}
    else if(token.kind==='word')left={kind:'variable',name:token.value,line:token.line};
    else throw new ProgramError(`Expected a value, found ${token.value}.`,token.line);
    while(true){
      if(is('(')&&left.kind==='variable'){
        take();const args=[];if(!is(')')){do{args.push(expression());if(!is(','))break;take();}while(true);}expect(')');left={kind:'call',name:left.name,args,line:left.line};continue;
      }
      if(is('[')){take();const index=expression();expect(']');left={kind:'index',target:left,index,line:left.line};continue;}
      if(is('++')||is('--')){left={kind:'postfix',target:left,op:take().value,line:left.line};continue;}
      const op=current().value,level=precedence[op];if(!level||level<min)break;
      take();const right=expression(level+(level===1?0:1));left={kind:level===1?'assign':'binary',op,left,right,line:left.line};
    }
    depth--;return left;
  }
  function declaration(semicolon=true){
    const type=take(),id=name();let size=null,value=null;
    if(is('[')){take();size=expression();expect(']');}
    if(is('=')){take();if(is('{')){take();value=[];if(!is('}'))do{value.push(expression());if(!is(','))break;take();}while(true);expect('}');}else value=expression();}
    if(semicolon)expect(';');return{kind:'declare',type:type.value,name:id.value,size,value,line:type.line};
  }
  function statement(){
    if(++depth>80)throw new ProgramError('Blocks are nested too deeply.',current().line);
    const t=current();let result;
    if(is('{')){take();const body=[];while(!is('}')){if(current().kind==='end')throw new ProgramError('Unclosed block.',t.line);body.push(statement());}expect('}');result={kind:'block',body,line:t.line};}
    else if(types.has(t.value))result=declaration();
    else if(is('if')){take();expect('(');const test=expression();expect(')');const yes=statement();let no=null;if(is('else')){take();no=statement();}result={kind:'if',test,yes,no,line:t.line};}
    else if(is('while')){take();expect('(');const test=expression();expect(')');result={kind:'while',test,body:statement(),line:t.line};}
    else if(is('do')){take();const body=statement();expect('while');expect('(');const test=expression();expect(')');expect(';');result={kind:'do',test,body,line:t.line};}
    else if(is('for')){take();expect('(');const init=is(';')?null:types.has(current().value)?declaration(false):{kind:'expression',value:expression(),line:current().line};expect(';');const test=is(';')?{kind:'literal',value:1,type:'int',line:t.line}:expression();expect(';');const update=is(')')?null:expression();expect(')');result={kind:'for',init,test,update,body:statement(),line:t.line};}
    else if(is(';')){take();result={kind:'empty',line:t.line};}
    else{result={kind:'expression',value:expression(),line:t.line};expect(';');}
    depth--;return result;
  }
  const body=[];while(current().kind!=='end')body.push(statement());return{kind:'program',body,source};
}

class Scope {
  constructor(parent=null){this.parent=parent;this.values=new Map();}
  lookup(name,line){if(this.values.has(name))return this.values.get(name);if(this.parent)return this.parent.lookup(name,line);throw new ProgramError(`Variable ${name} has not been declared.`,line);}
}
const val=(value,type=typeof value==='string'?'string':Number.isInteger(value)?'int':'float')=>({value,type});
const cast=(v,type,line)=>{if(type==='char'&&v.type==='string'){if(v.value.length!==1)throw new ProgramError('A char holds one character.',line);return val(v.value.charCodeAt(0),'int');}if(!Number.isFinite(Number(v.value)))throw new ProgramError('Expected a finite numeric value.',line);return val(type==='int'||type==='char'?Math.trunc(Number(v.value)):type==='bool'?Number(Boolean(Number(v.value))):Number(v.value),type==='float'||type==='double'?'float':'int');};

export function createProgram(source,api){
  const ast=typeof source==='string'?compileProgram(source):source,global=new Scope();let operations=0;
  const stats={actions:0,forIterations:0,whileIterations:0,branches:0,assignments:0,declarations:0,arrays:0,arrayReads:0};
  let loopDepth=0,branchDepth=0;
  const limit=line=>{if(++operations>12000)throw new ProgramError('Execution limit reached. Check that your loop makes progress.',line);};
  function* address(node,scope){
    if(node.kind==='variable'){const ref=scope.lookup(node.name,node.line);if(ref.array)throw new ProgramError('Use an index to assign an array element.',node.line);return ref;}
    if(node.kind==='index'&&node.target.kind==='variable'){const ref=scope.lookup(node.target.name,node.line),index=(yield* evaluate(node.index,scope)).value;if(!ref.array||!Number.isInteger(index)||index<0||index>=ref.array.length)throw new ProgramError('Array index is outside the declared bounds.',node.line);return ref.array[index];}
    throw new ProgramError('Assignment requires a variable or array element.',node.line);
  }
  function binary(op,a,b,line){
    const x=a.value,y=b.value;if(['+','-','*','/','%','<','>','<=','>='].includes(op)&&(!Number.isFinite(x)||!Number.isFinite(y)))throw new ProgramError('This operator needs numeric operands.',line);
    const type=a.type==='float'||b.type==='float'?'float':'int';let out;
    if((op==='/'||op==='%')&&y===0)throw new ProgramError('Division by zero.',line);
    switch(op){case '+':out=x+y;break;case '-':out=x-y;break;case '*':out=x*y;break;case '/':out=type==='int'?Math.trunc(x/y):x/y;break;case '%':if(type!=='int')throw new ProgramError('Remainder requires integers.',line);out=x%y;break;case '<':return val(Number(x<y));case '>':return val(Number(x>y));case '<=':return val(Number(x<=y));case '>=':return val(Number(x>=y));case '==':return val(Number(x===y));case '!=':return val(Number(x!==y));default:throw new ProgramError('Unknown operator.',line);}
    if(!Number.isFinite(out)||Math.abs(out)>1e12)throw new ProgramError('Numeric result is outside the supported range.',line);return val(out,type);
  }
  function* evaluate(n,scope){
    limit(n.line);
    if(n.kind==='literal')return val(n.value,n.type);
    if(n.kind==='variable'||n.kind==='index'){const ref=yield* address(n,scope);if(ref.value==null)throw new ProgramError('Read of an uninitialized variable.',n.line);if(n.kind==='index')stats.arrayReads++;return val(ref.value,['float','double'].includes(ref.type)?'float':'int');}
    if(n.kind==='unary'){const a=yield* evaluate(n.arg,scope);return val(n.op==='!'?Number(!a.value):n.op==='-'?-a.value:+a.value,n.op==='!'?'int':a.type);}
    if(n.kind==='binary'){const a=yield* evaluate(n.left,scope);if(n.op==='&&'&&!a.value)return val(0);if(n.op==='||'&&a.value)return val(1);const b=yield* evaluate(n.right,scope);if(n.op==='&&'||n.op==='||')return val(Number(Boolean(b.value)));return binary(n.op,a,b,n.line);}
    if(n.kind==='assign'){const ref=yield* address(n.left,scope);let v=yield* evaluate(n.right,scope);if(n.op!=='='){if(ref.value==null)throw new ProgramError('Initialize the variable before updating it.',n.line);v=binary(n.op[0],val(ref.value,['float','double'].includes(ref.type)?'float':'int'),v,n.line);}v=cast(v,ref.type,n.line);ref.value=v.value;stats.assignments++;return v;}
    if(n.kind==='postfix'){const ref=yield* address(n.target,scope);if(ref.value==null)throw new ProgramError('Initialize the counter before incrementing it.',n.line);const old=val(ref.value,ref.type);ref.value+=n.op==='++'?1:-1;stats.assignments++;return old;}
    if(n.kind==='call'){
      const args=[];for(const a of n.args)args.push((yield* evaluate(a,scope)).value);
      if(api.sensors.includes(n.name))return val(api.read(n.name,args,n.line));
      if(!api.actions.includes(n.name))throw new ProgramError(`Unknown command ${n.name}. Use a command from the field guide.`,n.line);
      if(++stats.actions>400)throw new ProgramError('Too many world actions in one run.',n.line);
      const dependencies=[];const collect=node=>{if(!node||typeof node!=='object')return;if(node.kind==='variable')dependencies.push(node.name);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')collect(value);}};n.args.forEach(collect);
      const result=yield{kind:'action',name:n.name,args,line:n.line,loopDepth,branchDepth,dependencies:[...new Set(dependencies)]};return val(result??1);
    }
    throw new ProgramError('Unsupported expression.',n.line);
  }
  function* execute(n,scope){
    limit(n.line);
    // Yield computation as well as world actions, so even an empty loop cannot
    // block the browser. The caller has its own per-frame instruction budget.
    yield{kind:'compute',line:n.line};
    if(n.kind==='program'||n.kind==='block'){const local=n.kind==='block'?new Scope(scope):scope;for(const child of n.body)yield* execute(child,local);}
    else if(n.kind==='declare'){
      if(scope.values.has(n.name))throw new ProgramError(`Variable ${n.name} is already declared in this scope.`,n.line);
      if(n.size){const size=(yield* evaluate(n.size,scope)).value;if(!Number.isInteger(size)||size<1||size>64)throw new ProgramError('Array size must be 1–64.',n.line);const array=Array.from({length:size},()=>({value:null,type:n.type}));if(n.value&&!Array.isArray(n.value))throw new ProgramError('Use braces to initialize an array.',n.line);if(n.value?.length>size)throw new ProgramError('Too many array values.',n.line);if(n.value){for(let i=0;i<size;i++){const v=i<n.value.length?yield* evaluate(n.value[i],scope):val(0);array[i].value=cast(v,n.type,n.line).value;}}scope.values.set(n.name,{array,type:n.type});}
      else{if(Array.isArray(n.value))throw new ProgramError('Only an array can use a brace initializer.',n.line);const v=n.value?cast(yield* evaluate(n.value,scope),n.type,n.line):null;scope.values.set(n.name,{value:v?.value??null,type:n.type});}stats.declarations++;if(n.size)stats.arrays++;
    }else if(n.kind==='expression')yield* evaluate(n.value,scope);
    else if(n.kind==='if'){stats.branches++;branchDepth++;if((yield* evaluate(n.test,scope)).value)yield* execute(n.yes,scope);else if(n.no)yield* execute(n.no,scope);branchDepth--;}
    else if(n.kind==='for'){const local=new Scope(scope);if(n.init)yield* execute(n.init,local);while((yield* evaluate(n.test,local)).value){stats.forIterations++;loopDepth++;yield* execute(n.body,local);loopDepth--;if(n.update)yield* evaluate(n.update,local);}}
    else if(n.kind==='while'||n.kind==='do'){let first=n.kind==='do';while(first||(yield* evaluate(n.test,scope)).value){first=false;stats.whileIterations++;loopDepth++;yield* execute(n.body,scope);loopDepth--;}}
  }
  const iterator=execute(ast,global);
  return{iterator,stats,get variables(){return Object.fromEntries([...global.values].map(([name,ref])=>[name,ref.array?ref.array.map(v=>v.value):ref.value]));}};
}
