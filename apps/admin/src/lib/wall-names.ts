/** "King Kohli Wall Setup — 6 Mini Poster Pack" → "King Kohli". */
export const wallName = (name: string) => name.split(/ Wall Setup| — /)[0];

/** "King Kohli, Cricket Gods, Never Give Up and 3 more" */
export function wallList(names: string[]) {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

export const wallCount = (count: number) => `${count} wall${count === 1 ? "" : "s"}`;

/** Why a poster can't be deleted yet. */
export const onWallsMessage = (names: string[]) => `It's on ${wallCount(names.length)}: ${wallList(names)}. Take it off them first.`;
