// Offline fallback. The authoritative copy is /data/description.json, which is
// fetched at boot and may be replaced by the host's initialize message.
export const fallbackDescription = {
  game_id: '01_platformer_quest',
  variation_id: '01_platformer_quest_v01',
  variation_title: 'Forked Routes',
  week: 1,
  level: 1,
  difficulty: 'standard',
  topic: 'valid variable names',
  title: 'Platformer Quest',
  subtitle: 'Forked Routes',
  objective:
    'Reach the flag beyond the castle gates. At the fork, choose the upper or lower gate and answer its variable-name question to open the way. Both routes rejoin before the final check.',
  win_condition:
    'Open a branch gate, cross the chasm, open the final gate, and touch the goal flag.',
  hint: 'A variable name may start with a letter, _ or $ and may contain letters, digits, _ or $. It cannot start with a digit or contain spaces, hyphens, or dots.',
  gates: {
    lower: ['q_lower_1', 'q_lower_2', 'q_lower_3'],
    upper: ['q_upper_1', 'q_upper_2'],
    final: ['q_final_1', 'q_final_2', 'q_final_3'],
  },
  questions: [
    {
      id: 'q_lower_1',
      prompt: 'Which of these is a valid variable name?',
      options: ['playerScore', '2ndPlayer', 'player-score', 'player score'],
      correctIndex: 0,
      explanation:
        'playerScore is valid: it starts with a letter and contains only letters. Names cannot start with a digit or contain spaces or hyphens.',
    },
    {
      id: 'q_lower_2',
      prompt: 'Which of these is a valid variable name?',
      options: ['price-1', '1price', '$price', 'price value'],
      correctIndex: 2,
      explanation:
        '$price is valid because $ is allowed at the start. Hyphens, leading digits, and spaces are not allowed.',
    },
    {
      id: 'q_lower_3',
      prompt: 'Which of these can be used as a variable name?',
      options: ['count-2', '2count', '_count', 'count 2'],
      correctIndex: 2,
      explanation:
        '_count is valid because an underscore may start a name. Hyphens, digits at the start, and spaces are invalid.',
    },
    {
      id: 'q_upper_1',
      prompt: 'Which of these is NOT a valid variable name?',
      options: ['_lives', '$bonus', 'total-score', 'totalScore'],
      correctIndex: 2,
      explanation:
        'total-score contains a hyphen, which is read as subtraction. _lives, $bonus, and totalScore are all valid.',
    },
    {
      id: 'q_upper_2',
      prompt: 'Which of these is a valid variable name?',
      options: ['green flag', 'green-flag', 'green.flag', 'greenFlag'],
      correctIndex: 3,
      explanation:
        'greenFlag is valid. Spaces, hyphens, and dots are not allowed inside a variable name.',
    },
    {
      id: 'q_final_1',
      prompt:
        'You need a variable for the number of lives left. Which name is valid?',
      options: ['lives-left', '3lives', 'lives left', 'livesLeft'],
      correctIndex: 3,
      explanation:
        'livesLeft is valid. It uses only letters and starts with a letter. The other options use a hyphen, a leading digit, or a space.',
    },
    {
      id: 'q_final_2',
      prompt: 'Which of these can be used as a variable name?',
      options: ['9temp', 'temp!', 'temp value', '_temp'],
      correctIndex: 3,
      explanation:
        '_temp is valid because an underscore may start a name. A name cannot start with a digit or contain ! or spaces.',
    },
    {
      id: 'q_final_3',
      prompt: 'Which of these is a valid variable name?',
      options: ['total score', 'total-score', 'total.score', 'totalScore'],
      correctIndex: 3,
      explanation:
        'totalScore is valid. Spaces, hyphens, and dots all break a variable name.',
    },
  ],
};
