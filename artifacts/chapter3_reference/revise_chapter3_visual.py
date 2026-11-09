from pathlib import Path
from copy import deepcopy
from collections import Counter
import math,re,textwrap,json
from PIL import Image,ImageDraw,ImageFont
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'artifacts/chapter3_reference'
ASSETS=WORK/'figures';ASSETS.mkdir(exist_ok=True)
BASE=ROOT/'output/documents/LogiCade_Chapter_3_Methods_and_Procedures.docx'
OUT=ROOT/'output/documents/LogiCade_Chapter_3_Illustrated_Revised.docx'
doc=Document(BASE)
sec=doc.sections[0];sec.page_width=Inches(8.27);sec.page_height=Inches(11.69)
sec.left_margin=Inches(1.5);sec.right_margin=sec.top_margin=sec.bottom_margin=Inches(1)
WIDTH=5.77
for name in ['Normal','Title','Heading 1','Heading 2','Heading 3','Caption']:
 s=doc.styles[name];s.font.name='Arial';s.font.size=Pt(12);s.font.color.rgb=RGBColor(0,0,0)
 rf=s.element.get_or_add_rPr().get_or_add_rFonts()
 for a in list(rf.attrib):
  if a.endswith('Theme'):del rf.attrib[a]
 for a in ['ascii','hAnsi','eastAsia','cs']:rf.set(qn('w:'+a),'Arial')
doc.styles['Title'].font.size=Pt(12)
for t in doc.tables:
 t.autofit=False
 for row in t.rows:
  for c in row.cells:
   c.width=int(c.width*WIDTH/6)
   for p in c.paragraphs:
    for r in p.runs:r.font.name='Arial';r.font.size=Pt(10)
 for col in t.columns:col.width=int(col.width*WIDTH/6)
for p in doc.paragraphs:
 for r in p.runs:
  if r.font.name:r.font.name='Arial'

# Publication figures are drawn from the application's documented processes.
FONTP=Path('C:/Windows/Fonts/arial.ttf')
BOLDP=Path('C:/Windows/Fonts/arialbd.ttf')
def font(size,bold=False):return ImageFont.truetype(str(BOLDP if bold else FONTP),size)
def canvas(w=1600,h=1100):
 im=Image.new('RGB',(w,h),'white');return im,ImageDraw.Draw(im)
def wrap(draw,text,f,width):
 lines=[]
 for segment in text.split('\n'):
  line=''
  for word in segment.split():
   trial=(line+' '+word).strip()
   if draw.textlength(trial,font=f)>width and line:lines.append(line);line=word
   else:line=trial
  lines.append(line)
 return lines
def box(draw,xy,text,size=37,fill='white',bold=False,shape='rect'):
 x0,y0,x1,y1=xy
 if shape=='diamond':draw.polygon([(x0,(y0+y1)/2),((x0+x1)/2,y0),(x1,(y0+y1)/2),((x0+x1)/2,y1)],fill=fill,outline='black',width=3)
 elif shape=='oval':draw.rounded_rectangle(xy,radius=45,fill=fill,outline='black',width=3)
 else:draw.rectangle(xy,fill=fill,outline='black',width=3)
 f=font(size,bold);lines=wrap(draw,text,f,(x1-x0)*(.62 if shape=='diamond' else .9))
 step=size*1.25;yy=(y0+y1-len(lines)*step)/2
 for line in lines:
  draw.text(((x0+x1-draw.textlength(line,font=f))/2,yy),line,font=f,fill='black');yy+=step
def arrow(draw,pts,label=None):
 draw.line(pts,fill='black',width=4,joint='curve')
 a,b=pts[-2],pts[-1];ang=math.atan2(b[1]-a[1],b[0]-a[0]);l=17
 draw.polygon([b,(b[0]-l*math.cos(ang-.5),b[1]-l*math.sin(ang-.5)),(b[0]-l*math.cos(ang+.5),b[1]-l*math.sin(ang+.5))],fill='black')
 if label:draw.text(((a[0]+b[0])/2+10,(a[1]+b[1])/2-35),label,font=font(30),fill='black')
def save(im,name):p=ASSETS/(name+'.png');im.save(p);return p

def ipo():
 im,d=canvas(1800,1110)
 cards=[('INPUT',['Approved CP1 syllabus and stage objectives','Consented participant data and formal assessments','Authored game assets and verified challenge pool','Gameplay features and expert labels']),('PROCESS',['Curriculum binding and bounded challenge verification','Authenticated play and explicit synchronization','Data cleaning and matched assessment analysis','Offline MLR training and participant-separated evaluation']),('OUTPUT',['Operational learning application and traceable game packages','Pseudonymous gameplay and assessment datasets','Descriptive summaries and supported comparisons','Exploratory model artifacts and documented limitations'])]
 for i,(title,items) in enumerate(cards):
  x=20+i*610;d.rectangle((x,40,x+550,1030),outline='black',width=3)
  d.rectangle((x,40,x+550,145),fill='#e7e7e7',outline='black',width=3)
  d.text((x+(550-d.textlength(title,font=font(44,True)))/2,68),title,font=font(44,True),fill='black')
  y=190
  for item in items:
   lines=wrap(d,item,font(37),465)
   d.ellipse((x+25,y+13,x+35,y+23),fill='black')
   for line in lines:d.text((x+55,y),line,font=font(37),fill='black');y+=49
   y+=35
  if i<2:arrow(d,[(x+552,550),(x+605,550)])
 return save(im,'ipo')
def chain(name,texts,side=None):
 h=len(texts)*160+40;im,d=canvas(1600,h)
 x0=280;x1=1270
 for i,t in enumerate(texts):
  y=20+i*160;box(d,(x0,y,x1,y+115),t,size=35,fill='#f3f3f3' if i in (0,len(texts)-1) else 'white',shape='oval' if i in (0,len(texts)-1) else 'rect')
  if i<len(texts)-1:arrow(d,[((x0+x1)/2,y+116),((x0+x1)/2,y+159)])
 return save(im,name)
def ml_flow():
 im,d=canvas(1800,1480)
 rows=[('Pseudonymous real exports','Synthetic demonstration records'),('Pre-decision features and independent expert labels','Pipeline exercise only'),('Participant-separated training and holdout sets','No mixing with participant data')]
 for i,(a,b) in enumerate(rows):
  y=30+i*210;box(d,(40,y,1100,y+145),a,38)
  box(d,(1240,y,1770,y+145),b,33,fill='#f0f0f0')
  if i<2:arrow(d,[(570,y+146),(570,y+208)]);arrow(d,[(1505,y+146),(1505,y+208)])
 box(d,(40,680,1100,835),'Training only: imputation, encoding, scaling and matched-time medians',38)
 arrow(d,[(570,595),(570,678)])
 box(d,(40,900,1100,1045),'Fit raw-feature and band-feature MLR models',38);arrow(d,[(570,836),(570,898)])
 box(d,(40,1110,1100,1265),'Held-out participant evaluation and probability-quality metrics',38);arrow(d,[(570,1046),(570,1108)])
 box(d,(40,1330,1100,1465),'Versioned research artifacts; not deployed as live difficulty',37);arrow(d,[(570,1266),(570,1328)])
 box(d,(1240,875,1770,1265),'Current live difficulty remains the server-authoritative 60 percent rule. Model deployment requires separate validation and approval.',35,fill='#f0f0f0')
 return save(im,'ml_pipeline')
def architecture():
 im,d=canvas(1800,1180)
 for xy,txt in [((30,50,560,250),'Learner browser\nReact and Canvas\nIndexedDB outbox'),((650,50,1170,250),'FastAPI\nAuthenticated APIs\nStage and package authority'),((1260,50,1780,250),'Supabase and PostgreSQL\nParticipant records\nResearch and audit views')]:box(d,xy,txt,37)
 arrow(d,[(562,150),(648,150)]);arrow(d,[(1172,150),(1258,150)])
 box(d,(30,410,560,640),'Verified pool\nJSON and mirrored games\nShared assets',37)
 box(d,(650,410,1170,640),'Private ZIP preparation\nDescription and manifest\nTemporary extraction lease',37)
 arrow(d,[(562,530),(648,530)]);arrow(d,[(910,408),(910,253)])
 box(d,(1260,410,1780,640),'Admin interface\nInspection and exports\nRestricted sessions',37)
 arrow(d,[(1520,408),(1520,253)])
 box(d,(30,840,560,1080),'Ollama worker\nBounded parameters\nFixed lesson and difficulty',37)
 box(d,(650,840,1170,1080),'Verifier\nReference execution\nNovelty and contract checks',37)
 box(d,(1260,840,1780,1080),'Recoverable publication\nVersioned artifacts\nPreserved prior source',37)
 arrow(d,[(562,960),(648,960)]);arrow(d,[(1172,960),(1258,960)])
 arrow(d,[(1520,1082),(1520,1140),(8,1140),(8,530),(28,530)])
 return save(im,'architecture')
def package():
 im,d=canvas(1800,1400)
 steps=['Select an available stage','Resolve difficulty from synchronized history','Choose a matching verified JSON and description','Prepare ZIP and extract a private lease','Start the selected immutable game revision','Save attempts and events; release on finish, exit or repeat']
 for i,t in enumerate(steps):
  y=20+i*210;box(d,(50,y,1180,y+140),t,39,shape='oval' if i in (0,5) else 'rect')
  if i<5:arrow(d,[(615,y+142),(615,y+208)])
 box(d,(1280,440,1770,790),'Unavailable history or stale revision\nSynchronize or select again\nNo silent difficulty substitution',34,fill='#eeeeee')
 arrow(d,[(1182,300),(1525,300),(1525,438)])
 box(d,(1280,980,1770,1280),'Background replacement is queued. Existing verified content remains available.',36,fill='#eeeeee')
 arrow(d,[(1182,1140),(1278,1140)])
 return save(im,'package_flow')
def llm():
 im,d=canvas(1700,1600)
 items=[('Consumed revision queues a job',False),('Propose bounded parameters for the fixed objective',False),('Build candidate and execute verification',False),('Candidate passes?',True),('Publish coherent revision and record provenance',False),('Serve new revision on a later selection',False)]
 for i,(t,diamond) in enumerate(items):
  y=20+i*250;box(d,(70,y,1080,y+170),t,38,shape='diamond' if diamond else 'rect')
  if i<len(items)-1:arrow(d,[(575,y+172),(575,y+248)],'Yes' if diamond else None)
 box(d,(1200,650,1670,1070),'No: retain last verified source. Retry up to three attempts; then wait five minutes before another attempt.',35,fill='#eeeeee')
 arrow(d,[(1082,855),(1198,855)],'No')
 arrow(d,[(1435,648),(1435,355),(1082,355)])
 return save(im,'llm_verification')
def records():
 im,d=canvas(1600,1050)
 box(d,(470,20,1120,150),'Private account identity',38)
 box(d,(470,220,1120,360),'Pseudonymous participant',38)
 arrow(d,[(795,152),(795,218)])
 labels=[('Assessments',30),('Stage records',560),('Learner sessions',1090)]
 for label,x in labels:box(d,(x,470,x+480,620),label,35)
 for x in [270,800,1330]:arrow(d,[(795,362),(795,415),(x,415),(x,468)])
 box(d,(560,720,1040,850),'Attempts',37);arrow(d,[(800,622),(800,718)])
 box(d,(560,920,1040,1040),'Gameplay events',37);arrow(d,[(800,852),(800,918)])
 box(d,(30,740,510,1000),'Coin ledger and difficulty decisions preserve their participant and stage links.',34,fill='#eeeeee')
 box(d,(1090,740,1570,1000),'Identifying values stay outside the default research export.',34,fill='#eeeeee')
 return save(im,'record_relationships')
def agile():
 im,d=canvas(1700,850)
 xs=[30,610,1190];ys=[40,490]
 labels=['1 Planning\nObjectives and requirements','2 Design\nInterfaces schema contracts','3 Implementation\nRuntime APIs and records','6 Review\nFeedback and versioned changes','5 Deployment\nApproved build and study access','4 Verification\nContent correctness and recovery']
 for i,t in enumerate(labels):
  x=xs[i%3];y=ys[i//3];box(d,(x,y,x+470,y+240),t,38,fill='#f5f5f5')
 for a,b in [((502,160),(608,160)),((1082,160),(1188,160)),((1425,282),(1425,488)),((1188,610),(1082,610)),((608,610),(502,610))]:arrow(d,[a,b])
 arrow(d,[(265,488),(265,282)]);return save(im,'agile_cycle')

figpaths={'ipo':ipo(),'collection':chain('collection',['Permissions and instrument validation','Recruit consented participants and collect baseline evidence','Deliver the approved LogiCade exposure schedule','Capture and confirm pseudonymous gameplay records','Collect posttest and role-appropriate evaluations','Clean matched records and report missingness','Apply approved statistics and exploratory ML analysis']), 'ml':ml_flow(),'architecture':architecture(),'package':package(),'llm':llm(),'records':records(),'agile':agile()}

cursor=None
def anchor(prefix,last=False):
 global cursor
 hits=[p._p for p in doc.paragraphs if p.text.startswith(prefix)]
 if not hits:raise ValueError('Missing anchor '+prefix)
 cursor=hits[-1] if last else hits[0]
def place(el):
 global cursor
 cursor.addnext(el);cursor=el
def para(text,style=None):
 p=doc.add_paragraph(text,style);place(p._p)
 p.paragraph_format.first_line_indent=Inches(.5 if not style else 0)
 p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
 return p
def heading(text):
 p=para(text,'Heading 3');p.paragraph_format.keep_with_next=True;return p
def tbl(title,headers,rows,widths):
 cap=para('Table 0 '+title,'Caption');cap.paragraph_format.first_line_indent=0;cap.paragraph_format.keep_with_next=True
 cap.runs[0].bold=True
 t=doc.add_table(rows=1,cols=len(headers));t.autofit=False;place(t._tbl)
 for col,w in zip(t.columns,widths):col.width=Inches(w)
 for rowdata,row in [(headers,t.rows[0])]+[(r,t.add_row()) for r in rows]:
  for c,txt,w in zip(row.cells,rowdata,widths):
   c.width=Inches(w);c.text=str(txt)
   for p in c.paragraphs:
    p.paragraph_format.first_line_indent=0;p.paragraph_format.line_spacing=1.1;p.paragraph_format.space_after=Pt(4)
    for r in p.runs:r.font.name='Arial';r.font.size=Pt(10)
 for i,row in enumerate(t.rows):
  trpr=row._tr.get_or_add_trPr();trpr.append(OxmlElement('w:cantSplit'))
  if i==0:trpr.append(OxmlElement('w:tblHeader'))
  for c in row.cells:
   pr=c._tc.get_or_add_tcPr()
   if i==0:
    sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'E1E1E1');pr.append(sh)
    for r in c.paragraphs[0].runs:r.bold=True
   mar=OxmlElement('w:tcMar')
   for k in ['top','left','bottom','right']:
    e=OxmlElement('w:'+k);e.set(qn('w:w'),'80');e.set(qn('w:type'),'dxa');mar.append(e)
   pr.append(mar)
 borders=OxmlElement('w:tblBorders')
 for edge in ['top','bottom','left','right','insideH','insideV']:
  e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
 t._tbl.tblPr.append(borders)
 para('').paragraph_format.space_after=Pt(0)
 return t
def figure(path,title,explanation=None,max_height=5.5):
 p=doc.add_paragraph();place(p._p);p.paragraph_format.first_line_indent=0;p.alignment=WD_ALIGN_PARAGRAPH.CENTER
 p.paragraph_format.keep_with_next=True
 w,h=Image.open(path).size;width=min(WIDTH,max_height*w/h)
 p.add_run().add_picture(str(path),width=Inches(width))
 cap=para('Figure 0 '+title,'Caption');cap.alignment=WD_ALIGN_PARAGRAPH.CENTER
 cap.paragraph_format.first_line_indent=0;cap.paragraph_format.line_spacing=1.1;cap.paragraph_format.space_after=Pt(9)
 cap.runs[0].bold=True;cap.paragraph_format.keep_with_next=bool(explanation)
 if explanation:para(explanation)

# Editable Office Math rather than equation screenshots.
def mr(text):
 e=OxmlElement('m:r');t=OxmlElement('m:t');t.text=str(text);e.append(t);return e
def seq(*args):return [mr(x) if isinstance(x,str) else x for x in args]
def sub(base,index):
 e=OxmlElement('m:sSub');b=OxmlElement('m:e');b.append(mr(base));s=OxmlElement('m:sub');s.append(mr(index));e.extend([b,s]);return e
def subsup(base,index,power):
 e=OxmlElement('m:sSubSup');b=OxmlElement('m:e');b.append(mr(base));s=OxmlElement('m:sub');s.append(mr(index));u=OxmlElement('m:sup');u.append(mr(power));e.extend([b,s,u]);return e
def summation(index,limit,content):
 e=OxmlElement('m:nary');pr=OxmlElement('m:naryPr');ch=OxmlElement('m:chr');ch.set(qn('m:val'),'∑');pr.append(ch)
 loc=OxmlElement('m:limLoc');loc.set(qn('m:val'),'subSup');pr.append(loc);e.append(pr)
 lo=OxmlElement('m:sub');lo.append(mr(index));hi=OxmlElement('m:sup');hi.append(mr(limit));body=OxmlElement('m:e')
 for c in content:body.append(c)
 e.extend([lo,hi,body]);return e
def sup(base,index):
 e=OxmlElement('m:sSup');b=OxmlElement('m:e')
 for c in base if isinstance(base,list) else [mr(base) if isinstance(base,str) else base]:b.append(c)
 s=OxmlElement('m:sup');s.append(mr(index));e.extend([b,s]);return e
def frac(n,d):
 e=OxmlElement('m:f')
 for tag,content in [('m:num',n),('m:den',d)]:
  child=OxmlElement(tag)
  for c in content if isinstance(content,list) else [mr(content) if isinstance(content,str) else content]:child.append(c)
  e.append(child)
 return e
def sqrt(content):
 e=OxmlElement('m:rad');pr=OxmlElement('m:radPr');hide=OxmlElement('m:degHide');hide.set(qn('m:val'),'1');pr.append(hide);e.append(pr);e.append(OxmlElement('m:deg'));b=OxmlElement('m:e')
 for c in content if isinstance(content,list) else [content]:b.append(c)
 e.append(b);return e
def equation(parts,definition):
 p=doc.add_paragraph();place(p._p);p.paragraph_format.first_line_indent=0;p.paragraph_format.keep_with_next=True
 mp=OxmlElement('m:oMathPara');pr=OxmlElement('m:oMathParaPr');jc=OxmlElement('m:jc');jc.set(qn('m:val'),'center');pr.append(jc);mp.append(pr)
 m=OxmlElement('m:oMath')
 for part in parts:m.append(mr(part) if isinstance(part,str) else part)
 m.append(mr('   [EQNO]'));mp.append(m);p._p.append(mp)
 para('Where '+definition)

anchor('Research strata, if retained')
figure(figpaths['ipo'],'Input Process Output framework for LogiCade','The inputs include curriculum requirements, approved instruments, reusable content, and learner evidence. Application processing and research analysis produce traceable records and supported summaries. A model artifact is an exploratory research output until validated and approved for live use.',5)

anchor('This rubric remains a proposed instrument')
equation(seq('S = 70',frac('P','T'),' + 20',frac('C','K'),' + 10',frac('D','R')),'S is the proposed challenge score; P and T are passed and total approved tests; C and K are satisfied and total distinct concept checks; and D and R are completed and required deliverables. Each denominator must be positive and approved before the task is scored.')
tbl('Interpretation of the proposed performance score',['Result','Permitted interpretation'],[
 ('0 to 100','A rubric score for one assessed challenge when all scoring criteria and denominators are approved.'),
 ('Missing','No evaluated submission, an invalidated task, or unavailable required evidence. Missing is not zero.'),
 ('Week summary','Use only the approved aggregation and report the number of valid assessed stages.'),
 ('Proficiency or grade band','[insert approved score cutoffs and proficiency interpretations]')],[1.35,4.42])

anchor('The training scripts normalize')
tbl('Provisional interpretation bands for scored gameplay features',['Feature','Needs Support','Standard','Advanced'],[
 ('Mistakes','3 or more','1 or 2','0'),('Revealed hints','3 or more','1 or 2','0'),
 ('Completion time relative to matched median','More than 125%','75% to 125%','Below 75%'),
 ('Level-run attempts','3 or more','2','1'),('Submission accuracy','Below 60%','60% to below 80%','80% to 100%'),
 ('First evaluated run success','No','No middle band','Yes'),('Failure rate across last five comparable runs','Above 50%','Above 0% to 50%','0%'),
 ('Additional submissions or retries','3 or more','1 or 2','0'),('ML topic mastery proxy','Below 50%','50% to below 80%','80% to 100%'),
 ('Response time relative to matched median','More than 125%','75% to 125%','Below 75%')],[2.05,1.24,1.24,1.24])
para('These bands reproduce the supplied difficulty rubric and offline trainer. They remain provisional review cues rather than a validated student-classification scale. Zero hints is interpretable only when assistance was accessible; failure-rate and mastery bands require at least three comparable observations. Timing medians are fitted on training participants only. Session duration and inactivity remain context measures. The overall label is assigned from combined expert-reviewed evidence rather than by counting or averaging band votes.')

anchor('10. Label and analyze')
figure(figpaths['collection'],'Data gathering and research record preparation flow','Recruitment, baseline assessment, system exposure, endpoint assessment, and analysis follow the approved protocol. The flow does not establish a sample size or research design; those fields remain subject to the placeholders in Sections 3.2 and 3.4.',5.9)

anchor('The available implementation uses Python')
tbl('Data analysis and implementation tools',['Tool','Use in this project'],[
 ('React and Vite','Learner views, stage selection, mission and result states.'),('HTML5 Canvas and authored JavaScript','Reusable game controllers and bounded teaching simulations.'),
 ('Python and FastAPI','Authenticated APIs, data validation, package handling and generator operations.'),('PostgreSQL and Supabase','Synchronized research tables, ledger records and aggregate views.'),
 ('IndexedDB','Local attempt and event records with an explicit retrying outbox.'),('pandas and NumPy','Offline feature construction and numeric data preparation.'),
 ('scikit-learn','L2 multinomial logistic regression, preprocessing, evaluation and exploratory clustering.'),('Ollama','Local, configuration-dependent candidate parameter generation.'),
 ('Approved inferential package','[insert statistical software version and analysis environment]')],[1.85,3.92])

anchor('The synthetic generator defaults')
figure(figpaths['ml'],'Offline MLR feature preparation training and evaluation pipeline','Only participant histories available before each decision enter the real-data workflow. Synthetic demonstration records remain separate. Grouped evaluation estimates performance for held-out participants; it does not make the resulting model a live selector.',5.4)
equation(seq(sub('z','ij'),' = ',frac(seq(sub('x','ij'),' − ',sub('μ','j')),sub('σ','j'))),'xij is a numeric feature for decision i, μj is its training-set mean, and σj is its training-set standard deviation. The fitted scaler is applied to evaluation records without refitting on them.')
tbl('Interpretation of standardized numeric features',['Value','Meaning'],[
 ('z = 0','At the training-set mean for that feature.'),('z > 0','Above that feature’s training-set mean.'),('z < 0','Below that feature’s training-set mean.'),
 ('Magnitude of z','Distance expressed in training standard deviations, not an educational mastery rating.'),('Missing raw measurement','Retain missingness; use only the fitted training-data imputation pipeline.')],[1.4,4.37])
equation(seq('Pr(Y = k | x) = ',frac(seq('exp(',sub('β','k0'),' + ',subsup('β','k','T'),'x)'),summation('j=1','3',seq('exp(',sub('β','j0'),' + ',subsup('β','j','T'),'x)')))),'k is one of Needs Support, Standard, and Advanced; x contains the transformed pre-decision features; and β contains the fitted model coefficients. The three class probabilities sum to one. This equation describes the offline model, not the current live rule.')

anchor('For categorical records, percentage')
equation(seq('Percentage = ',frac('f','N'),' × 100'),'f is an observed frequency and N is the valid denominator for the stated analytical unit.')
equation(seq('x̄ = ',frac(seq('Σ',sub('x','i')),'n')),'xi is an observed numeric measurement and n is the number of valid observations in the defined analysis.')
equation(seq('s = ',sqrt(frac(summation('i=1','n',[sup(seq('(',sub('x','i'),' − x̄)'),'2')]),'n − 1'))),'s is the sample standard deviation, defined only when at least two valid observations are available.')
anchor('For five-point questionnaire responses')
equation(seq(sub('x̄','w'),' = ',frac(seq('Σ',sub('f','j'),sub('r','j')),seq('Σ',sub('f','j')))),'rj is the assigned response value and fj is the number of valid respondents selecting it. This is a response-frequency weighted item mean, not an assumed weighted composite of different constructs.')
tbl('Proposed verbal interpretation of five-point item means',['Unrounded mean interval','Interpretation'],[
 ('4.20 to 5.00','Strongly Agree'),('3.40 to below 4.20','Agree'),('2.60 to below 3.40','Neutral'),('1.80 to below 2.60','Disagree'),('1.00 to below 1.80','Strongly Disagree')],[2.25,3.52])
para('These proposed intervals are inherited from the supplied revised LogiCade methodology. Their use requires instrument approval. Classify the unrounded mean and round only for display; adjacent half-open intervals avoid gaps caused by reporting to two decimal places. Do not apply this agreement scale to test scores or ML metrics.')

anchor('For participant i, learning gain')
equation(seq(sub('g','i'),' = ',sub('Post','i'),' − ',sub('Pre','i')),'gi is an individual paired score difference on the same assessment scale. Only matched valid scores contribute to paired analysis.')
tbl('Interpretation of paired learning gain',['Difference','Interpretation'],[
 ('g > 0','Observed posttest score is higher than pretest score.'),('g = 0','No observed score difference on the specified scale.'),('g < 0','Observed posttest score is lower than pretest score.'),('One assessment missing','No paired difference; exclude from paired calculations and report missingness.')],[1.5,4.27])
anchor('If the approved design supports')
equation(seq('t = ',frac('d̄',frac(sub('s','d'),sqrt([mr('n')])))),'d̄ is the mean paired difference, sd is the standard deviation of paired differences, and n is the number of valid pairs. Degrees of freedom are n − 1. Use only when the approved design and assumptions support this test.')
anchor('The proposed paired effect size')
equation(seq(sub('d','z'),' = ',frac('d̄',sub('s','d'))),'dz is the mean paired change in units of the standard deviation of differences. Its sign indicates direction; magnitude must be interpreted with a confidence interval and the educational context.')
tbl('Interpretation rules for inferential statistics',['Quantity','Interpretation rule'],[
 ('Prespecified alpha','The source draft proposes 0.05; final hypotheses and analysis require approval.'),('p below alpha','Evidence against the specified null under the test assumptions. It is not the probability that LogiCade caused improvement.'),
 ('p at or above alpha','Insufficient evidence to reject the specified null; not proof of no effect.'),('Three prespecified stratum tests','The source draft proposes Bonferroni alpha 0.05 / 3, approximately 0.0167.'),
 ('Effect size and confidence interval','Report direction, magnitude and uncertainty; acceptance cutoffs are [insert approved effect-size interpretation].')],[1.75,4.02])

anchor('Stage completion rate is the count')
equation(seq('Submission accuracy = ',frac('Correct scored submissions','All scored submissions')),'the denominator must be positive. This submission-based research measure is retained separately from test-case accuracy or a game’s native goal score.')
equation(seq('Failure rate = ',frac('Failed evaluated runs','Completed evaluated runs + Failed evaluated runs')),'abandoned, restarted, or unevaluated runs are retained separately rather than being silently added to the evaluated denominator.')
equation(seq('Time ratio = ',frac('Measured active task time','Training-only matched-task median')),'the completion measure requires a successful run; the response measure uses the available first-response samples. A ratio of 1 is the matched median, not a mastery cutoff.')

anchor('The trainer reports classification')
equation(seq('Accuracy = ',frac('Correct class predictions','All evaluated decisions')),'each row is one eligible next-stage decision. Report the number of distinct evaluation participants as well as the number of rows.')
equation(seq(sub('Precision','k'),' = ',frac(sub('TP','k'),seq(sub('TP','k'),' + ',sub('FP','k'))),';   ',sub('Recall','k'),' = ',frac(sub('TP','k'),seq(sub('TP','k'),' + ',sub('FN','k')))),'TPk, FPk and FNk are true positives, false positives and false negatives when class k is treated as the positive class. The trainer reports class recall; precision can be calculated from the confusion matrix for F1 interpretation.')
equation(seq(sub('F1','k'),' = ',frac(seq('2 ',sub('Precision','k'),' ',sub('Recall','k')),seq(sub('Precision','k'),' + ',sub('Recall','k'))),';   Macro F1 = ',frac(seq(sub('F1','1'),' + ',sub('F1','2'),' + ',sub('F1','3')),'3')),'macro F1 assigns equal importance to the three classes. The current trainer assigns zero when an F1 or recall denominator is undefined; class supports and the confusion matrix must remain visible.')
equation(seq('Log loss = −',frac('1','N'),summation('i=1','N',[summation('k=1','3',seq(sub('y','ik'),' ln(',sub('p','ik'),')'))])),'yik equals 1 for the actual class and 0 otherwise; pik is the predicted probability. Lower loss is better and confident incorrect predictions are penalized strongly.')
equation(seq('Brier = ',frac('1','N'),summation('i=1','N',[summation('k=1','3',[sup(seq('(',sub('p','ik'),' − ',sub('y','ik'),')'),'2')])])),'this is the unscaled multiclass definition used in the training script, with range 0 to 2. A score of zero represents perfect probabilities on the evaluated rows.')
tbl('Interpretation of MLR evaluation outputs',['Metric','Meaning and direction'],[
 ('Accuracy','0 to 1; higher means more correct class predictions. Read alongside class distribution.'),('Macro F1','0 to 1; higher indicates better balance of precision and recall across classes. No validated Excellent or Poor cutoffs are established.'),
 ('Recall by class','0 to 1; higher means fewer actual members of that class were missed.'),('Confusion matrix','Rows are actual classes and columns are predicted classes; inspect every off-diagonal error.'),
 ('Log loss','Zero is ideal; lower is better. The upper bound is unbounded.'),('Multiclass Brier score','0 to 2 for the implemented formula; lower is better. This is not a standalone proof of calibration.'),
 ('Production acceptance','[insert approved performance uncertainty and safety criteria]')],[1.6,4.17])

anchor('The proof of concept is the implemented')
figure(figpaths['architecture'],'LogiCade application and verified generation architecture','The learner host controls identity, rewards and persistence. A private package binds a selected challenge revision to its game. Background generation proposes content within a fixed lesson, while verification and recoverable publication protect the usable pool.',4.6)
anchor('A participant owns multiple stage records')
figure(figpaths['records'],'Logical relationships among participant research records','The diagram shows logical research relationships, not a claim that every displayed edge is a physical database foreign key. One participant can own many stage records, attempts, sessions and assessments. Account identity is separated from the default pseudonymous research dataset.',4.5)
anchor('The C execution environment is a bounded') if False else None
anchor('Shared sprites and interface audio')
figure(figpaths['package'],'Stage selection preparation play and cleanup flow','The selected stage retains its objective and assigned difficulty from preview to start. Missing evidence or a stale revision triggers recovery. Consuming a played build queues later replacement while preserving the last verified source.',5.1)
figure(figpaths['llm'],'Background challenge generation verification and retry flow','A failing or unavailable generator does not publish unverified content. Bounded retries use the same stage objective and difficulty. Publication is recoverable and does not alter an active extracted game revision.',5.9)

# Genuine archived interface captures. No screenshots are fabricated.
anchor('The verification procedure will cover')
heading('3.9.6 System snapshots')
para('The following figures are archived development captures from the project screenshot collection. The main interface set was captured on November 5, 2026; additional game captures document the later activity presentations available in the workspace. Accounts, assessments, and operational states in these previews may use demonstration fixtures. They illustrate interfaces and program execution only and do not provide participant findings, measured learning gains, or a production acceptance record.')
atlas=ROOT/'artifacts/LogiCade-screenshot-atlas-2026-11-05'
shots=[
 ('learner/landing.jpg','Landing interface','The landing screen introduces CP1 learning and provides the entry action to account access.'),
 ('learner/login.jpg','Student number login interface','The learner login uses a student number and password. This capture is from a development preview.'),
 ('learner/world.jpg','World map and curriculum regions','The map presents the nine curriculum regions and the available navigation controls.'),
 ('learner/level-selected.jpg','Stage selection and first clear reward display','The level selection view connects stage availability, completion state, and the Challenge action.'),
 ('levels/week-01-stage-02.jpg','Guided drag and drop flowchart practice','The orientation activity introduces chart assembly before the main Week 2 flowchart region.'),
 ('levels/week-02-stage-01.jpg','Flowchart circuit workbench','The circuit presentation associates the selected lesson with executable flowchart tasks.'),
 (ROOT/'artifacts/c-node-selectors-removed.png','Connected C program nodes','Multiple C teaching nodes exchange values. The current learner presentation hides diagnostic output selectors.'),
 (ASSETS/'current-five-object-archive.png','C history hidden object investigation','This isolated local capture shows the current five-artifact archive case. It uses the authored game and temporary package data without writing participant records.'),
 ('levels/week-05-stage-01.jpg','Factory and source assembly activity','The factory presentation connects routing and source-building tasks to the assigned C components lesson.'),
 ('levels/week-06-stage-01.jpg','Code controlled programming adventure','The adventure combines a bounded C task with map goals, local execution feedback, and navigation.'),
 (ROOT/'artifacts/week8-scope-circuit.png','Local and global variable circuit activity','The scope workbench documents program state and signal routing in a development execution preview.'),
 ('admin/reports.jpg','Administrator research export interface','Authorized users select a synchronized dataset, filters, and export format. This interface capture is not a report of actual study results.')]
for path,title,description in shots:
 source=path if isinstance(path,Path) else atlas/path
 figure(source,title,description,max_height=3.65)

anchor('The available LogiCade methodology specifies an Agile')
figure(figpaths['agile'],'Agile development iteration for LogiCade','The development cycle connects planning, design, implementation, verification, deployment, and review. Study data collection uses an identified approved release; later changes require documented version control.',3.7)

# Keep the illustrated Agile explanation compact and avoid a one-paragraph final page.
for p in doc.paragraphs:
 if p.text.startswith(('1. Planning.','2. Design.','3. Implementation.','4. Verification.','5. Deployment.','6. Review and refinement.')):
  p.paragraph_format.line_spacing=1.15;p.paragraph_format.space_after=Pt(4)

# A table header must share its page with at least the first body row.
for t in doc.tables:
 for p in t.rows[0].cells[0].paragraphs:p.paragraph_format.keep_with_next=True
 for c in t.rows[0].cells:
  for p in c.paragraphs:p.paragraph_format.keep_with_next=True

# Number tables, figures, and equations in their final document order.
table_no=fig_no=eq_no=0
for p in doc.paragraphs:
 if re.match(r'^Table \d+ ',p.text):
  table_no+=1;rest=re.sub(r'^Table \d+ ','',p.text);p.text=f'Table 3.{table_no} {rest}'
  p.style='Caption';p.paragraph_format.first_line_indent=0;p.paragraph_format.keep_with_next=True
  for r in p.runs:r.bold=True
 if p.text.startswith('Figure 0 '):
  fig_no+=1;p.text=f'Figure 3.{fig_no} '+p.text[len('Figure 0 '):]
  p.style='Caption';p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.first_line_indent=0
  for r in p.runs:r.bold=True
 for t in p._p.iter(qn('m:t')):
  if t.text and '[EQNO]' in t.text:
   eq_no+=1;t.text=t.text.replace('[EQNO]',f'({3}.{eq_no})')
# Uniform image alt descriptions and explicit no-title-border handling.
for p in doc.paragraphs:
 for el in p._p.iter(qn('wp:docPr')):
  next_el=p._p.getnext();txt=' '.join(next_el.itertext()) if next_el is not None else 'LogiCade figure'
  el.set('descr',txt)
for parent in [doc.styles.element,doc.element]:
 for border in list(parent.iter(qn('w:pBdr'))):border.getparent().remove(border)
doc.core_properties.title='LogiCade Chapter 3 Methods and Procedures Illustrated Revision'
doc.save(OUT)
(WORK/'revision_inventory.json').write_text(json.dumps({'output':str(OUT),'tables':table_no,'figures':fig_no,'editable_equations':eq_no,'screenshots':len(shots),'reference':'v2.3 THESIS II.pdf'},indent=2))
print(OUT);print('Tables',table_no,'Figures',fig_no,'Editable equations',eq_no,'Snapshots',len(shots))
