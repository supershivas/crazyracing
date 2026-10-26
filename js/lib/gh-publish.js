/* ─── Publication de l'Atelier dans le dépôt — partagé entre les jeux ──────
   Source de vérité : supershivas/game-system/modules/gh-publish.js
   Applique la section 17 de CONVENTIONS.md : l'Atelier publie d'un geste
   ce qui a été modifié dans le navigateur, en UN SEUL commit sur `main`, par
   l'API de GitHub (blobs → arbre → commit → avance de la branche). GitHub
   Pages republie le site ; le jeu lit le contenu publié à son lancement.

   Le jeton est un « fine-grained personal access token », limité à CE dépôt
   et au droit « Contents : Read and write ». Il est collé une fois dans
   l'atelier, reste dans ce navigateur, ne part que vers api.github.com et
   n'est jamais exporté.

   Module ES sans dépendance :
     import { createPublisher, TOKEN_URL } from './lib/gh-publish.js?v=0.2.0'
     const pub = createPublisher({ repo: 'supershivas/kingvi', tokenKey: 'kingvi:gh-token' })
     pub.setToken(collé)          // pub.getToken(), pub.hasToken
     const texts = await pub.readJSON('assets/design/texts.json')   // null si absent
     await pub.publish([
       { path: 'assets/design/texts.json', json: { ...texts, ...modifiés } },
       { path: 'assets/design/hero.png', blob: pngBlob },
       { path: 'data/notes.md', text: '# …' },
     ], { message: "Publie 3 textes depuis l'atelier", progress: s => statut(s) })
   Si quelqu'un a poussé entre-temps, la publication recommence une fois sur
   la nouvelle pointe ; fusionner (relire puis réécrire) reste au jeu.
   ─────────────────────────────────────────────────────────────────────────── */

export const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

const toBase64 = async blob => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64Utf8 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), c => c.charCodeAt(0)));

export function createPublisher({
  repo,
  branch = 'main',
  tokenKey,
  apiBase = 'https://api.github.com',
} = {}) {
  if (!repo || !tokenKey) throw new Error('createPublisher : repo et tokenKey sont obligatoires');

  const getToken = () => { try { return localStorage.getItem(tokenKey) || ''; } catch { return ''; } };
  const setToken = t => { try { t ? localStorage.setItem(tokenKey, t.trim()) : localStorage.removeItem(tokenKey); } catch { /* rien */ } };

  async function gh(path, init = {}) {
    const token = getToken();
    if (!token) throw new Error('Pas de jeton GitHub : colle-le dans l\'atelier.');
    const res = await fetch(`${apiBase}/repos/${repo}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 401) throw new Error('Jeton refusé par GitHub : il est faux ou expiré.');
    if (res.status === 403 || (res.status === 404 && init.method)) {
      throw new Error(`GitHub refuse l'écriture : le jeton doit avoir le droit « Contents : Read and write » sur ${repo}.`);
    }
    if (res.status === 409 || res.status === 422) { const e = new Error('conflit'); e.conflict = true; throw e; }
    if (!res.ok && res.status !== 404) throw new Error(`GitHub a répondu ${res.status}.`);
    return res.status === 404 ? null : res.json();
  }

  async function readText(path) {
    const f = await gh(`/contents/${path}?ref=${branch}`);
    return f ? fromBase64Utf8(f.content) : null;
  }

  return {
    getToken, setToken,
    get hasToken() { return !!getToken(); },
    readText,
    async readJSON(path) {
      const t = await readText(path);
      try { return t == null ? null : JSON.parse(t); } catch { return null; }
    },
    // files : [{ path, json } | { path, text } | { path, blob } | { path, delete: true }]
    async publish(files, { message = "Publie depuis l'atelier", progress = () => {} } = {}) {
      if (!files.length) throw new Error('Rien à publier.');
      for (let attempt = 0; ; attempt++) {
        try {
          progress('Lecture du dépôt…');
          const ref = await gh(`/git/ref/heads/${branch}`);
          if (!ref) throw new Error(`Branche ${branch} introuvable.`);
          const head = ref.object.sha;
          const commit = await gh(`/git/commits/${head}`);
          const tree = [];
          let n = 0;
          for (const f of files) {
            progress(`Envoi (${++n}/${files.length})…`);
            if (f.delete) { tree.push({ path: f.path, mode: '100644', type: 'blob', sha: null }); continue; }
            const body = f.blob
              ? { content: await toBase64(f.blob), encoding: 'base64' }
              : { content: f.json !== undefined ? JSON.stringify(f.json, null, 2) + '\n' : String(f.text ?? ''), encoding: 'utf-8' };
            const blob = await gh('/git/blobs', { method: 'POST', body });
            tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
          }
          progress('Publication…');
          const newTree = await gh('/git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree } });
          const made = await gh('/git/commits', { method: 'POST', body: { message, tree: newTree.sha, parents: [head] } });
          await gh(`/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: made.sha } });
          progress('Publié. Le jeu sera à jour dans une à dix minutes.');
          return made.sha;
        } catch (e) {
          // Quelqu'un a poussé entre-temps : on recommence une fois sur la nouvelle pointe
          if (e.conflict && attempt < 1) continue;
          if (e.conflict) throw new Error('Le dépôt a changé pendant la publication : réessaie.');
          throw e;
        }
      }
    },
  };
}
