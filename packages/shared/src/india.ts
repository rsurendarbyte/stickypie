// Indian states & union territories for delivery addresses, plus a matcher
// for the older/alternate names India Post's PIN lookup still returns.

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

const key = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

const ALIASES: Record<string, IndianState> = {
  pondicherry: "Puducherry",
  chattisgarh: "Chhattisgarh",
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  newdelhi: "Delhi",
  nctofdelhi: "Delhi",
  dadraandnagarhaveli: "Dadra and Nagar Haveli and Daman and Diu",
  damananddiu: "Dadra and Nagar Haveli and Daman and Diu",
  andamanandnicobar: "Andaman and Nicobar Islands",
};

const BY_KEY = new Map<string, IndianState>(INDIAN_STATES.map((s) => [key(s), s]));

/** Maps any spelling ("Pondicherry", "TAMIL NADU", "Andaman & Nicobar") to the list entry. */
export function matchIndianState(name: string | null | undefined): IndianState | null {
  if (!name) return null;
  const k = key(name);
  return BY_KEY.get(k) ?? ALIASES[k] ?? null;
}
