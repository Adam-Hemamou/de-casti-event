// Mise en forme minimale des textes des fichiers de données.
// *texte* -> <span class="it">texte</span> (italique, couleur d'accent selon le contexte)
// Retour à la ligne (\n) -> <br>
const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function rich(text: string, italicClass = 'it'): string {
  return escape(text)
    .replace(/\*([^*]+)\*/g, `<span class="${italicClass}">$1</span>`)
    .replace(/\n/g, '<br>');
}
