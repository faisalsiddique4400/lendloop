"use client";

import { SignInButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated, useMutation } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ToastProvider } from "@/components/ui/Toast";
import { api } from "@/convex/_generated/api";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <main className="wrap page">
          <ListSkeleton />
        </main>
      </AuthLoading>
      <Unauthenticated>
        <main className="wrap page">
          <EmptyState title="Sign in to see your neighbors' tools">
            <SignInButton mode="modal">
              <Button variant="primary">Sign in</Button>
            </SignInButton>
          </EmptyState>
        </main>
      </Unauthenticated>
      <Authenticated>
        <SignedIn>{children}</SignedIn>
      </Authenticated>
    </>
  );
}

function SignedIn({ children }: { children: ReactNode }) {
  const store = useMutation(api.users.store);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    store({}).then(() => setReady(true));
  }, [store]);

  if (!ready) {
    return (
      <main className="wrap page">
        <ListSkeleton />
      </main>
    );
  }
  return (
    <ToastProvider>
      <Nav />
      <main className="wrap page">{children}</main>
    </ToastProvider>
  );
}
