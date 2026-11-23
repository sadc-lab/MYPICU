// Axes partagés par les graphiques temporels (vue d'autorégulation, outil d'étude).

import { format } from "date-fns";
import { dateLocale } from "@/i18n";

// Axe du temps commun aux trois graphiques : graduations sur des heures rondes
// (pas choisi pour ~6 repères), et la date dès que l'enregistrement couvre
// plusieurs jours — sinon un « 08:00 » apparaît plusieurs fois sans repère.
export function timeAxis(t0: number, t1: number) {
  const MIN = 60_000;
  const span = Math.max(t1 - t0, 15 * MIN);
  const stepMin = [15, 30, 60, 120, 180, 360, 720, 1440, 2880].find((m) => span / (m * MIN) <= 7) ?? 2880;
  // Premier repère : premier multiple du pas (en heure locale) à partir de t0.
  let t = new Date(t0).setSeconds(0, 0);
  const minuteOfDay = (v: number) => {
    const d = new Date(v);
    return d.getHours() * 60 + d.getMinutes();
  };
  while (t < t0 || minuteOfDay(t) % Math.min(stepMin, 1440) !== 0) t += MIN;
  const ticks: number[] = [];
  for (; t <= t1; t += stepMin * MIN) ticks.push(t);
  const multiDay = new Date(t0).toDateString() !== new Date(t1).toDateString();
  const formatTick = (v: number) => {
    const d = new Date(v);
    if (!multiDay) return format(d, "HH:mm", { locale: dateLocale() });
    return minuteOfDay(v) === 0 ? format(d, "dd/MM", { locale: dateLocale() }) : format(d, "dd/MM HH:mm", { locale: dateLocale() });
  };
  return { domain: [t0, t1] as [number, number], ticks, formatTick };
}

// Échelle Y « ronde » : bornes et graduations sur un pas de 1, 2, 2,5 ou 5 × 10ⁿ.
export function niceScale(min: number, max: number, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 100] as [number, number], ticks: [0, 25, 50, 75, 100] };
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { domain: [lo, hi] as [number, number], ticks };
}


/** Props d'axe X temporel calculés sur les points réellement affichés. */
export function timeAxisFor<T>(points: T[], getTime: (p: T) => number) {
  const ax = timeAxis(points.length ? getTime(points[0]) : Date.now(), points.length ? getTime(points[points.length - 1]) : Date.now());
  return { domain: ax.domain, ticks: ax.ticks, tickFormatter: ax.formatTick };
}
