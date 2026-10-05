"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { localeOf, stripLocale, withLocale } from "@/i18n/config";
import { errorText } from "@/i18n/editor";
import { useEditorT } from "@/i18n/editor/useEditorT";
import {
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  FileCode2,
  Check,
  FolderTree,
  X,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  Home,
  Route,
  Server,
  Braces,
  FolderGit2,
} from "lucide-react";
import {
  SPECIAL_FILES,
  SPECIAL_FILE_MAP,
  EDITABLE_KINDS,
  PREVIEW_PATH,
  validateRoutePath,
  type SpecialFileId,
} from "@/lib/nextFileConventions";
import { Tooltip } from "@/components/editor/Tooltip";
import { Loading } from "@/components/editor/Loading";
import { OverlayScroll } from "@/components/editor/OverlayScroll";
import { Collapse } from "@/components/editor/Collapse";
import { useConfirm, useConfirmActive } from "@/components/editor/Confirm";
import { useNotify } from "@/components/editor/Notify";
import { useDrawerControl } from "@/components/editor/DrawerLayout";
import styles from "./RouteManager.module.css";

type MetaFields = {
  title?: string;
  description?: string;
  keywords?: string[];
};
type RouteInfo = {
  segments: string[];
  routePath: string;
  url: string;
  hasPage: boolean;
  hasRoute: boolean;
  specialFiles: SpecialFileId[];
  meta: MetaFields;
};

type CallFn = (
  fn: () => Promise<Response>,
  successMsg?: string,
  skipRefresh?: boolean
) => Promise<{ url?: string } | null>;

export function RouteManager() {
  const rawPathname = usePathname();
  const pathname = stripLocale(rawPathname);
  const locale = localeOf(rawPathname);
  const tx = useEditorT();
  const router = useRouter();
  // route URLs are locale-free; navigate within the language being viewed
  const go = (url: string) => router.push(withLocale(url, locale));
  const notify = useNotify();
  const { hideLeft, showLeft, animMs, setOverlay } = useDrawerControl();
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState<"current" | "all" | null>(null);

  useEffect(() => {
    setOverlay(scope !== null);
  }, [scope, setOverlay]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/routes");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setRoutes(data.routes);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx.routes.loadFailed);
    }
  }, [tx]);

  useEffect(() => {
    load();
  }, [load]);

  const call = useCallback<CallFn>(
    async (fn, successMsg, skipRefresh) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fn();
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        await load();
        if (!skipRefresh) router.refresh();
        if (successMsg) notify(successMsg, "success");
        return data as { ok: true; url?: string };
      } catch (e) {
        const msg = e instanceof Error ? e.message : tx.routes.actionFailed;
        setError(msg);
        notify(msg, "error");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load, router, notify, tx]
  );

  const createRoute = useCallback(
    async (path: string) => {
      setCreating(true);
      try {
        return await call(
          () =>
            fetch("/api/routes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path }),
            }),
          tx.routes.created
        );
      } finally {
        setCreating(false);
      }
    },
    [call, tx]
  );

  const openModal = useCallback(
    (s: "current" | "all") => {
      (document.activeElement as HTMLElement | null)?.blur();
      hideLeft();
      setTimeout(() => setScope(s), animMs);
    },
    [hideLeft, animMs]
  );

  useEffect(() => {
    if (scope !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);
      if (typing) return;
      // Esc in another modal (theme, html & body, confirm…) is that modal's close key;
      // the drawers are dialogs too, but <aside>, so they don't count
      if (document.querySelector('div[role="dialog"][aria-modal="true"]')) return;
      openModal("all");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scope, openModal]);

  const current = routes.find((r) => r.url === pathname) ?? null;

  return (
    <>
      <OverlayScroll viewportClassName={styles.wrap}>
        <button className={styles.treeBtn} onClick={() => openModal("all")}>
          <FolderTree size={16} /> {tx.routes.manageAll(routes.length)}
          <span className={styles.escBadge}>ESC</span>
        </button>

        <div className={styles.head}>
          <span className={styles.title}>{tx.routes.currentPage}</span>
          <button
            className={styles.iconBtn}
            onClick={load}
            disabled={busy}
            aria-label={tx.routes.reloadList}
          >
            <RefreshCw size={16} />
            <Tooltip side="bottom" label={tx.routes.reloadList} />
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {current ? (
          <>
            <button
              className={styles.currentUrl}
              onClick={() => openModal("current")}
            >
              <span className={styles.currentPath}>
                {["src", "app", "[lang]", ...current.segments].join("/")}
              </span>
              {current.hasRoute && <span className={styles.tag}>route</span>}
              <ChevronRight size={16} className={styles.currentGo} aria-hidden />
            </button>
            <SpecialFilesSection
              route={current}
              busy={busy}
              call={call}
              onNavigate={go}
            />
          </>
        ) : (
          <div className={styles.empty}>
            {tx.routes.noData}
            <br />
            {tx.routes.noDataHint}
          </div>
        )}
      </OverlayScroll>

      {scope && (
        <ManageModal
          scope={scope}
          rootPath={current?.routePath ?? ""}
          routes={routes}
          current={pathname}
          busy={busy}
          call={call}
          createRoute={createRoute}
          onRenamed={go}
          onClose={() => {
            setScope(null);
            showLeft();
          }}
          onNavigate={(url) => {
            setScope(null);
            go(url);
          }}
        />
      )}

      <Loading open={creating} label={tx.routes.creating} />
    </>
  );
}

const DYN_CHIPS = [
  { p: "[id]", tip: "id" },
  { p: "[...slug]", tip: "catchAll" },
  { p: "[[...slug]]", tip: "optionalCatchAll" },
  { p: "(group)", tip: "group" },
] as const;

function DynChips({ onInsert }: { onInsert: (p: string) => void }) {
  const tx = useEditorT();
  return (
    <div className={styles.dynChips}>
      {DYN_CHIPS.map((c) => (
        <button
          key={c.p}
          type="button"
          className={styles.dynChip}
          onClick={() => onInsert(c.p)}
        >
          {c.p}
          <Tooltip side="top" label={tx.routes.patterns[c.tip]} />
        </button>
      ))}
    </div>
  );
}

function routeIcon(r: RouteInfo) {
  if (r.routePath === "") return Home;
  const last = r.segments[r.segments.length - 1] ?? "";
  if (r.hasRoute) return Server;
  if (/^\(.*\)$/.test(last)) return FolderGit2;
  if (/^\[.*\]$/.test(last)) return Braces;
  return Route;
}

function ManageModal({
  scope,
  rootPath,
  routes,
  current,
  busy,
  call,
  createRoute,
  onRenamed,
  onClose,
  onNavigate,
}: {
  scope: "current" | "all";
  rootPath: string;
  routes: RouteInfo[];
  current: string;
  busy: boolean;
  call: CallFn;
  createRoute: (path: string) => Promise<{ url?: string } | null>;
  onRenamed: (newUrl: string) => void;
  onClose: () => void;
  onNavigate: (url: string) => void;
}) {
  const tx = useEditorT();
  const confirmActive = useConfirmActive();
  const [selected, setSelected] = useState<string | null>(
    scope === "current"
      ? routes.find((r) => r.url === current)?.routePath ?? null
      : null
  );
  const [addUnder, setAddUnder] = useState<string | null>(null);
  const [addTop, setAddTop] = useState(false);
  const [seg, setSeg] = useState("");
  const [specialOpen, setSpecialOpen] = useState(false);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  const strictPrefix = (a: string[], b: string[]) =>
    a.length < b.length && a.every((s, i) => b[i] === s);
  const rootSegs = rootPath === "" ? [] : rootPath.split("/");
  const baseDepth = scope === "current" ? rootSegs.length : 0;
  const scopeRoutes =
    scope === "current"
      ? routes.filter(
          (r) => r.routePath === rootPath || strictPrefix(rootSegs, r.segments)
        )
      : routes;
  const foldedSegs = [...folded].map((rp) => (rp === "" ? [] : rp.split("/")));
  const visibleRoutes = scopeRoutes.filter(
    (r) => !foldedSegs.some((c) => strictPrefix(c, r.segments))
  );
  const hasChildren = (r: RouteInfo) =>
    routes.some((x) => strictPrefix(r.segments, x.segments));
  const toggleFold = (rp: string) =>
    setFolded((prev) => {
      const n = new Set(prev);
      if (n.has(rp)) n.delete(rp);
      else n.add(rp);
      return n;
    });
  const foldTargets = scopeRoutes.filter(
    (r) => hasChildren(r) && r.routePath !== (scope === "all" ? "" : rootPath)
  );
  const anyParent = foldTargets.length > 0;
  const allCollapsed =
    anyParent && foldTargets.every((r) => folded.has(r.routePath));
  const collapseAll = () =>
    setFolded(new Set(foldTargets.map((r) => r.routePath)));
  const expandAll = () => setFolded(new Set());

  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollTo) return;
    const el = treeRef.current?.querySelector(
      `[data-rp="${CSS.escape(scrollTo)}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setScrollTo(null);
  }, [scrollTo, routes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const addError = (parent: string | null): string | null => {
    const s = seg.trim();
    if (!s) return null;
    const full = parent ? `${parent}/${s}` : s;
    const err = validateRoutePath(full);
    if (err) return errorText(tx, err.code, err.args);
    if (routes.some((r) => r.routePath === full)) return tx.routes.exists(full);
    return null;
  };

  const submitAdd = async (parent: string | null) => {
    const s = seg.trim();
    if (!s || addError(parent)) return;
    const full = parent ? `${parent}/${s}` : s;
    const data = await createRoute(full);
    if (data) {
      setSeg("");
      setAddUnder(null);
      setAddTop(false);
      if (data.url) window.location.assign(withLocale(data.url, localeOf(window.location.pathname)));
      else window.location.reload();
    }
  };

  const duplicate = (rp: string) =>
    call(
      () =>
        fetch("/api/routes/duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: rp }),
        }),
      tx.routes.duplicated
    );

  return createPortal(
    <div
      className={`${styles.modalOverlay} ${
        confirmActive ? styles.modalHidden : ""
      }`}
      onClick={onClose}
    >
      <div
        className={`${styles.modal} ${specialOpen ? styles.modalDim : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={
          scope === "current" ? tx.routes.manageCurrent : tx.routes.manageAllTitle
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <strong className={styles.modalTitle}>
            {scope === "current" ? <Route size={18} /> : <FolderTree size={18} />}{" "}
            {scope === "current" ? tx.routes.manageCurrent : tx.routes.manageAllTitle}
          </strong>
          <div className={styles.headBtns}>
            {scope === "all" && (
              <button
                className={styles.iconBtn}
                onClick={() => {
                  setAddTop((v) => !v);
                  setAddUnder(null);
                  setSeg("");
                }}
                aria-label={tx.routes.addPage}
              >
                <Plus size={17} />
                <Tooltip side="bottom" label={tx.routes.addPageTop} />
              </button>
            )}
            {anyParent &&
              (scope === "all" ? (
                <button
                  className={styles.iconBtn}
                  onClick={allCollapsed ? expandAll : collapseAll}
                  aria-label={allCollapsed ? tx.routes.expandAll : tx.routes.collapseAll}
                >
                  {allCollapsed ? (
                    <ChevronsUpDown size={16} />
                  ) : (
                    <ChevronsDownUp size={16} />
                  )}
                  <Tooltip
                    side="bottom"
                    label={allCollapsed ? tx.routes.expandAll : tx.routes.collapseAll}
                  />
                </button>
              ) : (
                <>
                  <button
                    className={styles.iconBtn}
                    onClick={collapseAll}
                    aria-label={tx.routes.collapseAll}
                  >
                    <ChevronsDownUp size={16} />
                    <Tooltip side="bottom" label={tx.routes.collapseAll} />
                  </button>
                  <button
                    className={styles.iconBtn}
                    onClick={expandAll}
                    aria-label={tx.routes.expandAll}
                  >
                    <ChevronsUpDown size={16} />
                    <Tooltip side="bottom" label={tx.routes.expandAll} />
                  </button>
                </>
              ))}
            {scope === "all" && <span className={styles.escBadge}>ESC</span>}
            <button className={styles.iconBtn} onClick={onClose} aria-label={tx.common.close}>
              <X size={16} />
            </button>
          </div>
        </div>

        <Collapse open={addTop}>
          <div className={styles.modalAddWrap}>
            <div className={styles.modalAdd}>
              <input
                className={styles.input}
                placeholder={tx.routes.newPathPlaceholder}
                value={seg}
                onChange={(e) => setSeg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd(null)}
                autoFocus
              />
              <button
                className={styles.primaryBtn}
                onClick={() => submitAdd(null)}
                disabled={busy || !seg.trim() || !!addError(null)}
              >
                <Plus size={14} /> {tx.common.add}
              </button>
            </div>
            {addError(null) && <div className={styles.error}>{addError(null)}</div>}
            <DynChips onInsert={(p) => setSeg(p)} />
          </div>
        </Collapse>

        <OverlayScroll
          viewportClassName={styles.tree}
          viewportRef={treeRef}
          inset={{ top: 16, right: 6, bottom: 16 }}
        >
          {visibleRoutes.map((r) => {
            const depth = r.segments.length - baseDepth;
            const label =
              r.segments.length === 0 ? "/" : r.segments[r.segments.length - 1];
            const isCurrent = r.url === current;
            const isSel = selected === r.routePath;
            const parent = hasChildren(r);
            const isFolded = folded.has(r.routePath);
            const Icon = routeIcon(r);
            return (
              <div
                key={r.routePath || "/"}
                data-rp={r.routePath}
                className={styles.treeRow}
              >
                <div
                  className={`${styles.treeItem} ${
                    depth > 0 ? styles.nested : ""
                  } ${isCurrent ? styles.treeCurrent : ""} ${
                    isSel ? styles.treeSelected : ""
                  }`}
                  style={{ marginLeft: depth * 16 }}
                >
                  {parent ? (
                    <button
                      className={styles.caret}
                      onClick={() => toggleFold(r.routePath)}
                      aria-label={isFolded ? tx.routes.expandSub : tx.routes.collapseSub}
                    >
                      {isFolded ? (
                        <ChevronRight size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                    </button>
                  ) : (
                    <span className={styles.caretSpacer} />
                  )}
                  <Icon size={15} className={styles.treeIcon} />
                  <button
                    className={styles.treeNameBtn}
                    onClick={() =>
                      scope === "all"
                        ? onNavigate(r.url)
                        : setSelected((s) =>
                            s === r.routePath ? null : r.routePath
                          )
                    }
                  >
                    <span className={styles.treeName}>{label}</span>
                    <span className={styles.treeUrl}>{r.url}</span>
                    <Tooltip
                      side="top"
                      label={scope === "all" ? tx.routes.goManage(r.url) : r.url}
                    />
                  </button>
                  {isCurrent && (
                    <span className={styles.treeYouAreHere}>{tx.routes.youAreHere}</span>
                  )}
                  <div className={styles.treeActions}>
                    <button
                      className={styles.miniBtn}
                      onClick={() => {
                        setAddUnder(addUnder === r.routePath ? null : r.routePath);
                        setAddTop(false);
                        setSeg("");
                      }}
                      aria-label={tx.routes.addSub}
                    >
                      <Plus size={14} />
                      <Tooltip side="left" label={tx.routes.addSub} />
                    </button>
                    {scope === "current" && (
                      <>
                        <button
                          className={styles.miniBtn}
                          onClick={() => duplicate(r.routePath)}
                          disabled={busy}
                          aria-label={tx.routes.duplicate}
                        >
                          <Copy size={14} />
                          <Tooltip
                            side="left"
                            label={tx.routes.duplicateTip}
                          />
                        </button>
                        <button
                          className={styles.miniBtn}
                          onClick={() => onNavigate(r.url)}
                          aria-label={tx.routes.open}
                        >
                          <ExternalLink size={14} />
                          <Tooltip side="left" label={tx.routes.open} />
                        </button>
                      </>
                    )}
                    {scope === "all" && (
                      <span className={styles.enterHint} aria-hidden>
                        <ChevronRight size={16} />
                      </span>
                    )}
                  </div>
                </div>

                <Collapse open={addUnder === r.routePath}>
                  <div
                    className={styles.modalAddWrap}
                    style={{ marginLeft: 12 + (depth + 1) * 16 }}
                  >
                    <div className={styles.modalAdd}>
                      <span className={styles.subPrefix}>{r.url}/</span>
                      <input
                        className={styles.input}
                        placeholder={tx.routes.subPlaceholder}
                        value={seg}
                        onChange={(e) => setSeg(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && submitAdd(r.routePath)
                        }
                        autoFocus
                      />
                      <button
                        className={styles.primaryBtn}
                        onClick={() => submitAdd(r.routePath)}
                        disabled={busy || !seg.trim() || !!addError(r.routePath)}
                      >
                        <Plus size={14} /> {tx.common.add}
                      </button>
                    </div>
                    {addError(r.routePath) && (
                      <div className={styles.error}>{addError(r.routePath)}</div>
                    )}
                    <DynChips onInsert={(p) => setSeg(p)} />
                  </div>
                </Collapse>

                {scope === "current" && (
                  <Collapse open={isSel}>
                    <div
                      className={styles.detailBox}
                      style={{ paddingLeft: 12 + depth * 16 }}
                    >
                      <RouteDetail
                        route={r}
                        busy={busy}
                        hasSub={parent}
                        call={call}
                        onRenamed={(u) => {
                          onRenamed(u);
                          setSelected(u.replace(/^\//, ""));
                        }}
                        onSpecialOpen={setSpecialOpen}
                        onNavigate={onNavigate}
                      />
                    </div>
                  </Collapse>
                )}
              </div>
            );
          })}
        </OverlayScroll>
      </div>
    </div>,
    document.body
  );
}

function RouteDetail({
  route,
  busy,
  hasSub,
  call,
  onRenamed,
  onSpecialOpen,
  onNavigate,
}: {
  route: RouteInfo;
  busy: boolean;
  hasSub?: boolean;
  call: CallFn;
  onRenamed: (newUrl: string) => void;
  onSpecialOpen?: (open: boolean) => void;
  onNavigate: (url: string) => void;
}) {
  const tx = useEditorT();
  const router = useRouter();
  const confirm = useConfirm();
  const notify = useNotify();
  const [rename, setRename] = useState(route.routePath);
  const [title, setTitle] = useState(route.meta.title ?? "");
  const [desc, setDesc] = useState(route.meta.description ?? "");
  const [keywords, setKeywords] = useState((route.meta.keywords ?? []).join(", "));

  const isRoot = route.routePath === "";

  const save = async () => {
    if (!isRoot && rename.trim() === "") {
      notify(tx.routes.urlEmpty, "error");
      return;
    }
    const willRename = !isRoot && rename.trim() !== route.routePath;

    const ok = await confirm({
      title: tx.routes.saveEditQ,
      message: willRename
        ? tx.routes.renameMsg(rename.trim())
        : tx.routes.saveEditMsg,
      confirmText: tx.common.save,
    });
    if (!ok) return;

    const meta: MetaFields = {
      title: title.trim() || undefined,
      description: desc.trim() || undefined,
      keywords: keywords.trim()
        ? keywords.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    };
    const data = await call(
      () =>
        fetch("/api/routes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: route.routePath,
            newPath: willRename ? rename.trim() : undefined,
            meta,
          }),
        }),
      tx.routes.saved,
      willRename
    );

    if (data?.url && willRename) onRenamed(data.url);
  };

  const del = async () => {
    const yes = await confirm({
      title: tx.routes.deleteQ,
      message: tx.routes.deleteMsg(route.url),
      confirmText: tx.common.delete,
      danger: true,
    });
    if (!yes) return;
    const ok = await call(
      () =>
        fetch(`/api/routes?path=${encodeURIComponent(route.routePath)}`, {
          method: "DELETE",
        }),
      tx.routes.deleted
    );
    const here = window.location.pathname;
    if (ok && route.url === stripLocale(here)) router.push(withLocale("/", localeOf(here)));
  };

  return (
    <div className={styles.detail}>
      {!hasSub && (
        <div className={styles.emptySub}>{tx.routes.noSub}</div>
      )}
      {!isRoot && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{tx.routes.urlLabel}</span>
          <input
            className={styles.input}
            value={rename}
            onChange={(e) => setRename(e.target.value)}
          />
          <Tooltip side="top" label={tx.routes.urlTip} />
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>{tx.routes.titleLabel}</span>
        <input
          className={styles.input}
          value={title}
          placeholder={tx.routes.defaultPlaceholder}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Tooltip
          side="top"
          label={tx.routes.titleTip}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{tx.routes.descLabel}</span>
        <input
          className={styles.input}
          value={desc}
          placeholder={tx.routes.defaultPlaceholder}
          onChange={(e) => setDesc(e.target.value)}
        />
        <Tooltip
          side="top"
          label={tx.routes.descTip}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>{tx.routes.keywordsLabel}</span>
        <input
          className={styles.input}
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        <Tooltip side="top" label={tx.routes.keywordsTip} />
      </label>

      <div className={styles.detailBtns}>
        {!isRoot && (
          <button className={styles.dangerBtn} onClick={del} disabled={busy}>
            <Trash2 size={14} /> {tx.common.delete}
          </button>
        )}
        <button
          className={styles.primaryBtn}
          onClick={save}
          disabled={busy || (!isRoot && rename.trim() === "")}
        >
          <Pencil size={14} /> {tx.common.save}
        </button>
      </div>

      <SpecialFilesSection
        route={route}
        busy={busy}
        call={call}
        onOpenChange={onSpecialOpen}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function SpecialFilesSection({
  route,
  busy,
  call,
  onOpenChange,
  onNavigate,
}: {
  route: RouteInfo;
  busy: boolean;
  call: CallFn;
  onOpenChange?: (open: boolean) => void;
  onNavigate: (url: string) => void;
}) {
  const tx = useEditorT();
  const confirm = useConfirm();
  const [openSpecial, setOpenSpecial] = useState<SpecialFileId | null>(null);

  useEffect(() => {
    onOpenChange?.(openSpecial !== null);
  }, [openSpecial, onOpenChange]);

  const toggleSpecial = async (id: SpecialFileId, exists: boolean) => {
    if (exists) {
      const yes = await confirm({
        title: tx.routes.removeSpecialQ,
        message: tx.routes.removeSpecialMsg(SPECIAL_FILE_MAP[id].filename),
        confirmText: tx.common.delete,
        danger: true,
      });
      if (!yes) return;
      await call(
        () =>
          fetch(
            `/api/routes/file?path=${encodeURIComponent(route.routePath)}&kind=${id}`,
            { method: "DELETE" }
          ),
        tx.routes.removedFile(SPECIAL_FILE_MAP[id].filename)
      );
    } else {
      await call(
        () =>
          fetch("/api/routes/file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: route.routePath, kind: id }),
          }),
        tx.routes.addedFile(SPECIAL_FILE_MAP[id].filename)
      );
    }
  };

  return (
    <>
      <div className={styles.specialHead}>{tx.routes.specialHead}</div>
      <div className={styles.specialGrid}>
        {route.hasPage && (
          <div className={`${styles.specialCard} ${styles.on}`}>
            <FileCode2 size={15} className={styles.specialCheck} />
            <span className={styles.specialName}>page.tsx</span>
            <span className={styles.specialState}>{tx.routes.mainPage}</span>
          </div>
        )}
        {SPECIAL_FILES.map((f) => {
          const exists = route.specialFiles.includes(f.id);
          return (
            <button
              key={f.id}
              className={`${styles.specialCard} ${exists ? styles.on : ""}`}
              onClick={() => setOpenSpecial(f.id)}
            >
              {exists ? (
                <Check size={15} className={styles.specialCheck} />
              ) : (
                <FileCode2 size={15} className={styles.specialIcon} />
              )}
              <span className={styles.specialName}>{f.filename}</span>
              <span className={styles.specialState}>
                {exists ? tx.routes.has : tx.routes.viewAdd}
              </span>
            </button>
          );
        })}
      </div>

      {openSpecial && (
        <SpecialFileModal
          id={openSpecial}
          exists={route.specialFiles.includes(openSpecial)}
          busy={busy}
          onToggle={() =>
            toggleSpecial(openSpecial, route.specialFiles.includes(openSpecial))
          }
          onClose={() => setOpenSpecial(null)}
          onEdit={
            route.specialFiles.includes(openSpecial) &&
            EDITABLE_KINDS.includes(openSpecial) &&
            // the root layout renders <html>, it can't be previewed inside a page
            !(openSpecial === "layout" && route.routePath === "")
              ? () => {
                  setOpenSpecial(null);
                  onNavigate(
                    `${PREVIEW_PATH}?path=${encodeURIComponent(route.routePath)}&kind=${openSpecial}`
                  );
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function SpecialFileModal({
  id,
  exists,
  busy,
  onToggle,
  onClose,
  onEdit,
}: {
  id: SpecialFileId;
  exists: boolean;
  busy: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const tx = useEditorT();
  const f = SPECIAL_FILE_MAP[id];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.sfOverlay} onClick={onClose}>
      <div
        className={styles.sfModal}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.sfHead}>
          <strong className={styles.sfTitle}>{f.title}</strong>
          <button className={styles.iconBtn} onClick={onClose} aria-label={tx.common.close}>
            <X size={16} />
          </button>
        </div>

        <OverlayScroll viewportClassName={styles.sfBody}>
          <p className={styles.docText}>{tx.specialFiles[f.id].summary}</p>
          {tx.specialFiles[f.id].scenario && (
            <p className={styles.docScenario}>
              <strong>{tx.routes.useWhen}</strong>
              {tx.specialFiles[f.id].scenario}
            </p>
          )}
          <div className={styles.docExampleLabel}>{tx.routes.exampleLabel}</div>
          <pre className={styles.code}>
            <code>{f.example}</code>
          </pre>
          <a
            className={styles.docLink}
            href={`https://nextjs.org/docs/${f.docPath}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tx.routes.openDocs}
          </a>
        </OverlayScroll>

        <div className={styles.sfActions}>
          <button className={styles.ghostBtn} onClick={onClose}>
            <X size={14} /> {tx.common.close}
          </button>
          {onEdit && (
            <button className={styles.primaryBtn} onClick={onEdit} disabled={busy}>
              <Pencil size={14} /> {tx.routes.edit}
            </button>
          )}
          {exists ? (
            <button
              className={styles.dangerBtn}
              onClick={onToggle}
              disabled={busy}
            >
              <Trash2 size={14} /> {tx.routes.deleteFile}
            </button>
          ) : (
            <button
              className={styles.primaryBtn}
              onClick={onToggle}
              disabled={busy}
            >
              <Plus size={14} /> {tx.routes.addFile}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
