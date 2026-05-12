/**
 * VietQR image URL (img.vietqr.io) — quét bằng app ngân hàng VN.
 * @see https://www.vietqr.io/
 */

const BANK_RULES: { test: RegExp; bin: string }[] = [
    { test: /vietcombank|\bvcb\b|ngoại thương việt nam|vietcom/i, bin: "970436" },
    { test: /techcombank|\btcb\b/i, bin: "970407" },
    { test: /\bbidv\b|đầu tư và phát triển/i, bin: "970418" },
    { test: /vietinbank|vietin|\bctg\b|công thương/i, bin: "970415" },
    { test: /\bacb\b|á châu/i, bin: "970416" },
    { test: /mbbank|\bmb\b|quân đội|military/i, bin: "970422" },
    { test: /tpbank|tiên phong/i, bin: "970423" },
    { test: /vpbank|việt nam thịnh vượng/i, bin: "970432" },
    { test: /sacombank|sacom/i, bin: "970403" },
    { test: /\bmsb\b|hàng hải/i, bin: "970426" },
    { test: /shb|sài gòn\s*-\s*hà nội/i, bin: "970443" },
    { test: /vib|quốc tế/i, bin: "970441" },
    { test: /hdbank|phát triển tp\.?\s*hcm|hdb/i, bin: "970437" },
    { test: /ocb|phương đông/i, bin: "970448" },
    { test: /seabank|đông nam á/i, bin: "970440" },
    { test: /eximbank|xuất nhập khẩu/i, bin: "970431" },
    { test: /pvcombank|đại chúng/i, bin: "970412" },
    { test: /nam á|nab/i, bin: "970428" },
    { test: /baoviet bank|baoviet/i, bin: "970438" },
    { test: /lienvietpost|lpbank|bưu điện/i, bin: "970449" },
    { test: /kienlongbank|kiên long|klb/i, bin: "970452" },
    { test: /vietbank|việt nam thương tín/i, bin: "970433" },
    { test: /abbank|an bình/i, bin: "970425" },
    { test: /scb|sài gòn/i, bin: "970429" },
    { test: /woori|woori bank/i, bin: "970457" },
    { test: /standard chartered/i, bin: "970410" },
    { test: /hsbc/i, bin: "458761" },
    { test: /cimb|cimb bank/i, bin: "422589" },
];

export function resolveVietQrBankBin(bankName: string): string | null {
    const n = (bankName || "").trim().toLowerCase();
    if (!n) return null;
    for (const { test, bin } of BANK_RULES) {
        if (test.test(n)) return bin;
    }
    return null;
}

/** Chỉ giữ chữ số cho số tài khoản VietQR */
export function normalizeVietQrAccountNo(raw: string): string {
    return (raw || "").replace(/\D/g, "");
}

const MAX_ADD_INFO_LEN = 50;

export interface VietQrImageParams {
    bankBin: string;
    accountNumber: string;
    amount: number;
    accountName: string;
    addInfo?: string;
}

/**
 * URL ảnh QR động (template compact2).
 */
export function buildVietQrImageUrl(p: VietQrImageParams): string {
    const acct = normalizeVietQrAccountNo(p.accountNumber);
    const base = `https://img.vietqr.io/image/${p.bankBin}-${acct}-compact2.png`;
    const q = new URLSearchParams();
    if (p.amount > 0) q.set("amount", String(Math.round(p.amount)));
    const info = (p.addInfo || "").trim().slice(0, MAX_ADD_INFO_LEN);
    if (info) q.set("addInfo", info);
    const name = (p.accountName || "").trim();
    if (name) q.set("accountName", name);
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
}
