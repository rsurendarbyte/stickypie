"use client";

// Shopper address book (customer_addresses), read and written with the
// shopper's own session — RLS keeps every list private to its owner.
import { useCallback, useEffect, useState } from "react";
import { authClient } from "./shopper-auth";

export const ADDRESS_TYPES = ["Home", "Work", "Other"] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export type SavedAddress = {
  id: string;
  label: AddressType;
  name: string;
  phone: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

export type AddressInput = Omit<SavedAddress, "id" | "isDefault">;

/** Keeps the book tidy; the least recently used extra addresses drop off. */
const MAX_ADDRESSES = 10;

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromRow(r: any): SavedAddress {
  return {
    id: r.id,
    label: (ADDRESS_TYPES as readonly string[]).includes(r.label) ? r.label : "Home",
    name: r.name,
    phone: r.phone,
    address1: r.address1,
    address2: r.address2 ?? null,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    isDefault: Boolean(r.is_default),
  };
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Same place, same recipient → treated as one saved address (type aside). */
export function sameAddress(a: AddressInput, b: AddressInput): boolean {
  return (
    a.pincode === b.pincode &&
    a.phone === b.phone &&
    norm(a.name) === norm(b.name) &&
    norm(a.address1) === norm(b.address1) &&
    norm(a.address2) === norm(b.address2)
  );
}

export async function listAddresses(): Promise<SavedAddress[]> {
  const c = authClient();
  if (!c) return [];
  const { data, error } = await c
    .from("customer_addresses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("last_used_at", { ascending: false });
  if (error) throw new Error("Could not load your saved addresses.");
  return (data ?? []).map(fromRow);
}

/**
 * Remembers an address after an order: an existing match just moves to the
 * top, a new one is added (the first ever becomes the default).
 */
export async function rememberAddress(input: AddressInput): Promise<void> {
  const c = authClient();
  if (!c) return;
  const existing = await listAddresses();
  const match = existing.find((a) => sameAddress(a, input));
  const now = new Date().toISOString();
  if (match) {
    await c
      .from("customer_addresses")
      .update({ label: input.label, city: input.city, state: input.state, last_used_at: now })
      .eq("id", match.id);
    return;
  }
  await c.from("customer_addresses").insert({
    label: input.label,
    name: input.name,
    phone: input.phone,
    address1: input.address1,
    address2: input.address2,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
    is_default: existing.length === 0,
    last_used_at: now,
  });
  const extras = existing.filter((a) => !a.isDefault).slice(MAX_ADDRESSES - 2);
  if (extras.length > 0) {
    await c.from("customer_addresses").delete().in("id", extras.map((a) => a.id));
  }
}

/** Adds an address from the account page (a duplicate just refreshes the existing one). */
export async function addAddress(input: AddressInput, makeDefault: boolean): Promise<void> {
  await rememberAddress(input);
  if (makeDefault) {
    const match = (await listAddresses()).find((a) => sameAddress(a, input));
    if (match && !match.isDefault) await setDefaultAddress(match.id);
  }
}

export async function setDefaultAddress(id: string): Promise<void> {
  const c = authClient();
  if (!c) return;
  // One default per shopper (unique index): clear the old one first.
  await c.from("customer_addresses").update({ is_default: false }).eq("is_default", true);
  const { error } = await c.from("customer_addresses").update({ is_default: true }).eq("id", id);
  if (error) throw new Error("Could not change your default address.");
}

export async function deleteAddress(id: string): Promise<void> {
  const c = authClient();
  if (!c) return;
  const { error } = await c.from("customer_addresses").delete().eq("id", id);
  if (error) throw new Error("Could not delete the address.");
  // Deleted the default → the most recently used one takes over.
  const rest = await listAddresses();
  if (rest.length > 0 && !rest.some((a) => a.isDefault)) {
    await c.from("customer_addresses").update({ is_default: true }).eq("id", rest[0].id);
  }
}

/** The signed-in shopper's addresses (empty for guests). */
export function useSavedAddresses(userKey: string | null) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!userKey) {
      setAddresses([]);
      setLoaded(true);
      return;
    }
    try {
      setAddresses(await listAddresses());
    } catch {
      setAddresses([]);
    } finally {
      setLoaded(true);
    }
  }, [userKey]);

  useEffect(() => {
    setLoaded(false);
    refresh();
  }, [refresh]);

  return { addresses, loaded, refresh };
}

/** One-line summary for cards: "12 MG Road, Indiranagar, Bengaluru 560038". */
export function addressLine(a: Pick<SavedAddress, "address1" | "address2" | "city" | "pincode">): string {
  return [a.address1, a.address2, `${a.city} ${a.pincode}`].filter(Boolean).join(", ");
}
