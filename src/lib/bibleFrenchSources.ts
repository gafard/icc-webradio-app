export type FrenchTranslationFormat = 'thiagobodruk-json' | 'osis-xml';

export type FrenchTranslation = {
  id: string;
  label: string;
  format: FrenchTranslationFormat;
  url: string;
  sourceLabel?: string;
};

export const FRENCH_TRANSLATIONS: FrenchTranslation[] = [
  {
    id: 'fr_apee',
    label: "Bible de l'Épée (APEe)",
    format: 'thiagobodruk-json',
    url: 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/fr_apee.json',
    sourceLabel: 'thiagobodruk/bible',
  },
  {
    id: 'fra_ostervald',
    label: 'Bible Ostervald',
    format: 'osis-xml',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/fra-ostervald.osis.xml',
    sourceLabel: 'open-bibles',
  },
];
