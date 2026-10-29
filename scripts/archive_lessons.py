"""C archive questions scoped to the assigned stage, using the existing references."""
from itertools import combinations

# Each row contains a question, its answer and three plausible misconceptions.
BANK = {
 1: [
  ('When did C develop?', 'The early 1970s', ['The 1990s', 'Before electronic computers', 'The 2010s']),
  ('Which language preceded C directly?', 'B', ['Java', 'Python', 'C#']),
  ('Which environment shaped C development?', 'Unix systems work', ['Only web browsers', 'Only phone applications', 'Only spreadsheets']),
  ('Which description fits C origins?', 'An evolution from earlier systems languages', ['A dialect of Python', 'A browser markup format', 'A spreadsheet formula language'])],
 2: [
  ('Who developed C?', 'Dennis Ritchie', ['James Gosling', 'Guido van Rossum', 'Bjarne Stroustrup']),
  ('Where was C developed?', 'Bell Labs', ['A web browser committee', 'A mobile app store', 'A school examination board']),
  ('Which pairing is supported by C history?', 'Dennis Ritchie — Bell Labs', ['Dennis Ritchie — Java', 'Guido van Rossum — C', 'James Gosling — B']),
  ('Which record correctly identifies the C developer?', 'Ritchie developed C at Bell Labs', ['C was developed by an app store', 'C was created for Python', 'C predates electronic computing'])],
 3: [
  ('Which language influenced C directly?', 'B', ['JavaScript', 'Swift', 'Kotlin']),
  ('Which operating system is closely associated with early C?', 'Unix', ['Android at its original release', 'A web page', 'A spreadsheet']),
  ('Which direction describes the language lineage?', 'B influenced C', ['C was derived from Java', 'Python preceded B', 'C was derived from C#']),
  ('Why does Unix appear in C history?', 'C developed in the context of Unix systems work', ['Unix is a C keyword', 'Unix is a printf format', 'Unix is a variable type'])],
 4: [
  ('What does general-purpose mean?', 'Useful across different application domains', ['Limited to one fixed task', 'No syntax is required', 'Every program runs without errors']),
  ('Which task can a general-purpose language express?', 'A calculation or a systems procedure', ['Only one predefined formula', 'Only color selection', 'Only document headings']),
  ('Which statement about C is appropriate?', 'C is general purpose', ['C is only a markup format', 'C can only draw pictures', 'C cannot express calculations']),
  ('Does general-purpose guarantee an identical program works everywhere?', 'No; portability still needs care', ['Yes, without any conditions', 'Yes, syntax never matters', 'Only if variables have short names'])],
 5: [
  ('Which classification fits C?', 'Procedural', ['Markup only', 'Spreadsheet only', 'Query only']),
  ('What organizes procedural programs?', 'Procedures and functions containing steps', ['Only page headings', 'Only cell colors', 'Only image dimensions']),
  ('Which description fits a procedural solution?', 'Arrange processing steps into functions', ['Remove all instructions', 'Replace source with a picture', 'Use no processing order']),
  ('Is procedural the same as object-oriented?', 'No; these describe different programming approaches', ['Yes, they are identical terms', 'Yes, both mean no functions', 'Yes, both mean markup'])],
 6: [
  ('What does imperative programming describe?', 'Instructions that change program state', ['Only a list of page styles', 'Only database table names', 'No execution steps']),
  ('Which action illustrates a state change?', 'Assign a new value to a variable', ['Rename the lesson title', 'Change the editor theme', 'Resize a screenshot']),
  ('Why does instruction order matter?', 'Later steps can use values changed by earlier steps', ['Only the font matters', 'Computers ignore assignments', 'All orders produce the same result']),
  ('Which classification applies to C?', 'Imperative', ['Only declarative markup', 'A sound format', 'An image format'])],
 7: [
  ('What does a compiler process?', 'Source code', ['Only the screen brightness', 'Only a mouse position', 'Only a game title']),
  ('Which order describes a normal compiled workflow?', 'Write source, compile, then run the executable', ['Run an executable before writing any source', 'Rename a picture to execute it', 'Skip translation in every environment']),
  ('How is C normally implemented?', 'As a compiled language', ['Only as HTML markup', 'Only as a spreadsheet', 'Only as an audio stream']),
  ('Does successful compilation prove a program meets its objective?', 'No; behavior and outputs must also be tested', ['Yes, every compiled program is correct', 'Yes, tests become unnecessary', 'Only the file name matters'])],
 8: [
  ('What does portability concern?', 'Moving source between environments with appropriate care', ['Moving an editor window', 'Changing a wallpaper', 'Choosing a font']),
  ('Can implementation-dependent behavior affect portability?', 'Yes', ['Never', 'Only the game title can', 'Only the background color can']),
  ('Which habit helps portable C?', 'Avoid relying on undocumented environment assumptions', ['Assume every implementation is identical', 'Skip all tests', 'Ignore compiler diagnostics']),
  ('Is every C program automatically portable unchanged?', 'No', ['Yes, without conditions', 'Only file names determine it', 'Only comments determine it'])],
 9: [
  ('Is middle-level an official ISO C language category?', 'No; it is an informal teaching description', ['Yes, it is a compiler mode', 'Yes, it is a variable type', 'Yes, it is a header']),
  ('Which precise description fits C?', 'General-purpose, procedural and imperative', ['Markup-only', 'A database file format', 'An image encoding']),
  ('Which claim overstates C capabilities?', 'Every C program is automatically correct and portable', ['C has syntax rules', 'Programs require testing', 'Implementations can differ']),
  ('Which limitation should a learner recognize?', 'Compilation alone does not establish program correctness', ['Every accepted program meets every goal', 'All syntax errors are harmless', 'Output never needs checking'])],
}

CONTEXT = {
 1: ('A museum puts C in a 1990s-only exhibit. Which correction is needed?', 'C developed in the early 1970s', ['C began in the 2010s', 'C began before electronic computers', 'C has no historical relationship to B']),
 2: ('An archive attributes C to the creator of Python. Which name should replace it?', 'Dennis Ritchie', ['James Gosling', 'Guido van Rossum', 'Bjarne Stroustrup']),
 3: ('A timeline links B, C and Unix. Which annotation is accurate?', 'B influenced C, which developed alongside Unix work', ['Unix is a C data type', 'B was derived from Java', 'C was derived from Python']),
 4: ('A tool must calculate totals and process files. Why can C be considered?', 'It is a general-purpose language', ['It supports only one fixed formula', 'It is only a page-description format', 'It does not express procedures']),
 5: ('A solution divides work into functions that perform ordered steps. What approach does this illustrate?', 'Procedural programming', ['Image encoding', 'Document markup', 'Audio compression']),
 6: ('A trace shows count changing from 2 to 3 after an assignment. What idea does this illustrate?', 'Imperative state change', ['Header inclusion', 'Font selection', 'File compression']),
 7: ('A compiled program prints the wrong total. What should the learner conclude?', 'Compilation succeeded, but the behavior still needs debugging', ['Compilation proves the total is correct', 'Tests are unnecessary', 'Changing the file name fixes the calculation']),
 8: ('A program assumes every environment has identical numeric limits. What needs review?', 'Its portability assumptions', ['Its editor background', 'Its lesson title', 'Its screenshot dimensions']),
 9: ('An archive describes middle-level as a required ISO compiler setting. What should be corrected?', 'Middle-level is an informal teaching label', ['It is a built-in C type', 'It is a required header', 'It is the name of main']),
}

EXTENSION = {
 1: ('Which origin record is consistent with the early-1970s timeline?', 'C followed B in the Unix development context', ['C was derived from JavaScript', 'C began as Python markup', 'C was invented for smartphones']),
 2: ('A plaque names Bell Labs but omits C’s developer. Which name completes it?', 'Dennis Ritchie', ['Guido van Rossum', 'James Gosling', 'Bjarne Stroustrup']),
 3: ('Which note correctly distinguishes Unix from B?', 'Unix is the operating-system context; B is a predecessor language', ['Both are C variable types', 'Unix is a printf format', 'B is a C header']),
 4: ('Would describing C as usable only for one fixed calculation be accurate?', 'No; general-purpose languages express many kinds of tasks', ['Yes; C can only add', 'Yes; C contains no procedures', 'Yes; source code is always a picture']),
 5: ('Which design groups a task into procedures?', 'Separate functions for input, processing and output', ['Only decorative file names', 'Only a color palette', 'Only image dimensions']),
 6: ('A procedure assigns a new total before printing. What determines the printed value?', 'The current state after the ordered assignments', ['Only the file title', 'Only the editor font', 'The original value regardless of assignments']),
 7: ('What remains necessary after the compiler accepts source?', 'Run tests against the intended behavior', ['Assume every result is correct', 'Remove all test inputs', 'Rename the executable to prove correctness']),
 8: ('Two implementations have different numeric limits. What should portable code do?', 'Check and avoid unsupported assumptions about those limits', ['Ignore the implementation differences', 'Change only the wallpaper', 'Assume every limit is identical']),
 9: ('Which claim should an accurate C archive reject?', 'C syntax acceptance guarantees every program meets its objective', ['C is general purpose', 'C supports procedural programming', 'Implementations can differ']),
}


def authoring_questions(level):
    topics=list(BANK) if level==10 else [level]
    return [{'id':f'c4_l{stage}_q{i+1}', 'prompt':prompt,'answer':answer,'distractors':distractors}
            for stage in topics for i,(prompt,answer,distractors) in enumerate([*BANK[stage],CONTEXT[stage],EXTENSION[stage]])]


def archive_questions(level, trial):
    rows = ([row for key,values in BANK.items() for row in [*values,CONTEXT[key]]] if level == 10 else [*BANK[level],CONTEXT[level]])
    # Five stage-specific questions yield ten distinct three-question problems.
    indices = list(combinations(range(5),3))[(trial-1)%10] if level != 10 else tuple((trial*3+i)%len(rows) for i in range(3))
    return [{'prompt': f'Archive case {trial}: {prompt}', 'answer': answer,
             'distractors': distractors, 'explanation': answer+'.', 'node_type': None}
            for prompt, answer, distractors in [rows[i] for i in indices]]
