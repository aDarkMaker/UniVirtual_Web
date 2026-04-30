import qrcode from 'qrcode-terminal';

interface QRCodeGenerateResp {
	code: number;
	data: {
		url: string;
		qrcode_key: string;
	};
}

interface QRCodePollResp {
	code: number;
	data: {
		code: number;
		url?: string;
	};
}

const QR_GENERATE_URL = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate';
const QR_POLL_URL = 'https://passport.bilibili.com/x/passport-login/web/qrcode/poll';

async function generateQR(): Promise<{ url: string; qrcode_key: string }> {
	const res = await fetch(QR_GENERATE_URL, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		},
	});
	const json = (await res.json()) as QRCodeGenerateResp;
	if (json.code !== 0) throw new Error(`QR generate failed: code=${json.code}`);
	return json.data;
}

async function pollStatus(qrcode_key: string): Promise<QRCodePollResp['data']> {
	const res = await fetch(`${QR_POLL_URL}?qrcode_key=${qrcode_key}`, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
		},
	});
	const json = (await res.json()) as QRCodePollResp;
	if (json.code !== 0) throw new Error(`QR poll failed: code=${json.code}`);
	return json.data;
}

function extractCookie(loginUrl: string): string {
	const parsed = new URL(loginUrl);
	const params = parsed.searchParams;
	const fields = ['DedeUserID', 'DedeUserID__ckMd5', 'SESSDATA', 'bili_jct'];
	const parts: string[] = [];
	for (const name of fields) {
		const value = params.get(name);
		if (value) parts.push(`${name}=${value}`);
	}
	return parts.join('; ');
}

export async function loginByQR(): Promise<string> {
	const { url, qrcode_key } = await generateQR();

	return new Promise((resolve, reject) => {
		qrcode.generate(url, { small: true });
		console.log('请使用 Bilibili 客户端扫描二维码登录...\n');

		let expired = false;
		const interval = setInterval(async () => {
			try {
				if (expired) {
					clearInterval(interval);
					reject(new Error('QR code expired'));
					return;
				}

				const data = await pollStatus(qrcode_key);

				if (data.code === 86038) {
					expired = true;
					console.log('\n二维码已过期，请重新运行');
				} else if (data.code === 86090) {
					if (process.stdout.isTTY) {
						process.stdout.write('\r已扫描，请在手机上确认...   ');
					}
				} else if (data.code === 0 && data.url) {
					clearInterval(interval);
					console.log('\n✓ 扫码成功！');
					const cookie = extractCookie(data.url);
					resolve(cookie);
				}
			} catch (err) {
				clearInterval(interval);
				reject(err);
			}
		}, 2000);
	});
}
