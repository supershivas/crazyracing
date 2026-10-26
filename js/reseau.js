// Le lien entre deux machines du même réseau, sans serveur : WebRTC, avec un code
// à échanger à la main (la « poignée de main » tient dans un texte copiable).
//
//   hôte :     const h = await creerHote();  h.code  → à donner à l'invité
//              await h.accepter(codeReponse)         → la liaison s'établit
//   invité :   const i = await rejoindre(codeHote);  i.code → à rendre à l'hôte
//   ensuite :  lien.envoyer(objet) ; lien.surMessage = o => … ; lien.surFermeture = () => …
//              lien.pret (promesse) ; lien.fermer()
//
// Aucun serveur STUN : `iceServers` est vide, seuls les chemins du réseau local
// sont proposés. Les navigateurs masquent l'adresse locale derrière un nom en
// « .local » (mDNS) ; il se résout sur un réseau domestique ordinaire, pas
// toujours sur un réseau d'entreprise ou d'hôtel : c'est la limite du procédé.

const PREFIXE_OFFRE = 'CRO.';
const PREFIXE_REPONSE = 'CRR.';
const DELAI_ICE = 4000;

const versB64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const depuisB64 = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function comprimer(texte) {
  const flux = new Blob([texte]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
async function decomprimer(bytes) {
  const flux = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(flux).text();
}

// Les lignes inutiles à une liaison locale partent : le code est plus court à lire et à recopier
const alleger = sdp => sdp.split(/\r?\n/).filter(l => l && !/^a=(extmap-allow-mixed|msid-semantic|ice-options|max-message-size)/.test(l)).join('\n');

const attendreCandidats = pc => new Promise(resolve => {
  if (pc.iceGatheringState === 'complete') return resolve();
  const fin = () => { pc.removeEventListener('icegatheringstatechange', verifie); resolve(); };
  const verifie = () => { if (pc.iceGatheringState === 'complete') fin(); };
  pc.addEventListener('icegatheringstatechange', verifie);
  setTimeout(fin, DELAI_ICE); // un réseau sans route : on donne ce qu'on a
});

function lienDepuis(pc) {
  const lien = {
    surMessage: null, surFermeture: null, canal: null, ferme: false,
    envoyer(o) { if (lien.canal?.readyState === 'open') lien.canal.send(JSON.stringify(o)); },
    fermer() { lien.ferme = true; try { lien.canal?.close(); pc.close(); } catch { /* déjà fermé */ } },
    get ouvert() { return lien.canal?.readyState === 'open'; },
  };
  lien.pret = new Promise((resolve, reject) => { lien.ok = resolve; lien.ko = reject; });
  const cloture = () => { if (!lien.ferme) { lien.ferme = true; lien.surFermeture?.(); } lien.ko(new Error('Connexion impossible : les deux machines sont-elles sur le même réseau ?')); };
  pc.addEventListener('connectionstatechange', () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) cloture(); });
  lien.brancher = canal => {
    lien.canal = canal;
    canal.onopen = () => lien.ok(lien);
    canal.onclose = cloture;
    canal.onmessage = e => {
      let o; try { o = JSON.parse(e.data); } catch { return; }
      if (o && typeof o === 'object') lien.surMessage?.(o);
    };
  };
  return lien;
}

export const reseauDisponible = () => typeof RTCPeerConnection !== 'undefined' && typeof CompressionStream !== 'undefined';

export async function creerHote() {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const lien = lienDepuis(pc);
  lien.brancher(pc.createDataChannel('course', { ordered: false, maxRetransmits: 0 }));
  await pc.setLocalDescription(await pc.createOffer());
  await attendreCandidats(pc);
  lien.code = PREFIXE_OFFRE + versB64(await comprimer(alleger(pc.localDescription.sdp)));
  lien.accepter = async code => {
    const texte = String(code).trim();
    if (!texte.startsWith(PREFIXE_REPONSE)) throw new Error('Ce n\'est pas le code de réponse de l\'invité (il commence par CRR.)');
    let sdp;
    try { sdp = await decomprimer(depuisB64(texte.slice(PREFIXE_REPONSE.length))); } catch { throw new Error('Code abîmé : il manque des caractères ?'); }
    await pc.setRemoteDescription({ type: 'answer', sdp: `${sdp}\r\n`.replace(/\r?\n/g, '\r\n') });
  };
  return lien;
}

export async function rejoindre(codeHote) {
  const texte = String(codeHote).trim();
  if (!texte.startsWith(PREFIXE_OFFRE)) throw new Error('Ce n\'est pas le code de l\'hôte (il commence par CRO.)');
  let sdp;
  try { sdp = await decomprimer(depuisB64(texte.slice(PREFIXE_OFFRE.length))); } catch { throw new Error('Code abîmé : il manque des caractères ?'); }
  const pc = new RTCPeerConnection({ iceServers: [] });
  const lien = lienDepuis(pc);
  pc.ondatachannel = e => lien.brancher(e.channel);
  await pc.setRemoteDescription({ type: 'offer', sdp: `${sdp}\r\n`.replace(/\r?\n/g, '\r\n') });
  await pc.setLocalDescription(await pc.createAnswer());
  await attendreCandidats(pc);
  lien.code = PREFIXE_REPONSE + versB64(await comprimer(alleger(pc.localDescription.sdp)));
  return lien;
}
