import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Stamp, Trash2, ImageOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPhotos, deletePhoto, mediaUrl } from "@/lib/apiClient";

const kb = (b) => (b ? `${(b / 1024).toFixed(0)} KB` : "—");

export default function MediaLibrary() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => getPhotos().then((d) => { setPhotos(d); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    try {
      await deletePhoto(id);
      toast.success("Photo removed from library.");
      setPhotos((p) => p.filter((x) => x.id !== id));
    } catch { toast.error("Could not remove photo."); }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-crimson">
          <Stamp className="h-3.5 w-3.5" /> Media Library
        </p>
        <h1 className="mt-1 font-serif text-4xl font-bold tracking-tight text-ink sm:text-5xl">Watermarked Assets</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Every processed photo, securely stored and linked to its story. {photos.length} asset{photos.length === 1 ? "" : "s"}.
        </p>
      </div>

      {loading && <p className="py-20 text-center font-mono text-sm text-slate-400">Loading library…</p>}

      {!loading && photos.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-24 text-center">
          <ImageOff className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-serif text-xl text-ink">Library is empty</p>
          <p className="mt-1 text-sm text-slate-500">Upload photos to an article to see them here.</p>
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {photos.map((p, i) => (
            <div key={p.id} className="hover-lift fade-up overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="relative aspect-[4/3] bg-ink">
                <img src={mediaUrl(p.url)} alt={p.original_filename} className="h-full w-full object-cover" />
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 font-mono text-[10px] text-white">
                  <Stamp className="h-2.5 w-2.5" /> Watermarked ✓
                </span>
              </div>
              <div className="p-4">
                <p className="truncate text-sm font-semibold text-ink">{p.original_filename}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-slate-500">
                  <span>{p.width}×{p.height}</span>
                  <span>{kb(p.size)}</span>
                </div>
                {p.article_title && (
                  <p className="mt-2 truncate font-mono text-[11px] uppercase tracking-wide text-slate-400">
                    ↳ {p.article_title}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <a href={mediaUrl(p.url)} target="_blank" rel="noreferrer" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full border-slate-300 text-xs">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                    </Button>
                  </a>
                  <Button
                    data-testid={`media-delete-${p.id}`}
                    onClick={() => remove(p.id)}
                    variant="outline"
                    size="sm"
                    className="border-slate-300 text-crimson hover:bg-crimson/5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
