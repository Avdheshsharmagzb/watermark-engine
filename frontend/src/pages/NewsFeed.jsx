import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ImageOff, Stamp, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NEWS } from "@/constants/testIds/news";
import { getArticles, getCategories, mediaUrl } from "@/lib/apiClient";

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

const ArticleCard = ({ article, index, featured }) => {
  const cover = article.photos?.[0];
  return (
    <Link
      to={`/article/${article.id}`}
      data-testid={`${NEWS.articleCard}-${index}`}
      className={`hover-lift fade-up group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white ${
        featured ? "md:col-span-2 md:row-span-2" : ""
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className={`relative w-full overflow-hidden bg-ink ${featured ? "aspect-[16/10]" : "aspect-[16/9]"}`}>
        {cover ? (
          <img
            src={mediaUrl(cover.url)}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-3 top-3 bg-crimson px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white">
          {article.category}
        </span>
        {cover && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-ink/70 px-2 py-1 font-mono text-[10px] text-white backdrop-blur">
            <Stamp className="h-3 w-3" /> Watermarked
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className={`font-serif font-bold leading-tight text-ink transition-colors group-hover:text-crimson ${featured ? "text-2xl lg:text-3xl" : "text-lg"}`}>
          {article.title}
        </h3>
        {article.summary && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{article.summary}</p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-4 font-mono text-[11px] uppercase tracking-wider text-slate-500">
          <span>{article.author}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(article.created_at)}</span>
          {article.photos?.length > 0 && <span>· {article.photos.length} photo{article.photos.length > 1 ? "s" : ""}</span>}
        </div>
      </div>
    </Link>
  );
};

export default function NewsFeed() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [active, setActive] = useState("All");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then((c) => setCategories(["All", ...c])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (active !== "All") params.category = active;
    if (q.trim()) params.q = q.trim();
    const t = setTimeout(() => {
      getArticles(params).then((d) => { setArticles(d); setLoading(false); }).catch(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [active, q]);

  const [featured, ...rest] = articles;
  const empty = !loading && articles.length === 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-crimson">Editorial Wire</p>
        <h1 className="mt-1 font-serif text-4xl font-bold tracking-tight text-ink sm:text-5xl">The Front Page</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Every photo attached to a story is automatically stamped with your newsroom watermark before it goes live.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" data-testid={NEWS.categoryFilter}>
          {categories.map((c) => (
            <button
              key={c}
              data-testid={`category-chip-${c}`}
              onClick={() => setActive(c)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                active === c
                  ? "border-ink bg-ink text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            data-testid={NEWS.searchInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search headlines, authors…"
            className="pl-9"
          />
        </div>
      </div>

      {loading && <p className="py-20 text-center font-mono text-sm text-slate-400">Loading the wire…</p>}

      {empty && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-24 text-center">
          <Stamp className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-serif text-xl text-ink">No stories yet</p>
          <p className="mt-1 text-sm text-slate-500">Hit “New Article” to publish your first watermarked story.</p>
        </div>
      )}

      {!loading && articles.length > 0 && (
        <div data-testid={NEWS.articleList} className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured && <ArticleCard article={featured} index={0} featured />}
          {rest.map((a, i) => (
            <ArticleCard key={a.id} article={a} index={i + 1} />
          ))}
        </div>
      )}
    </main>
  );
}
