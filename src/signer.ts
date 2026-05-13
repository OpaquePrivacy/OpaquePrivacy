/**
 * Built-in signer implementations.
 *
 * Most agents will use `KeypairSigner` — a thin wrapper around a Solana
 * Ed25519 keypair living on the device. For agents that want to keep keys
 * in an enclave / KMS / hardware wallet, implement the `Signer` interface
 * yourself instead.
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import type { Signer } from "./types.js";

export class KeypairSigner implements Signer {
  readonly publicKey: string;
  private readonly secretKey: Uint8Array;

  constructor(secretKey: Uint8Array) {
    if (secretKey.length !== 64) {
      throw new Error("Ed25519 secret key must be 64 bytes (32 seed + 32 pub)");
    }
    this.secretKey = secretKey;
    const kp = Keypair.fromSecretKey(secretKey);
    this.publicKey = kp.publicKey.toBase58();
  }

  static fromBase58(secretKey: string): KeypairSigner {
    return new KeypairSigner(bs58.decode(secretKey));
  }

  /** Generate a fresh agent identity. Persist `kp.secretKey` to keep it. */
  static generate(): { signer: KeypairSigner; secretKey: Uint8Array } {
    const kp = Keypair.generate();
    return { signer: new KeypairSigner(kp.secretKey), secretKey: kp.secretKey };
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    return nacl.sign.detached(message, this.secretKey);
  }
}

/**
 * Trivial in-memory sequence counter. Fine for short-lived agents. For
 * anything that survives a process restart, supply a SequenceStore that
 * persists to disk / Redis / etc.
 */
export class InMemorySequenceStore {
  private seq = 0;
  async next(): Promise<number> {
    const n = (this.seq + 1) & 0xffff;
    this.seq = n;
    return n;
  }
}
