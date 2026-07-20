# 📱 LocalLLM Android (Aisistan)

![Banner Placeholder](https://via.placeholder.com/1200x400?text=Aisistan+-+100%25+Offline+AI+Agent)

**LocalLLM Android**, internet bağlantısı olmadan doğrudan cihazınızın donanımında (offline) çalışan, tamamen otonom bir yapay zeka ajanıdır (AI Agent). 

Projeye **Gemma 2 (2B Parameters)** modeli entegre edilmiştir. Uygulama, arka planda web aramaları yapıp güncel verileri çekebilen, kendi kendine karar verebilen ve konuşmalarınızı anlayabilen bir "Otonom Ajan" döngüsüne (Agentic Loop) sahiptir.

---

## 🚀 Özellikler

- **🔒 %100 Gizlilik (Offline Inference):** Yapay zeka modeli (Gemma 2) telefonun kendi içinde çalışır. Hiçbir veriniz buluta gitmez.
- **🌐 Otonom İnternet Erişimi:** Kullanıcının sorusuna göre internette *kendi kendine* (DuckDuckGo üzerinden) arama yapar, çıkan siteleri okur, verileri çeker (Fiyat, hava durumu, güncel bilgiler) ve kendi kelimeleriyle cevaplar.
- **🎙️ Sesli Asistan (Speech-to-Text):** Türkçe sesli komutlarınızı kusursuz bir şekilde metne döker.
- **⚡ JSI / C++ Entegrasyonu:** React Native ile `llama.cpp`'nin inanılmaz hızlı entegrasyonu sayesinde gecikmesiz çalışır. (Gerçek cihazlarda GPU/NPU hızlandırması destekler).

---

## 🛠️ Kurulum (Kurmadan Önce Mutlaka Okuyun)

Bu proje içerisinde **1.7 GB** boyutundaki `.gguf` (yapay zeka modeli) barındırması gerektiği için GitHub'a model dosyası **YÜKLENMEMİŞTİR**. Uygulamayı çalıştırmadan önce modeli manuel olarak indirip klasöre atmanız GEREKİR.

### 1. Yapay Zeka Modelini İndirin
Uygulamanın çalışması için **Gemma 2 2B (Q4_K_M)** modelini indirmeniz gerekmektedir:
[👉 Modeli Buradan İndirin (HuggingFace)](https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf)

### 2. Modeli Projeye Ekleyin
İndirdiğiniz `gemma-2-2b-it-Q4_K_M.gguf` dosyasını bilgisayarınızda şu dizine kopyalayın:
`android/app/src/main/assets/models/gemma-2-2b-it-Q4_K_M.gguf`

### 3. Projeyi Çalıştırın
```bash
# Bağımlılıkları yükleyin
npm install

# Android cihazınızda başlatın (Gerçek cihaz önerilir)
npx react-native run-android
```

---

## 🧠 Nasıl Çalışır?

Aisistan sıradan bir sohbet botu değildir. O bir **Agent**'tır. 
Örneğin ona *"İstanbul'da bugün hava nasıl?"* diye sorduğunuzda şu adımları izler:
1. **Düşünür:** *"Bu güncel bir bilgi, internete girmeliyim."*
2. **Aksiyon Üretir (JSON):** Kendi içinde `{"action": "search", "query": "İstanbul bugün hava sıcaklık derece"}` komutunu üretir.
3. **Scraping:** Uygulama bu JSON'u yakalar, arama motoruna gider ve sonuçları indirir.
4. **Cevaplama:** İnternetten gelen ham sonuçları tekrar yapay zekaya verir, yapay zeka bunları analiz edip size doğal bir dille *"Bugün İstanbul güneşli ve 24 derece..."* der.

---

## ⚠️ Uyarılar ve Optimizasyonlar
- **Sanal Telefon (Emülatör) Kullanımı:** Emülatörler ekran kartı (GPU) desteklemediği için tüm yük işlemciye (CPU) biner ve cevap süreleri (Özellikle Windows'ta) uzun sürebilir. Uygulamanın asıl gücünü ve hızını görmek için **fiziksel Android telefonunuza** (APK olarak) yükleyin.
- GPU desteği olan gerçek cihazlarda, model saniyeler içinde cevap üretir.

---
*Geliştirici: Görkem Yiğit Memiş*
