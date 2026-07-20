# Notification Email API Examples

These examples describe intended payload shapes for notification email testing.

## Send To All Doctors

```json
{
  "tieu_de": "Thong bao lich kham",
  "noi_dung": "Vui long kiem tra lich lam viec moi.",
  "doi_tuong": "doctor",
  "kenh_gui": "email"
}
```

## Send To Selected Users

```json
{
  "tieu_de": "Thong bao ca truc",
  "noi_dung": "Ca truc da duoc cap nhat.",
  "doi_tuong": "selected",
  "recipient_ids": ["USER_ID_1", "USER_ID_2"],
  "kenh_gui": "email"
}
```

Replace ids with real user ids from the development database.
