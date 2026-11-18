export const defaultPreferences = Object.freeze({ name: 'Tom', paper: 'cloud', accent: 'blue', compact: false, showTemplates: true, glassOpacity: 62, reduceTransparency: false, reduceMotion: false });
export const accentColors = Object.freeze({ coral: '#b64e3c', green: '#28775f', blue: '#296bdc', purple: '#7656c7' });
export function normalizePreferences(value) {
  const input = value && typeof value === 'object' ? value : {};
  const result = { ...defaultPreferences };
  if (typeof input.name === 'string') result.name = input.name.slice(0, 24);
  if (['cloud', 'warm'].includes(input.paper)) result.paper = input.paper;
  if (Object.hasOwn(accentColors, input.accent)) result.accent = input.accent;
  for (const key of ['compact', 'showTemplates', 'reduceTransparency', 'reduceMotion']) if (typeof input[key] === 'boolean') result[key] = input[key];
  if (typeof input.glassOpacity === 'number' && Number.isFinite(input.glassOpacity)) result.glassOpacity = Math.min(90, Math.max(45, input.glassOpacity));
  return result;
}
