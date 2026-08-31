// api/_peers.test.js — XRPL peer detection (no network)
import { detectNetwork, xrplHandoffBody, peers } from '../lib/peers.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

const SOLANA = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const BASE = '0x9Ff25C4acf1DcDDf15fD2702C127A285f1dFa712';
const XRPL_R = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH';

assert(detectNetwork(SOLANA) === null, 'solana must not match');
assert(detectNetwork(BASE) === null, 'base treasury must not match');
assert(detectNetwork({ address: SOLANA }) === null, 'solana field');
assert(detectNetwork({ address: BASE }) === null, 'base field');
assert(detectNetwork({ payTo: BASE }) === null, 'payTo base');

assert(detectNetwork(XRPL_R) === 'xrpl', 'classic r-address');
assert(detectNetwork({ address: XRPL_R }) === 'xrpl', 'address=r…');
assert(detectNetwork({ network: 'xrpl' }) === 'xrpl', 'network=xrpl');
assert(detectNetwork({ network: 'xrpl:mainnet' }) === 'xrpl', 'network=xrpl:mainnet');
assert(detectNetwork({ network: 'xrpl:testnet' }) === 'xrpl', 'network=xrpl:testnet');
assert(detectNetwork({ currency: 'XRP' }) === 'xrpl', 'currency XRP');
assert(detectNetwork({ currency: 'RLUSD' }) === 'xrpl', 'currency RLUSD');
assert(detectNetwork('rlusd route') === 'xrpl', 'text rlusd');
assert(detectNetwork('xrpl ledger') === 'xrpl', 'text xrpl');
assert(detectNetwork({ query: { q: 'ripple' }, body: {} }) === 'xrpl', 'req-like q=ripple');

const body = xrplHandoffBody();
assert(body.ok === false && body.unsupported_network === 'xrpl', 'handoff shape');
assert(body.peer.name === peers.xrpl.name, 'peer name');
assert(body.peer.agentCard.includes('cloudpayxagent.xyz'), 'agent card url');
assert(!JSON.stringify(body).toLowerCase().includes('partner'), 'no partner wording');

console.log('ok peers detectNetwork + handoff');
