// Maps an exercise name to its demo media under public/media/<slug>/.
// GIFs load only when the exercise is on screen; the service worker caches each on first view.

const PREFIX: Record<string, string> = {
  "Incline DB press": "incline-db-press",
  "Lat pulldown": "lat-pulldown",
  "Cable lateral raise": "cable-lateral-raise",
  "Seated cable chest press": "seated-cable-chest-press",
  "Face pull": "face-pull",
  "Cable fly high-to-low": "cable-fly-high-to-low",
  "Overhead rope triceps extension": "overhead-rope-triceps-extension",
  "Triceps pushdown": "triceps-pushdown",
  "Dead bug": "dead-bug",
  "Front plank": "front-plank",
  "Kneeling cable crunch": "kneeling-cable-crunch",
  "Chest-supported DB row": "chest-supported-db-row",
  "Standing DB calf raise": "standing-db-calf-raise",
  "Seated cable row": "seated-cable-row",
  "Incline DB curl": "incline-db-curl",
  "Hammer curl": "hammer-curl",
  "Hollow hold": "hollow-hold",
  "Side plank": "side-plank",
  "DB Romanian deadlift": "db-romanian-deadlift",
  "Pallof press": "pallof-press",
  "Leg extension": "leg-extension",
  "Seated leg curl": "seated-leg-curl",
  "Hip thrust": "hip-thrust",
  "Reverse crunch": "reverse-crunch",
  "Flat DB press": "flat-db-press",
  "Single-arm cable row": "single-arm-cable-row",
  "Seated DB shoulder press": "seated-db-shoulder-press",
  "Neutral-grip lat pulldown": "neutral-grip-lat-pulldown",
  "Reverse cable fly": "reverse-cable-fly",
  "Cable curl": "cable-curl",
  "Rope pushdown": "rope-pushdown",
  "Cable woodchop": "cable-woodchop",
  "DB curl": "db-curl",
  "DB skull crusher": "db-skull-crusher",
  "Barbell box squat": "barbell-box-squat",
  "Band lying leg curl": "band-lying-leg-curl",
  "Cable pull-through": "cable-pull-through",
  "Seated calf raise": "seated-calf-raise",
};

const STARTS: [string, string][] = [
  ["Incline walk", "incline-treadmill-walk"],
  ["Bodyweight box", "barbell-box-squat"],
];

/** Slugs with a still frame but no GIF. */
const STILL_ONLY = new Set(["incline-treadmill-walk"]);

const ILLUSTRATED: Record<string, string> = {
  "Arm circles": "arm-circles",
  "Wall slides": "wall-slides",
  "Doorway pec stretch": "doorway-pec-stretch",
  "Triceps stretch behind the head": "triceps-stretch-behind-the-head",
  "Chest opener, hands clasped behind": "chest-opener-hands-clasped-behind",
  "Scapular squeezes": "scapular-squeezes",
  "Lat stretch, arm overhead": "lat-stretch-arm-overhead",
  "Biceps stretch, arm on a wall": "biceps-stretch-arm-on-a-wall",
  "Leg swings, front to back": "leg-swings-front-to-back",
  "Bodyweight squat primer": "bodyweight-squat-primer",
  "Glute bridges, easy": "glute-bridges-easy",
  "Hip flexor stretch, half kneel": "hip-flexor-stretch-half-kneel",
  "Hamstring stretch, one leg long": "hamstring-stretch-one-leg-long",
  "Calf stretch on a step": "calf-stretch-on-a-step",
  "Joint circles, easy range": "joint-circles-easy-range",
  "Easy march in place": "easy-march-in-place",
};

export interface Media {
  slug: string;
  /** Animated GIF, or the still when there is none. */
  src: string;
  /** Still frame: thumbnails, and the fallback if the GIF fails. */
  still: string;
  animated: boolean;
  illustration: boolean;
}

export function slugFor(name: string): string | undefined {
  for (const [p, slug] of STARTS) if (name.startsWith(p)) return slug;
  const n = name.replace(/,/g, "");
  let best = "";
  let slug: string | undefined;
  for (const [p, s] of Object.entries(PREFIX)) if (n.startsWith(p) && p.length > best.length) [best, slug] = [p, s];
  return slug;
}

export function mediaFor(name: string): Media | undefined {
  const slug = slugFor(name);
  if (slug) {
    const still = `./media/${slug}/01.jpg`;
    const animated = !STILL_ONLY.has(slug);
    return { slug, still, src: animated ? `./media/${slug}/demo.gif` : still, animated, illustration: false };
  }
  const ill = ILLUSTRATED[name];
  if (ill) {
    const src = `./media/${ill}/placeholder.svg`;
    return { slug: ill, src, still: src, animated: false, illustration: true };
  }
  return undefined;
}
