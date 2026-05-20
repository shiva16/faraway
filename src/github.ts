import type { SaveState } from './types';

const API   = 'https://api.github.com';
const OWNER = 'shiva16';
const REPO  = 'faraway';
const PATH  = 'progress.json';

function headers(token: string) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

export async function verifyToken(token: string): Promise<string> {
  const res = await fetch(`${API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error('Invalid token — check it and try again.');
  const data = await res.json() as { login: string };
  return data.login;
}

export async function ensureRepo(token: string): Promise<void> {
  const check = await fetch(`${API}/repos/${OWNER}/${REPO}`, {
    headers: headers(token),
  });
  if (check.status === 200) return; // already exists

  const res = await fetch(`${API}/user/repos`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      name: REPO,
      description: 'A tiny pixel art island — save your wanderings here.',
      private: false,
      auto_init: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(err.message ?? `Could not create repo (${res.status})`);
  }
  // Give GitHub a moment to initialise the repo
  await new Promise(r => setTimeout(r, 1800));
}

export async function loadSave(token: string): Promise<{ save: SaveState | null; sha: string | null }> {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    headers: headers(token),
  });
  if (res.status === 404) return { save: null, sha: null };
  if (!res.ok) throw new Error(`Could not read save (${res.status})`);

  const data = await res.json() as { content: string; sha: string };
  const json = JSON.parse(atob(data.content.replace(/\n/g, ''))) as SaveState;
  return { save: json, sha: data.sha };
}

export async function writeSave(
  token: string,
  save: SaveState,
  sha: string | null,
): Promise<string> {
  const content = btoa(JSON.stringify(save, null, 2));
  const body: Record<string, string> = {
    message: `wandered: ${save.discoveries.length} discoveries · ${Math.floor(save.playTime / 60)}m`,
    content,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Save failed (${res.status})`);

  const data = await res.json() as { content: { sha: string } };
  return data.content.sha;
}
