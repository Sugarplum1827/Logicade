"""Authored, executable flowchart puzzles. Actions are data, never generated code."""
import copy
import random


def variable(name): return {"var": name}
def operation(op, left, right): return {"op": op, "args": [left, right]}
def step(identity, label, kind, **action):
    return {"id": identity, "label": label, "kind": kind, "action": action}
def assign(identity, label, **values):
    return step(identity, label, "process", values=[{"name": name, "value": value} for name, value in values.items()])
def output(identity, label, value): return step(identity, label, "output", value=value)


def make_flowchart(file_id, trial, difficulty, seed, level=None, parameters=None):
    v, op = variable, operation
    start, end = step("start", "Start", "start"), step("end", "End", "end")
    # Without a level this remains the orientation's guided mixed practice.
    # Main lesson stages stay on their own concept across all ten variations.
    index = ({1:0, 2:0, 3:1, 4:2, 5:3, 6:6, 7:7, 8:4, 9:8}.get(level, (int(trial)-1)%10)
             if level is not None else (int(trial)-1)%10)
    shape = "sequence"
    if index == 0:
        title, prompt = "Add two numbers", "Build a flowchart that reads a and b, adds them, and displays their sum."
        pieces = [start, step("read", "Read a, b", "input", names=["a", "b"]), assign("calculate", "sum = a + b", sum=op("+", v("a"), v("b"))), output("write", "Write sum", v("sum")), end]
        cases = [({"a": a, "b": b}, [a+b]) for a,b in [(2,3),(-4,7),(0,0)]]
    elif index == 1:
        title, prompt = "Rectangle area", "Read a rectangle's width and height. Calculate its area and display the result."
        pieces = [start, step("read", "Read width, height", "input", names=["width","height"]), assign("calculate", "area = width × height", area=op("*",v("width"),v("height"))), output("write", "Write area", v("area")), end]
        cases = [({"width":a,"height":b},[a*b]) for a,b in [(3,4),(0,8),(7,2)]]
    elif index in (2,3,8):
        shape = "branch"
        if index == 2:
            title, prompt = "Positive or not?", "Read n. Display Positive when n is greater than zero; otherwise display Not positive."
            read=step("read","Read n","input",names=["n"])
            decision=step("decide","n > 0?","decision",test=op(">",v("n"),0))
            yes,no=output("yes","Write Positive","Positive"),output("no","Write Not positive","Not positive")
            cases=[({"n":n},["Positive" if n>0 else "Not positive"]) for n in [-2,0,5]]
        elif index == 3:
            title, prompt = "Pass or retry", "Read score. Display Pass when score is at least 60; otherwise display Retry."
            read=step("read","Read score","input",names=["score"])
            decision=step("decide","score ≥ 60?","decision",test=op(">=",v("score"),60))
            yes,no=output("yes","Write Pass","Pass"),output("no","Write Retry","Retry")
            cases=[({"score":n},["Pass" if n>=60 else "Retry"]) for n in [59,60,85]]
        else:
            title, prompt = "Find the larger number", "Read a and b. Display a when a is greater than b; otherwise display b."
            read=step("read","Read a, b","input",names=["a","b"])
            decision=step("decide","a > b?","decision",test=op(">",v("a"),v("b")))
            yes,no=output("yes","Write a",v("a")),output("no","Write b",v("b"))
            cases=[({"a":a,"b":b},[max(a,b)]) for a,b in [(9,2),(2,9),(4,4),(-3,-1)]]
        pieces=[start,read,decision,yes,no,end]
    elif index == 4:
        title, prompt = "Even numbers from 9 to 100", "Build a flowchart that prints every even number between 9 and 100, including 100. Start at 10 and increase by 2."
        shape="post_loop"
        pieces=[start,assign("initial","i = 10",i=10),output("write","Write i",v("i")),assign("increase","i = i + 2",i=op("+",v("i"),2)),step("decide","i ≤ 100?","decision",test=op("<=",v("i"),100)),end]
        cases=[({},list(range(10,101,2)))]
    elif index == 5:
        title, prompt = "Odd numbers, sum, and count", "Read n. Print every positive odd number strictly less than n, then print their sum and count. Start with i = 1."
        shape="odd_loop"
        pieces=[start,step("read","Read n","input",names=["n"]),assign("initial","sum = 0; count = 0; i = 1",sum=0,count=0,i=1),step("decide","i < n?","decision",test=op("<",v("i"),v("n"))),output("write","Write i",v("i")),assign("sum","sum = sum + i",sum=op("+",v("sum"),v("i"))),assign("count","count = count + 1",count=op("+",v("count"),1)),assign("increase","i = i + 2",i=op("+",v("i"),2)),output("total","Write sum",v("sum")),output("amount","Write count",v("count")),end]
        cases=[]
        for n in [0,1,2,9,16]:
            odds=list(range(1,n,2));cases.append(({"n":n},[*odds,sum(odds),len(odds)]))
    elif index in (6,7):
        shape="count_loop"
        if index == 6:
            title,prompt="Count up to n","Read n. Print the whole numbers from 1 through n. If n is zero, print nothing."
            initial=assign("initial","i = 1",i=1)
            work=output("work","Write i",v("i"))
            total=None
            cases=[({"n":n},list(range(1,n+1))) for n in [0,1,4,7]]
        else:
            title,prompt="Sum from 1 to n","Read n. Add all whole numbers from 1 through n, then display the total. For n = 0, display 0."
            initial=assign("initial","i = 1; total = 0",i=1,total=0)
            work=assign("work","total = total + i",total=op("+",v("total"),v("i")))
            total=output("total","Write total",v("total"))
            cases=[({"n":n},[n*(n+1)//2]) for n in [0,1,4,7]]
        pieces=[start,step("read","Read n","input",names=["n"]),initial,step("decide","i ≤ n?","decision",test=op("<=",v("i"),v("n"))),work,assign("increase","i = i + 1",i=op("+",v("i"),1)),*([total] if total else []),end]
    else:
        title,prompt="Temperature converter","Read a temperature C in Celsius. Calculate F = C × 9 / 5 + 32 and display F."
        pieces=[start,step("read","Read C","input",names=["C"]),assign("calculate","F = C × 9 / 5 + 32",F=op("+",op("/",op("*",v("C"),9),5),32)),output("write","Write F",v("F")),end]
        cases=[({"C":c},[c*9/5+32]) for c in [0,10,20,100]]

    if level is not None:
        if level == 2:
            title,prompt='Input and output',f'Read value for station {trial}, then display the same value without changing it.'
            pieces=[start,step('read','Read value','input',names=['value']),output('write','Write value',v('value')),end]
            cases=[({'value':n},[n]) for n in [-trial,0,trial+7,trial*3]]
        elif index == 0:
            pairs=[(trial,trial+2),(-trial,trial+5),(0,trial*2)]
            cases=[({'a':a,'b':b},[a+b]) for a,b in pairs]
        elif index == 1:
            pairs=[(trial+1,trial+2),(0,trial+4),(trial+3,2)]
            cases=[({'width':a,'height':b},[a*b]) for a,b in pairs]
        elif index == 2:
            cutoff=trial-5
            title,prompt='Decision branches',f'Read n. Display Above when n > {cutoff}; otherwise display At or below.'
            pieces[2]['label']=f'n > {cutoff}?';pieces[2]['action']['test']=op('>',v('n'),cutoff)
            for identity,text in [('yes','Above'),('no','At or below')]:
                p=next(p for p in pieces if p['id']==identity);p['label']='Write '+text;p['action']['value']=text
            cases=[({'n':n},['Above' if n>cutoff else 'At or below']) for n in [cutoff-2,cutoff,cutoff+3]]
        elif index == 3:
            cutoff=40+trial*2
            title,prompt='Boundary inputs',f'Read score. Display Pass when score ≥ {cutoff}; otherwise display Retry. Check below, equal to and above the boundary. This is an exercise cutoff, not the adaptation rule.'
            pieces[2]['label']=f'score ≥ {cutoff}?';pieces[2]['action']['test']=op('>=',v('score'),cutoff)
            cases=[({'score':n},['Pass' if n>=cutoff else 'Retry']) for n in [cutoff-1,cutoff,cutoff+1]]
        elif index == 4:
            first=10+2*trial;last=first+2*(4+trial)
            title,prompt='Trace a loop',f'Print every even number from {first} through {last}. Trace the update by 2 and the final failed condition.'
            pieces[1]['label']=f'i = {first}';pieces[1]['action']['values'][0]['value']=first
            pieces[4]['label']=f'i ≤ {last}?';pieces[4]['action']['test']=op('<=',v('i'),last)
            cases=[({},list(range(first,last+1,2)))]
        elif index in (6,7):
            values=[0,1,trial+2,trial+5]
            cases=[({'n':n},list(range(1,n+1)) if index==6 else [n*(n+1)//2]) for n in values]
        elif index == 8:
            pairs=[(trial+5,trial),(trial,trial+6),(trial,trial),(-trial,-trial-2)]
            cases=[({'a':a,'b':b},[max(a,b)]) for a,b in pairs]
        elif index == 5:
            cases=[]
            for n in [0,1,trial+3,trial+8]:
                odds=list(range(1,n,2));cases.append(({'n':n},[*odds,sum(odds),len(odds)]))
        else:
            cases=[({'C':c},[c*9/5+32]) for c in [-trial,0,trial+10,trial+20]]
        # Distinct, inspectable fixtures are part of the problem, not a cosmetic seed.
        prompt += f' Test dataset {trial}: '+str(cases[0][0])+'; '+str(cases[-1][0])+'.'

    if parameters:
        a,b=parameters['primary_value'],parameters['secondary_value']
        xs=parameters['input_values']
        if level==2:
            cases=[({'value':x},[x]) for x in xs]
        elif index in (0,1,8):
            pairs=[(x,b+i) for i,x in enumerate(xs)]+[(a,a),(-a,b)]
            if index==0:cases=[({'a':x,'b':y},[x+y]) for x,y in pairs]
            elif index==1:cases=[({'width':abs(x),'height':abs(y)},[abs(x)*abs(y)]) for x,y in pairs]
            else:cases=[({'a':x,'b':y},[max(x,y)]) for x,y in pairs]
        elif index in (2,3):
            cutoff=a-b if index==2 else a+b
            variable_name='n' if index==2 else 'score'
            predicate='>' if index==2 else '>='
            pieces[2]['label']=f'{variable_name} {predicate} {cutoff}?'
            pieces[2]['action']['test']=op(predicate,v(variable_name),cutoff)
            yes_text=pieces[3]['action']['value'];no_text=pieces[4]['action']['value']
            cases=[({variable_name:x},[yes_text if (x>cutoff if index==2 else x>=cutoff) else no_text]) for x in [cutoff-1,cutoff,cutoff+1,*xs]]
            prompt=f'Read {variable_name}. Display {yes_text} when {variable_name} {predicate} {cutoff}; otherwise display {no_text}. Test both branches and the boundary.'
        elif index==4:
            first=2*a;last=first+2*(b+2)
            pieces[1]['label']=f'i = {first}';pieces[1]['action']['values'][0]['value']=first
            pieces[4]['label']=f'i ≤ {last}?';pieces[4]['action']['test']=op('<=',v('i'),last)
            cases=[({},list(range(first,last+1,2)))];prompt=f'Print even numbers from {first} through {last}, updating by 2. Trace the final failed condition.'
        elif index in (5,6,7):
            cases=[]
            for n in dict.fromkeys([0,1,*[abs(x)+b for x in xs]]):
                odds=list(range(1,n,2))
                result=[*odds,sum(odds),len(odds)] if index==5 else list(range(1,n+1)) if index==6 else [n*(n+1)//2]
                cases.append(({'n':n},result))
        else:cases=[({'C':x},[x*9/5+32]) for x in xs]
        prompt=prompt.split(' Test dataset ')[0]+f' Problem values {a}, {b}; test inputs '+str([row[0] for row in cases])+'.'

    if shape=="sequence":
        coords={p['id']:[.5,.08+i*.84/(len(pieces)-1)] for i,p in enumerate(pieces)}
        edges=[{"from":a['id'],"to":b['id']} for a,b in zip(pieces,pieces[1:])]
    elif shape=="branch":
        coords={"start":[.5,.08],"read":[.5,.27],"decide":[.5,.47],"yes":[.24,.68],"no":[.76,.68],"end":[.5,.9]}
        edges=[{"from":"start","to":"read"},{"from":"read","to":"decide"},{"from":"decide","to":"yes","label":"Yes"},{"from":"decide","to":"no","label":"No"},{"from":"yes","to":"end"},{"from":"no","to":"end"}]
    elif shape=="post_loop":
        coords={p['id']:[.5,.06+i*.88/(len(pieces)-1)] for i,p in enumerate(pieces)}
        edges=[{"from":a['id'],"to":b['id']} for a,b in zip(pieces[:4],pieces[1:5])]
        edges += [{"from":"decide","to":"write","label":"Yes","via":[[.86,.77],[.86,.412]]},{"from":"decide","to":"end","label":"No"}]
    elif shape=="odd_loop":
        coords={"start":[.5,.06],"read":[.5,.19],"initial":[.5,.32],"decide":[.5,.46],"write":[.23,.6],"sum":[.23,.72],"count":[.23,.84],"increase":[.23,.96],"total":[.78,.6],"amount":[.78,.77],"end":[.78,.94]}
        edges=[{"from":a,"to":b} for a,b in [('start','read'),('read','initial'),('initial','decide'),('write','sum'),('sum','count'),('count','increase'),('total','amount'),('amount','end')]]
        edges += [{"from":"decide","to":"write","label":"Yes"},{"from":"decide","to":"total","label":"No"},{"from":"increase","to":"decide","label":"Loop","via":[[.06,.96],[.06,.46]]}]
    else:
        coords={"start":[.5,.06],"read":[.5,.23],"initial":[.5,.4],"decide":[.5,.57],"work":[.24,.76],"increase":[.24,.94],"total":[.78,.76],"end":[.78,.94]}
        edges=[{"from":a,"to":b} for a,b in [('start','read'),('read','initial'),('initial','decide'),('work','increase')]]
        edges += [{"from":"decide","to":"work","label":"Yes"},{"from":"increase","to":"decide","label":"Loop","via":[[.06,.94],[.06,.57]]}]
        if index==7: edges += [{"from":"decide","to":"total","label":"No"},{"from":"total","to":"end"}]
        else: edges += [{"from":"decide","to":"end","label":"No"}]

    if level is not None:
        # Reposition the same graph without altering its control-flow semantics.
        mirror=int(trial)%2==0
        for point in coords.values():
            if mirror:point[0]=1-point[0]
            if shape=='sequence':point[0]+=[-.05,0,.05][(int(trial)-1)%3]
        if mirror:
            for edge in edges:
                for point in edge.get('via',[]):point[0]=1-point[0]
    slots=[{"id":piece['id'],"x":coords[piece['id']][0],"y":coords[piece['id']][1],"number":i+1} for i,piece in enumerate(pieces)]
    solution={piece['id']:piece['id'] for piece in pieces}
    support=str(difficulty).lower().replace('_',' ') in {'needs support','need assistance','needassistance'}
    decoys=[]
    if not support:
        decoys=[assign('decoy_reset','Reset result to 0',result=0)]
        if str(difficulty).lower() in {'advanced','advance'}:
            decoy=copy.deepcopy(next((p for p in pieces if p['kind'] in {'process','decision'}),pieces[1]))
            decoy['id']='decoy_symbol';decoy['kind']='output';decoy['label']='Display '+decoy['label']
            decoy['action']={'value':'Not a calculation'};decoys.append(decoy)
    inventory=copy.deepcopy(pieces+decoys)
    random.Random(seed).shuffle(inventory)
    return {"schema_version":1,"scenario_id":f"flowchart_{index+1}","source_level":level,"title":title,"prompt":prompt,
            "entry":"start","slots":slots,"edges":edges,"pieces":inventory,"solution":solution,
            "cases":[{"id":f"case_{i+1}","inputs":inputs,"expected":expected} for i,(inputs,expected) in enumerate(cases)],
            "max_steps":1000,"scaffold":support,"feedback":"Trace the arrows. Read input before using it; use rectangles for assignments and diamonds for decisions.",
            "source_file_id":file_id}
