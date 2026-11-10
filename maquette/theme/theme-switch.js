// Aperçu des palettes : ajoute ?theme=noir-or ou ?theme=bordeaux à l'adresse,
// ou utilise le petit sélecteur en bas à droite. Le choix est mémorisé entre les pages.
(function () {
  var KEY = 'decasti-theme';
  var themes = { bordeaux: 'Bordeaux & champagne', 'noir-or': 'Noir & or' };
  var fromUrl = new URLSearchParams(location.search).get('theme');
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var theme = themes[fromUrl] ? fromUrl : (themes[saved] ? saved : 'bordeaux');
  document.documentElement.setAttribute('data-theme', theme);

  function apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('label');
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;gap:8px;align-items:center;' +
      'padding:8px 12px;border-radius:999px;background:rgba(0,0,0,.75);color:#fff;font:500 13px/1 system-ui,sans-serif';
    box.textContent = 'Palette';
    var sel = document.createElement('select');
    sel.style.cssText = 'font:inherit;padding:4px 6px;border-radius:6px';
    Object.keys(themes).forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = themes[k];
      if (k === theme) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener('change', function () { apply(sel.value); });
    box.appendChild(sel);
    document.body.appendChild(box);
  });
})();
