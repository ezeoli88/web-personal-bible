import { useEffect, useRef } from "react";
import clsx from "clsx";
import { GROUP_DURATIONS, type BiblePassage } from "../../core/types/ai";
import type { AiQuota } from "../auth/useMe";
import { LoginPrompt } from "../auth/LoginPrompt";
import { WordStudyCard } from "../wordStudy/WordStudyCard";
import { AskPassageChat } from "./AskPassageChat";
import { useBibleAiPanel, type PanelAccess } from "../hooks/useBibleAiPanel";
import { MarkdownText } from "./MarkdownText";
import { PassageReading } from "./PassageReading";
import { StreamingText } from "./StreamingText";
import { WordList } from "./WordList";
import styles from "./BibleAiPanel.module.css";

interface Props {
  open: boolean;
  passage: BiblePassage | null;
  access: PanelAccess;
  /** Monthly AI requests left; null when the reader has no limit. */
  quota?: AiQuota | null;
  onClose: () => void;
  onLogin: () => void;
}

const AUTO_SCROLL_THRESHOLD = 50;
const SKELETON_CARDS = [["42%", "88%"], ["60%", "70%"], ["50%", "94%"], ["38%", "76%"]];

function MenuSkeleton() {
  return (
    <div className={styles.menu}>
      <p role="status" className={styles.visuallyHidden}>Cargando opciones de análisis...</p>
      <div className={styles.skeleton} aria-hidden="true" data-testid="menu-skeleton">
        <div className={clsx(styles.skLine, styles.skTitle)} />
        <div className={clsx(styles.skLine, styles.skTranslation)} />
        <div className={clsx(styles.skLine, styles.skMenuTitle)} />
        {SKELETON_CARDS.map(([label, hint], index) => (
          <div key={index} className={styles.skCard}>
            <div className={clsx(styles.skLine, styles.skIcon)} />
            <div className={styles.skStack}>
              <div className={styles.skLine} style={{ width: label }} />
              <div className={clsx(styles.skLine, styles.skHint)} style={{ width: hint }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function quotaNote(quota: AiQuota): string {
  if (quota.remaining === 0) return `Usaste las ${quota.limit} consultas de IA de este mes. Se renuevan el 1.º del mes que viene.`;
  return quota.remaining === 1
    ? "Te queda 1 consulta de IA este mes."
    : `Te quedan ${quota.remaining} de ${quota.limit} consultas de IA este mes.`;
}

export function BibleAiPanel({ open, passage, access, quota, onClose, onLogin }: Props) {
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
    if ((panel.viewState === "streaming" && panel.response) || (panel.words.step === "defining" && panel.words.definitions)) {
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
  const modeBusy = panel.viewState === "loading" || panel.viewState === "streaming";
  const waitingFirstText = panel.viewState === "loading" ||
    (panel.viewState === "streaming" && !panel.response && !panel.error);
  const activeWord = panel.words.activeWord;
  const activeWordLabel = activeWord ? (activeWord.spanish || activeWord.hint || activeWord.original) : null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-testid="bible-ai-panel"
      aria-label="Análisis con IA"
      onClose={onClose}
    >
      <div className={styles.content}>
        {panel.viewState === "auth-loading" ? <MenuSkeleton /> : null}

        {panel.viewState === "login-required" ? <LoginPrompt onLogin={onLogin} /> : null}

        {panel.viewState === "not-allowed" ? (
          <p className={styles.denied} data-testid="not-allowed">
            Tu correo no tiene acceso a la IA. Pedíselo al administrador.
          </p>
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
            {quota ? <p className={styles.footerNote} data-testid="ai-quota">{quotaNote(quota)}</p> : null}
          </div>
        ) : null}

        {panel.viewState === "group-setup" && passage ? (
          <div className={styles.menu} data-testid="group-setup">
            <div className={styles.modeHeader}>
              <span aria-hidden="true">{panel.labels.group.emoji}</span>
              <span>{panel.labels.group.label}</span>
            </div>
            <p className={styles.menuTitle}>¿Cuánto dura el encuentro?</p>
            {GROUP_DURATIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={styles.modeButton}
                onClick={() => void panel.selectMode("group", minutes)}
              >
                <span className={styles.emoji} aria-hidden="true">⏱️</span>
                <span>
                  <span className={styles.modeLabel}>{minutes} minutos</span>
                  <span className={styles.modeHint}>
                    {minutes === 30 ? "Breve, para un encuentro corto" : minutes === 45 ? "Lo habitual en un grupo" : "Con tiempo para conversar"}
                  </span>
                </span>
              </button>
            ))}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={panel.backToMenu}>← Volver al menú</button>
            </div>
          </div>
        ) : null}

        {panel.viewState === "ask" && passage ? (
          <AskPassageChat passage={passage} chat={panel.chat} onBack={panel.backToMenu} />
        ) : null}

        {panel.viewState === "words" && passage ? (
          <div className={styles.response}>
            <div className={styles.modeHeader}>
              <span aria-hidden="true">{panel.labels.words.emoji}</span>
              <span>{activeWordLabel ?? panel.labels.words.label}</span>
            </div>
            <p role="status" className={styles.visuallyHidden}>{wordsStep === "complete" ? "Respuesta lista" : ""}</p>
            {wordsStep === "idle" || wordsStep === "identifying" ? (
              <PassageReading passage={passage} status="Preparando las palabras del pasaje..." />
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
                <div
                  ref={scrollerRef}
                  className={styles.scroller}
                  onScroll={onScroll}
                  aria-busy={wordsStep === "defining" ? true : undefined}
                >
                  {wordsStep === "error" && panel.words.error ? (
                    <p className={styles.error} role="alert">⚠️ {panel.words.error}</p>
                  ) : wordsStep === "defining" && !panel.words.definitions ? (
                    <PassageReading
                      passage={passage}
                      status={activeWordLabel ? `Buscando el significado de «${activeWordLabel}»...` : "Buscando el significado..."}
                    />
                  ) : (
                    <StreamingText text={panel.words.definitions} isStreaming={wordsStep === "defining"} />
                  )}
                  {wordsStep === "complete" && activeWord?.tokenId ? (
                    <WordStudyCard passage={passage} tokenId={activeWord.tokenId} onNavigate={onClose} />
                  ) : null}
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

        {(modeBusy || panel.viewState === "response") && modeLabel && passage ? (
          <div className={styles.response}>
            <div className={styles.modeHeader}>
              <span aria-hidden="true">{modeLabel.emoji}</span>
              <span>{modeLabel.label}</span>
            </div>
            <p role="status" className={styles.visuallyHidden}>
              {panel.viewState === "response" && !panel.error && !panel.stopped ? "Respuesta lista" : ""}
            </p>
            <div
              ref={scrollerRef}
              className={styles.scroller}
              onScroll={onScroll}
              aria-busy={modeBusy ? true : undefined}
            >
              {panel.error ? (
                <p className={styles.error} role="alert">⚠️ {panel.error}</p>
              ) : waitingFirstText ? (
                <PassageReading passage={passage} status={`Consultando sobre ${modeLabel.label.toLowerCase()}...`} />
              ) : panel.viewState === "streaming" ? (
                <StreamingText text={panel.response} isStreaming />
              ) : (
                <MarkdownText>{panel.response}</MarkdownText>
              )}
              {panel.stopped ? <p className={styles.note}>Detuviste la respuesta antes de que terminara.</p> : null}
              {panel.notes.map((note) => <p key={note} className={styles.note}>• {note}</p>)}
            </div>
            <div className={styles.actions}>
              {modeBusy ? (
                <button type="button" className={styles.secondary} onClick={panel.stopResponse}>
                  <span className={styles.stopIcon} aria-hidden="true" />
                  Detener
                </button>
              ) : (
                <button type="button" className={styles.secondary} onClick={panel.backToMenu}>
                  ← Volver al menú
                </button>
              )}
              {!panel.error && panel.viewState === "response" && panel.response ? (
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
