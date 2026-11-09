import { describe, expect, it } from 'vitest';
import { createInstance } from 'i18next';
import { en } from './en';
import { fr } from './fr';
import { frAwaitingNativeReview } from './frReview';

type Tree = { [key: string]: string | Tree };

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function leafKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : leafKeys(value, `${prefix}${key}.`)
  );
}

/** Every key the app can ask for, with plural keys collapsed to their base. */
const requestedKeys = [...new Set(leafKeys(en as Tree).map(key => key.replace(PLURAL_SUFFIX, '')))];
const pluralBases = new Set(
  leafKeys(en as Tree).filter(key => PLURAL_SUFFIX.test(key)).map(key => key.replace(PLURAL_SUFFIX, ''))
);

/** Looks every key up in French with no fallback language, and records what i18next reports missing. */
async function missingInFrench(): Promise<string[]> {
  const missing: string[] = [];
  const i18n = createInstance();
  await i18n.init({
    lng: 'fr',
    fallbackLng: false,
    resources: { fr: { translation: fr } },
    interpolation: { escapeValue: false },
    saveMissing: true,
    missingKeyHandler: (_lngs, _ns, key) => missing.push(key),
  });
  // Keys come from the English tree at runtime, so they are plain strings here.
  const t = i18n.t.bind(i18n) as (key: string, options?: { count: number }) => string;
  for (const key of requestedKeys) {
    if (pluralBases.has(key)) {
      // 1, 2 and a million cover French's one, other and many categories.
      for (const count of [1, 2, 1_000_000]) t(key, { count });
    } else {
      t(key);
    }
  }
  return missing;
}

function variables(text: string): string[] {
  return (text.match(/\{\{\s*\w+\s*\}\}/g) ?? []).map(token => token.replace(/[{}\s]/g, '')).sort();
}

function lookup(tree: Tree, key: string): string | undefined {
  const value = key.split('.').reduce<string | Tree | undefined>(
    (node, part) => (typeof node === 'object' ? node[part] : undefined),
    tree
  );
  return typeof value === 'string' ? value : undefined;
}

describe('French locale', () => {
  it('answers every key the English locale has, in every French plural form, without falling back', async () => {
    expect(await missingInFrench()).toEqual([]);
  });

  it('keeps every interpolated value the English string uses', () => {
    const mismatches = leafKeys(en as Tree)
      .map(key => ({ key, en: variables(lookup(en as Tree, key)!), fr: variables(lookup(fr as Tree, key) ?? '') }))
      .filter(({ en, fr }) => en.join() !== fr.join());
    expect(mismatches).toEqual([]);
  });

  it('translates every string rather than copying the English one', () => {
    // Words French spells the same way, and a URL pattern.
    const sameInBothLanguages = [
      'participants.title',
      'details.budget',
      'details.notes',
      'wishlist.notes',
      'previousDraw.linkPlaceholder',
    ];
    const copiedFromEnglish = leafKeys(en as Tree).filter(
      key => lookup(fr as Tree, key) === lookup(en as Tree, key) && !sameInBothLanguages.includes(key)
    );
    expect(copiedFromEnglish).toEqual([]);
  });

  it('marks machine-drafted strings for a native review with keys that exist in French', () => {
    const frKeys = leafKeys(fr as Tree);
    const unknown = frAwaitingNativeReview.filter(
      marked => !frKeys.some(key => key === marked || key.startsWith(`${marked}.`))
    );
    expect(frAwaitingNativeReview.length).toBeGreaterThan(0);
    expect(unknown).toEqual([]);
  });
});
