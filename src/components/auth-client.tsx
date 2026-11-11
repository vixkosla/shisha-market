"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { Button } from "./ui/button";
import Link from "next/link";
import { legalHeaders } from "@/lib/legal";
import { safeLoginReturn } from "@/lib/login-return";
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
export function LoginForm({ vk, local, returnTo = "/account" }: { vk: boolean; local: boolean; returnTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [terms, setTerms] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adult, setAdult] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [verifyAt, setVerifyAt] = useState(0);
  const [verifyRemaining, setVerifyRemaining] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (sent) codeInput.current?.focus();
  }, [sent]);
  useEffect(() => {
    if (!resendAt && !verifyAt) return;
    const timer = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
      setVerifyRemaining(Math.max(0, Math.ceil((verifyAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt, verifyAt]);
  function cooldown(seconds = 60) {
    const duration = Number.isFinite(seconds) && seconds > 0 ? Math.min(3600, Math.ceil(seconds)) : 60;
    setResendAt(Date.now() + duration * 1000);
    setRemaining(duration);
  }
  async function sendCode() {
    let retryAfter = 60;
    const result = await authClient.emailOtp.sendVerificationOtp(
      { email: email.trim(), type: "sign-in" },
      { headers: legalHeaders, onError: ({response}) => {
        retryAfter = Number(response.headers.get("retry-after") ?? response.headers.get("x-retry-after") ?? 60);
      } },
    );
    if (result.error) {
      if (result.error.status === 429) cooldown(retryAfter);
      setError(result.error.status === 429
        ? "Слишком частые запросы. Дождитесь окончания отсчёта и попробуйте снова."
        : "Не удалось отправить код. Проверьте адрес и повторите позже.");
    } else {
      setSent(true);
      setOtp("");
      cooldown();
      codeInput.current?.focus();
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!terms || !processing || !adult) {
      setError(
        "Примите условия, отдельно дайте согласие на обработку данных и подтвердите возраст.",
      );
      return;
    }
    setPending(true);
    try {
      if (!sent) {
        await sendCode();
        return;
      }
      let retryAfter = 60;
      const result = await authClient.signIn.emailOtp(
            { email: email.trim(), otp },
            { headers: legalHeaders, onError: ({response}) => {
              retryAfter = Number(response.headers.get("retry-after") ?? response.headers.get("x-retry-after") ?? 60);
            } },
          );
      if (result.error?.status === 429) {
        const duration = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(3600, Math.ceil(retryAfter)) : 60;
        setVerifyAt(Date.now() + duration * 1000);
        setVerifyRemaining(duration);
      }
      if (result.error)
        setError(
          result.error.status === 503
            ? "Не удалось сохранить вход. Запросите новый код и повторите позже."
            : result.error.status === 429
              ? "Слишком много попыток. Дождитесь окончания отсчёта и повторите вход с тем же кодом, если он ещё действует."
              : "Код неверный или истёк. Проверьте шесть цифр или запросите новый код.",
        );
      else {
        router.replace(safeLoginReturn(returnTo));
        router.refresh();
      }
    } catch {
      setError("Не удалось связаться с сервером.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="form-stack">
      <form onSubmit={submit} className="form-stack" aria-busy={pending}>
        <p className="muted small" aria-live="polite">{sent ? "Шаг 2 из 2 · Подтвердите почту" : "Шаг 1 из 2 · Укажите почту"}</p>
        <label>
          Электронная почта
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={sent}
            required
            maxLength={254}
          />
        </label>
        {sent && <>
          <p role="status" className="notice">Код отправлен на {email.trim()}. Он действует 5 минут. Если письма нет, проверьте «Спам».</p>
          <label>
            Код из письма
            <input
              name="otp"
              ref={codeInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onPaste={(event) => {event.preventDefault(); setOtp(event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6));}}
              required
            />
          </label>
        </>}
        <div className="form-stack" hidden={sent} style={sent ? {display: "none"} : undefined}>
        <label className="check-label">
          <input
            type="checkbox"
            checked={adult}
            onChange={(event) => setAdult(event.target.checked)}
            required
          />
          <span>Мне исполнилось 18 лет.</span>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            required
          />
          <span>
            Принимаю{" "}
            <Link href="/legal/terms" target="_blank" rel="noopener">
              пользовательское соглашение
            </Link>{" "}
            и{" "}
            <Link href="/legal/rules" target="_blank" rel="noopener">
              правила публикации
            </Link>
            .
          </span>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={processing}
            onChange={(event) => setProcessing(event.target.checked)}
            required
          />
          <span>
            Даю отдельное{" "}
            <Link href="/legal/consent" target="_blank" rel="noopener">
              согласие на обработку данных
            </Link>{" "}
            для регистрации и входа; ознакомлен с{" "}
            <Link href="/legal/privacy" target="_blank" rel="noopener">
              политикой
            </Link>
            . Это не согласие на рекламу или публикацию контактов.
          </span>
        </label>
        </div>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <Button disabled={pending || (sent ? verifyRemaining > 0 : remaining > 0)}>
          {pending ? "Подождите…" : sent ? verifyRemaining ? `Повторить вход через ${verifyRemaining} с` : "Войти" : remaining ? `Повторить через ${remaining} с` : "Получить код"}
        </Button>
        {sent && (
          <>
          <Button type="button" variant="outline" disabled={pending || remaining > 0} onClick={async () => {
            setError(""); setPending(true);
            try { await sendCode(); } catch { setError("Не удалось связаться с сервером."); } finally { setPending(false); }
          }}>{remaining ? `Отправить снова через ${remaining} с` : "Отправить код ещё раз"}</Button>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setSent(false);
              setOtp("");
              setError("");
              setResendAt(0);
              setRemaining(0);
              setVerifyAt(0);
              setVerifyRemaining(0);
            }}
          >
            Изменить почту
          </Button>
          </>
        )}
      </form>
      {local && (
        <p className="notice">
          Локальная разработка: письма не отправляются. Код появится в терминале
          запущенного сервера.
        </p>
      )}
      {vk ? (
        <Button
          variant="outline"
          onClick={async () => {
            const result = await authClient.signIn.social({
              provider: "vk",
              callbackURL: safeLoginReturn(returnTo),
            });
            if (result.error) setError("Вход через ВК временно недоступен.");
          }}
        >
          Войти через ВКонтакте
        </Button>
      ) : (
        <p className="muted small">
          Для входа достаточно почты. Подключать ВКонтакте не нужно.
        </p>
      )}
    </div>
  );
}
export function SignOut() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Выйти
    </Button>
  );
}
