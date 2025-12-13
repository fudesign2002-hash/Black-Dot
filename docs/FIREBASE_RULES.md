# Firestore Rules: Guest read for showcase exhibitions

Summary
- Guest-authenticated clients may read (`get` and `list`) documents in the `exhibitions` collection (read-only). They are not allowed to write, update, or delete documents.

Why this is needed
-- Your requirement: "guest 用匿名 sign in, 可以讀取所有 exhibitions 設定成 isPublic 是 true 的". Guest access is unauthenticated; server rules should check `isPublic` on exhibition documents.

Rules snippet (file: `firestore.rules`)
- The project includes the `firestore.rules` at repository root with the rule that enforces this.

Important client considerations
- Guest users: the rules permit read-only access to `exhibitions` when they are signed in as guests. You can run queries without requiring an `isShowcase` filter for rule compliance. Example:

```js
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Example: fetch all exhibitions (guest read-only allowed by rules)
const q = query(collection(db, 'exhibitions'));
const snap = await getDocs(q);
```

-- Guest access: this project treats guests as unauthenticated viewers. There is no client-side anonymous sign-in flow; guests access public `isShowcase` exhibitions without signing in.

Testing and deployment
- Install the Firebase CLI if you don't have it:

```bash
npm install -g firebase-tools
```

- To deploy only Firestore rules:

```bash
firebase login
firebase deploy --only firestore:rules
```

- For local testing, use the Firebase Emulator Suite (recommended):

```bash
# start auth + firestore emulators
firebase emulators:start --only auth,firestore
```

Notes
- The rule restricts reads to guest-authenticated users. If you want to allow other signed-in users to read active exhibitions as well, update the condition accordingly.
- Admin SDK scripts (server-side) still have full access when run with service account credentials; they bypass these client rules.

Signed-in (non-guest) users: owner-only access
- The rules in `firestore.rules` also enforce that an authenticated user can only read documents where `ownerId == request.auth.uid`.
- For queries (`list`) the client must include the equality filter on `ownerId` so Firestore can validate the query. Example:

```js
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

// signed-in user can list their own active exhibitions only
const q = query(
	collection(db, 'exhibitions'),
	where('ownerId', '==', auth.currentUser.uid),
	where('isPublic', '==', true)
);
const snap = await getDocs(q);
```

If you observed that a signed-in account could see exhibitions with an empty `ownerId`, that indicates the currently-deployed rules differ from this repository's `firestore.rules` (or the account used had elevated access). Deploy the updated rules and test again.

Reminder: guest users may read public exhibition documents (read-only). Authenticated signed-in users must still include `ownerId == <uid>` and `isPublic == true` filters for owner-scoped listings.

Special-case owner (admin-like access)
- There is a configured special owner account that is allowed to list both exhibitions that belong to them and exhibitions that have no `ownerId` (null/empty). The special UID is:

```
pOxClMAbnoOm3DLApNLrKNAr5892
```

- Because Firestore queries cannot express complex OR logic easily for null/missing fields in a single query, to list both owned and owner-less documents from the client you should run two queries and merge results locally, for example:

```js
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

const uid = auth.currentUser.uid;

// 1) Owned by the special user
const qOwned = query(collection(db, 'exhibitions'), where('ownerId', '==', uid));
const snapOwned = await getDocs(qOwned);

// 2) Owner-less (null or empty). Firebase may treat missing fields as null, so
// query for null and/or empty string if you use empty-string values in your data.
const qOwnerless = query(collection(db, 'exhibitions'), where('ownerId', '==', null));
const snapOwnerless = await getDocs(qOwnerless);

// merge snaps (dedupe by doc.id) and use

```

If you prefer a single query approach and your dataset uses an explicit empty-string marker for owner-less docs, you can use `where('ownerId', 'in', [uid, ''])` (note: `in` has a 10-item limit and does not accept `null`).
