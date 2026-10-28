import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BollsTranslationUnavailableError } from "../../core/api/BollsBibleClient";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { useBibleAISelection } from "../../core/hooks/useBibleAISelection";
import { useChapterNavigation, useVersesByChapter } from "../../core/hooks/useBibleQueries";
import { bookSlug } from "../../core/lib/bookSlugs";
import { parseBookNumber } from "../../core/lib/ids";
import { buildBiblePassage, formatVerseReference } from "../../core/lib/passageBuilder";
import type { BiblePassage } from "../../core/types/ai";
import type { ChapterNavigationInfo, Verse } from "../../core/types/bible";
import { TRANSLATION_NOTICES, type BibleTranslation } from "../../core/types/translation";
import { isOnline } from "../../platform/network";
import { copyText } from "../../platform/clipboard";
import { notify } from "../../platform/notify";
import { shareOrCopy } from "../../platform/share";
import { AnnotateSheet } from "../annotations/AnnotateSheet";
import { annotationKey, useAnnotations, type AnnotationTarget } from "../annotations/annotations";
import { useAuth } from "../auth/AuthProvider";
import { ConnectionsSheet } from "../connections/ConnectionsSheet";
import { useBookConnections } from "../connections/useConnections";
import { clearPendingSelection, readPendingSelection, savePendingSelection } from "../auth/pendingSelection";
import { BibleAiPanel } from "../components/BibleAiPanel";
import { ChapterArrows } from "../components/ChapterArrows";
import { ChapterNavigationFooter } from "../components/ChapterNavigationFooter";
import { Footnotes } from "../components/Footnotes";
import { SelectionActionBar } from "../components/SelectionActionBar";
import { SelectionHeader } from "../components/SelectionHeader";
import { TranslationSelector } from "../components/TranslationSelector";
import { VerseCompareSheet } from "../components/VerseCompareSheet";
import { VerseItem } from "../components/VerseItem";
import type { PanelAccess } from "../hooks/useBibleAiPanel";
import { formatVerseParam } from "../layout/bookRoute";
import { useRememberReading } from "../reading/lastReading";
import { buildVerseShare } from "../share/verseShare";
import styles from "./pages.module.css";

interface Props {
  bookName: string;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  slug: string;
  /** Verses named in the link (`?v=`): highlighted, and the first one scrolled into view. */
  focusVerses?: number[];
}

export function ChapterReaderPage({
  bookName,
  bookId,
  chapterId,
  chapterNumber,
  slug,
  focusVerses,
}: Props) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const href = useRouterState({ select: (state) => state.location.href });
  const { translation, setTranslation } = useBibleRepository();
  const auth = useAuth();
  const { data: verses = [], isPending, error } = useVersesByChapter(chapterId);
  const { data: chapterNav = { previous: null, next: null } } = useChapterNavigation(chapterId, bookId);
  const selection = useBibleAISelection(verses);
  const [panelOpen, setPanelOpen] = useState(false);
  const [passage, setPassage] = useState<BiblePassage | null>(null);
  const [footnotesOpen, setFootnotesOpen] = useState(false);
  const [compareVerses, setCompareVerses] = useState<Verse[]>([]);
  const [annotating, setAnnotating] = useState<{ verses: Verse[]; focus?: "note" } | null>(null);
  const annotations = useAnnotations();
  const { data: bookConnections } = useBookConnections(parseBookNumber(bookId));
  const [connectionsVerse, setConnectionsVerse] = useState<number | null>(null);
  const bookNumber = parseBookNumber(bookId);
  const annotationTargets = useMemo<AnnotationTarget[]>(() => (annotating?.verses ?? []).map((verse) => ({
    bookNumber,
    chapter: chapterNumber,
    verse: verse.number,
    text: verse.text.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim(),
    translation,
  })), [annotating, bookNumber, chapterNumber, translation]);
  const restored = useRef(false);
  const focused = useMemo(() => new Set(focusVerses), [focusVerses]);
  useRememberReading({ slug, chapter: chapterNumber, translation, verses, startVerse: focusVerses?.[0] });

  const footnotes = verses
    .filter((verse) => verse.footnote)
    .map((verse) => ({ verseNumber: verse.number, text: verse.footnote! }));

  const goToChapter = useCallback((info: ChapterNavigationInfo) => {
    const nextSlug = bookSlug(parseBookNumber(info.bookId));
    if (!nextSlug) return;
    void navigate({
      to: "/$book/$chapter",
      params: { book: nextSlug, chapter: String(info.chapterNumber) },
      search: { v: undefined },
    });
  }, [navigate]);

  useEffect(() => {
    selection.clearSelection();
    setPanelOpen(false);
    setPassage(null);
    setFootnotesOpen(false);
    setCompareVerses([]);
    setAnnotating(null);
    setConnectionsVerse(null);
    restored.current = false;
  }, [chapterId, translation, selection.clearSelection]);

  useEffect(() => {
    const first = focusVerses?.[0];
    if (!first || verses.length === 0) return;
    document.getElementById(`verse-${first}`)?.scrollIntoView({ block: "center" });
  }, [focusVerses, verses]);

  useEffect(() => {
    if (restored.current || verses.length === 0) return;
    const pending = readPendingSelection();
    if (!pending) return;
    const pendingPath = pending.path.split("?")[0];
    if (pendingPath !== pathname) {
      clearPendingSelection();
      restored.current = true;
      return;
    }
    if (pending.translation !== translation) {
      void setTranslation(pending.translation);
      return;
    }
    const matched = verses.filter((verse) => pending.verseIds.includes(verse.id));
    for (const verse of matched) selection.toggleVerse(verse);
    clearPendingSelection();
    restored.current = true;
    if (matched.length === 0) return;
    try {
      setPassage(buildBiblePassage({
        bookName,
        chapterNumber,
        selectedVerses: matched,
        translation,
      }));
      setPanelOpen(true);
    } catch (passageError) {
      notify("Selección inválida", passageError instanceof Error ? passageError.message : "Revisá los versículos.");
    }
  }, [bookName, chapterNumber, pathname, selection, setTranslation, translation, verses]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (panelOpen || footnotesOpen || compareVerses.length > 0 || annotating || connectionsVerse !== null) return;
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      if (event.key === "ArrowLeft" && chapterNav.previous) {
        event.preventDefault();
        goToChapter(chapterNav.previous);
      }
      if (event.key === "ArrowRight" && chapterNav.next) {
        event.preventDefault();
        goToChapter(chapterNav.next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotating, chapterNav, compareVerses, connectionsVerse, footnotesOpen, goToChapter, panelOpen]);

  async function handleAskAI() {
    if (!(await isOnline())) {
      notify("Sin conexión", "Necesitás conexión a internet para usar la IA.");
      return;
    }
    try {
      setPassage(buildBiblePassage({
        bookName,
        chapterNumber,
        selectedVerses: selection.selectedVerses,
        translation,
      }));
      setPanelOpen(true);
    } catch (passageError) {
      notify("Selección inválida", passageError instanceof Error ? passageError.message : "Revisá los versículos seleccionados.");
    }
  }

  function handleCompareSelect(nextTranslation: BibleTranslation) {
    const verseNumbers = compareVerses.map((verse) => verse.number);
    setCompareVerses([]);
    if (nextTranslation === translation) return;
    void setTranslation(nextTranslation);
    void navigate({
      to: "/$book/$chapter",
      params: { book: slug, chapter: String(chapterNumber) },
      search: { v: formatVerseParam(verseNumbers) },
      resetScroll: false,
    });
  }

  function selectionShare() {
    return buildVerseShare({
      bookName,
      chapterNumber,
      slug,
      translation,
      verses: selection.selectedVerses,
      origin: window.location.origin,
    });
  }

  async function handleShare() {
    try {
      const result = await shareOrCopy(selectionShare());
      if (result === "copied") notify("Copiado", "El pasaje y su enlace se copiaron al portapapeles.");
    } catch (shareError) {
      notify("No se pudo compartir", shareError instanceof Error ? shareError.message : "Probá de nuevo.");
    }
  }

  async function handleCopy() {
    try {
      const payload = selectionShare();
      await copyText(`${payload.text}\n${payload.url}`);
      notify("Copiado", "El pasaje y su enlace se copiaron al portapapeles.");
    } catch (copyError) {
      notify("No se pudo copiar", copyError instanceof Error ? copyError.message : "Probá de nuevo.");
    }
  }

  function handleLogin() {
    const path = href;
    savePendingSelection({
      path,
      verseIds: selection.selectedVerses.map((verse) => verse.id),
      translation,
    });
    window.location.assign(`/auth/login?returnTo=${encodeURIComponent(path)}`);
  }

  function closePanel() {
    setPanelOpen(false);
    setPassage(null);
    selection.clearSelection();
  }

  const access: PanelAccess = auth.status === "loading"
    ? "loading"
    : auth.status === "authenticated"
      ? auth.role ? "allowed" : "denied"
      : "anonymous";

  if (error) {
    return (
      <div>
        <TranslationSelector compact />
        <p className={styles.error}>
          {error instanceof BollsTranslationUnavailableError
            ? error.message
            : "Error cargando versículos. Verificá tu conexión a internet."}
        </p>
      </div>
    );
  }

  if (isPending) return <p className={styles.status}>Cargando capítulo...</p>;

  return (
    <section className={selection.isSelectionActive ? styles.withBar : styles.withArrows}>
      {selection.isSelectionActive ? (
        <SelectionHeader
          reference={formatVerseReference(bookName, chapterNumber, selection.selectedVerses.map((verse) => verse.number))}
          count={selection.selectedVerses.length}
          maxCount={selection.maxSelectable}
          translation={translation}
          onCancel={selection.clearSelection}
        />
      ) : null}
      {/* On phones the top bar already names the chapter and the translation. */}
      <div className={styles.desktopOnly}>
        <h2 className={styles.title}>{bookName} {chapterNumber} · {translation}</h2>
        <TranslationSelector compact />
      </div>
      {verses.map((verse: Verse, index) => (
        <VerseItem
          key={verse.id}
          verse={verse}
          dropCap={index === 0 ? chapterNumber : undefined}
          focused={focused.has(verse.number)}
          selected={selection.isSelected(verse.id)}
          selectionActive={selection.isSelectionActive}
          onPress={selection.toggleVerse}
          onLongPress={(item) => {
            if (selection.isSelectionActive) selection.toggleVerse(item);
            else selection.startSelection(item);
          }}
          onEscape={selection.clearSelection}
          onFootnotePress={() => setFootnotesOpen(true)}
          annotation={annotations[annotationKey({ bookNumber, chapter: chapterNumber, verse: verse.number })]}
          onNotePress={(item) => setAnnotating({ verses: [item], focus: "note" })}
          connections={bookConnections?.[`${chapterNumber}:${verse.number}`]?.length ?? 0}
          onConnectionsPress={(item) => setConnectionsVerse(item.number)}
        />
      ))}
      <p className={styles.copyright}>{TRANSLATION_NOTICES[translation as BibleTranslation]}</p>
      <ChapterNavigationFooter navigation={chapterNav} onNavigate={(id, nextBookId, name, number) => {
        goToChapter({ chapterId: id, bookId: nextBookId, bookName: name, chapterNumber: number });
      }} />
      {selection.isSelectionActive ? (
        <SelectionActionBar
          count={selection.selectedVerses.length}
          onAskAI={() => void handleAskAI()}
          onCompare={() => setCompareVerses([...selection.selectedVerses].sort((a, b) => a.number - b.number))}
          onShare={() => void handleShare()}
          onCopy={() => void handleCopy()}
          onAnnotate={() => setAnnotating({ verses: [...selection.selectedVerses].sort((a, b) => a.number - b.number) })}
        />
      ) : (
        <ChapterArrows navigation={chapterNav} onNavigate={goToChapter} />
      )}
      <VerseCompareSheet
        verses={compareVerses}
        reference={compareVerses.length > 0
          ? formatVerseReference(bookName, chapterNumber, compareVerses.map((verse) => verse.number))
          : ""}
        onSelectTranslation={handleCompareSelect}
        onClose={() => setCompareVerses([])}
      />
      <AnnotateSheet
        targets={annotationTargets}
        reference={annotating
          ? formatVerseReference(bookName, chapterNumber, annotating.verses.map((verse) => verse.number))
          : ""}
        focus={annotating?.focus}
        access={access}
        onLogin={handleLogin}
        onDone={() => {
          setAnnotating(null);
          selection.clearSelection();
        }}
        onClose={() => setAnnotating(null)}
      />
      <ConnectionsSheet
        references={connectionsVerse !== null ? bookConnections?.[`${chapterNumber}:${connectionsVerse}`] ?? [] : []}
        reference={connectionsVerse !== null ? `${bookName} ${chapterNumber}:${connectionsVerse}` : ""}
        onClose={() => setConnectionsVerse(null)}
      />
      {panelOpen && passage ? (
        <BibleAiPanel
          open={panelOpen}
          passage={passage}
          access={access}
          quota={auth.me?.aiQuota ?? null}
          onClose={closePanel}
          onLogin={handleLogin}
        />
      ) : null}
      {footnotes.length > 0 ? (
        <Footnotes open={footnotesOpen} footnotes={footnotes} onClose={() => setFootnotesOpen(false)} />
      ) : null}
    </section>
  );
}
