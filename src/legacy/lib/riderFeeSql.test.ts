import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('replacement SQL: onboarding, first/subsequent paid cycles, affiliate splits, retry and acceptance gate', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
      CREATE TABLE rider_fees(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rider_id uuid,
        platform_fee_balance numeric DEFAULT 0, total_career_earnings numeric DEFAULT 0,
        onboarding_fee_status text DEFAULT 'pending', total_payable numeric DEFAULT 0, frozen_at timestamptz, updated_at timestamptz);
      CREATE TABLE orders(id uuid DEFAULT gen_random_uuid(), rider_id uuid, rider_accepted_at timestamptz, status text);
      CREATE TABLE rider_fee_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rider_id uuid, amount numeric,
        status text, platform_fee_paid numeric, onboarding_fee_paid numeric, approved_at timestamptz, created_at timestamptz);
      CREATE TABLE affiliates(id uuid PRIMARY KEY, linked_user_id uuid, sponsor_id uuid, full_name text,
        wallet_balance numeric DEFAULT 0, lifetime_earnings numeric DEFAULT 0, tier1_earnings numeric DEFAULT 0,
        tier2_earnings numeric DEFAULT 0, updated_at timestamptz);
      CREATE TABLE affiliate_referrals(id uuid PRIMARY KEY, affiliate_id uuid, referred_user_id uuid,
        referred_role text, referred_name text, created_at timestamptz, milestones_hit integer DEFAULT 0, total_commission_earned numeric DEFAULT 0);
      CREATE TABLE affiliate_transactions(id uuid DEFAULT gen_random_uuid(), affiliate_id uuid, referral_id uuid,
        type text, description text, amount numeric, status text, tier integer);`);
    const sql = readFileSync(new URL('../../../database/rider-fee-and-affiliate-payout.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    const rider = '00000000-0000-0000-0000-000000000001';
    const direct = '00000000-0000-0000-0000-000000000002';
    const sponsor = '00000000-0000-0000-0000-000000000003';
    const ref = '00000000-0000-0000-0000-000000000004';
    const fee = async () => {
      const row = (await db.query<{ total_payable: number; onboarding_fee_status: string; frozen_at: string | null }>('SELECT * FROM rider_fees')).rows[0];
      assert.ok(row);
      return row;
    };
    await db.exec(`INSERT INTO rider_fees(rider_id,total_career_earnings,platform_fee_balance) VALUES('${rider}',999.99,30);`);
    assert.equal(Number((await fee()).total_payable), 30);
    await db.exec('UPDATE rider_fees SET total_career_earnings=1000');
    assert.equal(Number((await fee()).total_payable), 330);
    await db.exec(`UPDATE rider_fees SET platform_fee_balance=200;
      INSERT INTO orders(rider_id) VALUES('${rider}');
      INSERT INTO affiliates(id,sponsor_id) VALUES('${sponsor}',NULL),('${direct}','${sponsor}');
      INSERT INTO affiliate_referrals(id,affiliate_id,referred_user_id,referred_role) VALUES('${ref}','${direct}','${rider}','rider');`);
    assert.equal(Number((await fee()).total_payable), 500);
    assert.ok((await fee()).frozen_at);
    await assert.rejects(db.exec('UPDATE orders SET rider_accepted_at=now()'), /Settle rider fees/);
    // Simulate the existing approval's balance deduction before payment status update.
    await db.exec(`UPDATE rider_fees SET platform_fee_balance=0;
      INSERT INTO rider_fee_payments(rider_id,amount,status,platform_fee_paid,onboarding_fee_paid)
      VALUES('${rider}',499.99,'approved',199.99,300);`);
    assert.equal((await db.query('SELECT * FROM affiliate_transactions')).rows.length, 0);
    assert.equal((await fee()).onboarding_fee_status, 'paid');
    assert.equal(Number((await fee()).total_payable), 0);
    await db.exec(`INSERT INTO rider_fee_payments(rider_id,amount,status,platform_fee_paid,onboarding_fee_paid)
      VALUES('${rider}',0.01,'approved',0.01,0);`);
    const wallets = (await db.query<{ id: string; wallet_balance: number }>('SELECT id,wallet_balance FROM affiliates')).rows;
    assert.equal(Number(wallets.find(x => x.id === direct)?.wallet_balance), 35);
    assert.equal(Number(wallets.find(x => x.id === sponsor)?.wallet_balance), 15);
    await db.exec(sql);
    await db.exec("UPDATE rider_fee_payments SET status='approved'");
    assert.equal((await db.query('SELECT * FROM affiliate_transactions')).rows.length, 2);
    await db.exec('UPDATE orders SET rider_accepted_at=now()');
    await db.exec('UPDATE rider_fees SET platform_fee_balance=500,total_career_earnings=20000');
    assert.equal(Number((await fee()).total_payable), 500);
    assert.equal((await fee()).onboarding_fee_status, 'paid');
    await db.exec(`UPDATE affiliates SET sponsor_id=NULL WHERE id='${direct}';
      UPDATE rider_fees SET platform_fee_balance=0;
      INSERT INTO rider_fee_payments(rider_id,amount,status,platform_fee_paid,onboarding_fee_paid)
      VALUES('${rider}',500,'approved',500,0);`);
    assert.equal(Number((await db.query<{ wallet_balance: number }>(`SELECT wallet_balance FROM affiliates WHERE id='${direct}'`)).rows[0]?.wallet_balance), 85);
    assert.equal(Number((await fee()).total_payable), 0);
    await assert.rejects(db.exec(`INSERT INTO rider_fee_payments(rider_id,amount,status,platform_fee_paid,onboarding_fee_paid)
      VALUES('${rider}',300,'approved',0,300)`), /cannot exceed 300/);
    await assert.rejects(db.exec(`INSERT INTO rider_fee_payments(rider_id,amount,status,platform_fee_paid,onboarding_fee_paid)
      VALUES('${rider}',500,'approved',10,0)`), /allocate the actual amount/);
  } finally { await db.close(); }
});