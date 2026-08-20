import http from 'node:http';
import sharp from 'sharp';

const UPSTREAM = 'https://tile.openstreetmap.org';
const UA = 'AhorraRepostando-tile-proxy/1.0 (contacto: hola@ahorrarepostando.es)';
const MAX_ENTRIES = 5000;
const PORT = Number(process.env.PORT ?? 8080);

const cache = new Map();

async function serveTile(z, x, y) {
	const key = `${z}/${x}/${y}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const url = `${UPSTREAM}/${key}.png`;
	const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/png' } });
	if (!res.ok) throw new Error(`upstream ${res.status}`);
	const webp = await sharp(Buffer.from(await res.arrayBuffer())).webp({ quality: 72 }).toBuffer();
	if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
	cache.set(key, webp);
	return webp;
}

http.createServer(async (req, res) => {
	const match = req.url?.match(/^\/(\d+)\/(\d+)\/(\d+)(?:\.(?:png|webp|avif))?$/);
	if (!match) {
		res.writeHead(404).end('not found');
		return;
	}
	const [, z, x, y] = match.map(Number);
	try {
		const img = await serveTile(z, x, y);
		res.writeHead(200, {
			'Content-Type': 'image/webp',
			'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=604800',
			'Access-Control-Allow-Origin': '*',
		});
		res.end(img);
	} catch {
		res.writeHead(502).end('upstream error');
	}
}).listen(PORT, () => console.log(`tile proxy on :${PORT}`));