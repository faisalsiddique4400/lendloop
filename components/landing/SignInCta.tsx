"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function SignInCta({ label, size }: { label: string; size?: "sm" | "lg" }) {
  const variant = size === "lg" ? "primary" : undefined;
  return (
    <>
      <AuthLoading>
        <Button variant={variant} size={size} disabled>
          {label}
        </Button>
      </AuthLoading>
      <Unauthenticated>
        <SignInButton mode="modal" forceRedirectUrl="/tools">
          <Button variant={variant} size={size}>
            {label}
          </Button>
        </SignInButton>
      </Unauthenticated>
      <Authenticated>
        <Link href="/tools" className={["btn", variant && `btn-${variant}`, size && `btn-${size}`].filter(Boolean).join(" ")}>
          Open LendLoop
        </Link>
      </Authenticated>
    </>
  );
}
