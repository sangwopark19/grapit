import { describe, expect, it } from 'vitest';

import marketingConsentMd from '../marketing-consent.md?raw';
import privacyPolicyMd from '../privacy-policy.md?raw';
import termsOfServiceMd from '../terms-of-service.md?raw';

const legalDocuments = {
  'terms-of-service.md': termsOfServiceMd,
  'privacy-policy.md': privacyPolicyMd,
  'marketing-consent.md': marketingConsentMd,
};

const placeholderPatterns = [
  /\[사업자명:/,
  /\[대표자명:/,
  /\[사업자등록번호:/,
  /\[통신판매업 신고번호:/,
  /\[주소:/,
  /\[전화번호:/,
  /\[보호책임자 실명:/,
  /\[직책:/,
  /\[시행일:/,
  /\[직전 시행일:/,
  /000-00-00000/,
  /0000-서울/,
  /000-0000-0000/,
  /YYYY-MM-DD/,
];

describe('legal content', () => {
  it.each(Object.entries(legalDocuments))(
    '%s does not expose launch placeholder values',
    (_filename, content) => {
      for (const pattern of placeholderPatterns) {
        expect(content).not.toMatch(pattern);
      }
    },
  );

  it('uses the supplied business identity in terms of service', () => {
    expect(termsOfServiceMd).toContain('사업자명: (주)아이콘스');
    expect(termsOfServiceMd).toContain('대표자명: 정승준');
    expect(termsOfServiceMd).toContain('사업자등록번호: 109-86-27576');
    expect(termsOfServiceMd).toContain('통신판매업 신고번호: 2025-서울마포-1494');
    expect(termsOfServiceMd).toContain('사업장 주소: 서울특별시 마포구 월드컵로8길 69');
    expect(termsOfServiceMd).toContain('고객센터 전화번호: 02-325-179');
  });

  it('uses the launch effective date across legal documents', () => {
    for (const content of Object.values(legalDocuments)) {
      expect(content).toContain('2026-04-28');
    }
  });
});
