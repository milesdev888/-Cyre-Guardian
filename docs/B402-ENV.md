# B402 / BSC lane — Vercel env vars (values from owner — never commit secrets)

Lane is **dormant** until `X402_PAY_TO_BSC` is set. Base and Solana lanes unchanged.

## Required to arm the lane

| Env | Purpose |
|---|---|
| `X402_PAY_TO_BSC` | Merchant treasury `0x…` on BNB Chain (receives funds) |
| `X402_FACILITATOR_BSC` | Authenticated B402 `{BASE_URL}` from Binance onboarding (no trailing slash) |
| `B402_CLIENT_ID` | Partner `clientId` (alias: `B402_API_KEY`) |
| `B402_ACCESS_TOKEN` | Partner `accessToken` (alias: `B402_API_SECRET`) |
| `B402_RSA_PRIVATE_KEY` | Base64 PKCS#8 DER **or** PEM RSA private key used to sign `/papi/v2/b402/*` |
| `B402_SIGNER_ADDRESS` | Facilitator EOA from `POST /papi/v2/b402/supported` → `kinds[].extra.signerAddress` |
| `B402_SPENDER_ADDRESS` | Permit2 proxy from `/supported` → `kinds[].extra.spenderAddress` |

## Optional

| Env | Default | Purpose |
|---|---|---|
| `X402_NETWORK_BSC` | `mainnet` | `mainnet` → `eip155:56` · `testnet` → `eip155:97` |
| `X402_ASSET_BSC` | `USDT` | `USDT` or `USDC` (mainnet both 18 decimals) |
| `X402_ASSET_BSC_NAME` | from asset table | EIP-712 `extra.name` override |
| `X402_ASSET_BSC_VERSION` | from asset table | EIP-712 `extra.version` override |
| `X402_BSC_TRANSFER_METHOD` | `permit2-exact` | B402 `extra.assetTransferMethod` |

## Owner onboarding checklist

1. Apply Sandbox then Production: https://forms.gle/aUQvxUETfGMzyTky5  
2. Generate RSA key; submit public key + server IPs + receive wallet.  
3. Set the env vars above in Vercel (Production + Preview as needed).  
4. Call `/supported` once; copy `signerAddress` / `spenderAddress` into env (refresh if Binance rotates).  
5. Confirm `$0.005` offers show BSC `amount` as `5000000000000000` (18-decimal) in the 402 `accepts[]`.

See `docs/B402-RESEARCH.md` for full Part 1 research.
