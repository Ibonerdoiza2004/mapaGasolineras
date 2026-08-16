import { useEffect, useState } from 'react';

import { apiUrl } from '../config/runtime';

type Status = 'loading' | 'success' | 'error';

export default function HelloApi() {
	const [status, setStatus] = useState<Status>('loading');
	const [message, setMessage] = useState('');

	useEffect(() => {
		let cancelled = false;

		async function loadMessage() {
			try {
				const response = await fetch(apiUrl('/api/hello'));
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				const text = await response.text();
				if (!cancelled) {
					setMessage(text);
					setStatus('success');
				}
			} catch {
				if (!cancelled) {
					setStatus('error');
				}
			}
		}

		void loadMessage();

		return () => {
			cancelled = true;
		};
	}, []);

	if (status === 'loading') {
		return <p className="api-status__loading" role="status">Conectando con el backend…</p>;
	}

	if (status === 'error') {
		return <p className="api-status__error" role="alert">No se pudo conectar con el backend.</p>;
	}

	return <p className="api-status__success" role="status">Mensaje del backend: {message}</p>;
}
