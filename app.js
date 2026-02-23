document.addEventListener('DOMContentLoaded', () => {
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
                // --- 使用強大的 Google Gemini AI ---
                statusMessage.textContent = '呼叫 Google Gemini AI...';
                const result = await callGeminiVision(file);

                if (!result || result.lines.length === 0) {
                    showError('Gemini 辨識不到文字。');
                    return;
                }

                debugRawText.textContent = `[Gemini AI 模式]\n${result.rawText}`;
                labelLayer.innerHTML = '';
                const imgWidth = sourceImage.naturalWidth;
                const imgHeight = sourceImage.naturalHeight;

                for (const line of result.lines) {
                    const label = document.createElement('div');
                    label.className = 'trans-label';
                    label.textContent = line.translated;

                    // Gemini 回傳的是正規化座標 (0-1000)
                    label.style.left = `${(line.box[1] / 1000) * 100}%`;
                    label.style.top = `${(line.box[0] / 1000) * 100}%`;
                    label.style.width = `${((line.box[3] - line.box[1]) / 1000) * 100}%`;
                    label.style.height = `${((line.box[2] - line.box[0]) / 1000) * 100}%`;

                    label.onclick = (event) => {
                        event.stopPropagation();
                        speakText(line.translated, 'zh-TW');
                    };
                    labelLayer.appendChild(label);
                }
            } else {
                // --- 傳統 Tesseract.js Fallback ---
                // 使用 Tesseract.js 的簡化用法，並確保明確指定日文
                const result = await Tesseract.recognize(
                    file,
                    'jpn',
                    {
                        logger: m => {
                            if (m.status === 'loading language traineddata') statusMessage.textContent = '載入辨識引擎...';
                            if (m.status === 'recognizing text') statusMessage.textContent = `辨識中: ${Math.round(m.progress * 100)}%`;
                        }
                    }
                );

                const data = result.data;
                if (!data || !data.text || data.text.trim().length === 0) {
                    showError('找不到文字。提示：您可以設定 Gemini API Key 來提升辨識力！');
                    return;
                }

                debugRawText.textContent = data.text;
                labelLayer.innerHTML = '';
                const imgWidth = sourceImage.naturalWidth;
                const imgHeight = sourceImage.naturalHeight;

                for (const line of data.lines) {
                    const text = line.text.replace(/\s+/g, '').trim();
                    if (text.length < 1) continue;
                    const translated = await translateText(text, 'ja', 'zh-TW');
                    const label = document.createElement('div');
                    label.className = 'trans-label';
                    label.textContent = translated;
                    const { x0, y0, x1, y1 } = line.bbox;
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

            statusMessage.textContent = '分析完畢';
            addMessageToChat('[圖片翻譯]', '已更新為最新的辨識結果。', 'ja');

        } catch (error) {
            console.error('OCR Error:', error);
            showError(`辨識失敗: ${error.message}`);
        } finally {
            statusMessage.classList.remove('recording');
            imageInput.value = '';
        }
    });

    // 呼叫 Gemini API 的核心邏輯
    async function callGeminiVision(file) {
        const base64Image = await fileToBase64(file);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const prompt = `
            Analyze this menu or sign in Japanese. 
            Identify all Japanese text items and their locations.
            Return a JSON object with:
            1. "rawText": all text found.
            2. "lines": an array of objects, each with:
               "original": full Japanese line,
               "translated": Traditional Chinese translation,
               "box": [ymin, xmin, ymax, xmax] coordinates normalized to 1000.
            Strictly return ONLY JSON.
        `;

        try {
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

            if (!response.ok) {
                const errData = await response.json();
                const msg = errData.error ? errData.error.message : '未知連線錯誤';
                throw new Error(`Google API 錯誤: ${msg}`);
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;

            // 更強大的 JSON 擷取邏輯：尋找第一個 { 和最後一個 }
            const startIdx = textResponse.indexOf('{');
            const endIdx = textResponse.lastIndexOf('}');

            if (startIdx === -1 || endIdx === -1) {
                console.error('Gemini raw response:', textResponse);
                throw new Error('AI 回應格式錯誤，請再試一次。');
            }

            const jsonStr = textResponse.substring(startIdx, endIdx + 1);
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Gemini error:', e);
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
