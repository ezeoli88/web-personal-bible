import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { BollsTranslationUnavailableError } from "../../core/api/BollsBibleClient";
import { useBibleRepository } from "../../core/hooks/DatabaseProvider";
import { useBibleAISelection } from "../../core/hooks/useBibleAISelection";
import { useChapterNavigation, useVersesByChapter } from "../../core/hooks/useBibleQueries";
import { bookSlug } from "../../core/lib/bookSlugs";
import { parseBookNumber } from "../../core/lib/ids";
import { buildBiblePassage } from "../../core/lib/passageBuilder";
import type { BiblePassage } from "../../core/types/ai";
import type { ChapterNavigationInfo, Verse } from "../../core/types/bible";
import { TRANSLATION_NOTICES, type BibleTranslation } from "../../core/types/translation";
import { isOnline } from "../../platform/network";
import { notify } from "../../platform/notify";
import { useAuth } from "../auth/AuthProvider";
import { clearPendingSelection, readPendingSelection, savePendingSelection } from "../auth/pendingSelection";
import { BibleAiPanel } from "../components/BibleAiPanel";
import { ChapterNavigationFooter } from "../components/ChapterNavigationFooter";
import { Footnotes } from "../components/Footnotes";
import { SelectionActionBar } from "../components/SelectionActionBar";
import { TranslationSelector } from "../components/TranslationSelector";
import { VerseCompareSheet } from "../components/VerseCompareSheet";
import { VerseItem } from "../components/VerseItem";
import type { PanelAccess } from "../hooks/useBibleAiPanel";
import styles from "./pages.module.css";

interface Props {
  bookName: string;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  slug: string;
  focusVerseNumber?: number;
}

export function ChapterReaderPage({
  bookName,
  bookId,
  chapterId,
  chapterNumber,
  slug,
  focusVerseNumber,
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
  const [compareVerse, setCompareVerse] = useState<Verse | null>(null);
  const restored = useRef(false);

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
    setCompareVerse(null);
    restored.current = false;
  }, [chapterId, translation, selection.clearSelection]);

  useEffect(() => {
    if (!focusVerseNumber || verses.length === 0) return;
    document.getElementById(`verse-${focusVerseNumber}`)?.scrollIntoView({ block: "center" });
  }, [focusVerseNumber, verses]);

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
      if (panelOpen || footnotesOpen || compareVerse) return;
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
  }, [chapterNav, compareVerse, footnotesOpen, goToChapter, panelOpen]);

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
    const verseNumber = compareVerse?.number;
    setCompareVerse(null);
    if (nextTranslation === translation) return;
    void setTranslation(nextTranslation);
    void navigate({
      to: "/$book/$chapter",
      params: { book: slug, chapter: String(chapterNumber) },
      search: { v: verseNumber },
    });
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
    <section className={selection.isSelectionActive ? styles.withBar : undefined}>
      <h2 className={styles.title}>{bookName} {chapterNumber} · {translation}</h2>
      <TranslationSelector compact />
      {verses.map((verse: Verse) => (
        <VerseItem
          key={verse.id}
          verse={verse}
          focused={verse.number === focusVerseNumber}
          selected={selection.isSelected(verse.id)}
          selectionActive={selection.isSelectionActive}
          onPress={selection.toggleVerse}
          onLongPress={(item) => {
            if (selection.isSelectionActive) selection.toggleVerse(item);
            else selection.startSelection(item);
          }}
          onEscape={selection.clearSelection}
          onFootnotePress={() => setFootnotesOpen(true)}
        />
      ))}
      <p className={styles.copyright}>{TRANSLATION_NOTICES[translation as BibleTranslation]}</p>
      <ChapterNavigationFooter navigation={chapterNav} onNavigate={(id, nextBookId, name, number) => {
        goToChapter({ chapterId: id, bookId: nextBookId, bookName: name, chapterNumber: number });
      }} />
      {selection.isSelectionActive ? (
        <SelectionActionBar
          count={selection.selectedVerses.length}
          maxCount={selection.maxSelectable}
          onAskAI={() => void handleAskAI()}
          onCompare={() => setCompareVerse(selection.selectedVerses[0] ?? null)}
          onCancel={selection.clearSelection}
        />
      ) : null}
      <VerseCompareSheet
        verse={compareVerse}
        reference={compareVerse ? `${bookName} ${chapterNumber}:${compareVerse.number}` : ""}
        onSelectTranslation={handleCompareSelect}
        onClose={() => setCompareVerse(null)}
      />
      {panelOpen && passage ? (
        <BibleAiPanel
          open={panelOpen}
          passage={passage}
          access={access}
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
