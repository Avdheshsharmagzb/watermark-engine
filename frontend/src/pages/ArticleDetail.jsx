import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Trash2, UploadCloud, Stamp, Loader2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NEWS } from "@/constants/testIds/news";
import { getArticle, deleteArticle, deletePhoto, uploadPhotos, mediaUrl } from "@/lib/apiClient";

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch { return ""; }
};

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const inputRef = useRef(null);

  const load = () => getArticle(id).then((d) => { setArticle(d); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, [id]);

  const handleUpload = async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return toast.error("Only image files are supported.");
    setUploading(true);
    try {
      const res = await uploadPhotos(id, files);
      toast.success(`Watermark applied to ${res.photos.length} photo(s) — stored & linked.`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async (pid) => {
    try {
      await deletePhoto(pid);
      toast.success("Photo removed.");
      await load();
    } catch { toast.error("Could not remove photo."); }
  };

  const removeArticle = async () => {
    try {
      await deleteArticle(id);
      toast.success("Article deleted.");
      navigate("/");
    } catch { toast.error("Could not delete article."); }
  };

  if (loading) return <p className="py-24 text-center font-mono text-sm text-slate-400">Loading story…</p>;
  if (!article) return (
    <div className="py-24 text-center">
      <p className="font-serif text-2xl text-ink">Story not found</p>
      <Button variant="link" className="text-crimson" onClick={() => navigate("/")}>Back to the wire</Button>
    </div>
  );

  const [hero, ...gallery] = article.photos || [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <button onClick={() => navigate("/")} className="mb-6 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-slate-500 hover:text-crimson">
        <ArrowLeft className="h-4 w-4" /> Back to Feed
      </button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="bg-crimson px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-white">{article.category}</span>
          <h1 data-testid={NEWS.detailTitle} className="mt-4 font-serif text-4xl font-bold leading-tight text-ink sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-slate-500">
            By {article.author} · {fmtDate(article.created_at)}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button data-testid={NEWS.articleDelete} variant="outline" size="icon" className="shrink-0 border-slate-300 text-crimson hover:bg-crimson/5">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this article?</AlertDialogTitle>
              <AlertDialogDescription>This removes the story and its watermarked photos from the feed.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={removeArticle} className="bg-crimson hover:bg-crimson-hover">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {article.summary && (
        <p className="mt-6 border-l-4 border-crimson pl-4 font-serif text-xl italic text-slate-700">{article.summary}</p>
      )}

      {hero && (
        <figure className="group relative mt-8 overflow-hidden rounded-xl bg-ink">
          <img
            data-testid={NEWS.detailPhoto}
            src={mediaUrl(hero.url)}
            alt={article.title}
            className="w-full cursor-zoom-in object-cover"
            onClick={() => setLightbox(hero)}
          />
          <figcaption className="flex items-center justify-between px-4 py-2 font-mono text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5"><Stamp className="h-3.5 w-3.5 text-crimson" /> Watermark: “{hero.watermark_text}” · {hero.width}×{hero.height}</span>
          </figcaption>
        </figure>
      )}

      <div className="body-content mt-8 whitespace-pre-wrap text-lg leading-relaxed text-slate-800">
        {article.body || <span className="text-slate-400">No body text.</span>}
      </div>

      <section className="mt-12 border-t border-slate-200 pt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold text-ink">Media Gallery</h2>
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-full bg-ink px-4 font-semibold text-white hover:bg-ink/90"
          >
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {uploading ? "Watermarking…" : "Add Photos"}
          </Button>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && handleUpload(e.target.files)} />
        </div>

        {(!article.photos || article.photos.length === 0) ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
            No photos yet. Uploaded photos are auto-watermarked and stored securely.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(gallery.length ? [hero, ...gallery] : [hero]).map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-ink">
                <img src={mediaUrl(p.url)} alt={p.original_filename} className="aspect-square w-full cursor-zoom-in object-cover" onClick={() => setLightbox(p)} />
                <div className="absolute inset-0 flex items-start justify-end gap-1 bg-gradient-to-b from-ink/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => setLightbox(p)} className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink"><Maximize2 className="h-3.5 w-3.5" /></button>
                  <button data-testid={`${NEWS.photoDelete}-${p.id}`} onClick={() => removePhoto(p.id)} className="grid h-7 w-7 place-items-center rounded-full bg-crimson text-white"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[9px] text-white"><Stamp className="h-2.5 w-2.5" /> WM</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none">
          {lightbox && <img src={mediaUrl(lightbox.url)} alt="" className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </main>
  );
}
