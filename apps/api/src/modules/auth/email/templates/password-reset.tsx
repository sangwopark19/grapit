import { Html, Head, Body, Container, Heading, Text, Button, Hr, Section } from '@react-email/components';

interface PasswordResetEmailProps {
  resetLink: string;
}

/**
 * PasswordResetEmail — React Email template for Grabit password reset flow.
 * Phase 9 DEBT-01: replaces the console.log stub in auth.service.ts.
 *
 * Resend SDK accepts the JSX element via `react` param (no render() call).
 */
export function PasswordResetEmail({ resetLink }: PasswordResetEmailProps) {
  return (
    <Html lang="ko">
      <Head />
      <Body style={{ backgroundColor: '#f5f5f7', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', padding: '32px', maxWidth: '560px' }}>
          <Heading style={{ fontSize: '20px', color: '#1A1A2E' }}>비밀번호 재설정 안내</Heading>
          <Text style={{ fontSize: '14px', color: '#4A4A5E' }}>
            아래 버튼을 눌러 비밀번호를 재설정해주세요. 이 링크는 1시간 동안만 유효합니다.
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button
              href={resetLink}
              style={{
                backgroundColor: '#6C3CE0',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '6px',
              }}
            >
              비밀번호 재설정
            </Button>
          </Section>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#6B6B7B' }}>
            본 메일을 요청하지 않으셨다면 무시하셔도 됩니다.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
