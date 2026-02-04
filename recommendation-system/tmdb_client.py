import os
from typing import Optional
import requests

TMDB_BASE_URL = "https://api.themoviedb.org/3"

def tmdb_get(path: str, params: Optional[dict] = None) -> dict:
    """GET request to TMDB using v3 api_key auth."""
    api_key = os.getenv("TMDB_API_KEY")
    if not api_key:
        raise RuntimeError("Missing TMDB_API_KEY in environment (.env).")

    if params is None:
        params = {}
    params["api_key"] = api_key

    url = f"{TMDB_BASE_URL}{path}"
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    return r.json()
