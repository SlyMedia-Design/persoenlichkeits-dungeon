export type Dictionary = { [key: string]: string | string[] | Dictionary };

export type Translator = {
  (key: string, vars?: Record<string, string | number>): string;
  list(key: string): string[];
};

function lookup(dict: Dictionary, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && !Array.isArray(node)) return (node as Dictionary)[part];
    return undefined;
  }, dict);
}

/** Textzugriff per Punkt-Pfad, Platzhalter als {name}. Fehlende Texte werden sichtbar als [key]. */
export function createTranslator(dict: Dictionary): Translator {
  const t = ((key: string, vars?: Record<string, string | number>) => {
    const value = lookup(dict, key);
    if (typeof value !== 'string') return `[${key}]`;
    if (!vars) return value;
    return value.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  }) as Translator;
  t.list = (key: string) => {
    const value = lookup(dict, key);
    return Array.isArray(value) ? value : [`[${key}]`];
  };
  return t;
}
