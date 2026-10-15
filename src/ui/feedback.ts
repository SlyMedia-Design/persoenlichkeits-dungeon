import configJson from '../../data/config.json';

/** Link zum Feedback-Formular (data/config.json); leer = kein Feedback-Knopf */
export const feedbackUrl: string = (configJson as { feedbackUrl?: string }).feedbackUrl ?? '';

/**
 * Öffnet das Google-Formular in einem neuen Tab. Es wird nichts mitgeschickt:
 * keine Testergebnisse, keine Werte – nur, was der Spieler dort selbst eintippt.
 */
export function openFeedback() {
  if (feedbackUrl) window.open(feedbackUrl, '_blank', 'noopener,noreferrer');
}
