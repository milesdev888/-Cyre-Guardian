# Milestone 0 — Zama fhEVM feasibility

**Date:** 2026-09-11 (UTC)  
**Repo:** `milesdev888/-Cyre-Guardian`  
**Scope:** Answer the three founder questions with current primary sources and a real Hardhat compile/deploy attempt. No Cyre contracts or application code were added.

**Method:** Official Zama docs (`docs.zama.org`) + npm registry versions + a throwaway clone of [zama-ai/fhevm-hardhat-template](https://github.com/zama-ai/fhevm-hardhat-template) at `ec84e1aa1b0a3ef61d9795ef8bf367115b79272f` (2026-05-04). All compile/deploy work stayed under `/tmp` and is **not** in this repository. A local throwaway wallet was generated for the Sepolia attempt; no `.env` or keys are committed.

---

## Q1. Where is Zama fhEVM deployed and usable right now?

**Yes — a public testnet path exists today.** Zama’s protocol is not its own L1. It is a coprocessor/gateway stack that runs confidential contracts on an existing host chain.

Official Hardhat docs (2026-09-11):

> Zama Testnet is not a blockchain itself. It is a protocol that enables you to run confidential smart contracts on existing blockchains … Currently, Zama Protocol is available on the Sepolia Testnet.

Source: [Deploy contracts and run tests](https://docs.zama.org/protocol/solidity-guides/development-guide/hardhat/run_test)

### Usable public testnet (verified)

| Item | Value | Evidence |
| --- | --- | --- |
| Host chain | **Ethereum Sepolia** | Docs + live `eth_chainId` |
| Host chain ID | `11155111` (`0xaa36a7`) | [Chains](https://docs.zama.org/protocol/protocol-apps/chains); RPC check 2026-09-11 |
| Host RPC used in this check | `https://ethereum-sepolia-rpc.publicnode.com` | Documented as a host RPC in [@zama-fhe/relayer-sdk initialization](https://github.com/zama-ai/relayer-sdk/blob/main/docs/initialization.md). Official Hardhat template defaults to `https://sepolia.infura.io/v3/${INFURA_API_KEY}` |
| Gateway chain | **Zama Gateway Testnet** | [Chains](https://docs.zama.org/protocol/protocol-apps/chains) |
| Gateway chain ID | `10901` (`0x2a95`) | Docs + live `eth_chainId` on gateway RPC |
| Gateway RPC | `https://rpc.testnet.zama.org` | [Chains](https://docs.zama.org/protocol/protocol-apps/chains); live `eth_chainId` = `0x2a95` |
| Relayer | `https://relayer.testnet.zama.org` | [Contract addresses](https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses); GET `/` returned HTTP 404 `no Route matched` (API host is up; root is not a page) |
| Faucet | `https://faucet.testnet.zama.org/` | Live HTTP 200. Dispenses **Sepolia $ZAMA**, not Sepolia ETH |
| $ZAMA token (Sepolia) | `0xa798B04149e7a61cc95B7D114AD420e8969eA268` | [Sepolia addresses](https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia); live bytecode **8342 bytes** |

Sepolia host FHEVM contracts from [Contract addresses](https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses), each with live bytecode on Sepolia (2026-09-11, PublicNode + Tenderly RPC). 170-byte code is consistent with an EIP-1967 proxy stub:

| Contract | Address | Live bytecode |
| --- | --- | --- |
| ACL | `0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D` | 170 bytes |
| FHEVM Executor / Coprocessor | `0x92C920834Ec8941d2C77D188936E1f7A6f49c127` | 170 bytes |
| KMS Verifier | `0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A` | 170 bytes |
| HCU Limit | `0xa10998783c8CF88D886Bc30307e631D6686F0A22` | 170 bytes |
| Input Verifier | `0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0` | 170 bytes |

The same ACL / executor / KMS addresses are baked into `@fhevm/solidity@0.11.1` `ZamaConfig._getSepoliaConfig()` and `@zama-fhe/relayer-sdk@0.4.1` `SepoliaConfig` (installed from the official template). Relayer SDK also lists:

- `verifyingContractAddressDecryption`: `0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478`
- `verifyingContractAddressInputVerification`: `0x483b9dE06E4E4C7D35CCf5837A1668487406D955`
- `gatewayChainId`: `10901`

Zama already publishes **pre-deployed confidential wrappers** on Sepolia (for example `cUSDCMock` at `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639`, live proxy bytecode 170 bytes). Source: [Sepolia addresses](https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia).

### SDK / library versions (npm, 2026-09-11)

Do not treat “the SDK” as one package. Zama currently ships a new client SDK and a Hardhat/Solidity stack:

| Package | Role | Latest on npm (this check) | What the official Hardhat template actually installed |
| --- | --- | --- | --- |
| `@zama-fhe/sdk` | Current default TypeScript SDK | **3.5.1** (published 2026-08-27; registry modified 2026-09-09) | Not used by the Hardhat template |
| `@zama-fhe/relayer-sdk` | Legacy relayer SDK | **0.4.4** | **0.4.1** |
| `@fhevm/solidity` | Solidity FHE library | **0.13.3** | **0.11.1** |
| `@fhevm/hardhat-plugin` | Hardhat plugin | **0.4.2** | **0.4.2** |
| `@openzeppelin/confidential-contracts` | Audited ERC7984 library | **0.5.3** | **0.5.3** (peer: `@fhevm/solidity@0.11.1`) |
| `hardhat` | Tooling | — | **2.28.6** |

Sources:

- [SDK overview](https://docs.zama.org/protocol/sdk) — `@zama-fhe/sdk` is the new default; `@zama-fhe/relayer-sdk` is legacy
- [SDK configuration / chain presets](https://docs.zama.org/protocol/sdk/guides/configuration) — `sepolia` (`11155111`) needs **no relayer API key**
- [OpenZeppelin confidential contracts setup](https://docs.zama.org/protocol/examples/openzeppelin-confidential-contracts/openzeppelin)
- npm: `npm view <pkg> version` on 2026-09-11

Mainnet host addresses are also published ([Contract addresses](https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses); [SDK configuration](https://docs.zama.org/protocol/sdk/guides/configuration) lists `mainnet` / `polygon`). The official Hardhat “real encryption” path, and this check, use **Sepolia**. The client SDK also lists other test presets (`polygonAmoy`, `hoodi`, `ingenTestnet`, `bscTestnet`); those were **not** treated as substitutes for the documented Sepolia host.

**Q1 conclusion:** Public testnet support is live on Ethereum Sepolia + Zama Gateway Testnet. Stop-if-no-testnet does not apply.

---

## Q2. Can a fresh Hardhat project compile and deploy the example encrypted ERC-20?

**Compile: yes** (using the current official ERC7984 example).  
**Deploy: blocked by missing Sepolia ETH.** The network accepted a live `eth_estimateGas`; the send failed with `insufficient funds` (`have 0`).

### What was run

Outside this repo, following [Library installation and overview](https://docs.zama.org/protocol/examples/openzeppelin-confidential-contracts/openzeppelin) and [ERC7984 Standard](https://docs.zama.org/protocol/examples/openzeppelin-confidential-contracts/erc7984):

```bash
git clone https://github.com/zama-ai/fhevm-hardhat-template
cd fhevm-hardhat-template
npm ci
npm i @openzeppelin/confidential-contracts
# place official ERC7984Example.sol in contracts/
npm run compile
```

Environment: Node `v22.14.0`, npm `10.9.7`. Installed `@openzeppelin/confidential-contracts@0.5.3` (peer `@fhevm/solidity@0.11.1`, `@openzeppelin/contracts@5.6.1`).

### Compile — stale import (older docs page)

The older example page [erc7984 (v0.10)](https://docs.zama.org/protocol/solidity-guides/v0.10/docs/examples/openzeppelin/erc7984.md) still shows:

```solidity
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984.sol";
```

That path is **not** in `@openzeppelin/confidential-contracts@0.5.3` (actual file: `token/ERC7984/ERC7984.sol`). Compile failed:

```
> fhevm-hardhat-template@0.4.1 compile
> cross-env TS_NODE_TRANSPILE_ONLY=true hardhat compile

Error HH404: File @openzeppelin/confidential-contracts/token/ERC7984.sol, imported from contracts/ERC7984Example.sol, not found.

For more info go to https://v2.hardhat.org/HH404 or run Hardhat with --show-stack-traces
```

### Compile — current official example (success)

The current page [ERC7984 Standard](https://docs.zama.org/protocol/examples/openzeppelin-confidential-contracts/erc7984) uses the published import and `pragma solidity ^0.8.27`. That source was copied verbatim into `contracts/ERC7984Example.sol` in the throwaway template.

```
> fhevm-hardhat-template@0.4.1 compile
> cross-env TS_NODE_TRANSPILE_ONLY=true hardhat compile

Downloading compiler 0.8.27
Generating typings for: 21 artifacts in dir: types for target: ethers-v6
Successfully generated 78 typings!
Compiled 19 Solidity files successfully (evm target: cancun).

> fhevm-hardhat-template@0.4.1 postcompile
> npm run typechain


> fhevm-hardhat-template@0.4.1 typechain
> cross-env TS_NODE_TRANSPILE_ONLY=true hardhat typechain
```

Artifact sizes from `artifacts/contracts/ERC7984Example.sol/ERC7984Example.json`:

- creation bytecode: **11,947 bytes**
- deployed bytecode: **8,229 bytes**

Template `FHECounter` (for comparison): creation 2,872 bytes, deployed 2,227 bytes.

### Deploy attempt (Sepolia, real network)

Throwaway deployer (local only, not committed): `0x98612156Ee84D26eF165375f93cE7Eb2D6F6a262`  
RPC: `https://ethereum-sepolia-rpc.publicnode.com`  
Constructor args from the official example: `(owner, 1000, "Confidential Token", "CTKN", "https://example.com/token")`

`npx hardhat run scripts/deploy-erc7984.ts --network sepolia` (script only existed in `/tmp`; it called `eth_estimateGas` then skipped the send when balance was 0):

```
Compiled 3 Solidity files successfully (evm target: cancun).
network 11155111
deployer 0x98612156Ee84D26eF165375f93cE7Eb2D6F6a262
balance_wei 0
gasPrice_wei 1081378252
maxFeePerGas_wei 2184408630
estimateGas_units 2830956
estimated_cost_wei 6183964717550280
estimated_cost_eth 0.00618396471755028
DEPLOY_SKIPPED_UNFUNDED
```

Official template command `npx hardhat deploy --network sepolia` (deploys `FHECounter`, not ERC7984) then **did** submit and failed on funding:

```
deploying "FHECounter"insufficient funds for intrinsic transaction cost
ProviderError: insufficient funds for gas * price + value: have 0 want 1068908043296655
...
Error: ERROR processing /tmp/zama-m0/fhevm-hardhat-template/deploy/deploy.ts:
Error: insufficient funds for intrinsic transaction cost
```

`want 1068908043296655` wei ≈ **0.001069 ETH** for the template counter deploy.

Faucet attempts from this environment:

- `https://faucet.testnet.zama.org/` is a GitHub-gated JS app (page: “JavaScript is required to use this faucet”). Unauthenticated `POST /api/claim` → HTTP 404.
- Google Cloud Sepolia faucet is an interactive login page (HTTP 200 HTML).
- Public Sepolia ETH faucets checked (Alchemy, Chainstack, pk910) require captcha, account login, and/or a mainnet ETH balance. None could be claimed from this agent environment.

**Q2 conclusion:** The official encrypted ERC-20 example **compiles** on a fresh Hardhat template. Sepolia **accepts a deploy estimate** (the host FHEVM contracts are reachable). A broadcast deploy **did not succeed here** because the throwaway account had 0 Sepolia ETH, and the Zama faucet does not give ETH.

---

## Q3. What does it cost in testnet gas, and is the faucet sufficient?

### Measured on Sepolia (2026-09-11)

These are **live `eth_estimateGas` / fee-data readings**, not documentation guesses. No transaction was mined, so there is **no `gasUsed` receipt**.

| Contract | `estimateGas` (units) | Fee basis used | Estimated cost |
| --- | --- | --- | --- |
| `ERC7984Example` (official confidential token) | **2,830,956** | `maxFeePerGas` = 2,184,408,630 wei (~2.18 gwei) | **0.006184 ETH** (6,183,964,717,550,280 wei) |
| `FHECounter` (template default) | **740,007** | same fee oracle (script used current `maxFeePerGas`) | **0.001602 ETH** |
| `FHECounter` official `hardhat deploy` | (send attempted) | node quoted `want 1068908043296655` wei | **0.001069 ETH** intrinsic (lower than the max-fee estimate; typical) |

Spot `eth_gasPrice` on PublicNode during the check: `0x441619d6` = 1,144,068,566 wei (~1.14 gwei). Sepolia fees move; treat the ETH amounts as **that-hour estimates**.

Constructor `FHE.asEuint64(1000)` + `_mint` is a **cleartext initial mint**. It does not consume Sepolia $ZAMA. $ZAMA is charged later for:

- Input proof verification: **1 Sepolia $ZAMA**
- Decryption (public or user): **0.1 Sepolia $ZAMA**

Source: [https://faucet.testnet.zama.org/](https://faucet.testnet.zama.org/) (scraped 2026-09-11).

Zama docs also note confidential operations cost more gas than clear ERC-20s ([ERC7984 Standard](https://docs.zama.org/protocol/examples/openzeppelin-confidential-contracts/erc7984)) but do not publish a fixed deploy-gas number. No doc figure was substituted for the measurements above.

### Is the faucet sufficient?

**For FHE operations after a funded deploy: yes, for a feasibility exercise.** Daily limit is **75 Sepolia $ZAMA per GitHub account** (~75 input proofs). That is enough to mint/transfer/decrypt a handful of confidential ERC-20 calls.

**For the deploy itself: no.** The Zama faucet **does not dispense Sepolia ETH**. Hardhat’s Sepolia mode “requires Sepolia ETH” ([run tests](https://docs.zama.org/protocol/solidity-guides/development-guide/hardhat/run_test)). At the measured fees, one ERC7984 example deploy needs on the order of **~0.006–0.01 ETH** of Sepolia ETH (estimate plus headroom). That has to come from a third-party Sepolia ETH faucet (Alchemy, Infura, Google Cloud, Chainstack, etc.). Those faucets were not usable from this environment (login / captcha / mainnet-balance gates).

So: **$ZAMA faucet is sufficient for protocol fees once the contract is on-chain; it is not sufficient to get the contract on-chain.**

---

## Bottom line for Cyre

1. **Public testnet is real and reachable** — Ethereum Sepolia host + Gateway `10901` + relayer `https://relayer.testnet.zama.org`, with live host contracts and published confidential wrappers.
2. **Official Hardhat + ERC7984 example compiles** on `@fhevm/solidity@0.11.1` + `@openzeppelin/confidential-contracts@0.5.3`. Watch the import path (`token/ERC7984/ERC7984.sol`). Latest `@fhevm/solidity` on npm is `0.13.3`; the audited OZ library still peers `0.11.1`.
3. **Deploy gas is modest on Sepolia (~0.006 ETH estimated for the example token)** but **this check could not broadcast** without Sepolia ETH. Plan on a human-claimed Sepolia ETH faucet **plus** the GitHub $ZAMA faucet.

---

## Primary sources

- https://docs.zama.org/protocol/solidity-guides/development-guide/hardhat/run_test
- https://docs.zama.org/protocol/protocol-apps/chains
- https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses
- https://docs.zama.org/protocol/solidity-guides/smart-contract/configure
- https://docs.zama.org/protocol/examples/openzeppelin-confidential-contracts/openzeppelin
- https://docs.zama.org/protocol/examples/openzeppelin-confidential-contracts/erc7984
- https://docs.zama.org/protocol/solidity-guides/v0.10/docs/examples/openzeppelin/erc7984.md (stale import path)
- https://docs.zama.org/protocol/sdk
- https://docs.zama.org/protocol/sdk/guides/configuration
- https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia
- https://docs.zama.org/protocol/protocol-apps/zama-token
- https://faucet.testnet.zama.org/
- https://github.com/zama-ai/fhevm-hardhat-template
- https://github.com/zama-ai/relayer-sdk/blob/main/docs/initialization.md
- npm: `@zama-fhe/sdk`, `@zama-fhe/relayer-sdk`, `@fhevm/solidity`, `@fhevm/hardhat-plugin`, `@openzeppelin/confidential-contracts`
