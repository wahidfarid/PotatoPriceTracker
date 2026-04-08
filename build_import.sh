#!/bin/bash
echo "PRAGMA foreign_keys=OFF;"

# Schema in FK order
sqlite3 prisma/dev.db ".schema Shop"
sqlite3 prisma/dev.db ".schema Card"
sqlite3 prisma/dev.db ".schema CardVariant"
sqlite3 prisma/dev.db ".schema Price"

# Data in FK order
sqlite3 prisma/dev.db "SELECT * FROM Shop;" -cmd ".mode insert Shop"
sqlite3 prisma/dev.db "SELECT * FROM Card;" -cmd ".mode insert Card"
sqlite3 prisma/dev.db "SELECT * FROM CardVariant;" -cmd ".mode insert CardVariant"
sqlite3 prisma/dev.db "SELECT * FROM Price;" -cmd ".mode insert Price"
