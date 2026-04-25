"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { createLinkToken, exchangePublicToken } from "@/actions/plaid";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    async function fetchToken() {
      setLoading(true);
      const result = await createLinkToken();
      if ("error" in result) {
        setError(result.error);
      } else {
        setLinkToken(result.link_token);
      }
      setLoading(false);
    }
    fetchToken();
  }, []);

  const handleSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } | null }) => {
      setExchanging(true);
      const result = await exchangePublicToken(
        publicToken,
        metadata.institution?.institution_id ?? null,
        metadata.institution?.name ?? null,
      );
      setExchanging(false);

      if ("error" in result) {
        setError(result.error);
      } else {
        onSuccess?.();
      }
    },
    [onSuccess],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handleSuccess,
  });

  if (loading) {
    return (
      <Button disabled>
        Loading Plaid...
      </Button>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (exchanging) {
    return (
      <Button disabled>
        Connecting...
      </Button>
    );
  }

  return (
    <Button onClick={() => open()} disabled={!ready}>
      Connect Bank Account
    </Button>
  );
}
