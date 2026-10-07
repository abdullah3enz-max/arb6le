import type { ExtractedConcept, UserMemoryProfile } from '@/lib/ai/types';

/*
 * Fixed benchmark set — the same 100 facts and the same 7 interest profiles every run, so two
 * models or two prompts can be compared on numbers instead of impressions. 20 per category.
 * These names are test DATA (inputs and student interests); none of them is ever placed in a
 * discovery prompt as an example.
 */

export type BenchmarkCategory = 'numbers' | 'english_words' | 'medical_terms' | 'concepts' | 'names';

export interface BenchmarkFact {
  category: BenchmarkCategory;
  concept: ExtractedConcept;
}

function fact(
  category: BenchmarkCategory,
  title: string,
  atomLabel: string,
  summary: string,
  conceptType: ExtractedConcept['conceptType'],
  atomEmoji: string
): BenchmarkFact {
  return { category, concept: { title, atomLabel, summary, conceptType, atomEmoji, importance: 80, sourcePageNumbers: [1] } };
}

const N = (title: string, atom: string, summary: string, emoji = '🔢') => fact('numbers', title, atom, summary, 'DEFINITION', emoji);
const W = (word: string, meaning: string) =>
  fact('english_words', word, word, `English vocabulary: "${word}" means ${meaning}.`, 'TERMINOLOGY', '🔤');
const M = (term: string, summary: string, emoji = '🩺') => fact('medical_terms', term, term, summary, 'TERMINOLOGY', emoji);
const C = (title: string, atom: string, summary: string, type: ExtractedConcept['conceptType'] = 'DEFINITION') =>
  fact('concepts', title, atom, summary, type, '🧠');
const P = (name: string, summary: string) => fact('names', name, name, summary, 'DEFINITION', '👤');

export const BENCHMARK_FACTS: BenchmarkFact[] = [
  // 20 numbers
  N('Resting heart rate', '60–100 bpm', 'A normal adult resting heart rate is 60 to 100 beats per minute.', '🫀'),
  N('Bones in the adult body', '206 bones', 'The adult human skeleton has 206 bones.', '🦴'),
  N('Normal body temperature', '37 °C', 'Normal human body temperature is about 37 °C.', '🌡️'),
  N('Human chromosomes', '23 pairs', 'Human body cells have 23 pairs of chromosomes (46 in total).', '🧬'),
  N('Heart chambers', '4 chambers', 'The human heart has four chambers: two atria and two ventricles.', '🫀'),
  N('Normal blood pH', 'pH 7.4', 'Normal arterial blood pH is about 7.4 (7.35–7.45).', '🩸'),
  N('Paracetamol daily maximum', '4 g/day', 'The usual maximum daily dose of paracetamol for adults is 4 g.', '💊'),
  N('Red blood cell lifespan', '120 days', 'Red blood cells live about 120 days.', '🩸'),
  N('Adult respiratory rate', '12–20 breaths/min', 'A normal adult respiratory rate is 12 to 20 breaths per minute.', '🫁'),
  N('Cranial nerves', '12 pairs', 'There are 12 pairs of cranial nerves.', '🧠'),
  N('Spinal nerves', '31 pairs', 'There are 31 pairs of spinal nerves.', '🦴'),
  N('Permanent teeth', '32 teeth', 'An adult has 32 permanent teeth, including wisdom teeth.', '🦷'),
  N('Fasting blood glucose', '70–100 mg/dL', 'Normal fasting blood glucose is 70 to 100 mg/dL.', '🩸'),
  N('Ribs', '12 pairs', 'Humans normally have 12 pairs of ribs.', '🦴'),
  N('Cervical vertebrae', '7 vertebrae', 'The neck (cervical spine) has 7 vertebrae.', '🦴'),
  N('Right lung lobes', '3 lobes', 'The right lung has 3 lobes; the left lung has 2.', '🫁'),
  N('Boiling point of water', '100 °C', 'Water boils at 100 °C at sea level.', '💧'),
  N('Serum potassium', '3.5–5.0 mmol/L', 'Normal serum potassium is 3.5 to 5.0 mmol/L.', '🧪'),
  N('Platelet count', '150,000–450,000/µL', 'A normal platelet count is 150,000 to 450,000 per microliter.', '🩸'),
  N('Systolic blood pressure', '120 mmHg', 'An ideal adult systolic blood pressure is below 120 mmHg.', '🩺'),

  // 20 English words
  W('Salt', 'ملح'),
  W('Vinegar', 'خل'),
  W('Preserve', 'يحفظ (الطعام من التلف)'),
  W('Ancient', 'قديم جدًا'),
  W('Harvest', 'حصاد'),
  W('Shelter', 'مأوى'),
  W('Brave', 'شجاع'),
  W('Whisper', 'يهمس'),
  W('Journey', 'رحلة'),
  W('Island', 'جزيرة'),
  W('Merchant', 'تاجر'),
  W('Thunder', 'رعد'),
  W('Bridge', 'جسر'),
  W('Mirror', 'مرآة'),
  W('Garden', 'حديقة'),
  W('Honest', 'صادق'),
  W('Danger', 'خطر'),
  W('Ladder', 'سُلّم'),
  W('Candle', 'شمعة'),
  W('Silver', 'فضة'),

  // 20 medical terms
  M('Tachycardia', 'Tachycardia is a heart rate faster than 100 beats per minute.', '🫀'),
  M('Bradycardia', 'Bradycardia is a heart rate slower than 60 beats per minute.', '🫀'),
  M('Hypertension', 'Hypertension is persistently high blood pressure.'),
  M('Myocardium', 'The myocardium is the muscular middle layer of the heart wall.', '🫀'),
  M('Nephron', 'The nephron is the functional filtering unit of the kidney.'),
  M('Alveoli', 'Alveoli are tiny air sacs in the lungs where gas exchange happens.', '🫁'),
  M('Insulin', 'Insulin is a pancreatic hormone that lowers blood glucose.', '💉'),
  M('Hemoglobin', 'Hemoglobin is the protein in red blood cells that carries oxygen.', '🩸'),
  M('Thrombocyte', 'A thrombocyte (platelet) helps blood clot.', '🩸'),
  M('Erythrocyte', 'An erythrocyte is a red blood cell.', '🩸'),
  M('Pancreas', 'The pancreas makes digestive enzymes and the hormones insulin and glucagon.'),
  M('Dyspnea', 'Dyspnea means difficulty breathing or shortness of breath.', '🫁'),
  M('Edema', 'Edema is swelling caused by fluid trapped in body tissues.'),
  M('Anemia', 'Anemia is a lack of healthy red blood cells or hemoglobin.', '🩸'),
  M('Femur', 'The femur (thigh bone) is the longest bone in the body.', '🦴'),
  M('Fibula', 'The fibula is the thin outer bone of the lower leg.', '🦴'),
  M('Cortisol', 'Cortisol is the main stress hormone, made by the adrenal glands.'),
  M('Hepatocyte', 'A hepatocyte is the main functional cell of the liver.'),
  M('Diuretic', 'A diuretic is a drug that increases urine output.', '💊'),
  M('Placebo', 'A placebo is an inactive treatment used as a control in trials.', '💊'),

  // 20 concepts
  C('Osmosis', 'Osmosis', 'Osmosis is water moving across a membrane from low to high solute concentration.', 'PROCESS'),
  C('Diffusion', 'Diffusion', 'Diffusion is particles spreading from high to low concentration.', 'PROCESS'),
  C('Homeostasis', 'Homeostasis', 'Homeostasis is the body keeping a stable internal environment.'),
  C('Negative feedback', 'Negative feedback', 'Negative feedback reverses a change to bring a system back to normal.', 'CAUSE_EFFECT'),
  C('Supply and demand', 'Supply and demand', 'When demand rises and supply stays the same, prices go up.', 'CAUSE_EFFECT'),
  C('Inertia', 'Inertia', 'Inertia: an object keeps its state of motion unless a force acts on it.'),
  C('Photosynthesis', 'Photosynthesis', 'Plants turn light, water and carbon dioxide into glucose and oxygen.', 'PROCESS'),
  C('Confirmation bias', 'Confirmation bias', 'Confirmation bias is favoring information that confirms what you already believe.'),
  C('Randomized controlled trial', 'RCT', 'An RCT randomly assigns participants to a treatment or a control group.'),
  C('Blinding', 'Blinding', 'Blinding hides who gets the real treatment so expectations do not bias results.'),
  C('Sampling bias', 'Sampling bias', 'Sampling bias happens when a sample does not represent the population.'),
  C('Opportunity cost', 'Opportunity cost', 'Opportunity cost is the value of the best option you gave up.'),
  C('Natural selection', 'Natural selection', 'Organisms better suited to their environment survive and reproduce more.', 'CAUSE_EFFECT'),
  C('Enzymes', 'Enzymes are catalysts', 'Enzymes speed up chemical reactions without being used up.'),
  C('Antibiotic resistance', 'Antibiotic resistance', 'Bacteria evolve to survive the drugs designed to kill them.', 'CAUSE_EFFECT'),
  C('Herd immunity', 'Herd immunity', 'When enough people are immune, a disease cannot spread easily.'),
  C('Immune memory', 'Memory cells', 'After infection or vaccination, memory cells let the body respond faster next time.'),
  C('Peer review', 'Peer review', 'Experts check a study before it is published.', 'PROCESS'),
  C('Correlation vs causation', 'Correlation ≠ causation', 'Two things moving together does not mean one causes the other.', 'COMPARISON'),
  C('Compound interest', 'Compound interest', 'Compound interest earns interest on previous interest too.'),

  // 20 names
  P('Hippocrates', 'Hippocrates is called the father of medicine.'),
  P('Alexander Fleming', 'Alexander Fleming discovered penicillin in 1928.'),
  P('Ibn Sina', 'Ibn Sina (Avicenna) wrote The Canon of Medicine.'),
  P('Marie Curie', 'Marie Curie pioneered research on radioactivity and won two Nobel Prizes.'),
  P('Louis Pasteur', 'Louis Pasteur developed pasteurization and early vaccines.'),
  P('Edward Jenner', 'Edward Jenner developed the first smallpox vaccine.'),
  P('William Harvey', 'William Harvey described the circulation of blood.'),
  P('Gregor Mendel', 'Gregor Mendel founded genetics through experiments on pea plants.'),
  P('Charles Darwin', 'Charles Darwin proposed evolution by natural selection.'),
  P('Isaac Newton', 'Isaac Newton formulated the laws of motion and universal gravitation.'),
  P('Albert Einstein', 'Albert Einstein developed the theory of relativity.'),
  P('Florence Nightingale', 'Florence Nightingale founded modern nursing.'),
  P('Al-Zahrawi', 'Al-Zahrawi is known as the father of modern surgery.'),
  P('Ibn al-Haytham', 'Ibn al-Haytham is a founder of modern optics.'),
  P('Watson and Crick', 'Watson and Crick described the DNA double helix in 1953.'),
  P('Robert Koch', 'Robert Koch identified the bacterium that causes tuberculosis.'),
  P('Andreas Vesalius', 'Andreas Vesalius founded modern human anatomy.'),
  P('Jonas Salk', 'Jonas Salk developed the first successful polio vaccine.'),
  P('Ivan Pavlov', 'Ivan Pavlov discovered classical conditioning.'),
  P('Galen', 'Galen was an influential ancient Greek physician and anatomist.')
];

function profile(partial: Partial<UserMemoryProfile>): UserMemoryProfile {
  return {
    preferredWorlds: [],
    favoriteTeams: [],
    favoritePlayers: [],
    favoriteShows: [],
    favoriteMovies: [],
    favoriteAnime: [],
    favoriteGames: [],
    favoriteCars: [],
    favoriteMusic: [],
    favoritePeople: [],
    connectionStyles: ['fast', 'smart', 'visual'],
    weights: {},
    ...partial
  };
}

/** One profile per interest family; fact i uses profile i % 7, so every family meets every category. */
export const BENCHMARK_PROFILES: { name: string; profile: UserMemoryProfile }[] = [
  { name: 'Football', profile: profile({ preferredWorlds: ['FOOTBALL'], favoritePlayers: ['Cristiano Ronaldo', 'Lionel Messi'], favoriteTeams: ['Al Hilal'] }) },
  { name: 'Movies', profile: profile({ preferredWorlds: ['MOVIES'], favoriteMovies: ['Spider-Man', 'The Dark Knight'] }) },
  { name: 'TV', profile: profile({ preferredWorlds: ['SERIES'], favoriteShows: ['Breaking Bad', 'Sherlock'] }) },
  { name: 'Anime', profile: profile({ preferredWorlds: ['ANIME'], favoriteAnime: ['One Piece', 'Naruto'] }) },
  { name: 'Games', profile: profile({ preferredWorlds: ['GAMES'], favoriteGames: ['Minecraft', 'FIFA'] }) },
  { name: 'Cars', profile: profile({ preferredWorlds: ['CARS'], favoriteCars: ['Toyota Land Cruiser'] }) },
  { name: 'Music', profile: profile({ preferredWorlds: ['MUSIC'], favoriteMusic: ['Mohammed Abdu'] }) }
];
