# UNSWKC Tools Frontend

Internal management app for UNSW Kendo Club. Built with SvelteKit 5 + Firebase.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit 5 (Svelte 5 runes) |
| Styling | Tailwind CSS 3 |
| Backend | Firebase (Auth, Firestore, Storage) |
| Deployment | Static adapter (`adapter-static`) |
| Icons | Material Design Icons (`@mdi/js`) via `ace.svelte` |
| QR | `qrcode` (generation), `@zxing/library` (scanning) |
| Dialogs | SweetAlert2 |

---

## Local Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

---

## Auth Flow

All authentication is centralised in `src/routes/+layout.svelte`.

1. `onAuthStateChanged` fires once for the whole app.
2. When authenticated, the user's Firestore doc (`user/{uid}`) is fetched and stored in the global `userProfile` writable store (`src/lib/stores.js`).
3. The `<slot />` is blocked by an `authLoading` gate. Child pages only mount after auth resolves, so every page can safely read `$userProfile` in `onMount`.
4. If the user doc does not exist or the user is signed out, the app redirects to `/` (login).

New users are created on first Google sign-in. Their doc will be written to Firestore. The store will be populated immediately so the redirect to `/home` never races.

---

## Permission System

Each user doc has a `permissions: string[]` field. Pages check this array to grant access.

| Permission string | Grants access to |
|---|---|
| `beginner` | Beginners' Admin (`/beginner/admin`) |
| `profile` | Users' Admin (`/profile/admin`) |
| `attendance` | Attendance admin (`/attendance/admin`) |
| `bogu` | Bogu Log (`/bogu/admin`) |

Permissions are managed manually in the Firebase console. Every permission is explicit.

The home page (`/home`) renders app cards based on the user's permissions. Base apps (profile, beginner course) are visible to all authenticated users.

---

## Firestore Data Model

### `user/{uid}`
User profile, created on first sign-in.
```
{
  name: string,
  email: string,
  phone?: string,
  permissions: string[]
}
```

### `beginner/{uid}`
Beginner course enrolment record, one per user.
```
{
  join: boolean,          // confirmed attendance
  activated: boolean,     // armourer-approved; unlocks QR entry pass
  progress: boolean[],    // 4-session attendance checkboxes
  filePath?: string       // Firebase Storage path of payment receipt
}
```

### `config/beginner`
Editable content for the beginner course page. Managed via the admin modal.
```
{
  title: string,    // checkbox label
  content: string   // course description (plain text, rendered with whitespace-pre-wrap)
}
```

### `attendance/{name}`
Keyed by the member's display name (not uid) so records can exist for people who haven't signed up to the app.
```
{
  userId: string | null,   // matched uid if the name resolves to an app user
  data: {
    'YYYY/MM/DD': 0 | 1,   // training dates (Mon/Wed/Fri only)
    ...
  }
}
```

### `bogu/{id}`
One document per borrowing record (auto-ID).
```
{
  name: string,     // borrower's display name
  item: {
    men: boolean,
    kote: boolean,
    do: boolean,
    tare: boolean,
    'shinai bag': boolean,
    'bogu bag': boolean
  },
  note: string      // optional free-text note
}
```

---

## Routes

```
/                         Login (Google sign-in)
/home                     App launcher (permission-filtered cards)
/profile/?uid=<uid>       View / edit a user profile
/profile/admin            List all users  [permission: profile]
/beginner                 Beginner course enrolment for members
/beginner/admin           Manage enrolments, edit course content  [permission: beginner]
/beginner/admin/scan      QR code scanner for session entry  [permission: beginner]
/attendance/admin         Monthly attendance grid, CSV import/export  [permission: attendance]
/bogu/admin               Bogu borrowing log  [permission: bogu]
```

---

## Apps

### Beginner Course (`/beginner`)
Members confirm interest, upload a payment receipt, and (once activated) display a QR entry pass. Course description and checkbox label are editable by admins via `config/beginner`.

### Beginners' Admin (`/beginner/admin`)
- View all enrolments with per-session progress
- Preview payment receipts
- Activate members
- Scan QR codes at the door (`/beginner/admin/scan`)
- Edit course description and checkbox label

### Users' Admin (`/profile/admin`)
Lists all registered users and links to their profile pages.

### Attendance (`/attendance/admin`)
- Month picker generates a grid of all Mon/Wed/Fri training dates
- Click cells to toggle present/absent
- Import CSV (`name, 1, 0, 1, ...`). Values are positionally mapped to the month's dates; rows are merged by name
- Download a prefilled template CSV for offline entry
- Saves merge into each `attendance/{name}` doc, preserving other months' data
- Names are matched case-insensitively to app users; unmatched names are stored without a `userId`

### Bogu Log (`/bogu/admin`)
- Tracks who is borrowing club equipment (Men, Kote, Do, Tare, Shinai Bag, Bogu Bag)
- Each entry shows the borrower's attendance over the last 12 training sessions (4 weeks) as a colour-coded progress bar (red → yellow → green)
- Add, edit, delete entries

---

## Firestore Security Rules

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
  
  	function hasPermission(perm) {
      return get(/databases/$(database)/documents/user/$(request.auth.uid)).data.permissions.hasAny([perm]);
    }
    
    match /user/{userId} {
      allow read: if request.auth.uid == userId
      						|| hasPermission('profile');
      // Allow creation if the current user owns the new document
      allow create: if (request.auth.uid == userId
                    && request.resource.data.permissions is list
                    && request.resource.data.permissions.size() == 0)
                    || hasPermission('profile');
    	allow update: if (request.auth.uid == userId
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'phone', 'email2']))
                    || hasPermission('profile');
    }
    
    match /beginner/{userId} {
      allow read: if request.auth.uid == userId
                  || hasPermission('beginner');
      allow create: if (request.auth.uid == userId
                    && request.resource.data.activated == false
                    && request.resource.data.progress == [false, false, false, false])
                    || hasPermission('beginner');
      allow update: if (request.auth.uid == userId
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['join', 'filePath']))
                    || hasPermission('beginner');
    }
    
    match /config/{document} {
      allow read: if request.auth != null;
      allow write: if hasPermission(document); // 'beginner' doc → needs beginner permission
    }
    
    match /attendance/{name} {
      allow read: if request.auth != null;
      allow write: if hasPermission('attendance');
    }
    
    match /bogu/{id} {
      allow read: if request.auth != null;
      allow write: if hasPermission('bogu');
    }
  }
}
```
