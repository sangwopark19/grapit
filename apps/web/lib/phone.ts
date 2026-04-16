import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export interface PhoneLocale {
  isKorean: boolean;
  country: string | null;
  countryName: string | null;
  e164: string | null;
}

const COUNTRY_NAME_KO: Record<string, string> = {
  KR: '한국',
  TH: '태국',
  JP: '일본',
  US: '미국',
  VN: '베트남',
  HK: '홍콩',
  TW: '대만',
  SG: '싱가포르',
  PH: '필리핀',
  ID: '인도네시아',
  MY: '말레이시아',
  CN: '중국',
};

export function detectPhoneLocale(input: string): PhoneLocale {
  const cleaned = input.replace(/\s+/g, '');
  if (/^01[016789]\d{7,8}$/.test(cleaned.replace(/\D/g, ''))) {
    return { isKorean: true, country: 'KR', countryName: '한국', e164: null };
  }
  const withPlus = cleaned.startsWith('+')
    ? cleaned
    : cleaned.length > 0
      ? `+${cleaned}`
      : cleaned;
  const parsed = parsePhoneNumberFromString(withPlus);
  if (parsed?.isValid()) {
    const country = parsed.country ?? null;
    return {
      isKorean: country === 'KR',
      country,
      countryName: country ? (COUNTRY_NAME_KO[country] ?? null) : null,
      e164: parsed.format('E.164'),
    };
  }
  return { isKorean: false, country: null, countryName: null, e164: null };
}
