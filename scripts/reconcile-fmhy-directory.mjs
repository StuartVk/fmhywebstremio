#!/usr/bin/env node
/* global process */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { URL } from 'node:url';

const directoryPath = resolve('data/fmhy-streaming-directory.json');
const registryPath = resolve('src/engine/registry/deployment-registry.generated.ts');
const outputPath = resolve('data/fmhy-source-reconciliation.json');
const directory = JSON.parse(readFileSync(directoryPath, 'utf8'));
const registryText = readFileSync(registryPath, 'utf8');

const communityHost = /(?:^|\.)(?:discord\.gg|discord\.com|reddit\.com|t\.me|telegram\.me|github\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|instagram\.com|tiktok\.com|patreon\.com|ko-fi\.com)$/i;
const normalizeHost = value => String(value || '').replace(/^www\./i, '').toLowerCase();
const getHost = value => {
  try { return normalizeHost(new URL(value).hostname); } catch { return ''; }
};

const recordsText = registryText.split(/\n{4}\{\n{6}id: /).slice(1);
const registryRecords = recordsText.map(block => {
  const id = (block.match(/^'([^']+)'/) || [])[1] || '';
  const canonicalDomain = (block.match(/canonicalDomain: '([^']+)'/) || [])[1] || '';
  const name = (block.match(/name: '([^']+)'/) || [])[1] || id;
  const familyId = (block.match(/family:\s*\{\s*id: '([^']+)'/) || [])[1] || '';
  const status = (block.match(/status: '(supported|unsupported|unknown|disabled)'/) || [])[1] || 'unknown';
  const aliasesBlock = (block.match(/aliases: \[([\s\S]*?)\]/) || [])[1] || '';
  const aliases = [...aliasesBlock.matchAll(/'([^']+)'/g)].map(match => normalizeHost(match[1]));
  return { id, name, canonicalDomain: normalizeHost(canonicalDomain), aliases, familyId, status };
}).filter(record => record.id && record.canonicalDomain);

const registryHosts = new Map();
for (const record of registryRecords) {
  for (const host of [record.canonicalDomain, ...record.aliases]) {
    if (host) registryHosts.set(host, record);
  }
}

const categoryCounts = Object.fromEntries(directory.categories.map(category => [
  category, directory.entries.filter(entry => entry.category === category).length
]));
const linkRows = directory.entries.flatMap(entry => (entry.links || []).map(link => ({
  category: entry.category,
  title: entry.title,
  label: link.label,
  url: link.url,
  host: getHost(link.url)
})));
const nonWebLinks = linkRows.filter(link => !link.host);
const communityLinks = linkRows.filter(link => link.host && communityHost.test(link.host));
const websiteLinks = linkRows.filter(link => link.host && !communityHost.test(link.host));
const uniqueHosts = [...new Set(websiteLinks.map(link => link.host))].sort();

const matched = uniqueHosts.filter(host => registryHosts.has(host)).map(host => ({
  host,
  registry: registryHosts.get(host)
}));
const unmatched = uniqueHosts.filter(host => !registryHosts.has(host)).map(host => ({
  host,
  references: websiteLinks.filter(link => link.host === host).map(({ category, title, label, url }) => ({ category, title, label, url }))
}));

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  directory: {
    source: directory.source,
    sourceUrl: directory.sourceUrl,
    fetchedAt: directory.fetchedAt,
    entryCount: directory.entryCount,
    categories: categoryCounts
  },
  inventory: {
    totalLinks: linkRows.length,
    websiteLinks: websiteLinks.length,
    uniqueWebsiteHosts: uniqueHosts.length,
    communityOrSocialLinks: communityLinks.length,
    invalidLinks: nonWebLinks.length
  },
  runtimeRegistry: {
    recordCount: registryRecords.length,
    supportedRecordCount: registryRecords.filter(record => record.status === 'supported').length,
    registeredHostCount: registryHosts.size,
    matchedDirectoryHostCount: matched.length,
    unmatchedDirectoryHostCount: unmatched.length,
    matched,
    unmatched
  },
  limitations: [
    'This is an offline metadata reconciliation, not a live availability or playback test.',
    'A domain match means the current deployment registry knows the host; it does not prove the source is currently extractable.',
    'An unmatched domain is a candidate for recognition and validation, not automatically a supported streaming source.',
    'Social, community, source-code, and other non-player links are excluded from the website-host inventory.'
  ]
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({
  outputPath,
  directoryEntries: report.directory.entryCount,
  uniqueWebsiteHosts: report.inventory.uniqueWebsiteHosts,
  matchedDirectoryHosts: report.runtimeRegistry.matchedDirectoryHostCount,
  unmatchedDirectoryHosts: report.runtimeRegistry.unmatchedDirectoryHostCount,
  registryRecords: report.runtimeRegistry.recordCount
}, null, 2) + '\n');
