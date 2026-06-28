import { sendEmail } from '../notifications/emailService';
import { __setSecret, __clearSecrets } from './mocks/ff-params';

const MESSAGE = {
  to: 'a@example.com',
  from: 'no-reply@example.com',
  subject: 'Hi',
  text: 'Body',
};

const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

afterEach(() => {
  __clearSecrets();
  warnSpy.mockClear();
});

afterAll(() => {
  warnSpy.mockRestore();
});

describe('sendEmail — graceful degradation', () => {
  it('skips when SENDGRID_API_KEY is not configured', async () => {
    const result = await sendEmail(MESSAGE);
    expect(result.status).toBe('skipped');
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('sendEmail — configured', () => {
  it('reports sent on a 2xx response', async () => {
    __setSecret('SENDGRID_API_KEY', 'sg-key');
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Response stub
      .mockResolvedValue({ ok: true, status: 202 } as any);

    const result = await sendEmail(MESSAGE);
    expect(result.status).toBe('sent');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({ method: 'POST' }),
    );
    fetchSpy.mockRestore();
  });

  it('reports error on a non-2xx response', async () => {
    __setSecret('SENDGRID_API_KEY', 'sg-key');
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal Response stub
      .mockResolvedValue({ ok: false, status: 500 } as any);

    const result = await sendEmail(MESSAGE);
    expect(result).toEqual({ status: 'error', reason: 'SendGrid responded 500' });
    fetchSpy.mockRestore();
  });
});
