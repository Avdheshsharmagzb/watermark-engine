import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Stamp, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NEWS } from "@/constants/testIds/news";
import { getWatermarkSettings, saveWatermarkSettings, watermarkPreviewUrl } from "@/lib/apiClient";

const POSITIONS = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
  { value: "center", label: "Center" },
];

export default function WatermarkSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bust, setBust] = useState(Date.now());

  useEffect(() => {
    getWatermarkSettings().then((s) => setSettings(s)).catch(() => toast.error("Could not load settings."));
  }, []);

  // Debounced preview refresh whenever a setting changes.
  useEffect(() => {
    if (!settings) return;
    const t = setTimeout(() => setBust(Date.now()), 300);
    return () => clearTimeout(t);
  }, [settings]);

  const previewSrc = useMemo(() => (settings ? watermarkPreviewUrl(settings, bust) : ""), [settings, bust]);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveWatermarkSettings(settings);
      setSettings(saved);
      toast.success("Watermark settings saved — applied to all future uploads.");
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="py-24 text-center font-mono text-sm text-slate-400">Loading settings…</p>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:px-12">
      <div className="mb-8 border-b border-slate-200 pb-6">
        <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-crimson">
          <Stamp className="h-3.5 w-3.5" /> Watermark Processing Suite
        </p>
        <h1 className="mt-1 font-serif text-4xl font-bold tracking-tight text-ink sm:text-5xl">Watermark Settings</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Configure the text watermark stamped on every uploaded photo. Changes preview instantly and apply to all new uploads.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Controls */}
        <div className="space-y-8 rounded-xl border border-slate-200 bg-white p-6">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Watermark Text</Label>
            <Input
              data-testid={NEWS.watermarkTextInput}
              value={settings.text}
              onChange={(e) => update({ text: e.target.value })}
              placeholder="© Your Newsroom"
              className="font-mono"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Opacity</Label>
              <span className="font-mono text-sm text-crimson">{settings.opacity}%</span>
            </div>
            <Slider
              data-testid={NEWS.watermarkOpacity}
              value={[settings.opacity]}
              min={5} max={100} step={5}
              onValueChange={([v]) => update({ opacity: v })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Font Size</Label>
              <span className="font-mono text-sm text-crimson">{settings.font_size}px</span>
            </div>
            <Slider
              data-testid={NEWS.watermarkFontSize}
              value={[settings.font_size]}
              min={12} max={72} step={2}
              onValueChange={([v]) => update({ font_size: v })}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Position</Label>
            <Select value={settings.position} onValueChange={(v) => update({ position: v })}>
              <SelectTrigger data-testid={NEWS.watermarkPosition}><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white">
                {POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            data-testid={NEWS.watermarkSave}
            onClick={save}
            disabled={saving}
            className="w-full rounded-full bg-crimson py-6 text-base font-semibold text-white hover:bg-crimson-hover"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            {saving ? "Saving…" : "Save Watermark Settings"}
          </Button>
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <Label className="font-mono text-xs uppercase tracking-widest text-slate-500">Live Preview</Label>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#18181B] p-3">
            <img
              data-testid={NEWS.watermarkPreview}
              src={previewSrc}
              alt="Watermark live preview"
              className="w-full rounded-lg"
            />
          </div>
          <p className="font-mono text-[11px] text-slate-400">
            This is exactly how the watermark will render on uploaded photos, rendered server-side with Pillow.
          </p>
        </div>
      </div>
    </main>
  );
}
