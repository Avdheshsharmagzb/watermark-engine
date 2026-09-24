import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloud, X, Loader2, Stamp } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NEWS } from "@/constants/testIds/news";
import { createArticle, uploadPhotos, getCategories, getWatermarkSettings } from "@/lib/apiClient";

export default function CreateArticleDialog({ open, onOpenChange, onCreated }) {
  const [categories, setCategories] = useState(["World"]);
  const [wm, setWm] = useState(null);
  const [form, setForm] = useState({ title: "", category: "World", author: "", summary: "", body: "" });
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    getCategories().then(setCategories).catch(() => {});
    getWatermarkSettings().then(setWm).catch(() => {});
    setForm({ title: "", category: "World", author: "", summary: "", body: "" });
    setFiles([]);
  }, [open]);

  const addFiles = (list) => {
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (imgs.length !== list.length) toast.error("Only image files are supported (photos only).");
    setFiles((prev) => [...prev, ...imgs]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const submit = async () => {
    if (!form.title.trim()) return toast.error("A headline is required.");
    if (!form.author.trim()) return toast.error("An author byline is required.");
    setSubmitting(true);
    try {
      const article = await createArticle(form);
      if (files.length) {
        const res = await uploadPhotos(article.id, files);
        toast.success(`Article published — watermark applied to ${res.photos.length} photo(s) ${wm ? `(${wm.position})` : ""}.`);
      } else {
        toast.success("Article published successfully.");
      }
      onCreated?.(article);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to publish article.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-ink">Publisher Workbench</DialogTitle>
          <DialogDescription className="font-mono text-xs uppercase tracking-widest text-slate-500">
            Compose a new story · photos auto-watermarked on upload
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Headline</Label>
            <Input
              data-testid={NEWS.titleInput}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Breaking: your headline here"
              className="font-serif text-lg"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid={NEWS.categorySelect}><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Author</Label>
              <Input
                data-testid={NEWS.authorInput}
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="By line, e.g. Jane Doe"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Summary</Label>
            <Input
              data-testid={NEWS.summaryInput}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="A one-line standfirst"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Story Body</Label>
            <Textarea
              data-testid={NEWS.bodyTextarea}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Write the article…"
              rows={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <Stamp className="h-3.5 w-3.5 text-crimson" /> Photos {wm ? `· watermark "${wm.text}"` : ""}
            </Label>
            <div
              data-testid={NEWS.dropZone}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragActive ? "border-crimson bg-crimson/5" : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <UploadCloud className="mx-auto mb-2 h-7 w-7 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">
                Drag & drop photos or <span className="text-crimson">browse</span>
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                Every photo gets a semi-transparent watermark, bottom-right.
              </p>
              <input
                ref={inputRef}
                data-testid={NEWS.fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); }}
              />
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-4">
                {files.map((f, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-md border border-slate-200">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-20 w-full object-cover" />
                    <button
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            data-testid={NEWS.submitArticle}
            onClick={submit}
            disabled={submitting}
            className="rounded-full bg-crimson px-6 font-semibold text-white hover:bg-crimson-hover"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {submitting ? "Publishing…" : "Publish Article"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
