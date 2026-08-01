import { mockMovies } from '../data/mockMovies.js';

const TMDB_KEY = import.meta.env.VITE_TMDB_KEY;
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const BASE = 'https://api.themoviedb.org/3';

/** Fallback when TMDB key is missing */
export const FALLBACK_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music',
  'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western',
];

export function isTmdbConfigured() {
  return Boolean(TMDB_KEY);
}

async function tmdbFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}api_key=${TMDB_KEY}&language=en-US`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

/** Build id → genre name map */
async function fetchGenreMap() {
  const data = await tmdbFetch('/genre/movie/list');
  return Object.fromEntries(data.genres.map((g) => [g.id, g.name]));
}

function mapTmdbResults(results, genreMap) {
  return results.map((m) => ({
    id: String(m.id),
    tmdbId: m.id,
    title: m.title,
    posterUrl: m.poster_path ? `${IMAGE_BASE}${m.poster_path}` : null,
    overview: m.overview,
    releaseDate: m.release_date,
    genres: (m.genre_ids || []).map((id) => genreMap[id]).filter(Boolean),
    raw: m,
  }));
}

/** Genre list for the picker — from TMDB or fallback */
export async function fetchGenres() {
  if (!isTmdbConfigured()) return [...FALLBACK_GENRES].sort();

  try {
    const data = await tmdbFetch('/genre/movie/list');
    return data.genres.map((g) => g.name).sort();
  } catch (err) {
    console.warn('TMDB genre fetch failed:', err);
    return [...FALLBACK_GENRES].sort();
  }
}

/** Fetch movies matching any of the group's genres (OR) */
export async function fetchMoviesByGenres(genreNames, limit = 5) {
  const unique = [...new Set(genreNames)].filter(Boolean);
  if (unique.length === 0) return [];

  if (!isTmdbConfigured()) {
    const matched = mockMovies.filter((m) =>
      m.genres.some((g) => unique.includes(g))
    );
    return (matched.length >= 3 ? matched : mockMovies).slice(0, limit);
  }

  try {
    const genreMap = await fetchGenreMap();
    const nameToId = Object.fromEntries(
      Object.entries(genreMap).map(([id, name]) => [name, id])
    );
    const ids = unique.map((name) => nameToId[name]).filter(Boolean);

    if (ids.length === 0) {
      console.warn('No TMDB ids for genres:', unique);
      return filterMockByGenres(unique);
    }

    // Pipe = OR — match any group genre
    const data = await tmdbFetch(
      `/discover/movie?sort_by=popularity.desc&with_genres=${ids.join('|')}&page=1`
    );

    const movies = mapTmdbResults(data.results.slice(0, limit), genreMap);
    if (movies.length >= Math.min(limit, 3)) return movies;

    if (limit <= 5) return movies;

    // Top up from page 2 if thin results (large decks only)
    const page2 = await tmdbFetch(
      `/discover/movie?sort_by=popularity.desc&with_genres=${ids.join('|')}&page=2`
    );
    const combined = [...movies, ...mapTmdbResults(page2.results, genreMap)];
    const seen = new Set();
    return combined.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    }).slice(0, limit);
  } catch (err) {
    console.warn('TMDB discover failed:', err);
    return filterMockByGenres(unique).slice(0, limit);
  }
}

/** Look up a movie by title (and optional year) for AI recommendations */
export async function lookupMovieByTitle(title, year = null) {
  if (!isTmdbConfigured()) {
    const found = mockMovies.find(
      (m) => m.title.toLowerCase() === title.toLowerCase()
    );
    return found || null;
  }

  try {
    const yearParam = year ? `&year=${year}` : '';
    const data = await tmdbFetch(
      `/search/movie?query=${encodeURIComponent(title)}${yearParam}`
    );
    if (!data.results?.length) return null;

    const hit = data.results[0];
    const genreMap = await fetchGenreMap();
    const details = await tmdbFetch(`/movie/${hit.id}`);

    return {
      id: String(hit.id),
      tmdbId: hit.id,
      title: hit.title,
      posterUrl: hit.poster_path ? `${IMAGE_BASE}${hit.poster_path}` : null,
      overview: hit.overview || details.overview,
      releaseDate: hit.release_date,
      genres: (details.genres || []).map((g) => g.name),
      raw: hit,
    };
  } catch (err) {
    console.warn('TMDB search failed:', err);
    return null;
  }
}

/** Fallback: discover one movie excluding ids already in the room */
export async function discoverOneMovie(genreNames, excludeIds = []) {
  const unique = [...new Set(genreNames)].filter(Boolean);
  if (!isTmdbConfigured()) {
    const pool = mockMovies.filter((m) => !excludeIds.includes(m.id));
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }

  try {
    const genreMap = await fetchGenreMap();
    const nameToId = Object.fromEntries(
      Object.entries(genreMap).map(([id, name]) => [name, id])
    );
    const ids = unique.map((name) => nameToId[name]).filter(Boolean);
    const genreFilter = ids.length ? `&with_genres=${ids.join('|')}` : '';
    const page = Math.floor(Math.random() * 5) + 1;

    const data = await tmdbFetch(
      `/discover/movie?sort_by=popularity.desc${genreFilter}&page=${page}`
    );
    const candidates = mapTmdbResults(data.results, genreMap);
    return candidates.find((m) => !excludeIds.includes(m.id)) || candidates[0] || null;
  } catch (err) {
    console.warn('TMDB discover one failed:', err);
    return null;
  }
}

function filterMockByGenres(genreNames) {
  const matched = mockMovies.filter((m) =>
    m.genres.some((g) => genreNames.includes(g))
  );
  return matched.length >= 5 ? matched : mockMovies;
}

function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Rich details for swipe card: reviews, streaming, similar */
export async function fetchMovieDetails(tmdbId) {
  if (!tmdbId) return null;

  if (!isTmdbConfigured()) {
    return {
      runtime: null,
      voteAverage: null,
      reviews: [],
      streaming: [],
      similar: [],
    };
  }

  try {
    const [details, reviewsRes, providersRes, similarRes] = await Promise.all([
      tmdbFetch(`/movie/${tmdbId}`),
      tmdbFetch(`/movie/${tmdbId}/reviews`).catch(() => ({ results: [] })),
      tmdbFetch(`/movie/${tmdbId}/watch/providers`).catch(() => ({ results: {} })),
      tmdbFetch(`/movie/${tmdbId}/similar`).catch(() => ({ results: [] })),
    ]);

    const us = providersRes.results?.US;
    const streaming = [
      ...(us?.flatrate || []),
      ...(us?.rent || []),
      ...(us?.buy || []),
    ]
      .map((p) => p.provider_name)
      .filter((name, i, arr) => arr.indexOf(name) === i)
      .slice(0, 6);

    return {
      runtime: formatRuntime(details.runtime),
      voteAverage: details.vote_average ? details.vote_average.toFixed(1) : null,
      voteCount: details.vote_count || 0,
      popularity: details.popularity || 0,
      overview: details.overview,
      genres: (details.genres || []).map((g) => g.name),
      reviews: (reviewsRes.results || []).slice(0, 2).map((r) => ({
        author: r.author,
        text: r.content.length > 280 ? `${r.content.slice(0, 280)}…` : r.content,
      })),
      streaming,
      similar: (similarRes.results || []).slice(0, 4).map((m) => m.title),
    };
  } catch (err) {
    console.warn('TMDB details failed:', err);
    return null;
  }
}
