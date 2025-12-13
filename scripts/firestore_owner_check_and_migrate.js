#!/usr/bin/env node
/*
Simple admin script to inspect Firestore documents for owner-like fields
and optionally migrate from one field to another (e.g. ownerId -> ownerUid).

Usage:
  1) Install firebase-admin and set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON.
     npm install firebase-admin
     export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

  2) Run checks:
     node scripts/firestore_owner_check_and_migrate.js --check --limit=50

  3) Dry-run migration (report what would change):
     node scripts/firestore_owner_check_and_migrate.js --migrate --from=ownerId --to=ownerUid --dry-run

  4) Apply migration:
     node scripts/firestore_owner_check_and_migrate.js --migrate --from=ownerId --to=ownerUid

NOTE: This script modifies production data when run without --dry-run. Back up your data first.
*/

const admin = require('firebase-admin');
const argv = require('minimist')(process.argv.slice(2));

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.warn('WARNING: GOOGLE_APPLICATION_CREDENTIALS is not set. The script will still try to initialize admin SDK (may fail).');
}

try { admin.initializeApp(); } catch (e) { /* already initialized */ }
const db = admin.firestore();

const collections = ['exhibitions', 'zones', 'artworks'];
const fromField = argv.from || 'ownerId';
const toField = argv.to || 'ownerUid';
const limit = parseInt(argv.limit || '100', 10);
const doCheck = !!argv.check || !argv.migrate; // default to check if no --migrate
const doMigrate = !!argv.migrate;
const dryRun = !!argv['dry-run'] || !!argv['dryrun'] || !!argv.dry;

async function inspectCollection(name) {
  console.log('\n== Collection:', name);
  const snapshot = await db.collection(name).limit(limit).get();
  console.log(' Sampled docs:', snapshot.size);
  let counts = { total: 0, hasFrom: 0, hasTo: 0, missingBoth: 0 };
  const samples = [];
  snapshot.forEach(doc => {
    counts.total += 1;
    const data = doc.data();
    if (data.hasOwnProperty(fromField)) counts.hasFrom += 1;
    if (data.hasOwnProperty(toField)) counts.hasTo += 1;
    if (!data.hasOwnProperty(fromField) && !data.hasOwnProperty(toField)) counts.missingBoth += 1;
    samples.push({ id: doc.id, from: data[fromField], to: data[toField] });
  });
  console.log(' Counts:', counts);
  console.log(' Samples (up to limit):');
  samples.slice(0, 20).forEach(s => console.log('  -', s.id, '|', fromField + ':', s.from, '|', toField + ':', s.to));
  return { snapshot, counts };
}

async function migrateCollection(name) {
  console.log('\n-- Migrate collection:', name);
  const q = db.collection(name).where(toField, '==', null).limit(limit).get().catch(() => null);
  // Firestore doesn't index '== null' well; instead fetch sample batch and filter client-side
  const snapshot = await db.collection(name).limit(limit*10).get();
  let changed = 0;
  let considered = 0;
  const batch = db.batch();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (!data.hasOwnProperty(toField) && data.hasOwnProperty(fromField)) {
      considered += 1;
      const ref = doc.ref;
      if (!dryRun) {
        batch.update(ref, { [toField]: data[fromField] });
      }
      changed += 1;
      if (batch._ops && batch._ops.length >= 450) {
        // flush
        batch.commit();
      }
    }
  });
  if (!dryRun) {
    await batch.commit();
  }
  console.log(' Considered docs with', fromField, '=>', considered);
  console.log(dryRun ? ' Dry-run: no writes performed.' : (' Applied: ' + changed + ' documents updated.'));
  return changed;
}

(async () => {
  try {
    for (const c of collections) {
      await inspectCollection(c);
    }
    if (doMigrate) {
      console.log('\n*** MIGRATION MODE');
      console.log(' from:', fromField, ' to:', toField, dryRun ? '(dry-run)' : '(apply)');
      for (const c of collections) {
        await migrateCollection(c);
      }
      console.log('\nMigration finished.');
    } else {
      console.log('\nInspection finished.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(2);
  }
})();
