document.addEventListener('DOMContentLoaded', () => {
    const APP_VERSION = 'v5.2';
    // 版本標籤：v5.2 (動態目標語言切換：日文/英文)
    console.log(`--- 翻譯助手 ${APP_VERSION} ---`);
    const versionDisplay = document.getElementById('versionDisplay');
    if (versionDisplay) versionDisplay.textContent = `程式版本: ${APP_VERSION}`;

    const statusMessage = document.getElementById('statusMessage');
    const chatContainer = document.getElementById('chatContainer');
    const btnSpeakZh = document.getElementById('btnSpeakZh');
    const btnSpeakJa = document.getElementById('btnSpeakJa');

    // 檢查瀏覽器支援
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (!SpeechRecognition) {
        showError('您的瀏覽器不支援語音辨識。請使用 Google Chrome 或 Safari。');
        btnSpeakZh.disabled = true;
        btnSpeakJa.disabled = true;
        return;
    } else {
        recognition = new SpeechRecognition();
        recognition.continuous = false; // 每次對話結束就停止
        recognition.interimResults = false; // 只取最終結果
    }

    let currentSourceLang = '';
    let currentTargetLang = '';
    let GEMINI_API_KEY = localStorage.getItem('GEMINI_API_KEY') || '';
    let MAIN_TARGET_LANG = localStorage.getItem('MAIN_TARGET_LANG') || 'ja';

    // 設定視窗邏輯
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const manualInput = document.getElementById('manualInput');
    const btnSendText = document.getElementById('btnSendText');

    btnSettings.onclick = () => {
        apiKeyInput.value = GEMINI_API_KEY;
        document.getElementById('targetLangInput').value = MAIN_TARGET_LANG;
        settingsModal.style.display = 'flex';
    };

    closeSettings.onclick = () => {
        settingsModal.style.display = 'none';
    };

    btnSaveSettings.onclick = () => {
        GEMINI_API_KEY = apiKeyInput.value.trim();
        MAIN_TARGET_LANG = document.getElementById('targetLangInput').value;
        localStorage.setItem('GEMINI_API_KEY', GEMINI_API_KEY);
        localStorage.setItem('MAIN_TARGET_LANG', MAIN_TARGET_LANG);
        updateButtonsUI(); // 更新按鈕文字 (v5.2)
        settingsModal.style.display = 'none';
        alert('設定已儲存！');
    };

    // 更新按鈕 UI 文字函式 (v5.2)
    function updateButtonsUI() {
        const btnSpeakJaText = document.getElementById('btnSpeakJaText');
        const btnCameraText = document.getElementById('btnCameraText');
        if (MAIN_TARGET_LANG === 'ja') {
            if (btnSpeakJaText) btnSpeakJaText.innerHTML = '對方說日文<br><small>(日本語を話す)</small>';
            if (btnCameraText) btnCameraText.innerHTML = '圖片翻譯<br><small>(OCR/日文)</small>';
        } else {
            if (btnSpeakJaText) btnSpeakJaText.innerHTML = '對方說英文<br><small>(Speak English)</small>';
            if (btnCameraText) btnCameraText.innerHTML = '圖片翻譯<br><small>(OCR/英文)</small>';
        }
    }
    updateButtonsUI(); // 初始化執行一次

    // 手動文字輸入翻譯邏輯 (v3.5)
    async function handleManualTranslation() {
        const text = manualInput.value.trim();
        if (!text) return;

        manualInput.value = '';
        statusMessage.textContent = '翻譯中...';

        // 根據設定決定目標語言 (v5.1)
        const translatedText = await translateText(text, 'zh-TW', MAIN_TARGET_LANG);
        addMessageToChat(text, translatedText, 'zh');

        statusMessage.textContent = '準備就緒';
        // 翻譯完立即自動朗讀
        speakText(translatedText, MAIN_TARGET_LANG);
    }

    btnSendText.onclick = handleManualTranslation;
    manualInput.onkeypress = (e) => {
        if (e.key === 'Enter') handleManualTranslation();
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
            if (lang === 'ja') utterance.lang = 'ja-JP';
            else if (lang === 'en') utterance.lang = 'en-US';
            else utterance.lang = 'zh-TW';
            // 稍微放慢語速，讓長輩或對方聽得更清楚
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    // 更新 UI 顯示對話
    function addMessageToChat(originalText, translatedText, type) {
        const msgDiv = document.createElement('div');
        // type: zh, ja, en
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
            let targetLang = 'zh-TW';
            if (type === 'zh') targetLang = MAIN_TARGET_LANG; // 使用設定的語言 (v5.1)
            else if (type === 'ja') targetLang = 'zh-TW';
            else if (type === 'en') targetLang = 'ja';
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
    if (recognition) {
        recognition.onresult = async (event) => {
            const text = event.results[0][0].transcript;
            statusMessage.textContent = '辨識完成，準備翻譯...';
            statusMessage.classList.remove('recording');

            // 決定翻譯方向
            let langCodeSource = currentSourceLang;
            let langCodeTarget = '';
            let uiType = '';

            if (langCodeSource === 'zh-TW') {
                langCodeTarget = MAIN_TARGET_LANG;
                uiType = 'zh';
            } else {
                // 如果不是中文，則代表是「對方說話」(可能是日/英)，統一翻譯回中文
                langCodeTarget = 'zh-TW';
                uiType = (langCodeSource === 'ja-JP') ? 'ja' : 'en';
            }

            const translatedText = await translateText(text, langCodeSource, langCodeTarget);

            addMessageToChat(text, translatedText, uiType);
            statusMessage.textContent = '準備就緒';

            // 朗讀翻譯結果
            speakText(translatedText, langCodeTarget);
        };
    }

    if (recognition) {
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
    }

    if (recognition) {
        recognition.onend = () => {
            statusMessage.classList.remove('recording');
            btnSpeakZh.classList.remove('active');
            btnSpeakJa.classList.remove('active');
        };
    }

    // 綁定按鈕事件
    function startRecording(lang, langCode, btnElement) {
        if (!recognition) return;
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
        const lang = MAIN_TARGET_LANG === 'ja' ? 'ja-JP' : 'en-US';
        const type = MAIN_TARGET_LANG === 'ja' ? 'ja' : 'en';
        startRecording(lang, type, btnSpeakJa);
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
                const ocrLang = MAIN_TARGET_LANG === 'ja' ? 'jpn' : 'eng';
                statusMessage.textContent = `使用本地辨識 (${ocrLang})...`;
                const result = await Tesseract.recognize(file, ocrLang, {
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
            const targetName = MAIN_TARGET_LANG === 'ja' ? 'Japanese' : 'English';
            const prompt = `
                    ACT AS A PRECISE OCR SCANNER. 
                    1. Identify all ${targetName} text in the image.
                    2. For each text item, find its PRECISE bounding box.
                    Return a JSON object:
                    {
                      "rawText": "full text summary",
                      "lines": [
                        {
                          "original": "${targetName} text",
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

    // --- 旅遊工具箱邏輯 (v4.0) ---
    const btnToolbox = document.getElementById('btnToolbox');
    const toolboxModal = document.getElementById('toolboxModal');
    const closeToolbox = document.getElementById('closeToolbox');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // 開關模態視窗
    if (btnToolbox && toolboxModal) {
        btnToolbox.onclick = () => {
            toolboxModal.style.display = 'flex';
            updateHistoryList();
            loadEmergencyInfo();
            updateExchangeRate();
        };
    }

    if (closeToolbox && toolboxModal) {
        closeToolbox.onclick = () => {
            toolboxModal.style.display = 'none';
        };
    }

    // 分頁切換
    tabBtns.forEach(btn => {
        btn.onclick = () => {
            const target = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const panel = document.getElementById(`${target}Panel`);
            if (panel) panel.classList.add('active');
        };
    });

    // 常用語邏輯
    const phraseBtns = document.querySelectorAll('.phrase-btn');
    phraseBtns.forEach(btn => {
        btn.onclick = async () => {
            const text = btn.textContent;
            statusMessage.textContent = '翻譯常用語...';
            const translated = await translateText(text, 'zh-TW', 'ja');
            addMessageToChat(text, translated, 'zh');
            speakText(translated, 'ja');
            statusMessage.textContent = '準備就緒';
            // saveToHistory(text, translated); // 已在 addMessageToChat 內存過，此處刪除以免重複存檔
        };
    });

    // 救急卡邏輯
    const btnSaveEmergency = document.getElementById('btnSaveEmergency');
    const emergencyPreview = document.getElementById('emergencyPreview');

    function loadEmergencyInfo() {
        const info = JSON.parse(localStorage.getItem('EMERGENCY_INFO') || '{}');
        const nameInp = document.getElementById('infoName');
        const medInp = document.getElementById('infoMedical');
        const phoneInp = document.getElementById('infoPhone');
        if (nameInp) nameInp.value = info.name || '';
        if (medInp) medInp.value = info.medical || '';
        if (phoneInp) phoneInp.value = info.phone || '';
        updateEmergencyPreview(info);
    }

    function updateEmergencyPreview(info) {
        const preview = document.getElementById('emergencyPreview');
        if (!preview) return;
        if (!info.name && !info.medical && !info.phone) {
            preview.innerHTML = '<p style="color:#888; text-align:center;">尚未填寫資訊</p>';
            return;
        }
        preview.innerHTML = `
            <h3 style="margin-bottom:10px; border-bottom:2px solid #e74c3c; padding-bottom:5px;">本人確認卡 (Emergency Card)</h3>
            <p><strong>氏名 (Name):</strong> ${info.name}</p>
            <p><strong>持病/アレルギー (Medical):</strong> ${info.medical}</p>
            <p><strong>緊急連絡先 (Contact):</strong> ${info.phone}</p>
            <p style="margin-top:10px; font-size:0.8rem; color:#888;">* 遭遇緊急狀況時，請將此畫面出示給醫護人員或警方。</p>
        `;
    }

    if (btnSaveEmergency) {
        btnSaveEmergency.onclick = () => {
            const info = {
                name: document.getElementById('infoName')?.value.trim() || '',
                medical: document.getElementById('infoMedical')?.value.trim() || '',
                phone: document.getElementById('infoPhone')?.value.trim() || ''
            };
            localStorage.setItem('EMERGENCY_INFO', JSON.stringify(info));
            updateEmergencyPreview(info);
            alert('資訊已儲存！');
        };
    }

    // 匯率邏輯 (簡單台幣轉日幣)
    const twdInput = document.getElementById('twdAmount');
    const jpyInput = document.getElementById('jpyAmount');
    const currentRateDisp = document.getElementById('currentRateDisp');
    const btnRefreshRate = document.getElementById('btnRefreshRate');
    let currentRate = 4.65; // 預設匯率

    async function updateExchangeRate() {
        const rateDisp = document.getElementById('currentRateDisp');
        if (rateDisp) rateDisp.textContent = '正在獲取最新匯率...';
        try {
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/TWD');
            const data = await res.json();
            currentRate = data.rates.JPY;
            if (rateDisp) rateDisp.textContent = `當前匯率: 1 TWD = ${currentRate.toFixed(2)} JPY`;
        } catch (e) {
            if (rateDisp) rateDisp.textContent = `無法讀取匯率，使用暫存匯率: 1 TWD = ${currentRate} JPY`;
        }
    }

    if (twdInput) {
        twdInput.oninput = () => {
            if (jpyInput) jpyInput.value = (twdInput.value * currentRate).toFixed(0);
        };
    }

    if (jpyInput) {
        jpyInput.oninput = () => {
            if (twdInput) twdInput.value = (jpyInput.value / currentRate).toFixed(0);
        };
    }

    if (btnRefreshRate) btnRefreshRate.onclick = updateExchangeRate;

    // 歷史紀錄邏輯
    function saveToHistory(orig, trans) {
        let history = JSON.parse(localStorage.getItem('TRANS_HISTORY') || '[]');
        history.unshift({ orig, trans, time: new Date().toLocaleTimeString() });
        history = history.slice(0, 20); // 只留最近 20 筆
        localStorage.setItem('TRANS_HISTORY', JSON.stringify(history));
    }

    function updateHistoryList() {
        const historyList = document.getElementById('historyList');
        const history = JSON.parse(localStorage.getItem('TRANS_HISTORY') || '[]');

        if (history.length === 0) {
            historyList.innerHTML = '<p style="color:#888; text-align:center;">尚無歷史紀錄</p>';
            return;
        }

        historyList.innerHTML = '';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.style.borderLeftColor = '#3498db';
            div.innerHTML = `
                <div class="item-text">
                    <div class="orig"></div>
                    <div class="trans"></div>
                </div>
                <button class="play-btn">🔊</button>
            `;
            div.querySelector('.orig').textContent = `${item.orig} (${item.time})`;
            div.querySelector('.trans').textContent = item.trans;
            div.querySelector('.play-btn').onclick = () => window.speakTextFromHistory(item.trans);
            historyList.appendChild(div);
        });
    }

    // 為了讓 HTML 內的 onclick 能呼叫到 speakText
    window.speakTextFromHistory = (text) => {
        speakText(text, 'ja');
    };

    document.getElementById('btnClearHistory').onclick = () => {
        if (confirm('確定要清除所有翻譯歷史嗎？')) {
            localStorage.setItem('TRANS_HISTORY', '[]');
            updateHistoryList();
        }
    };

    // 修改原有的 addMessageToChat 以便存入歷史
    const originalAddMessageToChat = addMessageToChat;
    addMessageToChat = (originalText, translatedText, type) => {
        originalAddMessageToChat(originalText, translatedText, type);
        saveToHistory(originalText, translatedText);
    };
});
