"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
require("dotenv/config");
var prisma = new client_1.PrismaClient();
function seedSet(setCode) {
    return __awaiter(this, void 0, void 0, function () {
        var query, url, hasMore, count, res, json, data, _i, data_1, cardData, dbCard, finishes, variantsToCreate, languages, _a, languages_1, l, _b, variantsToCreate_1, v, exists, frameEffects, promoTypes, finish;
        var _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    console.log("Fetching set: ".concat(setCode.toUpperCase(), " from Scryfall..."));
                    query = "set:".concat(setCode.toLowerCase(), " unique:prints");
                    if (setCode.toLowerCase() === 'spg') {
                        query += ' year:2026'; // Only Lorwyn Eclipsed section of SPG
                    }
                    url = "https://api.scryfall.com/cards/search?q=".concat(encodeURIComponent(query));
                    hasMore = true;
                    count = 0;
                    _j.label = 1;
                case 1:
                    if (!hasMore) return [3 /*break*/, 19];
                    return [4 /*yield*/, fetch(url)];
                case 2:
                    res = _j.sent();
                    if (!res.ok)
                        throw new Error("Scryfall API error: ".concat(res.status));
                    return [4 /*yield*/, res.json()];
                case 3:
                    json = (_j.sent());
                    data = json.data;
                    if (!data) {
                        console.log("No data found for set ".concat(setCode, "."));
                        return [3 /*break*/, 19];
                    }
                    _i = 0, data_1 = data;
                    _j.label = 4;
                case 4:
                    if (!(_i < data_1.length)) return [3 /*break*/, 18];
                    cardData = data_1[_i];
                    dbCard = null;
                    if (!cardData.oracle_id) return [3 /*break*/, 6];
                    return [4 /*yield*/, prisma.card.findFirst({ where: { oracleId: cardData.oracle_id } })];
                case 5:
                    dbCard = _j.sent();
                    _j.label = 6;
                case 6:
                    if (!!dbCard) return [3 /*break*/, 8];
                    return [4 /*yield*/, prisma.card.findFirst({ where: { name: cardData.name } })];
                case 7:
                    dbCard = _j.sent();
                    _j.label = 8;
                case 8:
                    if (!!dbCard) return [3 /*break*/, 10];
                    return [4 /*yield*/, prisma.card.create({
                            data: {
                                name: cardData.name,
                                oracleId: cardData.oracle_id
                            }
                        })];
                case 9:
                    dbCard = _j.sent();
                    _j.label = 10;
                case 10:
                    finishes = cardData.finishes || [];
                    variantsToCreate = [];
                    if (finishes.includes('nonfoil'))
                        variantsToCreate.push({ isFoil: false });
                    if (finishes.includes('foil'))
                        variantsToCreate.push({ isFoil: true });
                    languages = ['EN', 'JP'];
                    _a = 0, languages_1 = languages;
                    _j.label = 11;
                case 11:
                    if (!(_a < languages_1.length)) return [3 /*break*/, 17];
                    l = languages_1[_a];
                    _b = 0, variantsToCreate_1 = variantsToCreate;
                    _j.label = 12;
                case 12:
                    if (!(_b < variantsToCreate_1.length)) return [3 /*break*/, 16];
                    v = variantsToCreate_1[_b];
                    return [4 /*yield*/, prisma.cardVariant.findFirst({
                            where: {
                                cardId: dbCard.id,
                                setCode: setCode.toUpperCase(),
                                collectorNumber: cardData.collector_number,
                                language: l,
                                isFoil: v.isFoil
                            }
                        })];
                case 13:
                    exists = _j.sent();
                    if (!!exists) return [3 /*break*/, 15];
                    frameEffects = ((_c = cardData.frame_effects) === null || _c === void 0 ? void 0 : _c.join(',')) || null;
                    promoTypes = ((_d = cardData.promo_types) === null || _d === void 0 ? void 0 : _d.join(',')) || null;
                    finish = v.isFoil ? 'foil' : 'nonfoil';
                    return [4 /*yield*/, prisma.cardVariant.create({
                            data: {
                                cardId: dbCard.id,
                                setCode: setCode.toUpperCase(),
                                collectorNumber: cardData.collector_number,
                                language: l,
                                isFoil: v.isFoil,
                                scryfallId: cardData.id,
                                image: ((_e = cardData.image_uris) === null || _e === void 0 ? void 0 : _e.normal) || ((_h = (_g = (_f = cardData.card_faces) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.image_uris) === null || _h === void 0 ? void 0 : _h.normal),
                                frameEffects: frameEffects,
                                promoTypes: promoTypes,
                                finish: finish
                            }
                        })];
                case 14:
                    _j.sent();
                    count++;
                    _j.label = 15;
                case 15:
                    _b++;
                    return [3 /*break*/, 12];
                case 16:
                    _a++;
                    return [3 /*break*/, 11];
                case 17:
                    _i++;
                    return [3 /*break*/, 4];
                case 18:
                    if (json.has_more) {
                        url = json.next_page;
                    }
                    else {
                        hasMore = false;
                    }
                    return [3 /*break*/, 1];
                case 19:
                    console.log("Seeded ".concat(count, " variants for set ").concat(setCode.toUpperCase(), "."));
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var sets, _i, sets_1, s;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sets = ['ecl', 'ecc', 'spg'];
                    _i = 0, sets_1 = sets;
                    _a.label = 1;
                case 1:
                    if (!(_i < sets_1.length)) return [3 /*break*/, 4];
                    s = sets_1[_i];
                    return [4 /*yield*/, seedSet(s)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(console.error)
    .finally(function () { return prisma.$disconnect(); });
