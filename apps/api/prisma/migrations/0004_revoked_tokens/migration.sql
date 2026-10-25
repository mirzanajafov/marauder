CREATE TABLE "revoked_tokens" (
    "jti" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("jti")
);
