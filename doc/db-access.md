# Panduan Akses Database via DBeaver

Database aktif project: **PostgreSQL 16 (Homebrew)** di port **5433**.

## Kredensial koneksi

Nilai diambil dari `.env` (yang benar-benar dipakai aplikasi):

| Field    | Nilai                 |
| -------- | --------------------- |
| Host     | `localhost`           |
| Port     | `5433`                |
| Database | `learning_study_ai`   |
| Username | `padepokan79`         |
| Password | *(kosongkan)*         |

> User `padepokan79` login tanpa password (auth lokal `trust`/peer). Biarkan field Password kosong.

## Langkah di DBeaver

1. **Database → New Database Connection** → pilih **PostgreSQL** → **Next**.
   Kalau diminta, klik **Download** untuk mengunduh driver PostgreSQL.
2. Isi tab **Main** sesuai tabel kredensial di atas.
3. Klik **Test Connection** → harus muncul *Connected* (PostgreSQL 16.14) → **Finish**.
4. Lihat tabel di panel kiri:
   `learning_study_ai → Schemas → public → Tables`
5. Klik-dobel tabel → tab **Data** untuk isinya, atau buka **SQL Editor** untuk query manual.

## Tabel (8)

`users`, `events`, `materials`, `enrollments`, `material_progress`, `responses`, `sessions`, `rate_limits`

---

## ⚠️ Ada 2 PostgreSQL di mesin ini

| Port     | Instalasi                                | Status                          |
| -------- | ---------------------------------------- | ------------------------------- |
| **5433** | Homebrew `postgresql@16`                 | ✅ **Dipakai app — gunakan ini** |
| 5432     | EnterpriseDB PostgreSQL 13 (`/Library/PostgreSQL/13`) | ❌ Bukan DB project      |

Jangan pakai port 5432 walaupun `docker/docker-compose.yml` menyebut 5432 — Docker sedang tidak jalan, jadi yang aktif adalah Homebrew di 5433.

## Alternatif: koneksi via Docker

Bila menjalankan `docker compose -f docker/docker-compose.yml up -d db`, kredensialnya berbeda:

| Field    | Nilai               |
| -------- | ------------------- |
| Host     | `localhost`         |
| Port     | `5432`              |
| Database | `learning_study_ai` |
| Username | `app`               |
| Password | `app`               |

Hati-hati bentrok port 5432 dengan PostgreSQL 13 yang sudah menempati port itu.

## Cek cepat dari terminal

```bash
psql "postgres://padepokan79@localhost:5433/learning_study_ai" -c "\dt"
```
