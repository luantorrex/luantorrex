#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROFILE_URL = 'https://stackoverflow.com/users/10487253/junior';
const FALLBACK_IMPACT = '48K+';
const OUTPUT_FILE = path.join(process.cwd(), 'assets', 'stackoverflow-impact.svg');
const STACK_OVERFLOW_ORANGE = '#f48024';

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function stripTags(value) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeImpactValue(value) {
  const cleaned = value.replace(/,/g, '').replace(/\s+/g, '').toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)([KMB])?\+?$/i);

  if (!match) {
    return null;
  }

  const number = match[1].replace(/\.0$/, '');
  const suffix = match[2] ? match[2].toUpperCase() : '';
  return `${number}${suffix}+`;
}

function extractPeopleReached(html) {
  const text = stripTags(html);
  const compactText = text.replace(/\s+/g, ' ');

  const textPatterns = [
    /(?:people|users)\s+reached\s+([0-9][0-9,]*(?:\.\d+)?\s*[KMB]?\+?)/i,
    /([0-9][0-9,]*(?:\.\d+)?\s*[KMB]?\+?)\s+(?:people|users)\s+reached/i,
  ];

  for (const pattern of textPatterns) {
    const match = compactText.match(pattern);
    if (match) {
      const normalized = normalizeImpactValue(match[1]);
      if (normalized) {
        return normalized;
      }
    }
  }

  const titlePatterns = [
    /title=["']([0-9][0-9,]*(?:\.\d+)?\s*[KMB]?\+?)\s+(?:people|users)\s+reached["']/i,
    /aria-label=["']([0-9][0-9,]*(?:\.\d+)?\s*[KMB]?\+?)\s+(?:people|users)\s+reached["']/i,
  ];

  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match) {
      const normalized = normalizeImpactValue(decodeHtmlEntities(match[1]));
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function escapeSvgText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateBadge(impact) {
  const safeImpact = escapeSvgText(impact);
  const label = 'Stack Overflow';
  const metric = `${safeImpact} people reached`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="96" viewBox="0 0 420 96" role="img" aria-labelledby="title desc">
  <title id="title">Stack Overflow Impact</title>
  <desc id="desc">${metric}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#fff4ec"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-20%" width="120%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0c0d0e" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect x="6" y="6" width="408" height="84" rx="18" fill="url(#bg)" stroke="#e4e6e8" filter="url(#shadow)"/>
  <rect x="6" y="6" width="10" height="84" rx="5" fill="${STACK_OVERFLOW_ORANGE}"/>
  <g transform="translate(40 29)" fill="none" stroke-linecap="round" stroke-width="4">
    <path d="M7 35h28" stroke="#6a737c"/>
    <path d="M10 27h22" stroke="#6a737c"/>
    <path d="M13 19l21 4" stroke="${STACK_OVERFLOW_ORANGE}"/>
    <path d="M16 11l20 8" stroke="${STACK_OVERFLOW_ORANGE}"/>
    <path d="M21 3l17 13" stroke="${STACK_OVERFLOW_ORANGE}"/>
  </g>
  <text x="92" y="37" fill="#232629" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif" font-size="17" font-weight="700">${label}</text>
  <text x="92" y="64" fill="${STACK_OVERFLOW_ORANGE}" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif" font-size="25" font-weight="800">${metric}</text>
</svg>
`;
}

async function fetchProfileHtml() {
  console.log(`Fetching Stack Overflow profile: ${PROFILE_URL}`);
  const response = await fetch(PROFILE_URL, {
    headers: {
      'User-Agent': 'github-readme-stackoverflow-impact-badge/1.0 (+https://github.com/) Node.js',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Stack Overflow responded with ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function main() {
  let impact = FALLBACK_IMPACT;

  try {
    const html = await fetchProfileHtml();
    const extractedImpact = extractPeopleReached(html);

    if (extractedImpact) {
      impact = extractedImpact;
      console.log(`Extracted people reached value: ${impact}`);
    } else {
      console.log(`Could not find people reached value. Falling back to ${FALLBACK_IMPACT}.`);
    }
  } catch (error) {
    console.log(`Unable to fetch or parse Stack Overflow profile. Falling back to ${FALLBACK_IMPACT}.`);
    console.log(`Reason: ${error.message}`);
  }

  const svg = generateBadge(impact);
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  if (fs.existsSync(OUTPUT_FILE)) {
    const currentSvg = fs.readFileSync(OUTPUT_FILE, 'utf8');
    if (currentSvg === svg) {
      console.log(`No changes needed for ${OUTPUT_FILE}.`);
      return;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, svg, 'utf8');
  console.log(`Updated ${OUTPUT_FILE} with impact value ${impact}.`);
}

main().catch((error) => {
  console.log(`Unexpected error while updating Stack Overflow badge: ${error.message}`);
  console.log(`Keeping workflow successful so the badge can be retried later.`);
});
