"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Plus, Save, X } from "lucide-react";
import { localeOf, withLocale } from "@/i18n/config";
import { ClassPicker, SelectedClasses } from "@/components/editor/ClassPicker";
import { useConfirm } from "@/components/editor/Confirm";
import { useNotify } from "@/components/editor/Notify";
import { useEditorT } from "@/i18n/editor/useEditorT";
import { Button } from "@/app/ui/components/base/button/Button";
import { buttonClasses } from "@/app/ui/components/base/button/button.classes";

type Classes = {
  base: string;
  size: Record<string, string>;
  styles: Record<string, Record<string, string>>;
};

const DEFAULT_VARIANTS = ["solid", "soft", "outline", "ghost", "link"];
const TONES = ["accent", "neutral", "danger"];
const SIZES = ["sm", "md", "lg", "icon"];
const SIZE_LABEL: Record<string, string> = {
  sm: "text-label-md",
  md: "text-label-lg",
  lg: "text-label-lg",
  icon: "text-label-md",
};

const rowStyle = { display: "flex", flexWrap: "wrap", gap: 8 } as const;
const inputStyle = {
  height: "var(--control-md)",
  padding: "0 16px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)",
  background: "var(--surface)",
  color: "var(--foreground)",
} as const;

export default function ButtonEditorPage() {
  const [classes, setClasses] = useState<Classes>(() =>
    JSON.parse(JSON.stringify(buttonClasses))
  );
  const [variant, setVariant] = useState("solid");
  const [tone, setTone] = useState("accent");
  const [size, setSize] = useState("md");
  const [slot, setSlot] = useState<"style" | "size" | "base">("style");
  const [saving, setSaving] = useState(false);
  const [newVariant, setNewVariant] = useState("");
  const confirm = useConfirm();
  const notify = useNotify();
  const tx = useEditorT();
  const tb = tx.buttonEditor;
  const pathname = usePathname();

  const variants = Object.keys(classes.styles);

  const compose = (v: string, t: string, s: string) =>
    [
      classes.base,
      classes.styles[v]?.[t] ?? "",
      v !== "link" ? classes.size[s] : "",
      SIZE_LABEL[s],
    ]
      .filter(Boolean)
      .join(" ");

  const slotValue =
    slot === "base"
      ? classes.base
      : slot === "size"
        ? classes.size[size]
        : (classes.styles[variant]?.[tone] ?? "");

  const addVariant = () => {
    const name = newVariant.trim();
    if (!name) return;
    if (classes.styles[name])
      return notify(tb.variantExists(name), "error");
    if (!/^[a-zA-Z][\w-]*$/.test(name))
      return notify(tb.variantRule, "error");
    setClasses((c) => ({
      ...c,
      styles: { ...c.styles, [name]: { ...c.styles.solid } },
    }));
    setNewVariant("");
    setVariant(name);
    setSlot("style");
    notify(tb.variantAdded(name), "success");
  };

  const removeVariant = (name: string) => {
    if (DEFAULT_VARIANTS.includes(name)) return;
    setClasses((c) => {
      const next = { ...c.styles };
      delete next[name];
      return { ...c, styles: next };
    });
    if (variant === name) setVariant("solid");
  };

  const setSlotValue = (next: string) =>
    setClasses((c) => {
      if (slot === "base") return { ...c, base: next };
      if (slot === "size")
        return { ...c, size: { ...c.size, [size]: next } };
      return {
        ...c,
        styles: {
          ...c.styles,
          [variant]: { ...c.styles[variant], [tone]: next },
        },
      };
    });

  const save = async () => {
    const yes = await confirm({
      title: tb.saveQ,
      message: tb.saveMsg,
      confirmText: tx.common.save,
    });
    if (!yes) return;
    setSaving(true);
    try {
      const res = await fetch("/api/component-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classes }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || tx.common.saveFailed);
      notify(tb.saved, "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : tx.errors.generic(), "error");
    } finally {
      setSaving(false);
    }
  };

  const slotName =
    slot === "base"
      ? "base"
      : slot === "size"
        ? `size · ${size}`
        : `${variant} · ${tone}`;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 960,
        margin: "0 auto",
        padding: 24,
        paddingBottom: 96,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <Button
        variant="link"
        href={withLocale("/ui/components", localeOf(pathname))}
        iconStart={<ArrowLeft size={14} />}
      >
        UI Components
      </Button>
      <h1 className="text-headline-md">{tb.title}</h1>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="text-label-sm">{tb.preview(tone, size)}</span>
        <div style={{ ...rowStyle, alignItems: "center" }}>
          {variants.map((v) => (
            <button key={v} className={compose(v, tone, size)}>
              {v}
            </button>
          ))}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="text-label-sm">variant</span>
          <div style={{ ...rowStyle, alignItems: "center" }}>
            {variants.map((v) => (
              <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                <Button
                  size="sm"
                  variant={v === variant ? "solid" : "ghost"}
                  tone={v === variant ? "accent" : "neutral"}
                  onClick={() => setVariant(v)}
                >
                  {v}
                </Button>
                {!DEFAULT_VARIANTS.includes(v) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    tone="danger"
                    aria-label={tb.removeVariant(v)}
                    onClick={() => removeVariant(v)}
                  >
                    <X size={14} />
                  </Button>
                )}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="text-label-sm">tone</span>
          <div style={rowStyle}>
            {TONES.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={t === tone ? "solid" : "ghost"}
                tone={t === tone ? "accent" : "neutral"}
                onClick={() => setTone(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="text-label-sm">size</span>
          <div style={rowStyle}>
            {SIZES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === size ? "solid" : "ghost"}
                tone={s === size ? "accent" : "neutral"}
                onClick={() => setSize(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="text-label-sm">{tb.editSlot}</span>
        <div style={rowStyle}>
          <Button
            size="sm"
            variant={slot === "style" ? "solid" : "ghost"}
            tone={slot === "style" ? "accent" : "neutral"}
            onClick={() => setSlot("style")}
          >
            variant×tone ({variant} · {tone})
          </Button>
          <Button
            size="sm"
            variant={slot === "size" ? "solid" : "ghost"}
            tone={slot === "size" ? "accent" : "neutral"}
            onClick={() => setSlot("size")}
          >
            size ({size})
          </Button>
          <Button
            size="sm"
            variant={slot === "base" ? "solid" : "ghost"}
            tone={slot === "base" ? "accent" : "neutral"}
            onClick={() => setSlot("base")}
          >
            {tb.baseAll}
          </Button>
        </div>

        <span className="text-label-sm">{tb.slotClasses(slotName)}</span>
        <SelectedClasses
          value={slotValue}
          onChange={setSlotValue}
          style={{ maxWidth: "100%", cursor: "grab" }}
        />
        <ClassPicker value={slotValue} onChange={setSlotValue} showSearch showCustom />
      </section>

      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px",
          borderRadius: 999,
          background: "var(--surface)",
          border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
          boxShadow: "0 16px 40px -12px rgba(15, 23, 42, 0.5)",
        }}
      >
        <input
          className="text-label-md"
          style={inputStyle}
          value={newVariant}
          placeholder={tb.newVariant}
          spellCheck={false}
          onChange={(e) => setNewVariant(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addVariant()}
        />
        <Button
          variant="soft"
          tone="accent"
          iconStart={<Plus size={14} />}
          onClick={addVariant}
          style={{ borderRadius: 999 }}
        >
          {tx.common.add}
        </Button>
        <Button
          onClick={save}
          disabled={saving}
          loading={saving}
          iconStart={<Save size={16} />}
          style={{ borderRadius: 999 }}
        >
          {saving ? tb.saving : tx.common.save}
        </Button>
      </div>
    </main>
  );
}
