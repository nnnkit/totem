const BASE_HUES = [210, 230, 250, 270, 290, 320, 340, 180, 160, 195];
const ANGLES = [135, 150, 210, 225, 315, 330];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 1) | 0;
    const x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };
}

export function generateGradient(seed: string): string {
  const hash = simpleHash(seed);
  const rand = seededRandom(hash);

  const baseHue = BASE_HUES[Math.floor(rand() * BASE_HUES.length)];
  const hue2 = (baseHue + 25 + Math.floor(rand() * 6)) % 360;
  const angle = ANGLES[Math.floor(rand() * ANGLES.length)];
  const useThreeStops = rand() < 0.3;

  const sat = (s: number) => 20 + Math.floor(s * 25);
  const lit = (l: number) => 10 + Math.floor(l * 16);

  const c1 = `hsl(${baseHue}, ${sat(rand())}%, ${lit(rand())}%)`;
  const c2 = `hsl(${hue2}, ${sat(rand())}%, ${lit(rand())}%)`;

  if (useThreeStops) {
    const hue3 = (baseHue + 50 + Math.floor(rand() * 10)) % 360;
    const c3 = `hsl(${hue3}, ${sat(rand())}%, ${lit(rand())}%)`;
    return `linear-gradient(${angle}deg, ${c1}, ${c2}, ${c3})`;
  }

  return `linear-gradient(${angle}deg, ${c1}, ${c2})`;
}
