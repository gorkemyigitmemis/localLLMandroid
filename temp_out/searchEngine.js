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
exports.performWebSearch = void 0;
var performWebSearch = function (query) { return __awaiter(void 0, void 0, void 0, function () {
    var url, userAgents, randomUA, headers, controller_1, timeoutId, response, html, results, snippetRegex, match, count, url_1, uddgMatch, pureText, fallbackQuery, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 6, , 7]);
                url = "https://html.duckduckgo.com/html/?q=".concat(encodeURIComponent(query));
                userAgents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'
                ];
                randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
                headers = {
                    'User-Agent': randomUA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                };
                controller_1 = new AbortController();
                timeoutId = setTimeout(function () { return controller_1.abort(); }, 10000);
                return [4 /*yield*/, fetch(url, { headers: headers, signal: controller_1.signal })];
            case 1:
                response = _a.sent();
                clearTimeout(timeoutId);
                if (!response.ok) {
                    throw new Error("Search request failed with status: ".concat(response.status));
                }
                return [4 /*yield*/, response.text()];
            case 2:
                html = _a.sent();
                results = [];
                snippetRegex = /<a[^>]*class=["']result[-_]*snippet["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
                match = void 0;
                count = 0;
                while ((match = snippetRegex.exec(html)) !== null && count < 3) {
                    url_1 = match[1];
                    uddgMatch = url_1.match(/uddg=([^&]+)/);
                    if (uddgMatch) {
                        url_1 = decodeURIComponent(uddgMatch[1]);
                    }
                    else if (url_1.startsWith('//')) {
                        url_1 = 'https:' + url_1;
                    }
                    else if (url_1.startsWith('/')) {
                        url_1 = 'https://duckduckgo.com' + url_1;
                    }
                    pureText = match[2].replace(/<[^>]*>?/gm, '').trim();
                    pureText = pureText.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    if (pureText.length > 10) {
                        results.push("[Kaynak ".concat(count + 1, "] (").concat(url_1, "): ").concat(pureText));
                        count++;
                    }
                }
                if (!(results.length === 0)) return [3 /*break*/, 5];
                if (!query.includes('site:')) return [3 /*break*/, 4];
                fallbackQuery = query.replace(/site:\S+/g, '').replace(/\s+OR\s+/g, ' ').trim();
                console.log("Fallback search triggered for: ".concat(fallbackQuery));
                return [4 /*yield*/, (0, exports.performWebSearch)(fallbackQuery)];
            case 3: return [2 /*return*/, _a.sent()];
            case 4: return [2 /*return*/, "İnternet aramasında belirgin bir sonuç bulunamadı."];
            case 5: return [2 /*return*/, results.join('\n')];
            case 6:
                error_1 = _a.sent();
                console.error("Web Search Error:", error_1);
                return [2 /*return*/, "Arama motoruna bağlanılamadı."];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.performWebSearch = performWebSearch;
