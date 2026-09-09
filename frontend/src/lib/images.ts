/**
 * Themed dummy images (no API key needed), served from the Unsplash CDN
 * (reliable + permanent) and pravatar for faces. A stable hash keeps the same
 * entity on the same photo across renders. Swap for a real CDN later.
 */
const HOTEL_PHOTOS = [
  "1566073771259-6a8506099945",
  "1542314831-068cd1dbfeeb",
  "1551882547-ff40c63fe5fa",
  "1520250497591-112f2f40a3f4",
  "1571896349842-33c89424de2d",
  "1564501049412-61c2a3083791",
  "1582719478250-c89cae4dc85b",
  "1611892440504-42a792e24d32",
  "1445019980597-93fa8acb246c",
  "1455587734955-081b22074882",
  "1578683010236-d716f9a3f461",
  "1631049307264-da0ec9d70304",
]

const CITY_PHOTOS: Record<string, string> = {
  dubai: "1512453979798-5ea266f8880c",
  paris: "1502602898657-3e91760cbb34",
  tokyo: "1540959733332-eab4deabeeaf",
  newyork: "1496442226666-8d4d0e62e6e9",
  maldives: "1514282401047-d79a71a590e8",
  santorini: "1570077188670-e3a8d69ac5ff",
  bali: "1537953773345-d172ccf13cf1",
  borabora: "1589197331516-4d84b72ebde3",
}
const CITY_POOL = Object.values(CITY_PHOTOS)

function hash(seed: string | number) {
  const s = String(seed)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function unsplash(id: string, width: number, height: number) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&h=${height}&q=70`
}

export function hotelImage(seed: string | number, width = 600, height = 400) {
  return unsplash(HOTEL_PHOTOS[hash(seed) % HOTEL_PHOTOS.length], width, height)
}

export function destinationImage(name: string, width = 400, height = 500) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "")
  const id = CITY_PHOTOS[key] ?? CITY_POOL[hash(name) % CITY_POOL.length]
  return unsplash(id, width, height)
}

export function avatarImage(seed: string | number, size = 128) {
  return `https://i.pravatar.cc/${size}?u=${encodeURIComponent(String(seed))}`
}

/** Backwards-compatible default — used in hotel contexts across the app. */
export function placeholderImage(seed: string | number, width = 600, height = 400) {
  return hotelImage(seed, width, height)
}
