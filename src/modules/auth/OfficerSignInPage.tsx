import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { signInOfficer, verifyOfficerCode } from "@/data/api";
import { useSessionMutation } from "@/data/queries";
import { ApiError } from "@/data/types";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { InlineError } from "@/components/States";
import { isOnline, OFFLINE_MESSAGE } from "@/lib/online";
import { AuthCover, DevHint, authLink } from "./AuthCover";

export function OfficerSignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const start = useMutation({
    mutationFn: () => {
      if (!isOnline()) throw new ApiError(OFFLINE_MESSAGE, "offline");
      return signInOfficer(email, password);
    },
  });
  const verify = useSessionMutation(verifyOfficerCode);

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    start.mutate();
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    verify.mutate([code], { onSuccess: () => navigate("/admin", { replace: true }) });
  }

  return (
    <>
      <AuthCover
        title="Officer Sign-In"
        subtitle="For the Director, Financial Secretary and Treasurer."
      />
      {!start.data ? (
        <form onSubmit={submitPassword} className="flex flex-col gap-4" noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <InlineError error={start.error} />
          <Button
            type="submit"
            block
            loading={start.isPending}
            disabled={!email.trim() || !password}
            className="mt-2"
          >
            Continue
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="anim-push flex flex-col gap-4" noValidate>
          {start.data.setup ? (
            <div className="flex flex-col gap-3 rounded-[0.75rem] bg-cell p-4 text-subhead">
              <p className="flex items-start gap-3">
                <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-tint-text" />
                <span>
                  First time here: install <strong>Google Authenticator</strong> (or any
                  authenticator app), tap <strong>+</strong>, and scan this code.
                </span>
              </p>
              <img
                src={start.data.setup.qrCode}
                alt="Code to scan with your authenticator app"
                className="mx-auto size-48 rounded-[0.5rem] bg-white p-2"
              />
              <p className="text-footnote text-label-2">
                Can't scan? Choose "Enter a setup key" in the app and type:{" "}
                <span className="tnum font-mono break-all text-label select-all">
                  {start.data.setup.secret}
                </span>
              </p>
              <p>Then enter the 6-digit code the app shows.</p>
            </div>
          ) : (
            <p className="flex items-start gap-3 rounded-[0.75rem] bg-cell p-4 text-subhead">
              <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-tint-text" />
              <span>
                Open your <strong>authenticator app</strong> and enter the 6-digit code for His
                Theatre.
              </span>
            </p>
          )}
          <TextField
            label="Verification code"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="tnum tracking-[0.3em]"
            autoFocus
          />
          <InlineError error={verify.error} />
          <Button
            type="submit"
            block
            loading={verify.isPending}
            disabled={code.length !== 6}
            className="mt-2"
          >
            Verify and Sign In
          </Button>
          <Button variant="plain" size="medium" onClick={() => start.reset()}>
            Use a Different Account
          </Button>
        </form>
      )}
      <div className="mt-6 flex justify-center">
        <Link to="/signin" className={authLink}>
          Member sign-in
        </Link>
      </div>
      <DevHint>
        <p>director@histheatre.org, finsec@histheatre.org or treasurer@histheatre.org</p>
        <p>Password Theatre2026, then code 246810.</p>
      </DevHint>
    </>
  );
}
