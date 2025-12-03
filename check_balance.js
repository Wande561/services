#!/usr/bin/env node

import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory } from './src/declarations/kotomo/kotomo.did.js';

const CANISTER_ID = 'ulvla-h7777-77774-qaacq-cai';
const HOST_URL = 'http://localhost:4943';

// The principal that should have the initial balance
const PRINCIPAL_WITH_BALANCE = 'nhrxz-f5ob2-fv3iz-pio7f-ereqc-7kfmw-p6hep-jax7m-66i3e-sw45s-jae';

async function checkTokenBalance() {
  console.log('💰 Checking Token Balance...\n');

  try {
    // Create agent
    const agent = new HttpAgent({ 
      host: HOST_URL 
    });

    // Fetch root key for local development
    await agent.fetchRootKey().catch(err => {
      console.warn('Unable to fetch root key:', err.message);
    });

    // Create actor
    const kotomoActor = Actor.createActor(idlFactory, {
      agent,
      canisterId: Principal.fromText(CANISTER_ID)
    });

    console.log('✅ Connected to Kotomo canister:', CANISTER_ID);

    // Check balance for the principal that should have initial tokens
    const account = {
      owner: Principal.fromText(PRINCIPAL_WITH_BALANCE),
      subaccount: []
    };
    
    const balance = await kotomoActor.icrc1_balance_of(account);
    const decimals = await kotomoActor.icrc1_decimals();
    const balanceDecimal = Number(balance) / Math.pow(10, decimals);
    
    console.log('🏦 Principal:', PRINCIPAL_WITH_BALANCE);
    console.log('💰 Raw Balance:', balance.toString());
    console.log('💰 Decimal Balance:', balanceDecimal.toLocaleString(), 'KOTOMO');
    
    if (balance > 0n) {
      console.log('✅ Great! This principal has tokens and can be used for testing transfers.');
    } else {
      console.log('⚠️  This principal has no tokens.');
    }

  } catch (error) {
    console.error('❌ Error checking balance:', error);
  }
}

checkTokenBalance();