import argparse
import sys

import numpy as np
import pandas as pd
from nltk.stem.porter import PorterStemmer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

from tmdb_build import fetch_discover_movies, search_movies, get_genre_map, tmdb_results_to_df


# -----------------------------
# Text preprocessing / model
# -----------------------------

def stem_text(text: str, stemmer: PorterStemmer) -> str:
    """Stem a space-separated text string."""
    if not isinstance(text, str):
        return ""
    return " ".join(stemmer.stem(word) for word in text.split())


def build_recommender(df: pd.DataFrame, max_features: int = 5000) -> tuple[pd.DataFrame, np.ndarray]:
    """Preprocess tags, vectorize, compute cosine similarity."""
    df = df.copy()

    if "title" not in df.columns or "tags" not in df.columns:
        raise ValueError("Data must contain columns: 'title' and 'tags'")

    df["title"] = df["title"].fillna("").astype(str)
    df["tags"] = df["tags"].fillna("").astype(str)

    ps = PorterStemmer()
    df["tags"] = df["tags"].str.lower().apply(lambda t: stem_text(t, ps))

    cv = CountVectorizer(max_features=max_features, stop_words="english")
    vectors = cv.fit_transform(df["tags"]).toarray()

    similarity = cosine_similarity(vectors)
    return df, similarity


def recommend(df: pd.DataFrame, similarity: np.ndarray, movie_query: str, k: int = 5) -> tuple[list[str], str] | None:
    """Recommend k movies based on partial title match (contains)."""
    if not movie_query or not isinstance(movie_query, str):
        return None

    matches = df[df["title"].str.contains(movie_query, case=False, na=False)]
    if matches.empty:
        return None

    movie_idx = matches.index[0]
    distances = similarity[movie_idx]

    ranked = sorted(enumerate(distances), key=lambda x: x[1], reverse=True)

    recs: list[str] = []
    for idx, _score in ranked:
        if idx == movie_idx:
            continue
        title = df.iloc[idx]["title"]
        if title and title not in recs:
            recs.append(title)
        if len(recs) >= k:
            break

    matched_title = matches.iloc[0]["title"]
    return recs, matched_title


# -----------------------------
# Data sources
# -----------------------------

def load_movies_from_csv(csv_path: str) -> pd.DataFrame:
    """Load movies from a CSV containing at least: title, tags."""
    try:
        return pd.read_csv(csv_path)
    except FileNotFoundError:
        raise FileNotFoundError(f"Could not find CSV file: {csv_path}")


def load_movies_from_tmdb(pages: int = 5, language: str = "en-US", query: str | None = None) -> pd.DataFrame:
    """Fetch movies from TMDB and convert to DataFrame with title/tags."""
    load_dotenv()  # loads TMDB_API_KEY from .env

    genre_map = get_genre_map(language=language)

    # Candidate pool (popular movies)
    results = fetch_discover_movies(pages=pages, language=language)

    # If user typed a movie, include search results too (so it exists in the dataset)
    if query:
        results = search_movies(query=query, page=1, language=language) + results

    return tmdb_results_to_df(results, genre_map)



# -----------------------------
# CLI / main
# -----------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Content-based Movie Recommender (CountVectorizer + Cosine Similarity)"
    )
    parser.add_argument(
        "--source",
        choices=["tmdb", "csv"],
        default="tmdb",
        help="Data source to use (default: tmdb)"
    )
    parser.add_argument(
        "--csv",
        default="movies_dataset.csv",
        help="CSV path (used when --source csv)"
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=5,
        help="TMDB pages to fetch (used when --source tmdb)"
    )
    parser.add_argument(
        "--language",
        default="en-US",
        help="TMDB language (default: en-US)"
    )
    parser.add_argument(
        "--movie",
        default=None,
        help="Movie title query (partial match allowed)"
    )
    parser.add_argument(
        "--k",
        type=int,
        default=5,
        help="Number of recommendations (default: 5)"
    )
    parser.add_argument(
        "--max_features",
        type=int,
        default=5000,
        help="Max features for CountVectorizer (default: 5000)"
    )

    args = parser.parse_args()

    # Load data
    try:
        if args.source == "csv":
            df = load_movies_from_csv(args.csv)
        else:
            df = load_movies_from_tmdb(pages=args.pages, language=args.language, query=args.movie)
    except Exception as e:
        print(f"ERROR loading data: {e}")
        sys.exit(1)

    # Build recommender
    try:
        df_clean, similarity = build_recommender(df, max_features=args.max_features)
    except Exception as e:
        print(f"ERROR building recommender: {e}")
        sys.exit(1)

    # One-off mode
    if args.movie:
        out = recommend(df_clean, similarity, args.movie, k=args.k)
        if not out:
            print("No movies found. Please check your input.")
            sys.exit(0)

        recs, matched_title = out
        print(f"\nRecommendations for: {matched_title}\n")
        for r in recs:
            print(f"- {r}")
        print()
        sys.exit(0)

    # Interactive mode
    print("\nInteractive mode. Type a movie title (or 'q' to quit).\n")
    while True:
        query = input("Movie: ").strip()
        if query.lower() in {"q", "quit", "exit"}:
            break

        out = recommend(df_clean, similarity, query, k=args.k)
        if not out:
            print("No movies found. Try a different title.\n")
            continue

        recs, matched_title = out
        print(f"\nRecommendations for: {matched_title}\n")
        for r in recs:
            print(f"- {r}")
        print()


if __name__ == "__main__":
    main()