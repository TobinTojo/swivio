from typing import Dict, List, Any

import pandas as pd

from tmdb_client import tmdb_get


# -----------------------------
# TMDB fetch helpers
# -----------------------------

def fetch_discover_movies(pages: int = 3, language: str = "en-US") -> List[Dict[str, Any]]:
    """Fetch popular movies using TMDB discover endpoint."""
    results: List[Dict[str, Any]] = []

    for page in range(1, pages + 1):
        data = tmdb_get(
            "/discover/movie",
            params={
                "sort_by": "popularity.desc",
                "page": page,
                "language": language,
                "include_adult": "false",
            },
        )
        results.extend(data.get("results", []))

    return results


def search_movies(query: str, page: int = 1, language: str = "en-US") -> List[Dict[str, Any]]:
    """Search TMDB movies by text query."""
    data = tmdb_get(
        "/search/movie",
        params={
            "query": query,
            "page": page,
            "language": language,
        },
    )
    return data.get("results", [])


def get_genre_map(language: str = "en-US") -> Dict[int, str]:
    """Return mapping of genre_id -> genre_name."""
    data = tmdb_get("/genre/movie/list", params={"language": language})
    return {g["id"]: g["name"] for g in data.get("genres", [])}


# -----------------------------
# Dataset construction
# -----------------------------

def tmdb_results_to_df(
    results: List[Dict[str, Any]],
    genre_map: Dict[int, str],
) -> pd.DataFrame:
    """
    Convert TMDB results into a DataFrame with:
    movie_id | title | tags
    """
    rows = []

    for m in results:
        movie_id = m.get("id")
        title = (m.get("title") or "").strip()
        overview = (m.get("overview") or "").strip()

        # Skip invalid entries
        if not title:
            continue

        genre_ids = m.get("genre_ids") or []
        genre_names = [genre_map.get(gid, "") for gid in genre_ids]

        # Join genres without spaces for cleaner tokens
        genres = " ".join(
            name.replace(" ", "") for name in genre_names if name
        )

        tags = f"{genres} {overview}".strip()

        rows.append(
            {
                "movie_id": movie_id,
                "title": title,
                "tags": tags,
            }
        )

    return pd.DataFrame(rows).reset_index(drop=True)
