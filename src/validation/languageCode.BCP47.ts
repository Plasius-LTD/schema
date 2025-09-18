/* eslint-disable @typescript-eslint/consistent-type-assertions */

/**
 * ISO 639-1 language codes (two-letter).
 * Tip: Keep this list as source of truth for supported languages in your app.
 */
export enum IsoLanguageCode {
  Afar = "aa",
  Abkhazian = "ab",
  Afrikaans = "af",
  Akan = "ak",
  Albanian = "sq",
  Amharic = "am",
  Arabic = "ar",
  Aragonese = "an",
  Armenian = "hy",
  Assamese = "as",
  Avaric = "av",
  Aymara = "ay",
  Azerbaijani = "az",
  Bashkir = "ba",
  Bambara = "bm",
  Basque = "eu",
  Belarusian = "be",
  Bengali = "bn",
  Bislama = "bi",
  Bosnian = "bs",
  Breton = "br",
  Bulgarian = "bg",
  Burmese = "my",
  Catalan = "ca",
  Chamorro = "ch",
  Chechen = "ce",
  Chinese = "zh",
  ChurchSlavic = "cu",
  Chuvash = "cv",
  Cornish = "kw",
  Corsican = "co",
  Cree = "cr",
  Croatian = "hr",
  Czech = "cs",
  Danish = "da",
  Divehi = "dv",
  Dutch = "nl",
  Dzongkha = "dz",
  English = "en",
  Esperanto = "eo",
  Estonian = "et",
  Ewe = "ee",
  Faroese = "fo",
  Fijian = "fj",
  Finnish = "fi",
  French = "fr",
  WesternFrisian = "fy",
  Fulah = "ff",
  Gaelic = "gd",
  Galician = "gl",
  Ganda = "lg",
  Georgian = "ka",
  German = "de",
  Greek = "el",
  Kalaallisut = "kl",
  Guarani = "gn",
  Gujarati = "gu",
  Haitian = "ht",
  Hausa = "ha",
  Hebrew = "he",
  Herero = "hz",
  Hindi = "hi",
  HiriMotu = "ho",
  Hungarian = "hu",
  Icelandic = "is",
  Ido = "io",
  Igbo = "ig",
  Indonesian = "id",
  Interlingua = "ia",
  Interlingue = "ie",
  Inuktitut = "iu",
  Inupiaq = "ik",
  Irish = "ga",
  Italian = "it",
  Japanese = "ja",
  Javanese = "jv",
  Kannada = "kn",
  Kanuri = "kr",
  Kashmiri = "ks",
  Kazakh = "kk",
  CentralKhmer = "km",
  Kikuyu = "ki",
  Kinyarwanda = "rw",
  Kyrgyz = "ky",
  Komi = "kv",
  Kongo = "kg",
  Korean = "ko",
  Kuanyama = "kj",
  Kurdish = "ku",
  Lao = "lo",
  Latin = "la",
  Latvian = "lv",
  Limburgan = "li",
  Lingala = "ln",
  Lithuanian = "lt",
  LubaKatanga = "lu",
  Luxembourgish = "lb",
  Macedonian = "mk",
  Malagasy = "mg",
  Malay = "ms",
  Malayalam = "ml",
  Maltese = "mt",
  Manx = "gv",
  Maori = "mi",
  Marathi = "mr",
  Marshallese = "mh",
  Mongolian = "mn",
  Nauru = "na",
  Navajo = "nv",
  NorthNdebele = "nd",
  SouthNdebele = "nr",
  Ndonga = "ng",
  Nepali = "ne",
  Norwegian = "no",
  NorwegianBokmal = "nb",
  NorwegianNynorsk = "nn",
  SichuanYi = "ii",
  Occitan = "oc",
  Ojibwa = "oj",
  Oriya = "or",
  Oromo = "om",
  Ossetian = "os",
  Pali = "pi",
  Pashto = "ps",
  Persian = "fa",
  Polish = "pl",
  Portuguese = "pt",
  Punjabi = "pa",
  Quechua = "qu",
  Romansh = "rm",
  Romanian = "ro",
  Rundi = "rn",
  Russian = "ru",
  Samoan = "sm",
  Sango = "sg",
  Sanskrit = "sa",
  Sardinian = "sc",
  Serbian = "sr",
  Shona = "sn",
  Sindhi = "sd",
  Sinhala = "si",
  Slovak = "sk",
  Slovenian = "sl",
  Somali = "so",
  SouthernSotho = "st",
  Spanish = "es",
  Sundanese = "su",
  Swahili = "sw",
  Swati = "ss",
  Swedish = "sv",
  Tagalog = "tl",
  Tahitian = "ty",
  Tajik = "tg",
  Tamil = "ta",
  Tatar = "tt",
  Telugu = "te",
  Thai = "th",
  Tibetan = "bo",
  Tigrinya = "ti",
  Tonga = "to",
  Tsonga = "ts",
  Tswana = "tn",
  Turkish = "tr",
  Turkmen = "tk",
  Twi = "tw",
  Uighur = "ug",
  Ukrainian = "uk",
  Urdu = "ur",
  Uzbek = "uz",
  Venda = "ve",
  Vietnamese = "vi",
  Volapuk = "vo",
  Walloon = "wa",
  Welsh = "cy",
  Wolof = "wo",
  Xhosa = "xh",
  Yiddish = "yi",
  Yoruba = "yo",
  Zhuang = "za",
  Zulu = "zu",
}

/** Fast lookup set for enum values (lowercase 2-letter codes). */
const ISO_LANGUAGE_SET: ReadonlySet<string> = new Set<string>(
  Object.values(IsoLanguageCode)
);

/** Type guard: primary language must be one of the enum values. */
export function isIsoLanguageCode(value: unknown): value is IsoLanguageCode {
  return typeof value === "string" && ISO_LANGUAGE_SET.has(value.toLowerCase());
}

/**
 * Region validator per BCP 47:
 * - ISO 3166-1 alpha-2: 2 uppercase letters (e.g., GB, US)
 * - UN M.49 numeric: 3 digits (e.g., 419 for Latin America)
 *
 * NOTE: This validates *shape* not membership against the 3166 list.
 * If you want hard membership, we can add a Set of all alpha-2 regions.
 */
export function isRegionSubtag(value: string): boolean {
  return /^[A-Z]{2}$/.test(value) || /^\d{3}$/.test(value);
}

/** Script subtag per ISO 15924: one capital + three lowercase (e.g., Latn, Cyrl, Hans). */
export function isScriptSubtag(value: string): boolean {
  return /^[A-Z][a-z]{3}$/.test(value);
}

/** Variant subtag per BCP 47: 5–8 alnum, or 4 starting with a digit. */
export function isVariantSubtag(value: string): boolean {
  return /^([0-9][A-Za-z0-9]{3}|[A-Za-z0-9]{5,8})$/.test(value);
}

/** Extension sequence: singleton (alnum except 'x') + one or more 2–8 alnum subtags. */
export function isExtensionSingleton(value: string): boolean {
  return /^[0-9A-WY-Za-wy-z]$/.test(value); // any alnum except 'x' (private-use)
}
export function isExtensionSubtag(value: string): boolean {
  return /^[A-Za-z0-9]{2,8}$/.test(value);
}

/** Private-use subtag: 'x' then one or more 1–8 alnum subtags. */
export function isPrivateUseSingleton(value: string): boolean {
  return value.toLowerCase() === "x";
}
export function isPrivateUseSubtag(value: string): boolean {
  return /^[A-Za-z0-9]{1,8}$/.test(value);
}

/**
 * Validates:
 *  - plain language: "en"
 *  - language + region: "en-GB"
 *  - language + script + region: "sr-Cyrl-RS"
 *  - language + variants: "sl-rozaj-biske", "de-CH-1996"
 *  - extensions: "en-GB-u-ca-gregory"
 *  - private-use: "en-x-klingon" or just "x-piglatin"
 *
 * Returns true only if the primary language is in IsoLanguageCode
 * and the rest of the tag conforms to BCP 47 structure.
 */
export function validateLanguage(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0) return false;

  const parts = value.split("-");
  let i = 0;

  // 1) primary language (must be enum member; we use lowercase for comparison)
  const lang = parts[i];
  if (!lang || !isIsoLanguageCode(lang)) return false;
  i += 1;

  // 2) optional script
  if (i < parts.length && isScriptSubtag(parts[i] as string)) {
    i += 1;
  }

  // 3) optional region
  if (i < parts.length && isRegionSubtag((parts[i] as string).toUpperCase())) {
    // region must be uppercase if alpha; we normalize for check only
    i += 1;
  }

  // 4) zero or more variants
  while (i < parts.length && isVariantSubtag((parts[i] as string))) {
    i += 1;
  }

  // 5) zero or more extensions
  //    extension = singleton ; 2–8 ; ( ; 2–8 )*
  while (i < parts.length && isExtensionSingleton((parts[i] as string))) {
    i += 1;
    // must have at least one following subtag of length 2–8
    if (!(i < parts.length && isExtensionSubtag(parts[i]!))) return false;
    while (i < parts.length && isExtensionSubtag(parts[i]!)) {
      i += 1;
    }
  }

  // 6) optional private-use: 'x' 1*('-' (1*8alnum))
  if (i < parts.length && isPrivateUseSingleton(parts[i]!)) {
    i += 1;
    if (!(i < parts.length && isPrivateUseSubtag(parts[i]!))) return false;
    while (i < parts.length && isPrivateUseSubtag(parts[i]!)) {
      i += 1;
    }
  }

  // no leftovers
  return i === parts.length;
}
