import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loginByQR } from '../src/lib/bili-login';

function parseCookie(cookie: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const part of cookie.split(';')) {
		const [k, v] = part.trim().split('=');
		if (k && v) result[k] = v;
	}
	return result;
}

async function main() {
	try {
		const cookie = await loginByQR();
		const map = parseCookie(cookie);

		const lines = [
			`BILI_DEDE_USER_ID=${map.DedeUserID ?? ''}`,
			`BILI_DEDE_USER_ID_CKMD5=${map.DedeUserID__ckMd5 ?? ''}`,
			`BILI_SESSDATA=${map.SESSDATA ?? ''}`,
			`BILI_JCT=${map.bili_jct ?? ''}`,
		];

		const envPath = resolve(import.meta.dirname, '..', '.env');
		writeFileSync(envPath, lines.join('\n') + '\n');
		console.log(`✓ Cookie 已写入 .env`);
	} catch (err) {
		console.error('登录失败:', err);
		process.exit(1);
	}
}

main();
