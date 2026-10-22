import { useEffect, useRef } from "react";
import clsx from "clsx";
import type { BiblePassage } from "../../core/types/ai";
import { LoginPrompt } from "../auth/LoginPrompt";
import { useBibleAiPanel, type PanelAccess } from "../hooks/useBibleAiPanel";
import { MarkdownText } from "./MarkdownText";
import { StreamingText } from "./StreamingText";
import { WordList } from "./WordList";
import styles from "./BibleAiPanel.module.css";

interface Props {
  open: boolean;
  passage: BiblePassage | null;
  access: PanelAccess;
  onClose: () => void;
  onLogin: () => void;
}

const AUTO_SCROLL_THRESHOLD = 50;

export function BibleAiPanel({ open, passage, access, onClose, onLogin }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const autoScroll = useRef(true);
  const lastScroll = useRef(0);
  const panel = useBibleAiPanel({ open, passage, access });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    autoScroll.current = true;
    lastScroll.current = 0;
  }, [panel.viewState, panel.words.step]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !autoScroll.current) return;
    if (panel.viewState === "streaming" || panel.words.step === "defining") {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [panel.response, panel.words.definitions, panel.viewState, panel.words.step]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const distance = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    if (scroller.scrollTop < lastScroll.current && distance > AUTO_SCROLL_THRESHOLD) {
      autoScroll.current = false;
    }
    if (distance <= AUTO_SCROLL_THRESHOLD) autoScroll.current = true;
    lastScroll.current = scroller.scrollTop;
  }

  const modeLabel = panel.currentMode ? panel.labels[panel.currentMode] : null;
  const wordsStep = panel.words.step;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-testid="bible-ai-panel"
      aria-label="Análisis con IA"
      onClose={onClose}
    >
      <div className={styles.content}>
        {panel.viewState === "auth-loading" || panel.viewState === "menu-loading" ? (
          <p className={styles.loading}>Cargando opciones de análisis...</p>
        ) : null}

        {panel.viewState === "login-required" ? <LoginPrompt onLogin={onLogin} /> : null}

        {panel.viewState === "not-allowed" ? (
          <p className={styles.denied} data-testid="not-allowed">
            Tu correo no tiene acceso a la IA. Pedíselo al administrador.
          </p>
        ) : null}

        {panel.viewState === "menu-error" && passage ? (
          <div className={styles.menu}>
            <h2 className={styles.passageTitle}>{passage.reference}</h2>
            <p className={styles.error} role="alert">⚠️ {panel.error}</p>
            <button type="button" className={styles.primary} onClick={() => void panel.loadMenu()}>Reintentar</button>
            <button type="button" className={styles.secondary} onClick={onClose}>Volver</button>
          </div>
        ) : null}

        {panel.viewState === "menu" && passage ? (
          <div className={styles.menu}>
            <h2 className={styles.passageTitle}>{passage.reference}</h2>
            <p className={styles.translation}>{passage.translation}</p>
            <p className={styles.menuTitle}>{panel.menuTitle}</p>
            {panel.menuOptions.map((option) => {
              const meta = panel.labels[option.id];
              return (
                <button
                  key={option.id}
                  type="button"
                  className={styles.modeButton}
                  data-testid={`ai-mode-${option.id}`}
                  onClick={() => void panel.selectMode(option.id)}
                >
                  <span className={styles.emoji} aria-hidden="true">{meta.emoji}</span>
                  <span>
                    <span className={styles.modeLabel}>{option.label}</span>
                    <span className={styles.modeHint}>{option.hint}</span>
                  </span>
                </button>
              );
            })}
            {panel.menuFooter ? <p className={styles.footerNote}>{panel.menuFooter}</p> : null}
          </div>
        ) : null}

        {panel.viewState === "loading" ? (
          <p className={styles.loading}>
            Consultando sobre {modeLabel ? modeLabel.label.toLowerCase() : "el pasaje"}...
          </p>
        ) : null}

        {panel.viewState === "words" && passage ? (
          <div className={styles.response}>
            <div className={styles.modeHeader}>
              <span aria-hidden="true">{panel.labels.words.emoji}</span>
              <span>
                {panel.words.activeWord
                  ? (panel.words.activeWord.spanish || panel.words.activeWord.hint || panel.words.activeWord.original)
                  : panel.labels.words.label}
              </span>
            </div>
            {wordsStep === "idle" || wordsStep === "identifying" ? (
              <p className={styles.loading}>Preparando las palabras del pasaje...</p>
            ) : null}
            {wordsStep === "browsing" ? (
              <>
                <WordList
                  words={panel.words.words}
                  passageReference={passage.reference}
                  source={panel.words.source}
                  onWordPress={(word) => {
                    autoScroll.current = true;
                    void panel.words.startDefinition(passage, word);
                  }}
                />
                <div className={styles.actions}>
                  <button type="button" className={styles.secondary} onClick={panel.backToMenu}>← Volver al menú</button>
                </div>
              </>
            ) : null}
            {wordsStep === "defining" || wordsStep === "complete" || wordsStep === "error" ? (
              <>
                <div ref={scrollerRef} className={styles.scroller} onScroll={onScroll}>
                  {wordsStep === "error" && panel.words.error ? (
                    <p className={styles.error} role="alert">⚠️ {panel.words.error}</p>
                  ) : (
                    <StreamingText text={panel.words.definitions} isStreaming={wordsStep === "defining"} />
                  )}
                  {panel.words.notes.map((note) => <p key={note} className={styles.note}>• {note}</p>)}
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={panel.words.words.length > 0 ? panel.words.backToWords : panel.backToMenu}
                  >
                    {panel.words.words.length > 0 ? "← Volver a las palabras" : "← Volver al menú"}
                  </button>
                  {wordsStep === "error" ? (
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => {
                        if (panel.words.activeWord) void panel.words.startDefinition(passage, panel.words.activeWord);
                        else void panel.words.startIdentification(passage);
                      }}
                    >
                      Reintentar
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {(panel.viewState === "streaming" || panel.viewState === "response") && modeLabel ? (
          <div className={styles.response}>
            <div className={styles.modeHeader}>
              <span aria-hidden="true">{modeLabel.emoji}</span>
              <span>{modeLabel.label}</span>
            </div>
            <div ref={scrollerRef} className={styles.scroller} onScroll={onScroll}>
              {panel.error ? (
                <p className={styles.error} role="alert">⚠️ {panel.error}</p>
              ) : panel.viewState === "streaming" ? (
                <StreamingText text={panel.response} isStreaming />
              ) : (
                <MarkdownText>{panel.response}</MarkdownText>
              )}
              {panel.notes.map((note) => <p key={note} className={styles.note}>• {note}</p>)}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={panel.backToMenu}
                disabled={panel.viewState === "streaming"}
              >
                ← Volver al menú
              </button>
              {!panel.error && panel.viewState === "response" ? (
                <button type="button" className={styles.primary} onClick={() => void panel.copyResponse()}>
                  Copiar
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {panel.viewState === "menu" || panel.viewState === "login-required" || panel.viewState === "not-allowed" ? (
        <div className={styles.footer}>
          <button type="button" className={clsx(styles.secondary, styles.closeMenu)} onClick={onClose}>Volver</button>
        </div>
      ) : null}
    </dialog>
  );
}
