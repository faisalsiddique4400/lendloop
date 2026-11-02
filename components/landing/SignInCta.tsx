"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function SignInCta({ size }: { size?: "sm" | "lg" }) {
  const variant = size === "lg" ? "primary" : undefined;
  return (
    <>
      <AuthLoading>
        <Button variant={variant} size={size} disabled>
          Sign in to borrow
        </Button>
      </AuthLoading>
      <Unauthenticated>
        <SignInButton mode="modal" forceRedirectUrl="/tools">
          <Button variant={variant} size={size}>
            Sign in to borrow
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
