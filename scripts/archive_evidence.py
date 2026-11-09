"""Authored evidence for the five-object Week 4 cases."""

CLUE_COUNT = 5

RITCHIE = "Dennis Ritchie, The Development of the C Language"
UNIX = "Dennis Ritchie, The Evolution of the Unix Time-sharing System"
IBM = "IBM, The IBM Punched Card"
GNU = "GNU C Language Introduction and Reference Manual"
GCC = "GNU Compiler Collection Manual, Overall Options"

# Each room gets one historical record of its own. Artwork depicts an illustrative prop.
HISTORY = {
    1: [
        ("Cards before computers", "Punched cards controlled patterns on textile machinery before they became a way to enter information into computers.", IBM),
        ("The 1890 census", "Herman Hollerith's machine-readable cards helped the United States process its census data mechanically.", IBM),
        ("The 80-column card", "IBM introduced an 80-column card in 1928. Rectangular holes let designers fit more columns into the existing form.", IBM),
        ("Program decks", "On punched-card systems, a program could occupy a deck of cards, with one card carrying a source line. The order of the cards mattered.", IBM),
        ("A machine with little memory", "The PDP-7 used for early Unix had 8K words of memory. The team chose small tools that could fit and run on it.", RITCHIE),
        ("Programs transported on paper tape", "Before the first PDP-7 Unix tools were ready, the team prepared programs on a GE computer and carried the resulting paper tapes to the PDP-7.", RITCHIE),
        ("The arrival of B", "Ken Thompson developed B around 1969–1970 using BCPL as his starting point. B became the direct predecessor of C.", RITCHIE),
        ("When C took shape", "Ritchie dates C's development to 1969–1973, with particularly rapid work during 1972.", RITCHIE),
        ("The move to a new computer", "Unix moved from the PDP-7 to the PDP-11. The new machine's handling of individual bytes made weaknesses in B's word-based model more apparent.", RITCHIE),
        ("Choosing the name C", "Ritchie used the name C after adding a type system and writing a compiler. Earlier development had used the name NB.", RITCHIE),
    ],
    2: [
        ("Leaving Multics", "Bell Labs withdrew from the Multics project. The researchers still wanted an environment where they could write and test programs interactively.", UNIX),
        ("The file-system sketch", "Ken Thompson, Rudd Canaday and Dennis Ritchie discussed the design of a file system before Unix had become a complete operating system.", UNIX),
        ("Computing as collaboration", "The researchers valued interactive access because it let colleagues share programs and ideas while working on the same system.", UNIX),
        ("The rejected computer proposals", "The researchers proposed acquiring several larger machines during 1969, but had to begin their work with equipment they could already access.", UNIX),
        ("The disk arrived late", "Ritchie recalls waiting three months for the PDP-11's disk. The team still tested software during that wait.", RITCHIE),
        ("A chessboard test", "One early PDP-11 exercise enumerated closed knight's tours, paths on chessboards that return to their starting square after visiting every square.", RITCHIE),
        ("Patent documents as a practical test", "Bell Labs' patent department tried early Unix for document preparation. The work helped the team demonstrate the system's value.", UNIX),
        ("Numbered pages", "The patent group needed line numbers on its pages. The Unix team extended the text formatter to meet that requirement.", UNIX),
        ("A contributor's compiler", "Ritchie wrote the first compiler for C while developing the language from B at Bell Labs.", RITCHIE),
        ("Two authors, different roles", "Brian Kernighan wrote most of the explanatory text of their 1978 C book. Ritchie wrote its language reference and a chapter on the Unix interface.", RITCHIE),
    ],
    3: [
        ("BCPL's single cell type", "BCPL used a machine-word-sized cell. The operations applied to a cell determined how its bit pattern was used.", RITCHIE),
        ("B's array notation", "BCPL used an exclamation mark for indexing an array. B supplied bracket notation, which readers of C will recognize.", RITCHIE),
        ("From length to terminator", "BCPL strings carried their length at the start. B used a terminating marker instead, an idea that remained important in C strings.", RITCHIE),
        ("The original Unix assembler", "The earliest Unix implementation was written in PDP-7 assembly. A higher-level implementation became practical as C developed.", RITCHIE),
        ("Unix becomes self-supporting", "Once the PDP-7 had working editing and assembly tools, the team could prepare and test programs on the same machine.", RITCHIE),
        ("A library for B", "Researchers wrote small routines for B so other programs could reuse common services. This helped make B practical despite its performance limits.", RITCHIE),
        ("A test before an operating system", "The variable-precision calculator later known as dc was an early B program tested on the PDP-11 before Unix was ready there.", RITCHIE),
        ("Small commands, bigger jobs", "Unix pipes appeared in 1972 and let separate commands hand data from one operation to the next.", UNIX),
        ("C in the Unix kernel", "The Bell Labs team rewrote the PDP-11 Unix kernel in C in the summer of 1973.", RITCHIE),
        ("B's comment notation", "B used slash-and-asterisk comments, a notation that C kept. The BCPL version that influenced B used a different form.", RITCHIE),
    ],
    4: [
        ("From kernel to utilities", "The team went on to rewrite Unix utilities after the kernel rewrite showed that C could handle systems work efficiently.", RITCHIE),
        ("Calculations and operating systems", "C's early design supplied arithmetic and ways to manipulate memory. This let it express calculations as well as the operation of a system.", RITCHIE),
        ("A language and its environment", "The team designed C to work with an operating system, so that a program could interact with files and use facilities beyond the language itself.", RITCHIE),
        ("Tools that build other tools", "C became useful for making development tools as well as applications. Johnson's portable C compiler is one example.", RITCHIE),
        ("The library's broader role", "Standard C's library gives programs a common interface for work such as text processing, input and output, and numeric routines.", GNU),
        ("Beyond the original hardware", "C eventually expressed software for machines as different as small personal computers and supercomputers.", RITCHIE),
        ("Users outside Unix", "As C compilers spread during the 1980s, developers began using C on many architectures and operating systems, including personal computers.", RITCHIE),
        ("Drawing from earlier languages", "Ritchie describes influences from several languages, including Algol 68's approach to composing types.", RITCHIE),
        ("Storage in a C program", "Automatic and static storage gave C code different lifetimes for its data. Library allocation offered another option when a program needed more control.", RITCHIE),
        ("Standard library portability", "The standards committee documented a shared library so everyday code could rely on common services across conforming environments.", RITCHIE),
    ],
    5: [
        ("Programs built from functions", "C kept the ability to name and call procedures from its predecessors. Its type system let a declaration also describe a function's result type.", RITCHIE),
        ("A type for results", "Ritchie's account illustrates a function declaration by giving the result of a sine function a floating-point type.", RITCHIE),
        ("Checking the arguments", "The original C standard adopted prototypes that describe parameter types. That information helps a compiler check how a function is called.", RITCHIE),
        ("Procedures with their own data", "C's automatic storage lets a function call use its own working values while that call is active.", GNU),
        ("Breaking up a larger program", "C developed separate compilation, so parts of a program could be translated in separate files and linked for use together.", RITCHIE),
        ("Library procedures", "The standard library made reusable procedures available for common work such as printing, so applications did not need their own implementation for every program.", RITCHIE),
        ("Headers as shared references", "C's include mechanism made it possible to reuse declarations across source files. Functions in a library can be declared in one shared header.", RITCHIE),
        ("Using a function's result", "A function that returns a value can be used as part of an expression, letting a result feed into another calculation.", GNU),
        ("A procedure that reports no value", "The earliest K&R edition did not describe the later void type. In modern C, a void function can do work without producing a result for its caller.", RITCHIE),
        ("Interfaces across files", "Stephen Johnson's lint checked suspicious constructions and helped find interface problems that ordinary separate compilation could miss.", RITCHIE),
    ],
    6: [
        ("The assignment sign", "B selected the single equals sign for assignment. C inherited that choice, alongside the separate equality operator.", RITCHIE),
        ("Compound assignment changes", "Early C wrote the add-and-assign operator as =+. The spelling was later changed to +=.", RITCHIE),
        ("Prefix and postfix", "Thompson added increment and decrement operators in B. Prefix and postfix distinguish which value an expression uses when it updates its operand.", RITCHIE),
        ("Instructions close to the machine", "Ritchie suggests that special memory cells on the PDP-7 may have inspired the increment operator. B already had that operator before the PDP-11 arrived.", RITCHIE),
        ("Two meanings for AND", "In B, the same operator could mean a bitwise operation or control how a condition was evaluated, depending on where it appeared.", RITCHIE),
        ("Short-circuit operators", "C introduced separate logical operators so code could explicitly request short-circuit evaluation. Under that rule, some operands are never evaluated.", RITCHIE),
        ("A historical precedence choice", "When C added logical operators, its designers retained B's precedence for bitwise AND relative to equality to ease some conversions from B.", RITCHIE),
        ("Breaking out of a switch", "B used break to leave a switch. C inherited that convention, which changes which statement the program executes next.", RITCHIE),
        ("One step at a time", "C's expression-statement rules allow an assignment to act as an instruction. A following statement can use the value it just stored.", GNU),
        ("Loops and stored values", "C loops can recheck a condition after statements update stored values. The update matters because the next check sees the current state.", GNU),
    ],
    7: [
        ("B and threaded code", "The PDP-7 B compiler could emit references to small code fragments. Those fragments performed the operations when the program ran.", RITCHIE),
        ("A compiler for another machine", "Ritchie built a B cross-compiler that ran on a smaller computer but emitted machine instructions for a GE-635 mainframe.", RITCHIE),
        ("A compiler written in its own language", "Once an initial implementation worked, Thompson rewrote the B compiler in B itself, an example of bootstrapping.", RITCHIE),
        ("Retargeting C", "Stephen Johnson worked on pcc, a compiler designed so that it could be adapted to a new machine more easily.", RITCHIE),
        ("Includes and macros", "The early C preprocessor supplied file inclusion and simple macro substitution. Later revisions added macros with arguments and conditional compilation.", RITCHIE),
        ("Stopping after preprocessing", "GCC can stop after preprocessing. Its output at that point is still source text with operations such as header inclusion already performed.", GCC),
        ("Inspecting assembly output", "A compiler driver can stop before assembly and leave an assembly-language file. This lets developers inspect one translation step.", GCC),
        ("An object file on disk", "Compiling without linking can leave an object file. A separate link step can combine it with other object files and libraries.", GCC),
        ("The linker joins references", "When one source file calls a function defined in another, the object files carry information the linker can use to connect the call to the function.", GCC),
        ("Warnings about suspicious code", "Johnson's lint reused compiler analysis to flag suspicious constructs across files. Code can compile and still need testing against its requirements.", RITCHIE),
    ],
    8: [
        ("Moving Unix to Interdata", "Johnson, Thompson and Ritchie moved Unix to the Interdata 8/32. The project brought portability problems in existing code into view.", RITCHIE),
        ("The VAX port", "Tom London and John Reiser carried out a port to the DEC VAX 11/780. Its wider use helped Unix and C reach more sites.", RITCHIE),
        ("Operating-system differences", "When Unix tools moved to new platforms, working with the host operating system often took more work than translating for new hardware.", RITCHIE),
        ("From words to bytes", "The PDP-11 could address individual bytes. That made the character-handling conventions inherited from word-addressed machines less useful.", RITCHIE),
        ("A type for unsigned arithmetic", "C added unsigned types to support unsigned arithmetic separately from pointer operations, an important distinction when moving software to new machines.", RITCHIE),
        ("Explicit casts", "Conversions became more explicit as C programmers encountered problems in code that freely mixed pointers with integers.", RITCHIE),
        ("Differences in data sizes", "The widths and ranges of some C types can differ between implementations. Portable code checks the limits it actually needs.", GNU),
        ("A standard for shared behavior", "The ANSI committee began its work in 1983 with portability as a goal. A documented language and library gave implementations a shared specification.", RITCHIE),
        ("From ANSI to ISO", "The ANSI C standard adopted in 1989 was followed by the international ISO standard in 1990.", RITCHIE),
        ("Compiler-specific extensions", "Ritchie cites near and far pointers as extensions introduced for particular processors. Such extensions can tie a program to one environment.", RITCHIE),
    ],
    9: [
        ("A systems language by origin", "C began as a tool for implementing Unix. Its later uses stretched well beyond the original operating-system work.", RITCHIE),
        ("An imperative program", "C can express a sequence of instructions that updates stored data. An assignment and its effect on later code illustrate that style.", GNU),
        ("A procedural program", "Functions let a C programmer give a name to a procedure and call it when needed, including from other functions.", GNU),
        ("An abstract type structure", "Ritchie drew on Algol 68 when designing ways to combine basic types into arrays, pointers and functions.", RITCHIE),
        ("Close to the machine", "C made it practical to write code for data in memory while using named variables, functions and types. Its combination of facilities explains the informal classroom label middle-level.", RITCHIE),
        ("The standard's actual remit", "The C standard describes a language and a library interface. Middle-level is a classroom description rather than a category specified by that standard.", RITCHIE),
        ("A common compiled workflow", "C is commonly translated to object code and linked. That workflow is a property of how compilers are used alongside the language's programming style.", GCC),
        ("Published descriptions change", "The first K&R book described the language as used in the late 1970s. The subsequent standard documented later language and library details more formally.", RITCHIE),
        ("Classification and capability", "General-purpose describes the variety of tasks C can express. Procedural and imperative describe ways its programs organize and perform work.", GNU),
        ("Different meanings of correct", "A compiler can accept an instruction that computes the wrong value. A developer still has to verify the program's behavior with tests.", GCC),
    ],
    10: [
        ("BCPL to B to C", "Martin Richards designed BCPL. Thompson drew on it for B, and Ritchie developed C from B while working on Unix.", RITCHIE),
        ("The hardware that changed the design", "With the PDP-11, programmers could address bytes separately. A language built around a single word-sized cell made character operations awkward.", RITCHIE),
        ("An operating system grows", "Unix began in 1969, years before its widely read 1974 description. Early development happened at Bell Labs.", UNIX),
        ("Work that proved useful", "By running the patent department's formatting work, the early Unix team showed how modest hardware could support real users.", UNIX),
        ("When a language gets a book", "The 1978 C book served as a reference for programmers for years before the first C standard was adopted.", RITCHIE),
        ("A check beyond the compiler", "The lint tool used knowledge of C to flag legal but suspicious code, particularly when programs were divided among files.", RITCHIE),
        ("A lesson from changing machines", "The effort to move Unix and its programs to the Interdata machine highlighted assumptions about integers, pointers and the surrounding system.", RITCHIE),
        ("The C library's role", "The ANSI committee documented library services in addition to syntax and behavior. That gives programmers common tools even when the underlying operating systems differ.", RITCHIE),
        ("Turning commands into a pipeline", "Unix introduced pipes after McIlroy argued that commands should be able to pass data to other commands. Each small step could then contribute to a larger task.", UNIX),
        ("Technical language versus labels", "C's designers wanted a practical tool for building systems. Terms such as general-purpose and procedural help explain what the tool can do and how programs are written.", RITCHIE),
    ],
}

# The first note for each topic is self-contained so mixed review cases can use
# one note from each assessed topic. Extra records illustrate the same concepts.
LESSON_NOTES = {
    1: [
        ("The C timeline", "C developed in the early 1970s. At Bell Labs, Ritchie built on B to create a systems language suited to the work on Unix.", RITCHIE),
        ("A family of languages", "BCPL influenced B. B in turn influenced C. Early C carried over much of B's notation while adding a richer type system.", RITCHIE),
        ("Why the context matters", "The team needed a way to express systems software at a higher level than assembly. Work on a real operating system shaped the language as it evolved.", RITCHIE),
        ("Reading the timeline", "Distinguish a language's development from the publication of its manual or its first standard. These events happened years apart for C.", RITCHIE),
    ],
    2: [
        ("The developer and laboratory", "Dennis Ritchie developed C at Bell Laboratories. He wrote its first compiler and refined the language alongside the Unix project.", RITCHIE),
        ("Roles in the project", "Ken Thompson developed B. Ritchie developed C from it. Many Bell Labs colleagues contributed tools and language ideas.", RITCHIE),
        ("A later collaboration", "Brian Kernighan and Dennis Ritchie coauthored a book that helped teach and document C. The book appeared after the language was already in use.", RITCHIE),
        ("Reading the credits", "A language developer, a book coauthor and a compiler contributor can all appear in the same archive. Look at what each record credits the person with doing.", RITCHIE),
    ],
    3: [
        ("Predecessor and operating system", "B was the immediate language predecessor of C. Unix was the operating system whose development helped shape C.", RITCHIE),
        ("Following the influence", "Read the line of influence as BCPL → B → C. Unix belongs on a different part of the timeline because it is an operating system.", RITCHIE),
        ("Why Unix used C", "Using a higher-level language helped the team express systems logic. Later ports exposed the assumptions that had to change for new machines.", RITCHIE),
        ("Tools in context", "On Unix, an editor, a compiler and a shell can each do different work. C can be used to implement those tools or the system on which they run.", UNIX),
    ],
    4: [
        ("A language for many tasks", "General-purpose means a language can express work across different domains. C can handle a calculation or a systems procedure. Running the same program on a new system still takes care.", GNU),
        ("From totals to files", "A program can calculate a total and another program can process a file. Both can use the same C statements, functions and data types.", GNU),
        ("Purpose and portability", "The variety of tasks a language can express is different from how easily one source program moves between environments.", RITCHIE),
        ("Choosing the operations", "Decide what data a problem needs, what changes or calculations to perform, and how to report a result. C supplies tools for all three.", GNU),
    ],
    5: [
        ("Procedural organization", "C supports procedural programming. Functions organize ordered steps that can be called and reused. Procedural and object-oriented describe distinct ways of organizing a program.", GNU),
        ("A division of labor", "Functions can separate input, processing and output. Give each function a clear job and call it in the order the task requires.", GNU),
        ("Follow the call", "A call runs a function's instructions. A function with a return value can pass a result back so the caller can use it.", GNU),
        ("A small function", "A function that computes a subtotal can be called from several places. Changing the calculation in that function updates every use of it.", GNU),
    ],
    6: [
        ("Instructions and state", "Imperative code gives instructions that can change program state. An assignment stores a new value. Later instructions read the state left by the earlier ones.", GNU),
        ("Trace a changing count", "If count starts at 2, count = count + 1 stores 3. A print after that assignment reads 3.", GNU),
        ("Order changes results", "Printing a value before incrementing it can show a different number from printing after the increment. Trace the steps in their execution order.", GNU),
        ("Two kinds of expression", "An assignment changes the value stored in a variable. An equality test compares two values and can guide what instruction happens next.", GNU),
    ],
    7: [
        ("Source, translation and tests", "C is normally compiled. Write the source, translate it and link it as needed, then run the resulting program. Tests check whether its behavior matches the goal after compilation succeeds.", GCC),
        ("The order of the tools", "Preprocessing, compilation, assembly and linking are stages a compiler driver can coordinate. A linked executable can then be run on its target.", GCC),
        ("When the output is wrong", "If a compiled program prints the wrong total, check its operations and test values. Accepting the source does not check that total for you.", GNU),
        ("A clean build and a test run", "Treat build diagnostics and program output as different clues. A successful build and a correct result are separate milestones.", GCC),
    ],
    8: [
        ("What moves between systems", "Portability concerns moving source between environments. Different type limits or implementation choices can affect behavior. Check documented limits and avoid undocumented assumptions.", GNU),
        ("Test on the intended target", "A program can compile on two implementations and still behave differently. Tests on both targets can expose a difference that the compiler alone cannot detect.", GNU),
        ("A standard and an extension", "Use documented standard facilities when the same code must work in several environments. Isolate platform-specific features so they can be reviewed and adapted.", GNU),
        ("An assumption to check", "When code assumes a particular numeric range, identify the required range and check what the target implementation actually provides.", GNU),
    ],
    9: [
        ("Classifying C precisely", "C is general-purpose, procedural and imperative. Middle-level is an informal teaching label. A compiler accepting a program does not prove that it works or runs unchanged everywhere.", GNU),
        ("Three different labels", "General-purpose is about the kinds of tasks a language can express. Procedural is about organizing work into functions. Imperative is about executing instructions that can change state.", GNU),
        ("What the standard covers", "The standard describes the language and library. It does not define a middle-level compiler mode or certify that a program meets its goal.", RITCHIE),
        ("Read claims with care", "Compare claims about a language's facilities with claims about a particular program. Testing the program and reviewing portability are still part of the work.", GNU),
    ],
}

RELATED_LEVEL = {1: 3, 2: 1, 3: 2, 4: 8, 5: 7, 6: 5, 7: 6, 8: 4, 9: 10, 10: 9}
# The physical prop used for each history record. The lesson notes can use any available prop.
HISTORY_ART = {
    1: ("punch", "punch", "punch", "punch", "board", "unix", "b-notes", "bell", "board", "book"),
    2: ("bell", "bell", "bell", "bell", "board", "board", "unix", "unix", "compiler", "book"),
    3: ("bcpl", "b-notes", "b-notes", "unix", "unix", "b-notes", "board", "unix", "unix", "b-notes"),
    4: ("unix", "book", "unix", "compiler", "book", "board", "board", "bcpl", "book", "standard"),
    5: ("book", "book", "standard", "book", "compiler", "standard", "compiler", "book", "book", "compiler"),
    6: ("b-notes", "compiler", "b-notes", "board", "b-notes", "book", "book", "b-notes", "book", "book"),
    7: ("compiler", "compiler", "b-notes", "compiler", "compiler", "compiler", "compiler", "compiler", "compiler", "compiler"),
    8: ("board", "board", "unix", "board", "book", "book", "standard", "standard", "standard", "board"),
    9: ("unix", "book", "book", "bcpl", "board", "standard", "compiler", "book", "book", "compiler"),
    10: ("bcpl", "board", "unix", "bell", "book", "compiler", "board", "standard", "unix", "book"),
}


def case_evidence(level: int, trial: int, tasks: list[dict]) -> list[dict]:
    try:
        from .archive_lessons import authoring_questions
    except ImportError:
        from archive_lessons import authoring_questions

    if level == 10:
        topics_by_prompt = {
            row["prompt"]: int(row["id"].split("_")[1][1:])
            for row in authoring_questions(10)
        }
        topics = list(dict.fromkeys(
            topics_by_prompt[task["prompt"].partition(": ")[2] if task["prompt"].startswith("Archive case ") else task["prompt"]]
            for task in tasks
        ))
    else:
        topics = [level]
    related = RELATED_LEVEL[level]
    related_trial = (trial + 2) % len(HISTORY[related]) + 1
    records = [
        (f"history_{level}_{trial}", HISTORY[level][trial - 1], HISTORY_ART[level][trial - 1]),
        (f"history_{related}_{related_trial}", HISTORY[related][related_trial - 1], HISTORY_ART[related][related_trial - 1]),
    ]
    examples = [1 + (trial + offset) % 3 for offset in range(3)]
    candidates = [(topic, index) for index in (0, *examples) for topic in topics]
    for topic, index in candidates[:CLUE_COUNT - len(records)]:
        records.append((f"lesson_{topic}_{index + 1}", LESSON_NOTES[topic][index], None))

    return [
        {"id": identity, "era": title, "history": body, "source": source, **({"art": art} if art else {})}
        for identity, (title, body, source), art in records
    ]
