import { useEffect, useState } from 'react';

/** Secondes restantes avant `deadline` (heure du serveur), recalculées quatre fois par seconde. */
export function useSecondsLeft(deadline: number | null, offset: number): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (deadline == null) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (deadline == null) return null;
  return Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000));
}

/** Copie un texte dans le presse-papiers. Retourne false si le navigateur refuse. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
