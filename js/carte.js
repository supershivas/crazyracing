// La carte du circuit en petit (canvas 2D) : pour la liste des circuits et le HUD.
// Le circuit en petit pour la carte du HUD (canvas 2D) : on le peint une fois, puis on rend
// la fonction qui repeint les voitures par-dessus
export function dessinerCarte(cv, piste, taille = 110) {
  const g = cv.getContext('2d');
  const b = piste.boite;
  const f = Math.min(taille / (b.x1 - b.x0), taille / (b.y1 - b.y0));
  cv.width = Math.ceil((b.x1 - b.x0) * f) + 6; cv.height = Math.ceil((b.y1 - b.y0) * f) + 6;
  const tr = p => [3 + (p.x - b.x0) * f, 3 + (p.y - b.y0) * f];
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath();
  piste.pts.forEach((p, i) => { const [x, y] = tr(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
  g.closePath();
  g.strokeStyle = '#1a1c2c'; g.lineWidth = 5; g.stroke();
  g.strokeStyle = '#94b0c2'; g.lineWidth = 3; g.stroke();
  const base = g.getImageData(0, 0, cv.width, cv.height);
  return voitures => {
    g.putImageData(base, 0, 0);
    for (const v of voitures) {
      const [x, y] = tr(v);
      g.fillStyle = v.humain ? '#f4f4f4' : '#ef7d57';
      const r = v.humain ? 2.4 : 1.7;
      g.fillRect(Math.round(x - r), Math.round(y - r), r * 2, r * 2);
    }
  };
}
