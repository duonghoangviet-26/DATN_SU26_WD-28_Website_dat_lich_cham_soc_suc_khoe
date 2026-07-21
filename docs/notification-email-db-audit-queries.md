# Notification Email Database Audit Queries

Use these read-only checks when email delivery looks inconsistent.

## Check User Emails

```js
db.users.find(
  { role: { $in: ["doctor", "nurse", "receptionist", "patient"] } },
  { email: 1, role: 1, fullName: 1, isActive: 1 }
)
```

## Check Notification History

```js
db.notifications.find(
  {},
  { tieu_de: 1, kenh_gui: 1, doi_tuong: 1, so_nguoi_nhan: 1, createdAt: 1 }
).sort({ createdAt: -1 }).limit(10)
```

Do not paste credential values into database notes or screenshots.
