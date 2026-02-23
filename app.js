document.addEventListener('DOMContentLoaded', () => {
    const APP_VERSION = 'v3.3';
    // 版本標籤：v3.3 (優化 AR 覆寫佈局：上方固圖，下方捲動)
    console.log(`--- 翻譯助手 ${APP_VERSION} ---`);
    const versionDisplay = document.getElementById('versionDisplay');
    if (versionDisplay) versionDisplay.textContent = `程式版本: ${APP_VERSION}`;

    const statusMessage = document.getElementById('statusMessage');
    const chatContainer = document.getElementById('chatContainer');
    const btnSpeakZh = document.getElementById('btnSpeakZh');
    const btnSpeakJa = document.getElementById('btnSpeakJa');

    // 檢查瀏覽器支援
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showError('您的瀏覽器不支援語音辨識。請使用 Google Chrome 或 Safari。');
        btnSpeakZh.disabled = true;
        btnSpeakJa.disabled = true;
        return;
    }

    let recognition = new SpeechRecognition();
    recognition.continuous = false; // 每次對話結束就停止
    recognition.interimResults = false; // 只取最終結果

    let currentSourceLang = '';
    let currentTargetLang = '';
    let GEMINI_API_KEY = localStorage.getItem('GEMINI_API_KEY') || '';

    // 設定視窗邏輯
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const btnSaveSettings = document.getElementById('btnSaveSettings');

    btnSettings.onclick = () => {
        apiKeyInput.value = GEMINI_API_KEY;
        settingsModal.style.display = 'flex';
    };

    closeSettings.onclick = () => {
        settingsModal.style.display = 'none';
    };

    btnSaveSettings.onclick = () => {
        GEMINI_API_KEY = apiKeyInput.value.trim();
        localStorage.setItem('GEMINI_API_KEY', GEMINI_API_KEY);
        settingsModal.style.display = 'none';
        alert('設定已儲存！');
    };

    // 初始化翻譯服務 (這裡先用一個免費的公開 API，實際應用可能需要替換為更穩定的服務)
    // 使用 MyMemory Translation API
    async function translateText(text, sourceLang, targetLang) {
        try {
            statusMessage.textContent = '翻譯中...';
            // MyMemory API limits to 500 words/day for free without email
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
            const data = await response.json();

            if (data.responseStatus === 200) {
                return data.responseData.translatedText;
            } else {
                throw new Error("翻譯失敗 API 回應錯誤");
            }
        } catch (error) {
            console.error('Translation error:', error);
            return '[翻譯服務暫時不可用，請稍後再試]';
        }
    }

    // 語音朗讀
    function speakText(text, lang) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'ja' ? 'ja-JP' : 'zh-TW';
            // 稍微放慢語速，讓長輩或對方聽得更清楚
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // 更新 UI 顯示對話
    function addMessageToChat(originalText, translatedText, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;

        const origDiv = document.createElement('div');
        origDiv.className = 'original';
        origDiv.textContent = originalText;

        const transDiv = document.createElement('div');
        transDiv.className = 'translated';
        transDiv.textContent = translatedText;

        const replayBtn = document.createElement('button');
        replayBtn.className = 'replay-btn';
        replayBtn.innerHTML = '🔊';
        replayBtn.title = '重新播放';
        replayBtn.onclick = () => {
            const targetLang = type === 'zh' ? 'ja' : 'zh-TW';
            speakText(translatedText, targetLang);
        };

        msgDiv.appendChild(origDiv);
        msgDiv.appendChild(transDiv);
        msgDiv.appendChild(replayBtn);
        chatContainer.appendChild(msgDiv);

        // 捲動到底部
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function showError(msg) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message error';
        msgDiv.textContent = msg;
        chatContainer.appendChild(msgDiv);
        statusMessage.textContent = '發生錯誤';
        statusMessage.classList.remove('recording');
    }

    // 處理語音辨識結果
    recognition.onresult = async (event) => {
        const text = event.results[0][0].transcript;
        statusMessage.textContent = '辨識完成，準備翻譯...';
        statusMessage.classList.remove('recording');

        // 決定翻譯方向
        let langCodeSource = currentSourceLang === 'zh-TW' ? 'zh-TW' : 'ja';
        let langCodeTarget = currentSourceLang === 'zh-TW' ? 'ja' : 'zh-TW';
        let uiType = currentSourceLang === 'zh-TW' ? 'zh' : 'ja';

        const translatedText = await translateText(text, langCodeSource, langCodeTarget);

        addMessageToChat(text, translatedText, uiType);
        statusMessage.textContent = '準備就緒';

        // 朗讀翻譯結果
        speakText(translatedText, langCodeTarget);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        statusMessage.classList.remove('recording');

        let errorMsg = '無法辨識語音。';
        if (event.error === 'not-allowed') {
            errorMsg = '請允許使用麥克風權限！';
        } else if (event.error === 'no-speech') {
            errorMsg = '沒有偵測到聲音，請再說一次。';
        }

        showError(errorMsg);

        // 恢復按鈕狀態
        btnSpeakZh.classList.remove('active');
        btnSpeakJa.classList.remove('active');
    };

    recognition.onend = () => {
        statusMessage.classList.remove('recording');
        btnSpeakZh.classList.remove('active');
        btnSpeakJa.classList.remove('active');
    };

    // 綁定按鈕事件
    function startRecording(lang, langCode, btnElement) {
        currentSourceLang = lang;
        recognition.lang = lang;

        btnElement.classList.add('active');
        statusMessage.textContent = '正在聆聽... 請說話';
        statusMessage.classList.add('recording');

        try {
            recognition.start();
        } catch (e) {
            // 如果已經在錄音中又按了一次
            console.warn(e);
        }
    }

    btnSpeakZh.addEventListener('click', () => {
        startRecording('zh-TW', 'zh-TW', btnSpeakZh);
    });

    btnSpeakJa.addEventListener('click', () => {
        // iOS 系統對於 ja-JP 的支援度比較好，Windows 也是
        startRecording('ja-JP', 'ja', btnSpeakJa);
    });

    // 圖片翻譯邏輯
    const btnCamera = document.getElementById('btnCamera');
    const imageInput = document.getElementById('imageInput');
    const overlayModal = document.getElementById('overlayModal');
    const sourceImage = document.getElementById('sourceImage');
    const labelLayer = document.getElementById('labelLayer');
    const closeModal = document.getElementById('closeModal');
    const debugRawText = document.getElementById('debugRawText');

    btnCamera.addEventListener('click', () => {
        imageInput.click();
    });

    closeModal.addEventListener('click', () => {
        overlayModal.style.display = 'none';
        labelLayer.innerHTML = '';
        debugRawText.textContent = '';
    });

    imageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 預覽圖片
        const reader = new FileReader();
        reader.onload = (event) => {
            sourceImage.src = event.target.result;
            overlayModal.style.display = 'flex';
        };
        reader.readAsDataURL(file);

        statusMessage.textContent = '分析圖片中 (AI)... 請稍候';
        statusMessage.classList.add('recording');

        try {
            if (GEMINI_API_KEY) {
                // --- [優先] 使用 Google Gemini AI (v3.0 雙模式) ---
                statusMessage.textContent = '正在呼叫 Google Gemini AI...';
                const result = await callGeminiVision(file);

                if (!result || result.lines.length === 0) {
                    showError('哎呀，AI 辨識不到文字。');
                    return;
                }

                debugRawText.textContent = `[Gemini AI 模式]\n${result.rawText}`;
                labelLayer.innerHTML = '';
                const translationList = document.getElementById('translationList');
                if (translationList) translationList.innerHTML = '';

                for (const line of result.lines) {
                    // 1. 建立圖片上的 AR 標籤
                    const label = document.createElement('div');
                    label.className = 'trans-label';
                    label.textContent = line.translated;

                    const box = line.box || [0, 0, 0, 0];
                    label.style.top = `${box[0] / 10}%`;
                    label.style.left = `${box[1] / 10}%`;
                    label.style.width = `${(box[3] - box[1]) / 10}%`;
                    label.style.height = `${(box[2] - box[0]) / 10}%`;

                    label.onclick = (e) => {
                        e.stopPropagation();
                        speakText(line.translated, 'zh-TW');
                    };
                    labelLayer.appendChild(label);

                    // 2. 建立下方的文字清單
                    if (translationList) {
                        const item = document.createElement('div');
                        item.className = 'list-item';
                        item.innerHTML = `
                            <div class="item-text">
                                <div class="orig">${line.original}</div>
                                <div class="trans">${line.translated}</div>
                            </div>
                            <button class="play-btn">🔊</button>
                        `;
                        item.onclick = () => speakText(line.translated, 'zh-TW');
                        translationList.appendChild(item);
                    }
                }
            } else {
                // --- 傳統模式 Fallback ---
                statusMessage.textContent = '使用本地辨識中...';
                const result = await Tesseract.recognize(file, 'jpn', {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            statusMessage.textContent = `辨識中: ${Math.round(m.progress * 100)}%`;
                        }
                    }
                });

                const data = result.data;
                if (!data || !data.text || data.text.trim().length === 0) {
                    showError('找不到文字。');
                    return;
                }

                debugRawText.textContent = `[本地模式]\n${data.text}`;
                labelLayer.innerHTML = '';
                const translationList = document.getElementById('translationList');
                if (translationList) translationList.innerHTML = '<p style="color:#aaa; padding:10px;">(案：本地辨識不支援列表，請點圖)</p>';

                for (const line of data.lines) {
                    const text = line.text.replace(/\s+/g, '').trim();
                    if (text.length < 1) continue;

                    const translated = await translateText(text, 'ja', 'zh-TW');
                    const label = document.createElement('div');
                    label.className = 'trans-label';
                    label.textContent = translated;

                    const { x0, y0, x1, y1 } = line.bbox;
                    const imgWidth = sourceImage.naturalWidth;
                    const imgHeight = sourceImage.naturalHeight;

                    label.style.left = `${(x0 / imgWidth) * 100}%`;
                    label.style.top = `${(y0 / imgHeight) * 100}%`;
                    label.style.width = `${((x1 - x0) / imgWidth) * 100}%`;
                    label.style.height = `${((y1 - y0) / imgHeight) * 100}%`;

                    label.onclick = (event) => {
                        event.stopPropagation();
                        speakText(translated, 'zh-TW');
                    };
                    labelLayer.appendChild(label);
                }
            }
            statusMessage.textContent = '辨識完畢';
        } catch (error) {
            console.error('OCR Error:', error);
            showError(`辨識失敗: ${error.message}`);
        } finally {
            statusMessage.classList.remove('recording');
            imageInput.value = '';
        }
    });

    async function callGeminiVision(file) {
        const base64Image = await fileToBase64(file);
        statusMessage.textContent = '偵測 API 權限中...';

        try {
            // STEP 1: 先找出這組 Key 到底能用哪些型號
            console.log('[v2.6] 正在向 Google 查詢您的可用模型...');
            const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
            const mResponse = await fetch(modelsUrl);
            const mData = await mResponse.json();

            if (!mData.models || mData.models.length === 0) {
                throw new Error('此 API Key 找不到任何可用模型，請確認已在 Google AI Studio 開通權限。');
            }

            const availableNames = mData.models.map(m => m.name.replace('models/', ''));
            console.log('您的權限清單:', availableNames);

            // STEP 2: 從清單中找出適合「視覺辨識」的型號 (優先順序)
            const candidates = [
                'gemini-1.5-flash',
                'gemini-2.0-flash-exp',
                'gemini-1.5-flash-latest',
                'gemini-1.5-flash-8b',
                'gemini-1.5-pro'
            ];

            let bestModel = '';
            for (const c of candidates) {
                if (availableNames.includes(c)) {
                    bestModel = c;
                    break;
                }
            }

            // 如果都沒在名單內，就硬抓清單裡第一個有 flash 字眼的，再不然就抓第一個
            if (!bestModel) {
                bestModel = availableNames.find(n => n.includes('flash')) || availableNames[0];
            }

            console.log(`🎯 自動選定最佳模型: ${bestModel}`);
            statusMessage.textContent = `使用 AI 模型: ${bestModel}`;

            // STEP 3: 使用選定的模型進行翻譯
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${bestModel}:generateContent?key=${GEMINI_API_KEY}`;
            const prompt = `
                ACT AS A PRECISE OCR SCANNER. 
                1. Identify all Japanese text in the image.
                2. For each text item, find its PRECISE bounding box.
                Return a JSON object:
                {
                  "rawText": "full text summary",
                  "lines": [
                    {
                      "original": "Japanese text",
                      "translated": "Traditional Chinese",
                      "box": [ymin, xmin, ymax, xmax] 
                    }
                  ]
                }
                *Coordinates 0-1000.* RETURN ONLY JSON.
            `;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inline_data: { mime_type: file.type, data: base64Image.split(',')[1] } }
                        ]
                    }]
                })
            });

            const data = await response.json();
            if (response.ok && data.candidates) {
                const textResponse = data.candidates[0].content.parts[0].text;
                const startIdx = textResponse.indexOf('{');
                const endIdx = textResponse.lastIndexOf('}');
                if (startIdx !== -1) {
                    console.log('✅ AI 辨識成功！');
                    return JSON.parse(textResponse.substring(startIdx, endIdx + 1));
                }
            }

            const errMsg = data.error ? data.error.message : 'AI 回應不完整';
            throw new Error(`${bestModel} 回報錯誤: ${errMsg}`);

        } catch (e) {
            console.error('Gemini 失敗:', e);
            throw e;
        }
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
});
