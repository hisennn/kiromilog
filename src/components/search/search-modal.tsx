"use client";

import { useEffect, useState } from "react";

import { SearchResultCard } from "@/components/search/search-result-card";

type SearchItem = {
  malId: number;
  mediaType: "anime" | "manga";
  title: string;
  imageUrl: string | null;
  score: number | null;
  progressTotal: number | null;
  year: number | null;
  libraryEntry:
    | {
        status: string;
        score: number | null;
        progressEpisodes?: number;
        progressChapters?: number;
        progressVolumes?: number;
      }
    | null;
};

type SearchResponse = {
  anime: SearchItem[];
  manga: SearchItem[];
};

export function SearchModal() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [results, setResults] = useState<SearchResponse>({ anime: [], manga: [] });

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults({ anime: [], manga: [] });
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("search_failed");
        }

        const data = (await response.json()) as SearchResponse;
        setResults(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setResults({ anime: [], manga: [] });
        setError(true);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const trimmed = query.trim();
  const showPanel = trimmed.length > 0;
  const hasResults = results.anime.length > 0 || results.manga.length > 0;

  return (
    <div className="header-search search-block">
      <div className="search-shell header-search-shell relative">
        <input
          autoComplete="off"
          className="search-input header-search-input w-full pr-10"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search anime or manga"
          type="search"
          value={query}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
      </div>

      {showPanel ? (
        <div className="search-results-panel header-search-results panel">
          <div className="grid gap-5 xl:grid-cols-2">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Anime</p>
                <span className="text-xs text-muted">{results.anime.length}</span>
              </div>
              {results.anime.length ? (
                <div className="space-y-3">
                  {results.anime.map((item) => (
                    <SearchResultCard item={item} key={`anime-${item.malId}`} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {loading
                    ? "Searching Jikan..."
                    : trimmed.length < 2
                      ? "Type at least 2 characters."
                      : error
                        ? "Failed to search anime."
                        : "No anime yet."}
                </p>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Manga</p>
                <span className="text-xs text-muted">{results.manga.length}</span>
              </div>
              {results.manga.length ? (
                <div className="space-y-3">
                  {results.manga.map((item) => (
                    <SearchResultCard item={item} key={`manga-${item.malId}`} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {loading
                    ? "Searching Jikan..."
                    : trimmed.length < 2
                      ? "Type at least 2 characters."
                      : error
                        ? "Failed to search manga."
                        : "No manga yet."}
                </p>
              )}
            </section>
          </div>

          {!loading && !error && trimmed.length >= 2 && !hasResults ? (
            <p className="mt-4 text-sm text-muted">No results found.</p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-muted">Search failed. Try again in a few seconds.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
