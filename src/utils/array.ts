/** Pushes `id` unless the list already holds it. */
export const addUnique = (list: string[], id: string) => {
  if (!list.includes(id)) list.push(id);
};
