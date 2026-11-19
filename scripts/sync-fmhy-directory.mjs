#!/usr/bin/env node
/**
 * Build a metadata-only index of the official FMHY Streaming wiki.
 * This script does NOT visit listed sites, extract media URLs, or enable playback.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wikiUrl = 'https://github.com/fmhy/FMHY.wiki.git';
const wikiPage = 'Streaming.md';
const outputPath = join(process.cwd(), 'data', 'fmhy-streaming-directory.json');
const tempRoot = mkdtempSync(join(tmpdir(), 'fmhy-wiki-'));

function cleanMarkdown(value) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*|__|~~|[*_]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseWiki(markdown) {
  const entries = [];
  let category = 'Uncategorized';
  let inStreamingSection = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (/^#\s+►\s*Streaming Sites/i.test(line)) {
      inStreamingSection = true;
      category = 'Streaming Sites';
      continue;
    }
    if (/^#\s+►\s*Streaming Apps/i.test(line)) {
      inStreamingSection = true;
      category = 'Streaming Apps';
      continue;
    }
    if (/^#\s+►/.test(line) && !/^#\s+►\s*Streaming/i.test(line)) {
      inStreamingSection = false;
    }
    if (!inStreamingSection) continue;

    const heading = line.match(/^#{2,4}\s+(?:▷\s*)?(.+)$/);
    if (heading) {
      category = cleanMarkdown(heading[1]);
      continue;
    }

    const bullet = rawLine.match(/^\s*[*-]\s+(.+)$/);
    if (!bullet) continue;

    const rawEntry = bullet[1].trim();
    if (/^note\s*[-:]/i.test(cleanMarkdown(rawEntry))) continue;

    const links = [];
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    for (const match of rawEntry.matchAll(linkPattern)) {
      const url = match[2].replace(/&amp;/g, '&');
      if (!links.some(item => item.url === url)) {
        links.push({ label: cleanMarkdown(match[1]), url });
      }
    }

    const plain = cleanMarkdown(rawEntry)
      .replace(/^[🌟⭐🌐↪️📺🎬🎞️\s]+/u, '')
      .trim();
    const title = (plain.split(/\s+-\s+/)[0] || plain).trim();
    if (!title) continue;

    entries.push({
      category,
      title,
      description: plain.length > title.length ? plain.slice(title.length).replace(/^\s*-\s*/, '').trim() : '',
      links,
      directoryOnly: true,
      playbackIntegration: 'not-implemented',
      sourceLine: rawEntry
    });
  }

  const deduped = [];
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.category.toLowerCase()}::${entry.title.toLowerCase()}::${entry.links.map(x => x.url).join('|')}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(entry);
    }
  }
  return deduped;
}

try {
  execFileSync('git', ['clone', '--depth', '1', wikiUrl, join(tempRoot, 'wiki')], { stdio: 'inherit' });
  const sourceFile = join(tempRoot, 'wiki', wikiPage);
  if (!existsSync(sourceFile)) throw new Error(`Expected wiki page not found: ${wikiPage}`);
  const markdown = readFileSync(sourceFile, 'utf8');
  const entries = parseWiki(markdown);
  if (entries.length < 10) throw new Error(`Refusing to publish an unexpectedly small directory (${entries.length} entries).`);

  const payload = {
    schemaVersion: 1,
    source: 'FMHY official wiki',
    sourceUrl: 'https://github.com/fmhy/FMHY/wiki/Streaming',
    fetchedAt: new Date().toISOString(),
    entryCount: entries.length,
    categories: [...new Set(entries.map(entry => entry.category))],
    note: 'Directory metadata only. Listing does not imply authorization, availability, compatibility, or Stremio playback support.',
    entries
  };

  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`Wrote ${entries.length} FMHY directory entries to ${outputPath}\n`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
