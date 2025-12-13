#!/usr/bin/env node
/*
List exhibitions for a specific ownerId.
Usage:
  npm install firebase-admin minimist
  export GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
  node scripts/list_exhibitions_by_owner.js --owner=<OWNER_ID>

Output: minimal — prints matching document id and title only.
*/

const admin = require('firebase-admin');
const argv = require('minimist')(process.argv.slice(2));

const owner = argv.owner || argv.o;
const limit = parseInt(argv.limit || '500', 10);

if (!owner) {
  console.error('Usage: --owner=<OWNER_ID>');
  process.exit(2);
}

try { admin.initializeApp(); } catch (e) { /* already initialized */ }
const db = admin.firestore();

(async () => {
  try {
    const col = db.collection('exhibitions');
    // query for ownerId field equals given owner
    const q = col.where('ownerId', '==', owner).limit(limit);
    const snap = await q.get();
    if (snap.empty) {
      console.log('No exhibitions found for ownerId:', owner);
      process.exit(0);
    }
    snap.forEach(doc => {
      const data = doc.data();
      // print minimal info: id and title (if present)
      const title = data.title || '';
      console.log(doc.id + (title ? (' — ' + title) : ''));
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
