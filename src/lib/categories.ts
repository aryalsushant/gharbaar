/**
 * What a cost can be, and who it lands on.
 *
 * The important distinction is `perApartment`. Food is shared by everyone
 * regardless of which flat they sleep in, so a Costco run splits six ways. An
 * electricity bill arrives for one flat and has nothing to do with the four
 * people who do not live there, so it splits among that flat's residents only.
 *
 * Getting that wrong is the kind of error nobody notices for a month and then
 * everybody argues about, so the form refuses to save a bill until an apartment
 * is chosen rather than quietly defaulting to the whole house.
 */
export type Category = {
  key: string;
  label: string;
  /** Split within one flat rather than across the house. */
  perApartment: boolean;
  /** Shown in the description field, so people name it rather than leaving it blank. */
  placeholder: string;
};

export const CATEGORIES: Category[] = [
  { key: 'grocery', label: 'Groceries', perApartment: false, placeholder: 'Costco, Sams, H Mart' },
  { key: 'electricity', label: 'Electricity', perApartment: true, placeholder: 'August bill' },
  { key: 'internet', label: 'Internet', perApartment: true, placeholder: 'August bill' },
  { key: 'misc', label: 'Miscellaneous', perApartment: false, placeholder: 'What was it for' },
];

export const APARTMENTS = ['D', 'F7'] as const;

export function categoryOf(key: string | null): Category | undefined {
  return CATEGORIES.find((c) => c.key === key);
}

export function categoryLabel(key: string | null): string {
  return categoryOf(key)?.label ?? 'Expense';
}
