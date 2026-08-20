const site = ((import.meta.env.PUBLIC_SITE_URL as string | undefined) ?? 'https://example.com').replace(
	/\/$/,
	'',
);

export const GET = () =>
	new Response(
		`User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap-index.xml\n`,
		{ headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
	);