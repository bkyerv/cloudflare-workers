export async function readFrom(cache, path) {
  const data = await cache.get(path);
  return JSON.parse(data);
}

export const writeTo = async (cache, path, data) => {
  await cache.put(path, JSON.stringify(data));
};
