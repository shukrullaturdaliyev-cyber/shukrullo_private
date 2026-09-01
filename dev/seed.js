/* Development seed — not part of the app. Run once from the console:
   fetch('/_seed.js').then(r=>r.text()).then(eval)  */
(function () {
  DB.settings = Object.assign(DB.settings, {
    name: 'Shukrullo', currency: 'UZS', semStart: '2026-09-01', semEnd: '2026-12-20',
    konspektyRoot: 'CAU', calcom: 'shukrullo', hiddenSources: [], collapsedFolders: [],
  });

  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return toISO(x); };

  DB.teachers = [
    { id: 't1', name: 'Dilnoza Karimova', teaches: 'SAT English', groups: ['G-12A', 'Blue 2'], joined: '2025-09-01', left: '', entries: [
      { id: 'e1', kind: 'note', text: 'Walked through the new reading pacing plan. She is trialling 9 minutes per passage.', date: d(-3), done: false },
      { id: 'e2', kind: 'task_me', text: 'Send her the 2019 October passage bank', date: d(-3), done: false },
      { id: 'e3', kind: 'task_them', text: 'Share the vocabulary quiz results by Friday', date: d(-3), done: false },
      { id: 'e4', kind: 'feedback', text: 'Strong error-log habit — worth showing the rest of the team.', date: d(-17), done: false } ] },
    { id: 't2', name: 'Javohir Tursunov', teaches: 'SAT English', groups: ['G-11B', 'evening group'], joined: '2025-02-10', left: '', entries: [
      { id: 'e5', kind: 'note', text: 'Discussed low attendance in the evening group.', date: d(-26), done: false },
      { id: 'e6', kind: 'task_me', text: 'Check whether the evening slot can move 30 minutes later', date: d(-26), done: false } ] },
    { id: 't3', name: 'Malika Rasulova', teaches: 'Writing lab', groups: ['Blue 1'], joined: '2026-01-15', left: '', entries: [
      { id: 'e7', kind: 'note', text: 'First 1-1. Wants more grammar drilling time.', date: d(-9), done: true } ] },
    { id: 't4', name: 'Sardor Yo‘ldoshev', teaches: 'SAT English', groups: ['G-10C'], joined: '2024-09-01', left: '2026-06-30', entries: [
      { id: 'e8', kind: 'note', text: 'Exit conversation — handing G-10C to Malika.', date: '2026-06-28', done: false } ] },
  ];

  DB.tasks = [
    { id: 'k1', face: 'work', title: 'September department report', due: d(4), link: '', notes: 'For the CEO deck.', course: '', status: 'doing', progress: 0,
      steps: [ { id: 's1', text: 'Pull exam medians', due: d(-1), done: true }, { id: 's2', text: 'Write the findings page', due: d(2), done: false }, { id: 's3', text: 'Review with the academic head', due: d(4), done: false } ] },
    { id: 'k2', face: 'work', title: 'Rewrite the observation rubric', due: d(12), link: 'https://example.org/rubric', notes: '', course: '', status: 'todo', progress: 20, steps: [] },
    { id: 'k3', face: 'work', title: 'Hire a second writing tutor', due: d(-2), link: '', notes: '', course: '', status: 'todo', progress: 0,
      steps: [ { id: 's4', text: 'Post the ad', due: d(-2), done: false } ] },
    { id: 'k4', face: 'work', title: 'Onboard Malika properly', due: '', link: '', notes: '', course: '', status: 'done', progress: 100, steps: [] },
    { id: 'k5', face: 'uni', title: 'Linear algebra problem set 3', due: d(3), link: '', notes: '', course: 'c1', status: 'doing', progress: 0,
      steps: [ { id: 's5', text: 'Sections 3.1–3.3', due: d(1), done: true }, { id: 's6', text: 'Proof exercises', due: d(3), done: false } ] },
    { id: 'k6', face: 'uni', title: 'Read Chapter 4 before the seminar', due: d(6), link: '', notes: '', course: 'c2', status: 'todo', progress: 0, steps: [] },
  ];

  DB.uni = {
    courses: [
      { id: 'c1', name: 'Linear Algebra', code: 'MATH-201', instructor: 'Prof. Aliyev', credits: '6', exams: [ { id: 'x1', date: d(23), time: '09:00', room: 'Main hall' } ] },
      { id: 'c2', name: 'Discrete Structures', code: 'CS-210', instructor: 'Dr. Nazarova', credits: '5', exams: [ { id: 'x2', date: d(31), time: '13:30', room: 'B-204' } ] },
      { id: 'c3', name: 'Academic Writing', code: 'HUM-105', instructor: 'M. Ismoilov', credits: '3', exams: [] },
    ],
    slots: [
      { id: 'sl1', courseId: 'c1', type: 'lecture', day: 0, start: '09:00', end: '10:30', room: 'A-101' },
      { id: 'sl2', courseId: 'c1', type: 'tutorial', day: 2, start: '11:00', end: '12:30', room: 'A-204' },
      { id: 'sl3', courseId: 'c2', type: 'lecture', day: 1, start: '09:00', end: '10:30', room: 'B-110' },
      { id: 'sl4', courseId: 'c2', type: 'lab', day: 3, start: '14:00', end: '16:00', room: 'Lab 2' },
      { id: 'sl5', courseId: 'c3', type: 'seminar', day: 4, start: '10:00', end: '11:30', room: 'C-3' },
      { id: 'sl6', courseId: 'c1', type: 'lecture', day: 5, start: '10:00', end: '11:30', room: 'A-101' },
    ],
  };

  const cats = ['Groceries', 'Transport', 'Books', 'Rent', 'Cafe'];
  const tx = [];
  for (let m = 0; m < 6; m++) {
    const base = new Date(); base.setMonth(base.getMonth() - m);
    tx.push({ id: 'i' + m, date: toISO(new Date(base.getFullYear(), base.getMonth(), 5)), amount: 9000000, category: 'Salary', account: 'Card', note: 'Monthly salary' });
    for (let i = 0; i < 9; i++) {
      const day = 2 + ((i * 3) % 26);
      tx.push({ id: 'e' + m + '_' + i, date: toISO(new Date(base.getFullYear(), base.getMonth(), day)),
        amount: -(80000 + ((i * 137 + m * 53) % 900) * 1000), category: cats[(i + m) % cats.length],
        account: i % 3 ? 'Card' : 'Cash', note: cats[(i + m) % cats.length] + ' spend' });
    }
  }
  DB.finances = { tx, budgets: { Groceries: 2500000, Cafe: 800000 } };

  DB.notes = [];
  const mk = (title, path, body, kind) => createNote({ title, path, body, kind: kind || 'md' });
  mk('Department priorities', 'Work', '# Priorities\n\n- Reading pacing across all groups\n- A real observation rubric\n\nSee [[Observation rubric draft]] and [[Weekly exam ritual]].\n\n#work #planning');
  mk('Observation rubric draft', 'Work', 'Four lines only: clarity, pacing, error handling, student talk time.\n\nLinks back to [[Department priorities]].');
  mk('Weekly exam ritual', 'Work/Rituals', 'Export Monday, upload to the desk, read the findings, book the two worst 1-1s.\n\n#ritual');
  mk('MATH-201 Lecture 1', 'CAU/MATH-201', '# Vector spaces\n\nAxioms, span, independence. The pivot argument is the whole lecture.\n\n#konspekt');
  mk('MATH-201 Lecture 2', 'CAU/MATH-201', '# Linear maps\n\nMatrix of a map depends on the basis. [[MATH-201 Lecture 1]]');
  mk('CS-210 Induction', 'CAU/CS-210', 'Strong induction template and three worked examples.\n\n#konspekt');
  mk('Inbox scratch', 'Inbox', 'Random thought: ask about the evening slot move.\n\nMissing link test: [[Not a real note]]');
  mk('Whiteboard 1', 'CAU/MATH-201', JSON.stringify({ type: 'excalidraw', version: 2, source: 'seed', elements: [], appState: {} }), 'excalidraw');

  const examCSV = (rows) => 'Student,Score,Group,Exam\n' + rows.join('\n');
  const names = ['Ali Karimov', 'Nigora Sattorova', 'Bekzod Rahimov', 'Zilola Umarova', 'Timur Ergashev', 'Madina Yusupova', 'Jasur Qodirov', 'Shahzoda Nabieva', 'Otabek Salimov', 'Kamola Tosheva'];
  const groups = ['G-12A', 'g12a', 'Blue 2', 'G-11B', 'evening group', 'G-10C'];
  const mkRows = (seed) => names.flatMap((n, i) => groups.map((g, j) => {
    const score = 45 + ((i * 17 + j * 29 + seed * 11) % 52);
    return `${n},${score},${g},Mock ${seed}`;
  }));
  addDataset({ name: 'exam-results-2026-W34', text: examCSV(mkRows(1)) });
  addDataset({ name: 'exam-results-2026-W35', text: examCSV(mkRows(2)) });

  const Q = 'How would you rate the quality of the class (English)?';
  const surveyHeaders = ['Timestamp', 'Full name', 'Choose your English teacher', 'Choose your English group', Q,
    'How would you rate the quality of the class (Math)?', 'To what extent would you recommend us to a friend?',
    'What part of the lesson needs improvement?', 'What part of the lesson needs improvement?'];
  const teachers = ['Dilnoza Karimova', 'Javohir Tursunov', 'Malika Rasulova', "I don't study English"];
  const rows = [surveyHeaders.map((h) => '"' + h + '"').join(',')];
  for (let m = 1; m >= 0; m--) {
    const date = new Date(); date.setMonth(date.getMonth() - m);
    for (let i = 0; i < 26; i++) {
      const t = teachers[i % teachers.length];
      const csat = t.startsWith('I don') ? '' : String(3 + ((i + m * 2) % 3));
      const nps = t.startsWith('I don') ? '' : String(5 + ((i * 3 + m) % 6));
      const stamp = `${date.getMonth() + 1}/${2 + (i % 25)}/${date.getFullYear()} 1${i % 9}:0${i % 6}:00`;
      const comment = i % 4 === 0 ? 'More speaking practice, less silent reading' : (i % 7 === 0 ? 'Pacing is too fast in the second half' : '');
      rows.push([stamp, 'Student ' + i, t, groups[i % groups.length], csat, String(4 + (i % 2)), nps, comment, ''].map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(','));
    }
  }
  addDataset({ name: 'english-quality-survey', text: rows.join('\n') });

  COLLECTIONS.forEach((c) => saveCollection(c, true));
  console.log('seeded');
  location.hash = '#work/overview';
  render();
})();
