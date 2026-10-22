const QUESTION_BANK = {
  'Variables & Assignment': [
    { prompt: 'If score starts at 4, what is score after score = score + 3?', answer: '7', options: ['7', '3', '4', '12'] },
    { prompt: 'Which statement stores 8 in lives?', answer: 'lives = 8;', options: ['lives == 8;', 'lives = 8;', '8 = lives;', 'lives + 8;'] },
  ],
  'Data Types & Operators': [
    { prompt: 'In C integer arithmetic, what is 7 / 2?', answer: '3', options: ['3', '3.5', '4', '2'] },
    { prompt: 'Which operator gives the remainder after integer division?', answer: '%', options: ['/', '%', '*', '&'] },
  ],
  'Conditionals (if / elif / else)': [
    { prompt: 'If score is 5, which test is true?', answer: 'score == 5', options: ['score > 5', 'score < 5', 'score == 5', 'score != 5'] },
    { prompt: 'Which branch runs when the if condition is false and no earlier branch matched?', answer: 'else', options: ['while', 'else', 'return', 'break'] },
  ],
  'Control Flow: While Loops': [
    { prompt: 'Starting at i = 0, how many times does while (i < 3) run if i increases by 1 each time?', answer: '3', options: ['2', '3', '4', 'It never ends'] },
    { prompt: 'What must change inside a counting while loop to avoid an infinite loop?', answer: 'The loop condition must eventually become false', options: ['The loop condition must eventually become false', 'The variable type must change', 'A function must be declared', 'The loop must contain an array'] },
  ],
  'Control Flow: For Loops': [
    { prompt: 'How many times does for (i = 0; i < 4; i++) run?', answer: '4', options: ['3', '4', '5', 'It never ends'] },
    { prompt: 'Which part of a for loop runs after each iteration?', answer: 'The update expression', options: ['The initialization', 'The update expression', 'The condition only', 'The function return'] },
  ],
  Functions: [
    { prompt: 'What does a return statement do in a value-returning function?', answer: 'Sends a value back to the caller', options: ['Repeats the function forever', 'Sends a value back to the caller', 'Declares a new variable', 'Skips every later function call'] },
    { prompt: 'A function add(a, b) returns a + b. What does add(2, 5) return?', answer: '7', options: ['2', '5', '7', '25'] },
  ],
  Lists: [
    { prompt: 'In a zero-based array of 5 items, what is the index of the last item?', answer: '4', options: ['4', '5', '1', '0'] },
    { prompt: 'If values[0] is the first array item, which expression reads the third item?', answer: 'values[2]', options: ['values[1]', 'values[2]', 'values[3]', 'values[0]'] },
  ],
  'Strings & Dictionaries': [
    { prompt: 'For char word[] = "cat", what character is word[0]?', answer: 'c', options: ['c', 'a', 't', 'The null terminator'] },
    { prompt: 'What does a dictionary use to look up a stored value?', answer: 'A key', options: ['A key', 'A loop counter', 'A return type', 'An array length'] },
  ],
  'Debugging & Combined Skills': [
    { prompt: 'In C, which operator tests whether score is equal to 5?', answer: '==', options: ['=', '==', '=>', '!='] },
    { prompt: 'A loop never stops because its counter never changes. What should you inspect first?', answer: 'The loop update', options: ['The loop update', 'The program title', 'The file extension', 'The screen size'] },
  ],
};

function shuffle(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createMissionQuestion(spec = {}, random = Math.random) {
  const topic = spec.topic || spec.metadata?.topic || 'Variables & Assignment';
  const questions = QUESTION_BANK[topic] || QUESTION_BANK['Variables & Assignment'];
  const source = questions[Math.floor(random() * questions.length)];
  const options = shuffle(source.options, random);
  return { topic, prompt: source.prompt, options, correctIndex: options.indexOf(source.answer) };
}

export { QUESTION_BANK };
