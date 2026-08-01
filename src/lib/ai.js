import { VOTE, VOTE_LABELS, isPositiveVote } from './votes.js';
import { aggregateGroupGenres } from './scoring.js';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
const MODEL = 'llama-3.3-70b-versatile';

export function isAiConfigured() {
  return Boolean(GROQ_KEY);
}

async function callAi(prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 128,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

function formatGroupGenres(groupGenres) {
  if (!groupGenres?.length) return 'not specified';
  return groupGenres.map((g) => `${g.name} (${g.count})`).join(', ');
}

function formatUserGenres(users) {
  return users
    .filter((u) => u.favoriteGenres?.length)
    .map((u) => `${u.displayName}: ${u.favoriteGenres.join(', ')}`)
    .join('; ');
}

function summarizeVotes(movies, votes) {
  return votes
    .slice(-8)
    .map((v) => {
      const m = movies.find((x) => x.id === v.movieId);
      return m ? `"${m.title}" → ${VOTE_LABELS[v.vote] || v.vote}` : null;
    })
    .filter(Boolean)
    .join('; ');
}

/** Ask Groq for the next movie title to show the group */
export async function recommendNextMovieTitle({
  users,
  movies,
  votes,
  lastMovie,
  lastVote,
}) {
  const groupGenres = aggregateGroupGenres(users);
  const exclude = movies.map((m) => m.title).join(', ');
  const liked = movies.filter((m) =>
    votes.some((v) => v.movieId === m.id && isPositiveVote(v.vote))
  );
  const likedTitles = liked.map((m) => m.title).join(', ') || 'none yet';

  const prompt = `You are a movie recommendation engine for a group swipe app.

Group favorite genres: ${formatGroupGenres(groupGenres)}
Member picks: ${formatUserGenres(users) || 'various'}
Already in the deck (DO NOT recommend these): ${exclude}
Group liked: ${likedTitles}
Recent swipes: ${summarizeVotes(movies, votes) || 'none'}
Just swiped: "${lastMovie?.title}" → ${VOTE_LABELS[lastVote] || lastVote}

Recommend ONE real, well-known movie that fits this group's taste and is NOT in the exclude list.
Prefer movies matching their genres. No obscure titles.

Respond with ONLY valid JSON, no markdown:
{"title":"Exact Movie Title","year":2010}`;

  const raw = await callAi(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI returned invalid format');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.title) throw new Error('AI missing title');
  return { title: parsed.title.trim(), year: parsed.year || null };
}

/** 2–3 sentence group taste summary */
export async function generateGroupSummary(likedMovies, users, groupGenres) {
  const titles = likedMovies.map((m) => m.title).join(', ');
  const voteGenres = [...new Set(likedMovies.flatMap((m) => m.genres || []))].join(', ');

  const prompt = `You are a movie recommendation assistant for a group picking a movie together.

Group members' favorite genres: ${formatGroupGenres(groupGenres)}
Individual preferences: ${formatUserGenres(users) || 'none yet'}
Movies the group liked or enjoyed watching: ${titles || 'none yet'}
Genres from those votes: ${voteGenres || 'various'}

Write a 2-3 sentence "Group Taste Summary" describing what this group seems to enjoy. Use their stated genre preferences AND swipe results. Be friendly and concise. No spoilers.`;

  return callAi(prompt);
}

/** One sentence reason why a movie fits the group */
export async function generateMovieReason(movie, likedMovies, users, groupGenres) {
  const likedTitles = likedMovies.slice(0, 5).map((m) => m.title).join(', ');

  const prompt = `Movie: "${movie.title}" (${(movie.genres || []).join(', ') || 'film'}).
Group favorite genres: ${formatGroupGenres(groupGenres)}
Member preferences: ${formatUserGenres(users) || 'various'}
Group liked: ${likedTitles || 'various films'}.
Write ONE sentence explaining why this movie might fit this group's taste. No spoilers. Be specific but brief.`;

  return callAi(prompt);
}

/** One movie for the whole group's daily pick */
export async function recommendDailyGroupMovie({ users, tasteByUser, groupGenres }) {
  const memberTaste = Object.entries(tasteByUser)
    .map(([, t]) => `${t.name}: liked ${t.likes.slice(0, 5).join(', ') || 'nothing yet'}; passed on ${t.dislikes.slice(0, 3).join(', ') || 'nothing'}`)
    .join('\n');

  const prompt = `You are picking ONE movie for a friend group to watch together tonight.

Group members and their recent solo swipes:
${memberTaste || 'No swipe data yet — pick something broadly appealing.'}

Group genre preferences: ${groupGenres?.length ? groupGenres.join(', ') : 'various'}

Pick ONE real, well-known movie that fits the group's combined taste. Explain briefly why.

Respond with ONLY valid JSON:
{"title":"Exact Movie Title","year":2010,"reason":"One sentence why the group would like it"}`;

  const raw = await callAi(prompt);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI returned invalid format');
  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.title) throw new Error('AI missing title');
  return {
    title: parsed.title.trim(),
    year: parsed.year || null,
    reason: parsed.reason?.trim() || 'Picked for your group\'s taste.',
  };
}
