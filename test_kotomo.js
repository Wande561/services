#!/usr/bin/env node

import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory } from './src/declarations/kotomo/kotomo.did.js';

const CANISTER_ID = 'ulvla-h7777-77774-qaacq-cai';
const HOST_URL = 'http://localhost:4943';

async function testKotomoToken() {
  console.log('🧪 Testing Kotomo Token Integration...\n');

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

    // Test token metadata
    console.log('\n📊 Testing Token Metadata...');
    const metadata = await kotomoActor.icrc1_metadata();
    console.log('Metadata:', metadata);

    // Test token basic info
    console.log('\n🏷️  Testing Token Basic Info...');
    const [name, symbol, decimals, fee, totalSupply] = await Promise.all([
      kotomoActor.icrc1_name(),
      kotomoActor.icrc1_symbol(),
      kotomoActor.icrc1_decimals(),
      kotomoActor.icrc1_fee(),
      kotomoActor.icrc1_total_supply()
    ]);

    console.log('Token Name:', name);
    console.log('Token Symbol:', symbol);
    console.log('Decimals:', decimals);
    console.log('Fee:', fee.toString());
    console.log('Total Supply:', totalSupply.toString());

    // Test balance check (with anonymous principal)
    console.log('\n💰 Testing Balance Check...');
    const testAccount = {
      owner: Principal.anonymous(),
      subaccount: []
    };
    
    const balance = await kotomoActor.icrc1_balance_of(testAccount);
    console.log('Anonymous Balance:', balance.toString());

    console.log('\n✅ All Kotomo token tests passed!');
    console.log('\n🔗 Token canister is working correctly and ready for use in the application.');

  } catch (error) {
    console.error('❌ Error testing Kotomo token:', error);
    console.error('\nError details:', error.message);
  }
}

testKotomoToken();