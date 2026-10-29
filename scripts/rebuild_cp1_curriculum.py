"""Write the researched, user-specified nine-week CP1 syllabus (explicit use only)."""
import json
from pathlib import Path

SOURCES = {
 'algorithms': ('OpenStax: algorithms and programs', 'https://openstax.org/books/introduction-computer-science/pages/3-1-introduction-to-data-structures-and-algorithms'),
 'flowcharts': ('Victoria Department of Education: flowcharts', 'https://www.education.vic.gov.au/school/teachers/teachingresources/discipline/english/literacy/Pages/using-flow-charts-to-design-algorithms.aspx'),
 'history': ('Dennis Ritchie: The Development of the C Language', 'https://cm-bell-labs.github.io/who/dmr/chist.html'),
 'c': ('GNU C Language Manual', 'https://www.gnu.org/software/c-intro-and-ref/manual/c-intro-and-ref.html'),
 'variables': ('GNU C: variables and scope', 'https://www.gnu.org/software/c-intro-and-ref/manual/html_node/Variables.html'),
 'cpp': ('GCC: header inclusion', 'https://gcc.gnu.org/onlinedocs/cpp/Include-Syntax.html'),
 'macros': ('GCC: object-like macros', 'https://gcc.gnu.org/onlinedocs/cpp/Object-like-Macros.html'),
 'basics': ('Harvard CS50: C basics', 'https://cs50.harvard.edu/x/notes/1/'),
}
TITLES = ['Orientation', 'Flowcharting', 'Algorithms', 'Introduction to C: History, Characteristics and Classification',
          'C Components, Keywords, Preprocessor and Organization', 'Creating Simple C Programs and Program Structure',
          'Basic Parts of C and Variable Declarations', 'Local and Global Variables', 'Examination Practice: Weeks 2–8']
POINTS = [
 ['Read the mission before starting. Learn the controls, Run, Step and Oracle hints.', 'A new wallet starts with 20 coins. Each hint costs 6 coins; first clears award the configured rewards once.', 'Stage 2 is guided interface practice; the main flowchart lesson is Week 2.'],
 ['Terminators mark start/end; rectangles perform processes; parallelograms represent input/output.', 'Decision diamonds choose labeled alternatives. Arrows specify order and loop-back paths.', 'Test both branches and boundary inputs before accepting a chart.'],
 ['An algorithm specifies precise steps; a program expresses a procedure in a programming language.', 'Identify inputs, processing and outputs. Trace intermediate state and check termination.', 'The register game is a small instruction language for algorithm practice, not C.'],
 ['Dennis Ritchie developed C at Bell Labs in the early 1970s, building on B in the Unix environment.', 'C is general purpose, procedural and imperative; it is normally compiled.', 'Portability needs care with implementation-dependent behavior. Middle-level is an informal classroom label, not an ISO language category.'],
 ['int and return are keywords; main and printf are identifiers, not keywords.', 'Preprocessing precedes compilation. #include supplies header content; #define specifies token replacement.', 'Organize directives, a main definition, declarations, statements and braces. Source construction is checked separately from the factory analogy.'],
 ['A hosted program begins at main. Braces form its body; statements execute in order.', 'Construct a short program using declarations, initialization, assignment and printf.', 'Adventure movement functions are LogiCade helpers declared in logicade.h, not standard C library functions.'],
 ['A declaration pairs a type and name; initialization supplies a first value, and assignment changes it.', 'Practice int, float, double and char, with suitable printf formats.', 'Names are case sensitive. Do not read an uninitialized automatic local.'],
 ['File-scope variables are declared outside functions; block-scope locals are visible in their block.', 'An inner declaration can hide an outer name. Leaving its scope restores the outer declaration.', 'Scope differs from lifetime: ordinary automatic locals belong to a block execution; file-scope objects have static storage duration.'],
 ['Stages cover every topic from Weeks 2–8 using its corresponding activity.', 'Apply flowcharts, algorithms, C history, source organization, declarations and scope.', 'These gamified examination exercises remain separate from formal pretest/posttest scores and approved assessment scoring.'],
]
STAGES = [
 ['Welcome video', 'Controls and mission practice'],
 ['Symbols and sequence','Input/output','Process expressions','Decision branches','Boundary inputs','Counting loops','Accumulators','Trace a loop','Compare branches','Flowchart synthesis'],
 ['Inputs and outputs','Ordered operations','State tracing','Arithmetic procedures','Negative values','Multi-step plans','Compare procedures','Debug ordering','Termination','Algorithm synthesis'],
 ['C origins','Ritchie and Bell Labs','B and Unix','General-purpose languages','Procedural classification','Imperative operations','Compilation','Portability','Characteristics and limits','History/classification review'],
 ['Tokens and components','Keywords and identifiers','Preprocessor directives','Header inclusion','Object-like macros','main and blocks','Declarations and statements','Expression statements','Source organization','Build and verify a source file'],
 ['The main function','Blocks and semicolons','Initialization','Ordered assignment','Integer expressions','Formatted output','Read and trace','Repair a short program','Output verification','Program synthesis'],
 ['Declare int','Initialize and add','Assignment versus equality','Multiply state','Signed values','Expression order','Declare float','Declare double','Declare char','Integer division'],
 ['File-scope declarations','Main-local declarations','Global initialization','Read global state','Shadow a global','Nested local blocks','Update visible state','Restore visibility','Compare local and global','Scope trace synthesis'],
 ['Flowchart examination','Algorithm examination','C history/classification examination','C component examination','Simple program examination','Declaration examination','Scope examination','Flowchart application','Source organization application','Local/global synthesis'],
]
SOURCE_IDS = [[], ['flowcharts','algorithms'], ['algorithms'], ['history','c'], ['cpp','macros','c'], ['basics','c'], ['basics','variables'], ['variables','c'], ['algorithms','history','cpp','variables']]
EXAMPLES = ['', 'Start → Read n → n > 0? → Yes/No output → End', 'READ x; ADD 3; OUTPUT result',
 'C: Ritchie; Bell Labs; early 1970s; general purpose; procedural.',
 '#include <stdio.h>\nint main(void) {\n int total = 3;\n printf("%d\\n", total);\n return 0;\n}',
 '#include <stdio.h>\nint main(void) {\n int score = 2;\n score = score + 3;\n printf("%d\\n", score);\n return 0;\n}',
 "int count = 3;\nfloat rate = 1.5f;\ndouble distance = 2.5;\nchar grade = 'A';",
 '#include <stdio.h>\nint score = 2;\nint main(void) {\n { int score = 7; printf("%d\\n", score); }\n printf("%d\\n", score);\n return 0;\n}',
 'Apply the earlier lessons; read the source-week label on each stage.']

def main():
    path = Path(__file__).resolve().parents[1] / 'data/curriculum.json'
    course = json.loads(path.read_text(encoding='utf-8'))
    for i, row in enumerate(course['weeks']):
        row.update(title=TITLES[i], mission=TITLES[i], objectives=POINTS[i][:2], stages=STAGES[i], source_ids=SOURCE_IDS[i],
                   lesson={'summary':TITLES[i], 'points':POINTS[i], 'example':EXAMPLES[i], 'practice':STAGES[i][-1]}, mechanic=POINTS[i][0])
    course.update(version='cp1-stage-objectives-v1-2026-10-29', source='User weekly syllabus; primary educational and language documentation',
                  stage_objective_policy='Level fixes the learning focus; variations change problems, fixtures and layouts within that focus.',
                  sources={key:{'title':title,'url':url} for key,(title,url) in SOURCES.items()},
                  exam_blueprint={str(k):v for k,v in {1:2,2:3,3:4,4:5,5:6,6:7,7:8,8:2,9:5,10:8}.items()},
                  exam_level_blueprint={str(k):v for k,v in {1:10,2:10,3:10,4:10,5:10,6:10,7:9,8:10,9:9,10:10}.items()})
    course['weeks'][8]['genres']=['circuit','terminal','pending','factory','dungeon']
    path.write_text(json.dumps(course,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__ == '__main__': main()
